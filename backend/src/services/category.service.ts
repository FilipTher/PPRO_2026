import { Category } from '@prisma/client';
import { ICategoryRepository } from '../repositories/category.repository';

export class CategoryService {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }
}
