import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProductService, DomainValidationError, NotFoundError, ConflictError } from '../src/services/product.service';
import { IProductRepository, ProductWithCategories } from '../src/repositories/product.repository';
import { ICategoryRepository } from '../src/repositories/category.repository';
import { Product, Category } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from '../src/types';

// Mockovaná in-memory implementace repozitáře pro čistý unit test domény bez závislosti na DB
class MockProductRepository implements IProductRepository {
  public products: Product[] = [];
  public lastCreateData: CreateProductDto | null = null;
  private nextId = 1;

  async findAll(filters?: ProductFilterDto): Promise<ProductWithCategories[]> {
    return this.products
      .filter(p => {
        if (filters?.isActive !== undefined && p.isActive !== filters.isActive) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          return p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
        }
        return true;
      })
      .map(p => ({ ...p, categories: [] }));
  }

  async findById(id: number): Promise<ProductWithCategories | null> {
    const product = this.products.find(p => p.id === id);
    return product ? { ...product, categories: [] } : null;
  }

  async findByCode(code: string): Promise<ProductWithCategories | null> {
    const product = this.products.find(p => p.code.toUpperCase() === code.toUpperCase());
    return product ? { ...product, categories: [] } : null;
  }

  async create(data: CreateProductDto): Promise<ProductWithCategories> {
    this.lastCreateData = data;
    const product: Product = {
      id: this.nextId++,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description ?? null,
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      minStockLimit: data.minStockLimit ?? 5,
      isActive: true,
      isVariantOfId: data.isVariantOfId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.products.push(product);
    return { ...product, categories: [] };
  }

  async update(id: number, data: UpdateProductDto): Promise<ProductWithCategories> {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Not found in mock');
    this.products[idx] = {
      ...this.products[idx],
      ...data,
      updatedAt: new Date()
    } as Product;
    return { ...this.products[idx], categories: [] };
  }

  async delete(id: number): Promise<ProductWithCategories> {
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Not found in mock');
    this.products[idx].isActive = false;
    return { ...this.products[idx], categories: [] };
  }
}

class MockCategoryRepository implements ICategoryRepository {
  public categories: Category[] = [];

  async findAll(): Promise<Category[]> {
    return this.categories;
  }

  async findByIds(ids: number[]): Promise<Category[]> {
    return this.categories.filter(c => ids.includes(c.id));
  }
}

describe('ProductService (Doménová vrstva)', () => {
  let repository: MockProductRepository;
  let categoryRepository: MockCategoryRepository;
  let service: ProductService;

  beforeEach(() => {
    repository = new MockProductRepository();
    categoryRepository = new MockCategoryRepository();
    categoryRepository.categories = [
      { id: 1, name: 'Pro batolata', description: 'Bezpečné hračky pro nejmenší' },
      { id: 2, name: 'Dárky do 500 Kč', description: 'Cenově dostupné dárky' }
    ];
    service = new ProductService(repository, categoryRepository);
  });

  describe('createProduct', () => {
    it('měl by úspěšně vytvořit validní produkt a normalizovat kód na velká písmena', async () => {
      const dto: CreateProductDto = {
        code: 'kaca-01',
        name: 'Dřevěná káča',
        purchasePrice: 50,
        sellingPrice: 120,
        minStockLimit: 10
      };

      const result = await service.createProduct(dto);

      expect(result.id).toBeDefined();
      expect(result.code).toBe('KACA-01');
      expect(result.name).toBe('Dřevěná káča');
      expect(result.sellingPrice).toBe(120);
      expect(result.isActive).toBe(true);
    });

    it('měl by přiřadit produkt do více kategorií naráz (vazba M:N)', async () => {
      await service.createProduct({
        code: 'KACA-02',
        name: 'Káča pro batolata jako dárek',
        purchasePrice: 50,
        sellingPrice: 120,
        categoryIds: [1, 2]
      });

      expect(repository.lastCreateData?.categoryIds).toEqual([1, 2]);
    });

    it('měl by odstranit duplicitní ID kategorií', async () => {
      await service.createProduct({
        code: 'KACA-03',
        name: 'Káča s duplicitou',
        purchasePrice: 50,
        sellingPrice: 120,
        categoryIds: [1, 1, 2]
      });

      expect(repository.lastCreateData?.categoryIds).toEqual([1, 2]);
    });

    it('měl by odmítnout neexistující kategorii', async () => {
      await expect(
        service.createProduct({
          code: 'KACA-04',
          name: 'Káča s neplatnou kategorií',
          purchasePrice: 50,
          sellingPrice: 120,
          categoryIds: [99]
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout nekladné nebo neceločíselné ID kategorie', async () => {
      await expect(
        service.createProduct({
          code: 'KACA-05',
          name: 'Káča se zápornou kategorií',
          purchasePrice: 50,
          sellingPrice: 120,
          categoryIds: [-1]
        })
      ).rejects.toThrow(DomainValidationError);

      await expect(
        service.createProduct({
          code: 'KACA-06',
          name: 'Káča s desetinnou kategorií',
          purchasePrice: 50,
          sellingPrice: 120,
          categoryIds: [1.5]
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by vyhodit DomainValidationError pokud je kód prázdný', async () => {
      const dto: CreateProductDto = {
        code: '   ',
        name: 'Hračka bez kódu',
        purchasePrice: 10,
        sellingPrice: 20
      };

      await expect(service.createProduct(dto)).rejects.toThrow(DomainValidationError);
    });

    it('měl by vyhodit DomainValidationError pokud kód obsahuje nepovolené znaky', async () => {
      const dto: CreateProductDto = {
        code: 'KACA @#$ 01',
        name: 'Káča se znaky',
        purchasePrice: 10,
        sellingPrice: 20
      };

      await expect(service.createProduct(dto)).rejects.toThrow(DomainValidationError);
    });

    it('měl by vyhodit ConflictError při pokusu o vytvoření duplicitního kódu', async () => {
      await service.createProduct({
        code: 'HR-100',
        name: 'Vláček',
        purchasePrice: 100,
        sellingPrice: 200
      });

      await expect(
        service.createProduct({
          code: 'hr-100', // malá písmena, ale stejný kód
          name: 'Jiný vláček',
          purchasePrice: 150,
          sellingPrice: 250
        })
      ).rejects.toThrow(ConflictError);
    });

    it('měl by odmítnout prodejní cenu nižší než nákupní cenu (zákaz prodeje se ztrátou)', async () => {
      const dto: CreateProductDto = {
        code: 'STRATA-01',
        name: 'Ztrátový produkt',
        purchasePrice: 200,
        sellingPrice: 150 // nižší než nákupní
      };

      await expect(service.createProduct(dto)).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout zápornou nákupní cenu nebo nulovou prodejní cenu', async () => {
      await expect(
        service.createProduct({
          code: 'TEST-01',
          name: 'Test',
          purchasePrice: -10,
          sellingPrice: 100
        })
      ).rejects.toThrow(DomainValidationError);

      await expect(
        service.createProduct({
          code: 'TEST-02',
          name: 'Test',
          purchasePrice: 50,
          sellingPrice: 0
        })
      ).rejects.toThrow(DomainValidationError);
    });
  });

  describe('getProductById', () => {
    it('měl by vrátit NotFoundError pro neexistující ID', async () => {
      await expect(service.getProductById(9999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deactivateProduct', () => {
    it('měl by provést soft-delete nastavením isActive na false', async () => {
      const created = await service.createProduct({
        code: 'DEACT-01',
        name: 'Produkt k deaktivaci',
        purchasePrice: 50,
        sellingPrice: 100
      });

      const deactivated = await service.deactivateProduct(created.id);
      expect(deactivated.isActive).toBe(false);
    });
  });
});
