FROM node:20-alpine

WORKDIR /app

# Instalace openssl pro Prisma na Alpine
RUN apk add --no-cache openssl

# Kopírování definice závislostí a Prisma schématu
COPY package*.json ./
COPY prisma ./prisma/

# Instalace závislostí
RUN npm ci

# Kopírování konfigurace a zdrojových kódů
COPY tsconfig*.json ./
COPY src ./src/

# Generování Prisma klienta a kompilace TypeScriptu
RUN npx prisma generate
RUN npm run build

# Vytvoření složky pro SQLite databázi
RUN mkdir -p data

EXPOSE 3000

# Před startem aplikace se aplikují migrace a spustí se server
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/index.js"]
