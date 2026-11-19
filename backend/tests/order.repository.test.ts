import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../src/prisma';
import { PrismaOrderRepository } from '../src/repositories/order.repository';
import { PrismaCustomerRepository } from '../src/repositories/customer.repository';
import { CreateOrderWithItemsDto } from '../src/types/order.types';

const customerRepository = new PrismaCustomerRepository(prisma);
const orderRepository = new PrismaOrderRepository(prisma);

const stamp = Date.now();
const testEmail = `test-zakaznik-${stamp}@example.com`;
const orderNumber = `ORD-TEST-${stamp}`;

let customerId: number;
let productId: number;
let warehouseId: number;
let orderId: number;

describe('Order/Customer repozitáře (SQLite)', () => {
  beforeAll(async () => {
    const customer = await customerRepository.findOrCreate({
      name: 'Jan Testovací',
      email: testEmail,
      phone: '+420 777 000 111',
      street: 'Testovací 1',
      city: 'Hradec Králové',
      zip: '500 01'
    });
    customerId = customer.id;

    const product = await prisma.product.findFirstOrThrow({ orderBy: { id: 'asc' } });
    productId = product.id;

    const warehouse = await prisma.warehouse.findFirstOrThrow({ orderBy: { id: 'asc' } });
    warehouseId = warehouse.id;
  });

  afterAll(async () => {
    // Úklid testovacích dat (zákazník se v aplikaci nemaže, tady jde o testovací záznam)
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber } } });
    await prisma.order.deleteMany({ where: { orderNumber } });
    await prisma.customer.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it('findOrCreate vrátí stejného zákazníka pro e-mail bez ohledu na velikost písmen', async () => {
    const original = await customerRepository.findById(customerId);
    const again = await customerRepository.findOrCreate({
      name: 'Jan Testovací',
      email: `  ${testEmail.toUpperCase()}  `,
      phone: '+420 777 000 111',
      street: 'Testovací 1',
      city: 'Hradec Králové',
      zip: '500 01'
    });
    const found = await customerRepository.findByEmail(testEmail);

    expect(again.id).toBe(customerId);
    expect(found?.id).toBe(customerId);
    expect(original?.email).toBe(testEmail.toLowerCase());
  });

  it('createOrderWithItems uloží objednávku s položkami a zafixovanou cenou', async () => {
    const data: CreateOrderWithItemsDto = {
      orderNumber,
      customerId,
      status: 'RESERVED',
      items: [{ productId, warehouseId, quantity: 3, unitPrice: 123.45 }]
    };

    const created = await orderRepository.createOrderWithItems(data);
    orderId = created.id;

    expect(created.orderNumber).toBe(orderNumber);
    expect(created.status).toBe('RESERVED');
    expect(created.customer.email).toBe(testEmail.toLowerCase());
    expect(created.items).toHaveLength(1);
    expect(created.items[0].quantity).toBe(3);
    // Cena zůstává zafixovaná, i když je jiná než aktuální ceník produktu
    expect(created.items[0].unitPrice).toBe(123.45);
    expect(created.items[0].warehouse.id).toBe(warehouseId);
  });

  it('findOrderById a findOrderByNumber vrátí detail včetně zákazníka a položek', async () => {
    const byId = await orderRepository.findOrderById(orderId);
    const byNumber = await orderRepository.findOrderByNumber(orderNumber);

    expect(byId?.id).toBe(orderId);
    expect(byId?.customer.name).toBe('Jan Testovací');
    expect(byId?.items[0].product.code).toBeDefined();
    expect(byNumber?.id).toBe(orderId);
    expect(await orderRepository.findOrderById(999999)).toBeNull();
  });

  it('findAllOrders umí filtrovat podle stavu a zákazníka', async () => {
    const reserved = await orderRepository.findAllOrders({ status: 'RESERVED' });
    const others = await orderRepository.findAllOrders({ status: 'SHIPPED' });
    const byCustomer = await orderRepository.findAllOrders({ customerId });

    expect(reserved.some((o) => o.id === orderId)).toBe(true);
    expect(others.some((o) => o.id === orderId)).toBe(false);
    expect(byCustomer.every((o) => o.customerId === customerId)).toBe(true);
  });

  it('odmítne duplicitní číslo objednávky (unikátní index v DB)', async () => {
    await expect(
      orderRepository.createOrderWithItems({
        orderNumber,
        customerId,
        items: [{ productId, warehouseId, quantity: 1, unitPrice: 10 }]
      })
    ).rejects.toThrow();
  });

  it('updateOrderStatus nastaví stav SHIPPED včetně data expedice', async () => {
    const shippedAt = new Date();
    const updated = await orderRepository.updateOrderStatus(orderId, 'SHIPPED', shippedAt);

    expect(updated.status).toBe('SHIPPED');
    expect(updated.shippedAt?.toISOString()).toBe(shippedAt.toISOString());
  });

  it('updateOrderItems atomicky nahradí položky objednávky', async () => {
    const updated = await orderRepository.updateOrderItems(orderId, [
      { productId, warehouseId, quantity: 7, unitPrice: 99 }
    ]);

    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].quantity).toBe(7);
    expect(updated.items[0].unitPrice).toBe(99);
  });
});
