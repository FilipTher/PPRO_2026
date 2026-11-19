import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';

export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * GET /api/customers – seznam zákazníků pro výběr v objednávce
   */
  getAll = async (_req: Request, res: Response) => {
    try {
      const customers = await this.customerService.getAllCustomers();
      res.json({ success: true, data: customers });
    } catch (err: any) {
      console.error('Neošetřená chyba:', err);
      res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
    }
  };
}
