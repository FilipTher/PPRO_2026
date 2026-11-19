-- Zákaz záporného stavu zásob garantovaný databází (SQLite CHECK).
-- SQLite neumí přidat constraint přes ALTER TABLE, proto se tabulka přestaví.
CREATE TABLE "new_WarehouseStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "warehouseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "physicalQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarehouseStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarehouseStock_physicalQuantity_nonnegative" CHECK ("physicalQuantity" >= 0),
    CONSTRAINT "WarehouseStock_reservedQuantity_nonnegative" CHECK ("reservedQuantity" >= 0),
    CONSTRAINT "WarehouseStock_reserved_not_above_physical" CHECK ("reservedQuantity" <= "physicalQuantity")
);

INSERT INTO "new_WarehouseStock" ("id", "warehouseId", "productId", "physicalQuantity", "reservedQuantity")
SELECT "id", "warehouseId", "productId", "physicalQuantity", "reservedQuantity" FROM "WarehouseStock";

DROP TABLE "WarehouseStock";
ALTER TABLE "new_WarehouseStock" RENAME TO "WarehouseStock";

CREATE UNIQUE INDEX "WarehouseStock_warehouseId_productId_key" ON "WarehouseStock"("warehouseId", "productId");
