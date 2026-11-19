import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();

describe('Reports API (měsíční obrat po kategoriích)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/reports/category-turnover by měl vrátit report za zadaný měsíc', async () => {
    const res = await request(app).get('/api/reports/category-turnover?year=2026&month=11');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.totalRevenue).toBe('number');
    expect(typeof res.body.data.totalQuantity).toBe('number');
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.periodFrom).toBe('2026-11-01T00:00:00.000Z');
  });

  it('GET /api/reports/category-turnover by měl bez parametrů použít aktuální měsíc', async () => {
    const res = await request(app).get('/api/reports/category-turnover');
    const now = new Date();

    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(now.getFullYear());
    expect(res.body.data.month).toBe(now.getMonth() + 1);
  });

  it('GET /api/reports/category-turnover by měl odmítnout neplatné parametry (400)', async () => {
    const badMonth = await request(app).get('/api/reports/category-turnover?month=13');
    expect(badMonth.status).toBe(400);

    const badYear = await request(app).get('/api/reports/category-turnover?year=abc');
    expect(badYear.status).toBe(400);
  });

  it('GET /api/reports/low-stock by měl nahlásit produkt bez zásoby jako CRITICAL', async () => {
    const created = await request(app).post('/api/products').send({
      code: `TEST-LOWSTOCK-${Date.now()}`,
      name: 'Hračka bez zásoby',
      purchasePrice: 10,
      sellingPrice: 20
    });
    const productId = created.body.data.id;

    try {
      const res = await request(app).get('/api/reports/low-stock');
      const alert = res.body.data.find((a: { productId: number }) => a.productId === productId);

      expect(res.status).toBe(200);
      expect(alert).toBeDefined();
      expect(alert.totalPhysicalQuantity).toBe(0);
      expect(alert.severity).toBe('CRITICAL');
      // výchozí minimum je 5 ks -> doporučeno doobjednat 5 ks
      expect(alert.recommendedQuantity).toBe(5);
    } finally {
      await prisma.product.delete({ where: { id: productId } });
    }
  });

  it('GET /api/reports/low-stock by neměl hlásit seed produkty se zásobou 20 ks', async () => {
    const res = await request(app).get('/api/reports/low-stock');

    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { productCode: string }) => a.productCode === 'KACA-BUK-01')).toBe(
      false
    );
  });
});
