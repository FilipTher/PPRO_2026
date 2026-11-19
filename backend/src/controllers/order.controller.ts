import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { DomainValidationError, NotFoundError } from '../errors';
import { ORDER_STATUSES, OrderStatus } from '../types/order.types';

export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * GET /api/orders – seznam objednávek s filtrem podle stavu
   */
  getAll = async (req: Request, res: Response) => {
    try {
      const rawStatus = req.query.status;
      let status: OrderStatus | undefined;

      if (typeof rawStatus === 'string' && rawStatus.length > 0) {
        if (!ORDER_STATUSES.includes(rawStatus as OrderStatus)) {
          throw new DomainValidationError('Neplatný stav objednávky.');
        }
        status = rawStatus as OrderStatus;
      }

      const orders = await this.orderService.getOrders({ status });
      res.json({ success: true, data: orders });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /api/orders/:id – detail objednávky včetně zákazníka a položek
   */
  getById = async (req: Request, res: Response) => {
    try {
      const order = await this.orderService.getOrderById(this.requireId(req.params.id));
      res.json({ success: true, data: order });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/orders – vytvoření objednávky s rezervací (400 při nedostatku zásob)
   */
  create = async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      if (!body.customer || typeof body.customer !== 'object') {
        throw new DomainValidationError('Údaje zákazníka jsou povinné.');
      }
      if (!Array.isArray(body.items)) {
        throw new DomainValidationError('Položky objednávky musí být pole.');
      }

      const order = await this.orderService.createOrder({
        customer: body.customer,
        items: this.mapItems(body.items)
      });

      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * PUT /api/orders/:id/items – editace položek před expedicí
   */
  updateItems = async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!Array.isArray(body.items)) {
        throw new DomainValidationError('Položky objednávky musí být pole.');
      }

      const order = await this.orderService.updateOrderItems(
        this.requireId(req.params.id),
        this.mapItems(body.items)
      );
      res.json({ success: true, data: order });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/orders/:id/ship – expedice objednávky
   */
  ship = async (req: Request, res: Response) => {
    try {
      const order = await this.orderService.shipOrder(this.requireId(req.params.id));
      res.json({ success: true, data: order });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * POST /api/orders/:id/cancel – storno objednávky s důvodem
   */
  cancel = async (req: Request, res: Response) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      const order = await this.orderService.cancelOrder(
        this.requireId(req.params.id),
        reason
      );
      res.json({ success: true, data: order });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  private mapItems(items: any[]) {
    return items.map((item) => ({
      productId: Number(item?.productId),
      warehouseId: Number(item?.warehouseId),
      quantity: Number(item?.quantity)
    }));
  }

  private requireId(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new DomainValidationError('ID objednávky musí být kladné celé číslo.');
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
