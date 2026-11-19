import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { MovementFilter, StockMovement, Warehouse } from '../../models/stock.model';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-movements-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movements.page.html'
})
export class MovementsPage implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly productService = inject(ProductService);
  private readonly cdr = inject(ChangeDetectorRef);

  movements: StockMovement[] = [];
  warehouses: Warehouse[] = [];
  products: Product[] = [];

  movementType = '';
  warehouseId: number | null = null;
  productId: number | null = null;
  searchText = '';

  isLoading = false;
  errorMessage: string | null = null;

  readonly movementTypes = [
    { value: 'RECEIPT', label: 'Příjem' },
    { value: 'DISPATCH', label: 'Výdej' },
    { value: 'TRANSFER_IN', label: 'Převod do' },
    { value: 'TRANSFER_OUT', label: 'Převod z' },
    { value: 'INVENTORY_ADJUSTMENT', label: 'Inventura' }
  ];

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadProducts();
    this.loadMovements();
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

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (res) => {
        if (res.success) {
          this.products = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  loadMovements(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const filters: MovementFilter = {
      productId: this.productId ?? undefined,
      warehouseId: this.warehouseId ?? undefined,
      movementType: this.movementType || undefined
    };

    this.stockService.getMovements(filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.movements = res.data;
        } else {
          this.errorMessage = res.error || 'Nepodařilo se načíst pohyby.';
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

  /** Fulltext nad načtenou historií (produkt, sklad, důvod, poznámka). */
  get filteredMovements(): StockMovement[] {
    const query = this.searchText.trim().toLowerCase();
    if (!query) {
      return this.movements;
    }

    return this.movements.filter((movement) =>
      [
        movement.product.code,
        movement.product.name,
        movement.warehouse.name,
        movement.warehouse.code,
        movement.reason ?? '',
        movement.note ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'RECEIPT':
        return 'Příjem';
      case 'DISPATCH':
        return 'Výdej';
      case 'TRANSFER_IN':
        return 'Převod do';
      case 'TRANSFER_OUT':
        return 'Převod z';
      case 'INVENTORY_ADJUSTMENT':
        return 'Inventura';
      default:
        return type;
    }
  }

  badgeClass(type: string): string {
    if (type === 'RECEIPT') return 'receipt';
    if (type === 'DISPATCH') return 'dispatch';
    if (type === 'INVENTORY_ADJUSTMENT') return 'inventory';
    return 'transfer';
  }
}
