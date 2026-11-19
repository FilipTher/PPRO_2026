import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();

type OverviewItem = {
  productCode: string;
  minStockLimit: number;
  stocks: { warehouseCode: string; physicalQuantity: number; reservedQuantity: number; availableQuantity: number }[];
  totalPhysicalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  isLowStock: boolean;
};

describe('Stock API (zásoby po skladech ze SQLite)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/stock/overview by měl vrátit zásoby produktů ze seedu', async () => {
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
    expect(item!.totalAvailableQuantity).toBe(20);
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
