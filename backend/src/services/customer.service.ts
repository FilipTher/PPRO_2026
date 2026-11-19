import { Customer } from '@prisma/client';
import { ICustomerRepository } from '../repositories/customer.repository';

export class CustomerService {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async getAllCustomers(): Promise<Customer[]> {
    return this.customerRepository.findAll();
  }
}
