import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const testCode = `TEST-KATEGORIE-${Date.now()}`;

describe('Kategorie API (vazba M:N produkt <-> kategorie)', () => {
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { code: { startsWith: 'TEST-KATEGORIE-' } } });
    await prisma.$disconnect();
  });

  it('GET /api/categories by měl vrátit kategorie ze seedu', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('POST /api/products by měl uložit produkt do dvou kategorií naráz', async () => {
    const categories = (await request(app).get('/api/categories')).body.data as { id: number }[];
    const categoryIds = categories.slice(0, 2).map((c) => c.id);

    const res = await request(app)
      .post('/api/products')
      .send({
        code: testCode,
        name: 'Dřevěná káča pro batolata i jako dárek',
        purchasePrice: 60,
        sellingPrice: 149,
        categoryIds
      });

    expect(res.status).toBe(201);
    expect(res.body.data.categories.map((c: { id: number }) => c.id).sort()).toEqual([...categoryIds].sort());
  });

  it('GET /api/products?categoryId= by měl filtrovat produkty podle kategorie', async () => {
    const categories = (await request(app).get('/api/categories')).body.data as { id: number }[];
    const categoryId = categories[0].id;

    const res = await request(app).get(`/api/products?categoryId=${categoryId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((p: { categories: { id: number }[] }) =>
        p.categories.some((c) => c.id === categoryId)
      )
    ).toBe(true);
    expect(res.body.data.some((p: { code: string }) => p.code === testCode)).toBe(true);
  });

  it('POST /api/products by měl odmítnout neexistující kategorii', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        code: `${testCode}-ERR`,
        name: 'Neplatná kategorie',
        purchasePrice: 10,
        sellingPrice: 20,
        categoryIds: [999999]
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('kategorie');
  });
});
