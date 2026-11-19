import { Category } from '../domain/models';
import { ICategoryRepository } from '../repositories/category.repository';

export class CategoryService {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }
}
