import { PrismaClient, Prisma } from '@prisma/client';
import { Product, StockMovement, Warehouse, WarehouseStock } from '../domain/models';
import { RecordMovementDto, StockMovementFilterDto } from '../types/stock.types';

export type StockWithRelations = WarehouseStock & {
  product: Product;
  warehouse: Warehouse;
};

export type StockWithWarehouse = WarehouseStock & {
  warehouse: Warehouse;
};

export type MovementWithRelations = StockMovement & {
  product: Product;
  warehouse: Warehouse;
};

export interface IStockRepository {
  findAllWarehouses(): Promise<Warehouse[]>;
  findWarehouseById(id: number): Promise<Warehouse | null>;
  findWarehouseByCode(code: string): Promise<Warehouse | null>;

  findStock(warehouseId: number, productId: number): Promise<WarehouseStock | null>;
  findStocksByProductId(productId: number): Promise<StockWithWarehouse[]>;
  findAllStocks(): Promise<StockWithRelations[]>;
  upsertStock(
    warehouseId: number,
    productId: number,
    initialPhysical?: number,
    initialReserved?: number
  ): Promise<WarehouseStock>;
  updateStockQuantities(
    warehouseId: number,
    productId: number,
    data: { physicalQuantity?: number; reservedQuantity?: number }
  ): Promise<WarehouseStock>;

  recordMovement(data: RecordMovementDto): Promise<StockMovement>;
  findMovements(filters?: StockMovementFilterDto): Promise<MovementWithRelations[]>;

  executeInTransaction<T>(operation: (repo: IStockRepository) => Promise<T>): Promise<T>;
}

export class PrismaStockRepository implements IStockRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async findAllWarehouses(): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({
      orderBy: { id: 'asc' }
    });
  }

  async findWarehouseById(id: number): Promise<Warehouse | null> {
    return this.prisma.warehouse.findUnique({
      where: { id }
    });
  }

  async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    return this.prisma.warehouse.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
  }

  async findStock(warehouseId: number, productId: number): Promise<WarehouseStock | null> {
    return this.prisma.warehouseStock.findUnique({
      where: {
        warehouseId_productId: { warehouseId, productId }
      }
    });
  }

  async findStocksByProductId(productId: number): Promise<StockWithWarehouse[]> {
    return this.prisma.warehouseStock.findMany({
      where: { productId },
      include: { warehouse: true },
      orderBy: { warehouseId: 'asc' }
    });
  }

  async findAllStocks(): Promise<StockWithRelations[]> {
    return this.prisma.warehouseStock.findMany({
      include: {
        product: true,
        warehouse: true
      },
      orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }]
    });
  }

  async upsertStock(
    warehouseId: number,
    productId: number,
    initialPhysical = 0,
    initialReserved = 0
  ): Promise<WarehouseStock> {
    return this.prisma.warehouseStock.upsert({
      where: {
        warehouseId_productId: { warehouseId, productId }
      },
      update: {},
      create: {
        warehouseId,
        productId,
        physicalQuantity: initialPhysical,
        reservedQuantity: initialReserved
      }
    });
  }

  async updateStockQuantities(
    warehouseId: number,
    productId: number,
    data: { physicalQuantity?: number; reservedQuantity?: number }
  ): Promise<WarehouseStock> {
    // Pozor: upsert by na SQLite provedl INSERT s výchozím fyzickým stavem 0,
    // což teď (s CHECK reserved <= physical) selže ještě před přepnutím na UPDATE.
    const existing = await this.prisma.warehouseStock.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } }
    });

    if (existing) {
      return this.prisma.warehouseStock.update({
        where: { id: existing.id },
        data: {
          ...(data.physicalQuantity !== undefined && { physicalQuantity: data.physicalQuantity }),
          ...(data.reservedQuantity !== undefined && { reservedQuantity: data.reservedQuantity })
        }
      });
    }

    return this.prisma.warehouseStock.create({
      data: {
        warehouseId,
        productId,
        physicalQuantity: data.physicalQuantity ?? 0,
        reservedQuantity: data.reservedQuantity ?? 0
      }
    });
  }

  async recordMovement(data: RecordMovementDto): Promise<StockMovement> {
    return this.prisma.stockMovement.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        movementType: data.movementType,
        quantityChange: data.quantityChange,
        quantityAfter: data.quantityAfter,
        orderId: data.orderId ?? null,
        reason: data.reason ?? null,
        note: data.note ?? null
      }
    });
  }

  async findMovements(filters?: StockMovementFilterDto): Promise<MovementWithRelations[]> {
    const where: Prisma.StockMovementWhereInput = {};

    if (filters?.productId) where.productId = filters.productId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.movementType) where.movementType = filters.movementType;
    if (filters?.orderId) where.orderId = filters.orderId;

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters?.from) where.createdAt.gte = filters.from;
      if (filters?.to) where.createdAt.lte = filters.to;
    }

    return this.prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
        warehouse: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async executeInTransaction<T>(operation: (repo: IStockRepository) => Promise<T>): Promise<T> {
    if ('$transaction' in this.prisma) {
      return (this.prisma as PrismaClient).$transaction(async (tx) => {
        const txRepo = new PrismaStockRepository(tx);
        return operation(txRepo);
      });
    }
    return operation(this);
  }
}
