import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ReportService } from '../../services/report.service';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { LowStockAlert, MonthlyCategoryRevenue } from '../../models/report.model';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';

const MONTHS = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec'
];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly stockService = inject(StockService);
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly cdr = inject(ChangeDetectorRef);

  lowStock: LowStockAlert[] = [];
  stockOverview: ProductStockOverview[] = [];
  warehouses: Warehouse[] = [];
  products: Product[] = [];
  orders: Order[] = [];

  current: MonthlyCategoryRevenue | null = null;
  previous: MonthlyCategoryRevenue | null = null;
  currentLabel = '';
  previousLabel = '';

  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Rychlé naskladnění z panelu „co hoří“
  restockAlert: LowStockAlert | null = null;
  restockWarehouseId: number | null = null;
  restockQuantity = 1;
  restockNote = '';
  restockError: string | null = null;
  isRestocking = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const previousDate = new Date(year, month - 2, 1);
    const previousYear = previousDate.getFullYear();
    const previousMonth = previousDate.getMonth() + 1;

    this.currentLabel = monthLabel(year, month);
    this.previousLabel = monthLabel(previousYear, previousMonth);

    forkJoin({
      lowStock: this.reportService.getLowStockAlerts(),
      overview: this.stockService.getStockOverview(),
      warehouses: this.stockService.getWarehouses(),
      products: this.productService.getProducts(),
      orders: this.orderService.getOrders(),
      current: this.reportService.getCategoryTurnover(year, month),
      previous: this.reportService.getCategoryTurnover(previousYear, previousMonth)
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.lowStock = res.lowStock.data;
        this.stockOverview = res.overview.data;
        this.warehouses = res.warehouses.data;
        this.products = res.products.data;
        this.orders = res.orders.data;
        this.current = res.current.data;
        this.previous = res.previous.data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Dashboard se nepodařilo načíst. Zkontrolujte, že backend běží.';
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  get purchaseValue(): number {
    return this.totalValue('purchasePrice');
  }

  get sellingValue(): number {
    return this.totalValue('sellingPrice');
  }

  get piecesHk(): number {
    return this.piecesAt('WH-HK');
  }

  get piecesTrb(): number {
    return this.piecesAt('WH-TRB');
  }

  get pendingOrders(): number {
    return this.orders.filter((order) => order.status === 'RESERVED' || order.status === 'PENDING')
      .length;
  }

  barWidth(share: number): string {
    return `${Math.min(Math.max(share, 0), 100)}%`;
  }

  alertCountLabel(count: number): string {
    if (count === 1) {
      return '1 položka';
    }
    if (count >= 2 && count <= 4) {
      return `${count} položky`;
    }
    return `${count} položek`;
  }

  openRestock(alert: LowStockAlert): void {
    this.restockAlert = alert;
    this.restockWarehouseId = this.warehouses[0]?.id ?? null;
    this.restockQuantity = alert.recommendedQuantity > 0 ? alert.recommendedQuantity : 1;
    this.restockNote = '';
    this.restockError = null;
  }

  closeRestock(): void {
    this.restockAlert = null;
    this.restockError = null;
  }

  submitRestock(): void {
    if (!this.restockAlert) {
      return;
    }
    if (this.restockWarehouseId === null) {
      this.restockError = 'Vyberte sklad.';
      return;
    }
    if (!Number.isInteger(this.restockQuantity) || this.restockQuantity <= 0) {
      this.restockError = 'Množství musí být kladné celé číslo.';
      return;
    }

    this.isRestocking = true;
    this.restockError = null;

    this.stockService
      .receiveStock({
        productId: this.restockAlert.productId,
        warehouseId: this.restockWarehouseId,
        quantity: this.restockQuantity,
        note: this.restockNote.trim() || 'Rychlé naskladnění z dashboardu'
      })
      .subscribe({
        next: () => {
          this.isRestocking = false;
          this.successMessage = `Naskladněno ${this.restockQuantity} ks produktu '${this.restockAlert!.productName}'.`;
          this.closeRestock();
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.markForCheck();
          }, 4000);
          this.load();
        },
        error: (err) => {
          this.isRestocking = false;
          this.restockError = err.error?.error || 'Naskladnění se nepodařilo.';
          this.cdr.markForCheck();
        }
      });
  }

  private totalValue(priceField: 'purchasePrice' | 'sellingPrice'): number {
    return this.stockOverview.reduce((sum, product) => {
      const entity = this.products.find((p) => p.id === product.productId);
      if (!entity) {
        return sum;
      }
      return sum + product.totalPhysicalQuantity * entity[priceField];
    }, 0);
  }

  private piecesAt(warehouseCode: string): number {
    return this.stockOverview.reduce((sum, product) => {
      const stock = product.stocks.find((s) => s.warehouseCode === warehouseCode);
      return sum + (stock ? stock.physicalQuantity : 0);
    }, 0);
  }
}

function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}
