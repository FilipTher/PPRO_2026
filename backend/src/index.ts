import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Skladový systém Dřevěnka s.r.o. běží!`);
  console.log(`📡 REST API dostupné na: http://localhost:${PORT}/api/products`);
  console.log(`🩺 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});
