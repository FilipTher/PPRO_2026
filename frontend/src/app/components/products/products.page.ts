import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { Product, CreateProductDto, Category } from '../../models/product.model';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.page.html'
})
export class ProductsPage implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  // Angular 22 běží zoneless, takže async callbacky musí překreslení vyžádat samy.
  private readonly cdr = inject(ChangeDetectorRef);

  products: Product[] = [];
  categories: Category[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Filtrování
  searchQuery = '';
  showOnlyActive = true;
  selectedCategoryId: number | null = null;

  // Dialog nového produktu
  isModalOpen = false;
  modalError: string | null = null;
  isSubmitting = false;

  newProduct: CreateProductDto = {
    code: '',
    name: '',
    description: '',
    purchasePrice: 0,
    sellingPrice: 0,
    minStockLimit: 5,
    categoryIds: []
  };

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (res) => {
        if (res.success) {
          this.categories = res.data;
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
    this.isLoading = true;
    this.errorMessage = null;

    this.productService
      .getProducts(
        this.searchQuery,
        this.showOnlyActive ? true : undefined,
        this.selectedCategoryId ?? undefined
      )
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.products = res.data;
          } else {
            this.errorMessage = res.error || 'Nepodařilo se načíst produkty.';
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

  onSearchChange(): void {
    this.loadProducts();
  }

  toggleActiveFilter(): void {
    this.showOnlyActive = !this.showOnlyActive;
    this.loadProducts();
  }

  onCategoryChange(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.loadProducts();
  }

  toggleCategory(categoryId: number): void {
    const selected = this.newProduct.categoryIds ?? [];
    this.newProduct.categoryIds = selected.includes(categoryId)
      ? selected.filter((id) => id !== categoryId)
      : [...selected, categoryId];
  }

  openCreateModal(): void {
    this.newProduct = {
      code: '',
      name: '',
      description: '',
      purchasePrice: 0,
      sellingPrice: 0,
      minStockLimit: 5,
      categoryIds: []
    };
    this.modalError = null;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.modalError = null;
  }

  submitCreate(): void {
    // Klientská předvalidace
    if (!this.newProduct.code.trim()) {
      this.modalError = 'Kód produktu je povinný.';
      return;
    }
    if (!this.newProduct.name.trim()) {
      this.modalError = 'Název produktu je povinný.';
      return;
    }
    if (this.newProduct.purchasePrice < 0) {
      this.modalError = 'Nákupní cena nesmí být záporná.';
      return;
    }
    if (this.newProduct.sellingPrice <= 0) {
      this.modalError = 'Prodejní cena musí být vyšší než 0 Kč.';
      return;
    }
    if (this.newProduct.sellingPrice < this.newProduct.purchasePrice) {
      this.modalError = 'Prodejní cena nesmí být nižší než nákupní cena (zákaz ztrátového prodeje).';
      return;
    }

    this.isSubmitting = true;
    this.modalError = null;

    this.productService.createProduct(this.newProduct).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.isModalOpen = false;
          this.showToast(`Produkt '${res.data.name}' byl úspěšně uložen do skladu!`);
          this.loadProducts();
        } else {
          this.modalError = res.error || 'Chyba při ukládání.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.modalError = err.error?.error || 'Chyba serveru při ukládání produktu.';
        this.cdr.markForCheck();
      }
    });
  }

  deactivateProduct(product: Product): void {
    if (!confirm(`Opravdu chcete deaktivovat produkt "${product.name}"?`)) {
      return;
    }

    this.productService.deactivateProduct(product.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast(`Produkt '${product.name}' byl deaktivován.`);
          this.loadProducts();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Nepodařilo se produkt deaktivovat.';
        this.cdr.markForCheck();
      }
    });
  }

  calculateMargin(purchase: number, selling: number): number {
    if (purchase <= 0) return 100;
    return Math.round(((selling - purchase) / purchase) * 100);
  }

  showToast(message: string): void {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = null;
      this.cdr.markForCheck();
    }, 4000);
  }
}
