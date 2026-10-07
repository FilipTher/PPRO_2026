import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();

describe('Product API (Integrační testy HTTP -> SQLite)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health by měl vrátit 200 OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/products by měl vrátit seznam produktů ze SQLite', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/products by měl vytvořit nový produkt a uložit do SQLite', async () => {
    const testCode = `TEST-PEXESO-${Date.now()}`;
    const res = await request(app)
      .post('/api/products')
      .send({
        code: testCode,
        name: 'Dřevěné pexeso Lesní zvířátka',
        description: 'Kvalitní bukové kartičky s rytinou zvířátek',
        purchasePrice: 90,
        sellingPrice: 199,
        minStockLimit: 5
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(testCode);

    // Ověření v databázi
    const inDb = await prisma.product.findUnique({ where: { code: testCode } });
    expect(inDb).not.toBeNull();
    expect(inDb?.name).toBe('Dřevěné pexeso Lesní zvířátka');
  });

  it('POST /api/products by měl vrátit 400 při neplatných cenách', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        code: `ERR-${Date.now()}`,
        name: 'Neplatná hračka',
        purchasePrice: 500,
        sellingPrice: 300 // ztráta
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Prodejní cena nesmí být nižší');
  });
});
