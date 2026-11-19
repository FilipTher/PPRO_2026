import { PrismaClient } from '@prisma/client';
import { CategoryRevenueRow, ShippedRevenueSummary } from '../types/report.types';

export interface IReportRepository {
  /**
   * Souhrn expedovaných objednávek (stav SHIPPED) mezi `from` a `to`
   * podle data expedice, včetně rozpadu po kategoriích.
   */
  getShippedRevenue(from: Date, to: Date): Promise<ShippedRevenueSummary>;
}

export class PrismaReportRepository implements IReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getShippedRevenue(from: Date, to: Date): Promise<ShippedRevenueSummary> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: 'SHIPPED',
          shippedAt: { gte: from, lt: to }
        }
      },
      select: {
        quantity: true,
        // Do obratu vstupuje zafixovaná cena z objednávky, nikdy aktuální ceník
        unitPrice: true,
        product: {
          select: {
            categories: {
              select: {
                category: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    let totalRevenue = 0;
    let totalQuantity = 0;
    const byCategory = new Map<number, CategoryRevenueRow>();

    for (const item of items) {
      const revenue = item.unitPrice * item.quantity;
      totalRevenue += revenue;
      totalQuantity += item.quantity;

      // Produkt ve více kategoriích se započítá do každé z nich (vazba M:N)
      for (const link of item.product.categories) {
        const row = byCategory.get(link.category.id) ?? {
          categoryId: link.category.id,
          categoryName: link.category.name,
          revenue: 0,
          quantity: 0
        };
        row.revenue += revenue;
        row.quantity += item.quantity;
        byCategory.set(link.category.id, row);
      }
    }

    return {
      totalRevenue,
      totalQuantity,
      categories: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue)
    };
  }
}
