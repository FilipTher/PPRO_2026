import { Request, Response } from 'express';
import { ProductService, DomainValidationError, NotFoundError, ConflictError } from '../services/product.service';

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

      const products = await this.productService.getAllProducts({ search, isActive });
      res.json({ success: true, data: products });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Neplatné ID produktu.' });
      }

      const product = await this.productService.getProductById(id);
      res.json({ success: true, data: product });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { code, name, description, purchasePrice, sellingPrice, minStockLimit, isVariantOfId } = req.body;

      const product = await this.productService.createProduct({
        code,
        name,
        description,
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        minStockLimit: minStockLimit !== undefined ? Number(minStockLimit) : undefined,
        isVariantOfId: isVariantOfId !== undefined ? Number(isVariantOfId) : undefined
      });

      res.status(201).json({ success: true, data: product });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Neplatné ID produktu.' });
      }

      const { name, description, purchasePrice, sellingPrice, minStockLimit, isActive } = req.body;

      const product = await this.productService.updateProduct(id, {
        name,
        description,
        purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : undefined,
        sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : undefined,
        minStockLimit: minStockLimit !== undefined ? Number(minStockLimit) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined
      });

      res.json({ success: true, data: product });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  deactivate = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Neplatné ID produktu.' });
      }

      const product = await this.productService.deactivateProduct(id);
      res.json({ success: true, message: 'Produkt byl deaktivován.', data: product });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  private handleError(res: Response, err: any) {
    if (err instanceof DomainValidationError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: err.message });
    }
    if (err instanceof ConflictError) {
      return res.status(409).json({ success: false, error: err.message });
    }

    console.error('Neošetřená chyba:', err);
    res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
  }
}
