import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { StockService } from '../../services/stock.service';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';

interface InventoryRow {
  productId: number;
  productCode: string;
  productName: string;
  currentPhysical: number;
  counted: number | null;
}

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.page.html'
})
export class InventoryPage implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);

  overview: ProductStockOverview[] = [];
  warehouses: Warehouse[] = [];
  selectedWarehouseId: number | null = null;
  rows: InventoryRow[] = [];

  reason = '';
  isLoading = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadOverview();
  }

  loadWarehouses(): void {
    this.stockService.getWarehouses().subscribe({
      next: (res) => {
        if (res.success) {
          this.warehouses = res.data;
          if (this.selectedWarehouseId === null && this.warehouses.length > 0) {
            this.selectedWarehouseId = this.warehouses[0].id;
            this.buildRows();
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  loadOverview(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.stockService.getStockOverview().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.overview = res.data;
          this.buildRows();
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

  onWarehouseChange(): void {
    this.buildRows();
  }

  difference(row: InventoryRow): number | null {
    return row.counted === null ? null : row.counted - row.currentPhysical;
  }

  differenceLabel(row: InventoryRow): string {
    const diff = this.difference(row);
    if (diff === null) {
      return '—';
    }
    if (diff === 0) {
      return 'Stav souhlasí';
    }
    return diff > 0 ? `Přebytek +${diff} ks` : `Manko ${diff} ks`;
  }

  differenceClass(row: InventoryRow): string {
    const diff = this.difference(row);
    if (diff === null) return '';
    if (diff === 0) return 'diff-zero';
    return diff > 0 ? 'diff-positive' : 'diff-negative';
  }

  submit(): void {
    const counted = this.rows.filter((row) => row.counted !== null);

    if (counted.length === 0) {
      this.errorMessage = 'Zadejte alespoň jeden napočítaný stav.';
      return;
    }
    if (counted.some((row) => !Number.isInteger(row.counted) || (row.counted as number) < 0)) {
      this.errorMessage = 'Napočítaný stav musí být nezáporné celé číslo.';
      return;
    }

    const changed = counted.filter((row) => row.counted !== row.currentPhysical);
    if (changed.length === 0) {
      this.errorMessage = 'Všechny zadané stavy souhlasí, není co uložit.';
      return;
    }
    if (this.reason.trim().length === 0) {
      this.errorMessage = 'Důvod inventurního rozdílu je povinný.';
      return;
    }

    const warehouseId = this.selectedWarehouseId;
    if (warehouseId === null) {
      this.errorMessage = 'Vyberte sklad.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;

    const calls = changed.map((row) =>
      this.stockService.reconcileInventory({
        productId: row.productId,
        warehouseId,
        actualPhysicalQuantity: row.counted as number,
        reason: this.reason.trim()
      })
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = `Inventura uložena: ${changed.length} ${
          changed.length === 1 ? 'položka' : 'položky'
        }.`;
        this.reason = '';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.successMessage = null;
          this.cdr.markForCheck();
        }, 4000);
        this.loadOverview();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.error || 'Inventuru se nepodařilo uložit.';
        this.cdr.markForCheck();
      }
    });
  }

  private buildRows(): void {
    if (this.selectedWarehouseId === null) {
      this.rows = [];
      this.cdr.markForCheck();
      return;
    }

    const warehouseId = this.selectedWarehouseId;
    this.rows = this.overview.map((product) => {
      const stock = product.stocks.find((s) => s.warehouseId === warehouseId);
      return {
        productId: product.productId,
        productCode: product.productCode,
        productName: product.productName,
        currentPhysical: stock ? stock.physicalQuantity : 0,
        counted: null
      };
    });
    this.cdr.markForCheck();
  }
}
