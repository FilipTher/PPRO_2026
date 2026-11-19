import { Customer } from '../domain/models';
import { ICustomerRepository } from '../repositories/customer.repository';

export class CustomerService {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async getAllCustomers(): Promise<Customer[]> {
    return this.customerRepository.findAll();
  }
}
