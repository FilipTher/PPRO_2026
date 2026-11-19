import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  getAll = async (_req: Request, res: Response) => {
    try {
      const categories = await this.categoryService.getAllCategories();
      res.json({ success: true, data: categories });
    } catch (err: any) {
      console.error('Neošetřená chyba:', err);
      res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
    }
  };
}
