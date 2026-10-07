import { Product } from '@prisma/client';
import { IProductRepository } from '../repositories/product.repository';
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from '../types';

import { DomainValidationError, NotFoundError, ConflictError } from '../errors';
export { DomainValidationError, NotFoundError, ConflictError };

export class ProductService {
  constructor(private readonly productRepository: IProductRepository) {}

  async getAllProducts(filters?: ProductFilterDto): Promise<Product[]> {
    return this.productRepository.findAll(filters);
  }

  async getProductById(id: number): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Produkt s ID ${id} nebyl nalezen.`);
    }
    return product;
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    // 1. Validace povinných polí
    if (!dto.code || dto.code.trim().length === 0) {
      throw new DomainValidationError('Kód produktu je povinný.');
    }
    if (!dto.name || dto.name.trim().length === 0) {
      throw new DomainValidationError('Název produktu je povinný.');
    }

    // 2. Validace formátu kódu (bez mezer, jen bezpečné znaky)
    const normalizedCode = dto.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
      throw new DomainValidationError('Kód produktu může obsahovat pouze písmena, číslice, pomlčky a podtržítka.');
    }

    // 3. Validace cen a limitů
    if (dto.purchasePrice === undefined || dto.purchasePrice < 0) {
      throw new DomainValidationError('Nákupní cena nesmí být záporná.');
    }
    if (dto.sellingPrice === undefined || dto.sellingPrice <= 0) {
      throw new DomainValidationError('Prodejní cena musí být kladné číslo větší než 0.');
    }
    if (dto.sellingPrice < dto.purchasePrice) {
      throw new DomainValidationError('Prodejní cena nesmí být nižší než nákupní cena (zákaz prodeje se ztrátou).');
    }
    if (dto.minStockLimit !== undefined && dto.minStockLimit < 0) {
      throw new DomainValidationError('Minimální zásoba nesmí být záporná.');
    }

    // 4. Ověření unikátnosti kódu v databázi
    const existing = await this.productRepository.findByCode(normalizedCode);
    if (existing) {
      throw new ConflictError(`Produkt s kódem '${normalizedCode}' již existuje.`);
    }

    return this.productRepository.create({
      ...dto,
      code: normalizedCode
    });
  }

  async updateProduct(id: number, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.getProductById(id);

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new DomainValidationError('Název produktu nesmí být prázdný.');
    }
    if (dto.purchasePrice !== undefined && dto.purchasePrice < 0) {
      throw new DomainValidationError('Nákupní cena nesmí být záporná.');
    }
    if (dto.sellingPrice !== undefined && dto.sellingPrice <= 0) {
      throw new DomainValidationError('Prodejní cena musí být větší než 0.');
    }

    const effectivePurchase = dto.purchasePrice ?? existing.purchasePrice;
    const effectiveSelling = dto.sellingPrice ?? existing.sellingPrice;
    if (effectiveSelling < effectivePurchase) {
      throw new DomainValidationError('Prodejní cena nesmí být nižší než nákupní cena.');
    }

    if (dto.minStockLimit !== undefined && dto.minStockLimit < 0) {
      throw new DomainValidationError('Minimální zásoba nesmí být záporná.');
    }

    return this.productRepository.update(id, dto);
  }

  async deactivateProduct(id: number): Promise<Product> {
    await this.getProductById(id);
    return this.productRepository.delete(id);
  }
}
