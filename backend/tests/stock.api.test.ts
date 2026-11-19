import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const testCode = `TEST-STOCK-${Date.now()}`;
let productId: number;
let hkId: number;
let trbId: number;

type OverviewItem = {
  productId: number;
  productCode: string;
  minStockLimit: number;
  stocks: { warehouseCode: string; physicalQuantity: number; reservedQuantity: number; availableQuantity: number }[];
  totalPhysicalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  isLowStock: boolean;
};

type Movement = {
  movementType: string;
  quantityChange: number;
  quantityAfter: number;
  reason: string | null;
  productId: number;
};

describe('Stock API (zásoby, pohyby a skladové operace ze SQLite)', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        code: testCode,
        name: 'Testovací káča pro skladové operace',
        purchasePrice: 50,
        sellingPrice: 100
      });
    productId = res.body.data.id;

    const warehouses = (await request(app).get('/api/stock/warehouses')).body.data as {
      id: number;
      code: string;
    }[];
    hkId = warehouses.find((w) => w.code === 'WH-HK')!.id;
    trbId = warehouses.find((w) => w.code === 'WH-TRB')!.id;
  });

  afterAll(async () => {
    // Úklid: pohyby a skladové karty blokují smazání produktu (FK), mažou se první
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.warehouseStock.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { code: testCode } });
    await prisma.$disconnect();
  });

  describe('GET /api/stock/overview', () => {
    it('by měl vrátit zásoby produktů ze seedu', async () => {
      const res = await request(app).get('/api/stock/overview');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('měla by u každého produktu být zásoba na obou skladech (HK i garáž)', async () => {
      const res = await request(app).get('/api/stock/overview');
      const items = res.body.data as OverviewItem[];

      for (const item of items) {
        expect(item.stocks).toHaveLength(2);
        expect(item.stocks.map((s) => s.warehouseCode).sort()).toEqual(['WH-HK', 'WH-TRB']);
      }
    });

    it('měla by sedět čísla ze seedu pro produkt KACA-BUK-01 (15 ks HK + 5 ks Třebechovice)', async () => {
      const res = await request(app).get('/api/stock/overview');
      const item = (res.body.data as OverviewItem[]).find((i) => i.productCode === 'KACA-BUK-01');

      expect(item).toBeDefined();
      const hk = item!.stocks.find((s) => s.warehouseCode === 'WH-HK')!;
      const trebechovice = item!.stocks.find((s) => s.warehouseCode === 'WH-TRB')!;

      expect(hk.physicalQuantity).toBe(15);
      expect(trebechovice.physicalQuantity).toBe(5);
      expect(item!.totalPhysicalQuantity).toBe(20);
      // Seed drží rezervaci 2 ks pro objednávku k expedici – disponibilní stav se dopočítá
      expect(item!.totalAvailableQuantity).toBe(
        item!.totalPhysicalQuantity - item!.totalReservedQuantity
      );
      // minimum je 10 ks, celkem 20 ks -> není pod minimem
      expect(item!.isLowStock).toBe(false);
    });

    it('měla by správně počítat disponibilní stav jako fyzický - rezervovaný', async () => {
      const res = await request(app).get('/api/stock/overview');
      const items = res.body.data as OverviewItem[];

      for (const item of items) {
        for (const stock of item.stocks) {
          expect(stock.availableQuantity).toBe(stock.physicalQuantity - stock.reservedQuantity);
        }
        expect(item.totalAvailableQuantity).toBe(item.totalPhysicalQuantity - item.totalReservedQuantity);
      }
    });
  });

  describe('GET /api/stock/warehouses', () => {
    it('by měl vrátit oba sklady Dřevěnky', async () => {
      const res = await request(app).get('/api/stock/warehouses');

      expect(res.status).toBe(200);
      expect(res.body.data.map((w: { code: string }) => w.code).sort()).toEqual(['WH-HK', 'WH-TRB']);
    });
  });

  describe('POST /api/stock/receipt', () => {
    it('by měl naskladnit 10 ks do Hradce a zapsat pohyb RECEIPT', async () => {
      const res = await request(app)
        .post('/api/stock/receipt')
        .send({ productId, warehouseId: hkId, quantity: 10, reason: 'Dodávka od truhláře' });

      expect(res.status).toBe(201);
      expect(res.body.data.warehouseStock.physicalQuantity).toBe(10);
      expect(res.body.data.warehouseStock.availableQuantity).toBe(10);
      expect(res.body.data.movement.movementType).toBe('RECEIPT');
      expect(res.body.data.movement.quantityChange).toBe(10);
      expect(res.body.data.movement.quantityAfter).toBe(10);
    });

    it('by měl odmítnout nulové množství (400)', async () => {
      const res = await request(app)
        .post('/api/stock/receipt')
        .send({ productId, warehouseId: hkId, quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('by měl vrátit 404 pro neexistující produkt', async () => {
      const res = await request(app)
        .post('/api/stock/receipt')
        .send({ productId: 999999, warehouseId: hkId, quantity: 5 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/stock/transfer', () => {
    it('by měl přesunout 4 ks z Hradce do garáže a zapsat spárované pohyby', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .send({ productId, sourceWarehouseId: hkId, targetWarehouseId: trbId, quantity: 4, note: 'Sezónní přesun' });

      expect(res.status).toBe(201);
      expect(res.body.data.source.physicalQuantity).toBe(6);
      expect(res.body.data.target.physicalQuantity).toBe(4);

      const [out, incoming] = res.body.data.movements as Movement[];
      expect(out.movementType).toBe('TRANSFER_OUT');
      expect(out.quantityChange).toBe(-4);
      expect(incoming.movementType).toBe('TRANSFER_IN');
      expect(incoming.quantityChange).toBe(4);

      const transferNumber = out.reason?.match(/PREV-\d+/)?.[0];
      expect(transferNumber).toBeDefined();
      expect(incoming.reason).toContain(transferNumber!);
    });

    it('by měl odmítnout přesun nad rámec volných zásob (400)', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .send({ productId, sourceWarehouseId: hkId, targetWarehouseId: trbId, quantity: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Nedostatek volných zásob pro přesun');
    });

    it('by měl odmítnout stejný zdroj a cíl (400)', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .send({ productId, sourceWarehouseId: hkId, targetWarehouseId: hkId, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('nesmí být stejný');
    });
  });

  describe('POST /api/stock/inventory', () => {
    it('by měl narovnat stav na 8 ks a zapsat INVENTORY_ADJUSTMENT', async () => {
      const res = await request(app)
        .post('/api/stock/inventory')
        .send({
          productId,
          warehouseId: hkId,
          actualPhysicalQuantity: 8,
          reason: 'Přebytek při inventuře'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.difference).toBe(2);
      expect(res.body.data.warehouseStock.physicalQuantity).toBe(8);
      expect(res.body.data.movement.movementType).toBe('INVENTORY_ADJUSTMENT');
      expect(res.body.data.movement.quantityChange).toBe(2);
    });

    it('by při shodě stavu neměl založit žádný pohyb', async () => {
      const before = await request(app).get(`/api/stock/movements?productId=${productId}`);
      const res = await request(app)
        .post('/api/stock/inventory')
        .send({
          productId,
          warehouseId: hkId,
          actualPhysicalQuantity: 8,
          reason: 'Kontrolní inventura'
        });
      const after = await request(app).get(`/api/stock/movements?productId=${productId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.difference).toBe(0);
      expect(res.body.data.movement).toBeNull();
      expect(after.body.data.length).toBe(before.body.data.length);
    });

    it('by měl odmítnout záporný stav a chybějící důvod (400)', async () => {
      const negative = await request(app)
        .post('/api/stock/inventory')
        .send({ productId, warehouseId: hkId, actualPhysicalQuantity: -1, reason: 'Chyba' });
      expect(negative.status).toBe(400);

      const withoutReason = await request(app)
        .post('/api/stock/inventory')
        .send({ productId, warehouseId: hkId, actualPhysicalQuantity: 9 });
      expect(withoutReason.status).toBe(400);
    });
  });

  describe('GET /api/stock/movements (auditní kniha)', () => {
    it('by měl vrátit všechny pohyby produktu včetně typů operací', async () => {
      const res = await request(app).get(`/api/stock/movements?productId=${productId}`);
      const types = (res.body.data as Movement[]).map((m) => m.movementType);

      expect(res.status).toBe(200);
      expect(types).toContain('RECEIPT');
      expect(types).toContain('TRANSFER_OUT');
      expect(types).toContain('TRANSFER_IN');
      expect(types).toContain('INVENTORY_ADJUSTMENT');
    });

    it('by měl filtrovat podle typu pohybu a skladu', async () => {
      const res = await request(app).get(
        `/api/stock/movements?productId=${productId}&warehouseId=${hkId}&movementType=TRANSFER_OUT`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].movementType).toBe('TRANSFER_OUT');
      expect(res.body.data[0].warehouseId).toBe(hkId);
    });

    it('by měl filtrovat podle data a odmítnout neplatné datum (400)', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const empty = await request(app).get(`/api/stock/movements?productId=${productId}&from=${future}`);
      expect(empty.status).toBe(200);
      expect(empty.body.data).toHaveLength(0);

      const invalid = await request(app).get('/api/stock/movements?from=neplatne-datum');
      expect(invalid.status).toBe(400);
    });
  });

  describe('Stav zásob po operacích', () => {
    it('by měl v přehledu ukázat 8 ks v Hradci a 4 ks v garáži', async () => {
      const res = await request(app).get('/api/stock/overview');
      const item = (res.body.data as OverviewItem[]).find((i) => i.productId === productId);

      expect(item).toBeDefined();
      const hk = item!.stocks.find((s) => s.warehouseCode === 'WH-HK')!;
      const trebechovice = item!.stocks.find((s) => s.warehouseCode === 'WH-TRB')!;

      expect(hk.physicalQuantity).toBe(8);
      expect(trebechovice.physicalQuantity).toBe(4);
      expect(item!.totalPhysicalQuantity).toBe(12);
    });
  });
});
