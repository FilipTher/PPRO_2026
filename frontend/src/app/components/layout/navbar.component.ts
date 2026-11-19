import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  isMenuOpen = false;
  lowStockCount = 0;
  hasCritical = false;

  ngOnInit(): void {
    this.loadLowStock();

    // Po každé navigaci zavřít mobilní menu a obnovit indikátor „co hoří“
    const subscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isMenuOpen = false;
        this.loadLowStock();
      });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  private loadLowStock(): void {
    this.reportService.getLowStockAlerts().subscribe({
      next: (res) => {
        if (res.success) {
          this.lowStockCount = res.data.length;
          this.hasCritical = res.data.some((alert) => alert.severity === 'CRITICAL');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }
}
