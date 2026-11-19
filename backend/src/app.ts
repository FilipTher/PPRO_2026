import express from 'express';
import cors from 'cors';
import { createProductRouter } from './routes/product.routes';
import { createCategoryRouter } from './routes/category.routes';
import { createStockRouter } from './routes/stock.routes';
import { createOrderRouter } from './routes/order.routes';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'drevenka-warehouse-api', timestamp: new Date().toISOString() });
  });

  // API modul produktů
  app.use('/api/products', createProductRouter());

  // API modul kategorií
  app.use('/api/categories', createCategoryRouter());

  // API modul skladových zásob
  app.use('/api/stock', createStockRouter());

  // API modul objednávek
  app.use('/api/orders', createOrderRouter());

  return app;
}
