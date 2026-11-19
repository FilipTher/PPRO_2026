import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { prisma } from '../src/prisma';

const stamp = Date.now();
const code = `TEST-INTEGRITY-${stamp}`;

let productId: number;
let stockId: number;
let warehouseId: number;

describe('Databázová integrita (CHECK constraints)', () => {
  beforeAll(async () => {
    const product = await prisma.product.create({
      data: { code, name: 'Test integrity', purchasePrice: 10, sellingPrice: 20 }
    });
    productId = product.id;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ orderBy: { id: 'asc' } });
    warehouseId = warehouse.id;

    const stock = await prisma.warehouseStock.create({
      data: { productId, warehouseId, physicalQuantity: 5, reservedQuantity: 2 }
    });
    stockId = stock.id;
  });

  afterAll(async () => {
    await prisma.warehouseStock.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { code } });
    await prisma.$disconnect();
  });

  it('databáze odmítne záporný fyzický stav', async () => {
    await expect(
      prisma.warehouseStock.update({ where: { id: stockId }, data: { physicalQuantity: -1 } })
    ).rejects.toThrow();
  });

  it('databáze odmítne zápornou rezervaci', async () => {
    await expect(
      prisma.warehouseStock.update({ where: { id: stockId }, data: { reservedQuantity: -1 } })
    ).rejects.toThrow();
  });

  it('databáze odmítne rezervaci vyšší, než je fyzický stav', async () => {
    await expect(
      prisma.warehouseStock.update({ where: { id: stockId }, data: { reservedQuantity: 6 } })
    ).rejects.toThrow();
  });

  it('platný stav zůstává povolený', async () => {
    const updated = await prisma.warehouseStock.update({
      where: { id: stockId },
      data: { physicalQuantity: 5, reservedQuantity: 5 }
    });
    expect(updated.reservedQuantity).toBe(5);
  });
});
