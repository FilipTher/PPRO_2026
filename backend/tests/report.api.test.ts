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
});
