import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService } from '../../services/stock.service';
import { ProductStockOverview } from '../../models/stock.model';

@Component({
  selector: 'app-stock-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock.page.html'
})
export class StockPage implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);

  overview: ProductStockOverview[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
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
}
