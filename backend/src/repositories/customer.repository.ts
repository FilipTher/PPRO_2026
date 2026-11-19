import { PrismaClient } from '@prisma/client';
import { Customer } from '../domain/models';
import { CreateCustomerDto } from '../types/order.types';

export interface ICustomerRepository {
  findById(id: number): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  findAll(): Promise<Customer[]>;
  /** Zákazník se nikdy nemaže – při opakované objednávce se použije existující záznam. */
  findOrCreate(data: CreateCustomerDto): Promise<Customer>;
}

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: number): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { email: normalizeEmail(email) } });
  }

  async findAll(): Promise<Customer[]> {
    return this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
  }

  async findOrCreate(data: CreateCustomerDto): Promise<Customer> {
    const email = normalizeEmail(data.email);

    // E-mail je unikátní -> upsert zaručí, že se zákazník neduplikuje ani při souběhu dvou objednávek
    return this.prisma.customer.upsert({
      where: { email },
      update: {}, // existující zákazník se nepřepisuje, historie objednávek zůstává
      create: {
        email,
        name: data.name.trim(),
        phone: data.phone.trim(),
        street: data.street.trim(),
        city: data.city.trim(),
        zip: data.zip.trim()
      }
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
