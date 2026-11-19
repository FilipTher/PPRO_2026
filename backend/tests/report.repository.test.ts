import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../src/prisma';
import { PrismaReportRepository } from '../src/repositories/report.repository';

const repository = new PrismaReportRepository(prisma);
const stamp = Date.now();
const categoryAName = `TEST-REPORT-A-${stamp}`;
const categoryBName = `TEST-REPORT-B-${stamp}`;
const productCode = `TEST-REPORT-${stamp}`;
const customerEmail = `test-report-${stamp}@example.com`;

let productId: number;
let customerId: number;
let warehouseId: number;

const from = new Date(Date.UTC(2026, 2, 1)); // 1. 3. 2026
const to = new Date(Date.UTC(2026, 3, 1)); // 1. 4. 2026

describe('Report repository (obrat jen z expedovaných objednávek)', () => {
  beforeAll(async () => {
    const categoryA = await prisma.category.create({
      data: { name: categoryAName, description: 'Testovací kategorie A' }
    });
    const categoryB = await prisma.category.create({
      data: { name: categoryBName, description: 'Testovací kategorie B' }
    });

    const product = await prisma.product.create({
      data: {
        code: productCode,
        name: 'Testovací hračka pro report',
        purchasePrice: 100,
        sellingPrice: 199
      }
    });
    productId = product.id;

    await prisma.productCategory.createMany({
      data: [
        { productId, categoryId: categoryA.id },
        { productId, categoryId: categoryB.id }
      ]
    });

    const customer = await prisma.customer.create({
      data: {
        name: 'Report Zákazník',
        email: customerEmail,
        phone: '+420 111 222 333',
        street: 'Testovací 1',
        city: 'Hradec Králové',
        zip: '500 01'
      }
    });
    customerId = customer.id;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ orderBy: { id: 'asc' } });
    warehouseId = warehouse.id;

    // Expedováno v březnu -> počítá se (2 ks x 199 = 398)
    await prisma.order.create({
      data: {
        orderNumber: `ORD-REPORT-IN-${stamp}`,
        customerId,
        status: 'SHIPPED',
        shippedAt: new Date(Date.UTC(2026, 2, 15, 10, 0, 0)),
        items: {
          create: [{ productId, warehouseId, quantity: 2, unitPrice: 199 }]
        }
      }
    });

    // Expedováno v únoru -> mimo rozsah
    await prisma.order.create({
      data: {
        orderNumber: `ORD-REPORT-OUT-${stamp}`,
        customerId,
        status: 'SHIPPED',
        shippedAt: new Date(Date.UTC(2026, 1, 20, 10, 0, 0)),
        items: {
          create: [{ productId, warehouseId, quantity: 5, unitPrice: 199 }]
        }
      }
    });

    // Rezervováno, nikdy neexpedováno -> nesmí se počítat
    await prisma.order.create({
      data: {
        orderNumber: `ORD-REPORT-RESERVED-${stamp}`,
        customerId,
        status: 'RESERVED',
        items: {
          create: [{ productId, warehouseId, quantity: 3, unitPrice: 199 }]
        }
      }
    });

    // Změna ceníku po prodeji nesmí obrat přepsat (cena je zafixovaná v položce)
    await prisma.product.update({ where: { id: productId }, data: { sellingPrice: 999 } });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.productCategory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { name: { in: [categoryAName, categoryBName] } } });
    await prisma.$disconnect();
  });

  it('měl by započítat jen expedované objednávky v daném měsíci', async () => {
    const summary = await repository.getShippedRevenue(from, to);

    expect(summary.totalRevenue).toBe(398);
    expect(summary.totalQuantity).toBe(2);
  });

  it('měl by použít zafixovanou cenu položky, ne aktuální ceník', async () => {
    const summary = await repository.getShippedRevenue(from, to);

    // 2 ks x 199 (ne 2 x 999 po změně ceníku)
    expect(summary.totalRevenue).toBe(398);
  });

  it('měl by produkt ve dvou kategoriích započítat do obou', async () => {
    const summary = await repository.getShippedRevenue(from, to);

    expect(summary.categories).toHaveLength(2);
    expect(summary.categories.map((c) => c.categoryName).sort()).toEqual(
      [categoryAName, categoryBName].sort()
    );
    for (const category of summary.categories) {
      expect(category.revenue).toBe(398);
      expect(category.quantity).toBe(2);
    }
  });

  it('měl by vrátit prázdný souhrn pro měsíc bez expedic', async () => {
    const summary = await repository.getShippedRevenue(
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 1, 1))
    );

    expect(summary.totalRevenue).toBe(0);
    expect(summary.totalQuantity).toBe(0);
    expect(summary.categories).toHaveLength(0);
  });
});
