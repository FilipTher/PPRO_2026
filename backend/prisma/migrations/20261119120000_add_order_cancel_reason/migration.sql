-- Důvod storna objednávky (povinný v doméně, ukládá se pro dohledatelnost)
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT;
