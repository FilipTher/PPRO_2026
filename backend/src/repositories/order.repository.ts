import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateOrderItemDto,
  CreateOrderWithItemsDto,
  OrderFilterDto,
  OrderStatus,
  OrderWithRelations
} from '../types/order.types';

const orderInclude = {
  customer: true,
  items: {
    include: { product: true, warehouse: true }
  }
};

export interface IOrderRepository {
  createOrderWithItems(data: CreateOrderWithItemsDto): Promise<OrderWithRelations>;
  findOrderById(id: number): Promise<OrderWithRelations | null>;
  findOrderByNumber(orderNumber: string): Promise<OrderWithRelations | null>;
  findAllOrders(filters?: OrderFilterDto): Promise<OrderWithRelations[]>;
  updateOrderStatus(id: number, status: OrderStatus, shippedAt?: Date): Promise<OrderWithRelations>;
  updateOrderItems(id: number, items: CreateOrderItemDto[]): Promise<OrderWithRelations>;
}

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createOrderWithItems(data: CreateOrderWithItemsDto): Promise<OrderWithRelations> {
    // Vnořené create je atomické: objednávka i položky vzniknou, nebo nic
    return this.prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        customerId: data.customerId,
        status: data.status ?? 'PENDING',
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            // Fixace ceny: hodnota z okamžiku prodeje, ne z aktuálního ceníku
            unitPrice: item.unitPrice
          }))
        }
      },
      include: orderInclude
    });
  }

  async findOrderById(id: number): Promise<OrderWithRelations | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: orderInclude
    });
  }

  async findOrderByNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: orderInclude
    });
  }

  async findAllOrders(filters?: OrderFilterDto): Promise<OrderWithRelations[]> {
    const where: Prisma.OrderWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    return this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateOrderStatus(
    id: number,
    status: OrderStatus,
    shippedAt?: Date
  ): Promise<OrderWithRelations> {
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(shippedAt !== undefined && { shippedAt })
      },
      include: orderInclude
    });
  }

  async updateOrderItems(id: number, items: CreateOrderItemDto[]): Promise<OrderWithRelations> {
    // Nahrazení položek musí být atomické, aby objednávka nikdy nezůstala bez nich
    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      if (items.length > 0) {
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude
      });
    });
  }
}
