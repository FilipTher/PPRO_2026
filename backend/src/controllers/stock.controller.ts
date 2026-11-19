import { Request, Response } from 'express';
import { StockService } from '../services/stock.service';
import { DomainValidationError, NotFoundError } from '../errors';
import { StockMovementFilterDto } from '../types/stock.types';

export class StockController {
  constructor(private readonly stockService: StockService) {}

  /**
   * GET /api/stock/warehouses – seznam skladů (Hradec Králové, garáž Třebechovice)
   */
  getWarehouses = async (_req: Request, res: Response) => {
    try {
      const warehouses = await this.stockService.getAllWarehouses();
      res.json({ success: true, data: warehouses });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /api/stock/overview – zásoby všech aktivních produktů po skladech
   * (fyzický, rezervovaný a disponibilní stav + flag nízké zásoby).
   */
  getOverview = async (_req: Request, res: Response) => {
    try {
      const overview = await this.stockService.getStockOverview();
      res.json({ success: true, data: overview });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/stock/receipt – příjem zboží na sklad (RECEIPT)
   */
  receive = async (req: Request, res: Response) => {
    try {
      const { productId, warehouseId, quantity, reason, note } = req.body;

      const result = await this.stockService.receiveStock({
        productId: this.requireInt(productId, 'ID produktu'),
        warehouseId: this.requireInt(warehouseId, 'ID skladu'),
        quantity: Number(quantity),
        reason,
        note
      });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/stock/transfer – přesun zboží mezi sklady (TRANSFER_OUT + TRANSFER_IN)
   */
  transfer = async (req: Request, res: Response) => {
    try {
      const { productId, sourceWarehouseId, targetWarehouseId, quantity, note } = req.body;

      const result = await this.stockService.transferStock({
        productId: this.requireInt(productId, 'ID produktu'),
        sourceWarehouseId: this.requireInt(sourceWarehouseId, 'ID zdrojového skladu'),
        targetWarehouseId: this.requireInt(targetWarehouseId, 'ID cílového skladu'),
        quantity: Number(quantity),
        note
      });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/stock/inventory – inventura, narovnání fyzického stavu (INVENTORY_ADJUSTMENT)
   */
  inventory = async (req: Request, res: Response) => {
    try {
      const { productId, warehouseId, actualPhysicalQuantity, reason, note } = req.body;

      const result = await this.stockService.reconcileInventory({
        productId: this.requireInt(productId, 'ID produktu'),
        warehouseId: this.requireInt(warehouseId, 'ID skladu'),
        actualPhysicalQuantity: Number(actualPhysicalQuantity),
        reason,
        note
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /api/stock/movements – auditní kniha pohybů s filtry
   * (productId, warehouseId, movementType, orderId, from, to)
   */
  getMovements = async (req: Request, res: Response) => {
    try {
      const filters: StockMovementFilterDto = {
        productId: this.optionalInt(req.query.productId, 'ID produktu'),
        warehouseId: this.optionalInt(req.query.warehouseId, 'ID skladu'),
        orderId: this.optionalInt(req.query.orderId, 'ID objednávky'),
        movementType:
          typeof req.query.movementType === 'string' && req.query.movementType.length > 0
            ? req.query.movementType
            : undefined,
        from: this.optionalDate(req.query.from, 'datum od'),
        to: this.optionalDate(req.query.to, 'datum do')
      };

      const movements = await this.stockService.getMovements(filters);
      res.json({ success: true, data: movements });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  private requireInt(value: unknown, label: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new DomainValidationError(`${label} musí být celé číslo.`);
    }
    return parsed;
  }

  private optionalInt(value: unknown, label: string): number | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    return this.requireInt(value, label);
  }

  private optionalDate(value: unknown, label: string): Date | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    const parsed = new Date(String(value));
    if (isNaN(parsed.getTime())) {
      throw new DomainValidationError(`${label} není platné datum.`);
    }
    return parsed;
  }

  private handleError(res: Response, err: any) {
    if (err instanceof DomainValidationError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ success: false, error: err.message });
    }

    console.error('Neošetřená chyba:', err);
    res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
  }
}
