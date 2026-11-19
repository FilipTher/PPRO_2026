import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ReportService } from '../../services/report.service';
import { CategoryRevenue, LowStockAlert, MonthlyCategoryRevenue } from '../../models/report.model';

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
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.page.html'
})
export class ReportsPage implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly cdr = inject(ChangeDetectorRef);

  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  report: MonthlyCategoryRevenue | null = null;
  lowStock: LowStockAlert[] = [];

  isLoading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  get monthLabel(): string {
    return `${MONTHS[this.month - 1]} ${this.year}`;
  }

  get categoryCount(): number {
    return this.report ? this.report.categories.length : 0;
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = null;

    forkJoin({
      report: this.reportService.getCategoryTurnover(this.year, this.month),
      lowStock: this.reportService.getLowStockAlerts()
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.report = res.report.data;
        this.lowStock = res.lowStock.data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Reporty se nepodařilo načíst. Zkontrolujte, že backend běží.';
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  previousMonth(): void {
    if (this.month === 1) {
      this.month = 12;
      this.year -= 1;
    } else {
      this.month -= 1;
    }
    this.load();
  }

  nextMonth(): void {
    if (this.month === 12) {
      this.month = 1;
      this.year += 1;
    } else {
      this.month += 1;
    }
    this.load();
  }

  shareWidth(category: CategoryRevenue): string {
    return `${Math.min(Math.max(category.revenueSharePercent, 0), 100)}%`;
  }
}
