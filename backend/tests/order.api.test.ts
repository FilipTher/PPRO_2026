import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const stamp = Date.now();
const testCode = `TEST-ORDER-${stamp}`;
const testEmail = `test-objednavka-${stamp}@example.com`;

let productId: number;
let hkId: number;
let trbId: number;
let orderId: number;

const customer = {
  name: 'Petr Testovací',
  email: testEmail,
  phone: '+420 606 111 222',
  street: 'Dřevěná 5',
  city: 'Třebechovice pod Orebem',
  zip: '503 46'
};

describe('Orders API (životní cyklus objednávky nad SQLite)', () => {
  beforeAll(async () => {
    const product = await request(app).post('/api/products').send({
      code: testCode,
      name: 'Testovací vláček pro objednávky',
      purchasePrice: 100,
      sellingPrice: 199
    });
    productId = product.body.data.id;

    const warehouses = (await request(app).get('/api/stock/warehouses')).body.data as {
      id: number;
      code: string;
    }[];
    hkId = warehouses.find((w) => w.code === 'WH-HK')!.id;
    trbId = warehouses.find((w) => w.code === 'WH-TRB')!.id;

    await request(app).post('/api/stock/receipt').send({ productId, warehouseId: hkId, quantity: 10 });
    await request(app).post('/api/stock/receipt').send({ productId, warehouseId: trbId, quantity: 5 });
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({ where: { customer: { email: testEmail } } });
    const orderIds = orders.map((o) => o.id);

    await prisma.stockMovement.deleteMany({
      where: { OR: [{ productId }, { orderId: { in: orderIds } }] }
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { email: testEmail } });
    await prisma.warehouseStock.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { code: testCode } });
    await prisma.$disconnect();
  });

  it('POST /api/orders by měl odmítnout objednávku bez zásob (400)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customer, items: [{ productId, warehouseId: hkId, quantity: 1000 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Nedostatek zásob');
  });

  it('POST /api/orders by měl odmítnout neplatné tělo požadavku (400)', async () => {
    const res = await request(app).post('/api/orders').send({ customer, items: 'neco' });
    expect(res.status).toBe(400);
  });

  it('POST /api/orders by měl založit rezervovanou objednávku se zafixovanou cenou', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customer, items: [{ productId, warehouseId: hkId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('RESERVED');
    expect(res.body.data.customer.email).toBe(testEmail);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].unitPrice).toBe(199);
    expect(res.body.data.items[0].warehouse.code).toBe('WH-HK');

    orderId = res.body.data.id;
  });

  it('GET /api/orders by měl filtrovat podle stavu', async () => {
    const reserved = await request(app).get('/api/orders?status=RESERVED');
    const shipped = await request(app).get('/api/orders?status=SHIPPED');

    expect(reserved.status).toBe(200);
    expect(reserved.body.data.some((o: { id: number }) => o.id === orderId)).toBe(true);
    expect(shipped.body.data.some((o: { id: number }) => o.id === orderId)).toBe(false);
  });

  it('GET /api/customers by měl vrátit zákazníka založeného objednávkou', async () => {
    const res = await request(app).get('/api/customers');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(
      res.body.data.some((c: { email: string }) => c.email === testEmail)
    ).toBe(true);
  });

  it('GET /api/orders by měl odmítnout neplatný stav (400)', async () => {
    const res = await request(app).get('/api/orders?status=NEEXISTUJE');
    expect(res.status).toBe(400);
  });

  it('GET /api/orders/:id by měl vrátit detail se zákazníkem a položkami', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('Petr Testovací');
    expect(res.body.data.items[0].product.code).toBe(testCode);
  });

  it('GET /api/orders/:id by měl vrátit 404 pro neexistující objednávku', async () => {
    const res = await request(app).get('/api/orders/999999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/orders/:id/items by měl přepočítat rezervace (přesun mezi sklady)', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items`)
      .send({
        items: [
          { productId, warehouseId: hkId, quantity: 1 },
          { productId, warehouseId: trbId, quantity: 2 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.map((i: { warehouse: { code: string } }) => i.warehouse.code).sort()).toEqual([
      'WH-HK',
      'WH-TRB'
    ]);

    const overview = (await request(app).get('/api/stock/overview')).body.data as {
      productId: number;
      stocks: { warehouseCode: string; reservedQuantity: number }[];
    }[];
    const item = overview.find((o) => o.productId === productId)!;
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-HK')!.reservedQuantity).toBe(1);
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-TRB')!.reservedQuantity).toBe(2);
  });

  it('PUT /api/orders/:id/items by měl odmítnout navýšení nad zásoby a zachovat rezervace', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items`)
      .send({ items: [{ productId, warehouseId: hkId, quantity: 100 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Nedostatek zásob');

    const overview = (await request(app).get('/api/stock/overview')).body.data as {
      productId: number;
      stocks: { warehouseCode: string; reservedQuantity: number }[];
    }[];
    const item = overview.find((o) => o.productId === productId)!;
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-HK')!.reservedQuantity).toBe(1);
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-TRB')!.reservedQuantity).toBe(2);
  });

  it('POST /api/orders/:id/ship by měl odepsat zásoby z obou skladů a zapsat DISPATCH', async () => {
    const res = await request(app).post(`/api/orders/${orderId}/ship`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SHIPPED');
    expect(res.body.data.shippedAt).toBeTruthy();

    const overview = (await request(app).get('/api/stock/overview')).body.data as {
      productId: number;
      stocks: { warehouseCode: string; physicalQuantity: number; reservedQuantity: number }[];
    }[];
    const item = overview.find((o) => o.productId === productId)!;
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-HK')!.physicalQuantity).toBe(9);
    expect(item.stocks.find((s) => s.warehouseCode === 'WH-TRB')!.physicalQuantity).toBe(3);
    expect(item.stocks.every((s) => s.reservedQuantity === 0)).toBe(true);

    const movements = await request(app).get(`/api/stock/movements?orderId=${orderId}`);
    expect(movements.body.data).toHaveLength(2);
    expect(movements.body.data.every((m: { movementType: string }) => m.movementType === 'DISPATCH')).toBe(true);
  });

  it('POST /api/orders/:id/cancel by měl odmítnout storno expedované objednávky (400)', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .send({ reason: 'Pozdní storno' });

    expect(res.status).toBe(400);
  });

  it('POST /api/orders/:id/cancel by měl uvolnit rezervaci a nastavit CANCELLED', async () => {
    const created = await request(app)
      .post('/api/orders')
      .send({ customer, items: [{ productId, warehouseId: hkId, quantity: 3 }] });
    const newOrderId = created.body.data.id;

    const res = await request(app)
      .post(`/api/orders/${newOrderId}/cancel`)
      .send({ reason: 'Zákazník nezaplatil' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    // Důvod storna se ukládá kvůli dohledatelnosti
    expect(res.body.data.cancelReason).toBe('Zákazník nezaplatil');

    const overview = (await request(app).get('/api/stock/overview')).body.data as {
      productId: number;
      stocks: { warehouseCode: string; physicalQuantity: number; reservedQuantity: number }[];
    }[];
    const item = overview.find((o) => o.productId === productId)!;
    const hk = item.stocks.find((s) => s.warehouseCode === 'WH-HK')!;
    expect(hk.reservedQuantity).toBe(0);
    expect(hk.physicalQuantity).toBe(9);
  });

  it('POST /api/orders/:id/cancel by měl vyžadovat důvod (400)', async () => {
    const created = await request(app)
      .post('/api/orders')
      .send({ customer, items: [{ productId, warehouseId: hkId, quantity: 1 }] });

    const res = await request(app).post(`/api/orders/${created.body.data.id}/cancel`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Důvod storna je povinný');
  });
});
