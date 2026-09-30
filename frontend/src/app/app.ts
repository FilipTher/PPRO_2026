import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from './services/product.service';
import { Product, CreateProductDto } from './models/product.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  private readonly productService = inject(ProductService);

  products: Product[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Filtrování
  searchQuery = '';
  showOnlyActive = true;

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
    minStockLimit: 5
  };

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.productService.getProducts(this.searchQuery, this.showOnlyActive ? true : undefined).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.products = res.data;
        } else {
          this.errorMessage = res.error || 'Nepodařilo se načíst produkty.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Chyba připojení k backendu. Ujistěte se, že server běží.';
        console.error(err);
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

  openCreateModal(): void {
    this.newProduct = {
      code: '',
      name: '',
      description: '',
      purchasePrice: 0,
      sellingPrice: 0,
      minStockLimit: 5
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
      },
      error: (err) => {
        this.isSubmitting = false;
        this.modalError = err.error?.error || 'Chyba serveru při ukládání produktu.';
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
      },
      error: (err) => {
        this.errorMessage = 'Nepodařilo se produkt deaktivovat.';
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
    }, 4000);
  }
}
