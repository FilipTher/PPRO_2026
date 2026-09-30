import express from 'express';
import cors from 'cors';
import { createProductRouter } from './routes/product.routes';

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

  return app;
}
