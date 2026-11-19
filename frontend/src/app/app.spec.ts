import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { ProductService } from './services/product.service';
import { CategoryService } from './services/category.service';
import { StockService } from './services/stock.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: ProductService,
          useValue: {
            getProducts: () => of({ success: true, data: [] }),
            createProduct: () => of({ success: true, data: {} }),
            deactivateProduct: () => of({ success: true, data: {} })
          }
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => of({ success: true, data: [] })
          }
        },
        {
          provide: StockService,
          useValue: {
            getStockOverview: () => of({ success: true, data: [] })
          }
        }
      ]
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Dřevěnka s.r.o.');
  });
});
