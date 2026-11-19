import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock.page.html'
})
export class StockPage implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);

  overview: ProductStockOverview[] = [];
  warehouses: Warehouse[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Dialog příjmu na sklad
  receiptProduct: ProductStockOverview | null = null;
  receiptWarehouseId: number | null = null;
  receiptQuantity = 1;
  receiptNote = '';
  receiptError: string | null = null;
  isReceiptSubmitting = false;

  // Dialog přesunu mezi sklady
  transferProduct: ProductStockOverview | null = null;
  transferSourceId: number | null = null;
  transferTargetWarehouseId: number | null = null;
  transferQuantity = 1;
  transferNote = '';
  transferError: string | null = null;
  isTransferSubmitting = false;

  ngOnInit(): void {
    this.loadWarehouses();
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.stockService.getStockOverview().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.overview = res.data;
        } else {
          this.errorMessage = res.error || 'Nepodařilo se načíst zásoby.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Chyba připojení k backendu. Ujistěte se, že server běží.';
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  loadWarehouses(): void {
    this.stockService.getWarehouses().subscribe({
      next: (res) => {
        if (res.success) {
          this.warehouses = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  /** Volné kusy produktu na konkrétním skladu (pro validaci přesunu v UI). */
  availableAt(product: ProductStockOverview, warehouseId: number | null): number {
    const stock = product.stocks.find((s) => s.warehouseId === warehouseId);
    return stock ? stock.availableQuantity : 0;
  }

  openReceipt(product: ProductStockOverview): void {
    this.receiptProduct = product;
    this.receiptWarehouseId = this.warehouses[0]?.id ?? product.stocks[0]?.warehouseId ?? null;
    this.receiptQuantity = 1;
    this.receiptNote = '';
    this.receiptError = null;
  }

  closeReceipt(): void {
    this.receiptProduct = null;
    this.receiptError = null;
  }

  submitReceipt(): void {
    if (!this.receiptProduct) {
      return;
    }
    if (this.receiptWarehouseId === null) {
      this.receiptError = 'Vyberte sklad.';
      return;
    }
    if (!Number.isInteger(this.receiptQuantity) || this.receiptQuantity <= 0) {
      this.receiptError = 'Množství musí být kladné celé číslo.';
      return;
    }

    this.isReceiptSubmitting = true;
    this.receiptError = null;

    this.stockService
      .receiveStock({
        productId: this.receiptProduct.productId,
        warehouseId: this.receiptWarehouseId,
        quantity: this.receiptQuantity,
        note: this.receiptNote.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.isReceiptSubmitting = false;
          this.showToast(`Naskladněno ${this.receiptQuantity} ks produktu '${this.receiptProduct!.productName}'.`);
          this.closeReceipt();
          this.load();
        },
        error: (err) => {
          this.isReceiptSubmitting = false;
          this.receiptError = err.error?.error || 'Příjem na sklad se nepodařil.';
          this.cdr.markForCheck();
        }
      });
  }

  openTransfer(product: ProductStockOverview): void {
    const withStock = product.stocks.find((s) => s.availableQuantity > 0);
    const source = withStock ?? product.stocks[0];
    const target = product.stocks.find((s) => s.warehouseId !== source?.warehouseId);

    this.transferProduct = product;
    this.transferSourceId = source?.warehouseId ?? null;
    this.transferTargetWarehouseId = target?.warehouseId ?? null;
    this.transferQuantity = 1;
    this.transferNote = '';
    this.transferError = null;
  }

  closeTransfer(): void {
    this.transferProduct = null;
    this.transferError = null;
  }

  submitTransfer(): void {
    if (!this.transferProduct) {
      return;
    }
    if (this.transferSourceId === null || this.transferTargetWarehouseId === null) {
      this.transferError = 'Vyberte zdrojový i cílový sklad.';
      return;
    }
    if (this.transferSourceId === this.transferTargetWarehouseId) {
      this.transferError = 'Zdrojový a cílový sklad nesmí být stejný.';
      return;
    }
    if (!Number.isInteger(this.transferQuantity) || this.transferQuantity <= 0) {
      this.transferError = 'Množství musí být kladné celé číslo.';
      return;
    }

    const available = this.availableAt(this.transferProduct, this.transferSourceId);
    if (this.transferQuantity > available) {
      this.transferError = `Na zdrojovém skladu je volných pouze ${available} ks.`;
      return;
    }

    this.isTransferSubmitting = true;
    this.transferError = null;

    this.stockService
      .transferStock({
        productId: this.transferProduct.productId,
        sourceWarehouseId: this.transferSourceId,
        targetWarehouseId: this.transferTargetWarehouseId,
        quantity: this.transferQuantity,
        note: this.transferNote.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.isTransferSubmitting = false;
          this.showToast(`Přesunuto ${this.transferQuantity} ks produktu '${this.transferProduct!.productName}'.`);
          this.closeTransfer();
          this.load();
        },
        error: (err) => {
          this.isTransferSubmitting = false;
          this.transferError = err.error?.error || 'Přesun mezi sklady se nepodařil.';
          this.cdr.markForCheck();
        }
      });
  }

  showToast(message: string): void {
    this.successMessage = message;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.successMessage = null;
      this.cdr.markForCheck();
    }, 4000);
  }
}
