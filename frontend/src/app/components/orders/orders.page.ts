import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { StockService } from '../../services/stock.service';
import {
  CreateCustomerDto,
  CreateOrderDto,
  Customer,
  Order,
  OrderStatus
} from '../../models/order.model';
import { Product } from '../../models/product.model';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';

interface OrderItemRow {
  productId: number | null;
  warehouseId: number | null;
  quantity: number;
}

const emptyCustomer: CreateCustomerDto = {
  name: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  zip: ''
};

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.page.html'
})
export class OrdersPage implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly customerService = inject(CustomerService);
  private readonly productService = inject(ProductService);
  private readonly stockService = inject(StockService);
  private readonly cdr = inject(ChangeDetectorRef);

  orders: Order[] = [];
  customers: Customer[] = [];
  products: Product[] = [];
  warehouses: Warehouse[] = [];
  stockOverview: ProductStockOverview[] = [];

  statusFilter: '' | OrderStatus = '';
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Dialog tvorby objednávky
  isCreateOpen = false;
  customerMode: 'existing' | 'new' = 'existing';
  selectedCustomerId: number | null = null;
  newCustomer: CreateCustomerDto = { ...emptyCustomer };
  itemRows: OrderItemRow[] = [];
  createError: string | null = null;
  isSubmitting = false;

  // Detail objednávky
  detailOrder: Order | null = null;

  readonly statusOptions: { value: '' | OrderStatus; label: string }[] = [
    { value: '', label: 'Vše' },
    { value: 'PENDING', label: 'K rezervaci' },
    { value: 'RESERVED', label: 'K expedici' },
    { value: 'SHIPPED', label: 'Odesláno' },
    { value: 'CANCELLED', label: 'Stornováno' }
  ];

  ngOnInit(): void {
    this.loadOrders();
    this.loadCustomers();
    this.loadProducts();
    this.loadStock();
    this.loadWarehouses();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.orderService.getOrders(this.statusFilter || undefined).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.orders = res.data;
        } else {
          this.errorMessage = res.error || 'Nepodařilo se načíst objednávky.';
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

  loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (res) => {
        if (res.success) {
          this.customers = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error(err)
    });
  }

  loadProducts(): void {
    this.productService.getProducts(undefined, true).subscribe({
      next: (res) => {
        if (res.success) {
          this.products = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error(err)
    });
  }

  loadStock(): void {
    this.stockService.getStockOverview().subscribe({
      next: (res) => {
        if (res.success) {
          this.stockOverview = res.data;
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error(err)
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
      error: (err) => console.error(err)
    });
  }

  orderTotal(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'K rezervaci';
      case 'RESERVED':
        return 'K expedici';
      case 'SHIPPED':
        return 'Odesláno';
      case 'CANCELLED':
        return 'Stornováno';
      case 'REJECTED':
        return 'Odmítnuto';
      default:
        return status;
    }
  }

  statusClass(status: string): string {
    return `order-status ${status.toLowerCase()}`;
  }

  openCreate(): void {
    this.customerMode = this.customers.length > 0 ? 'existing' : 'new';
    this.selectedCustomerId = this.customers[0]?.id ?? null;
    this.newCustomer = { ...emptyCustomer };
    this.itemRows = [];
    this.addItemRow();
    this.createError = null;
    this.isCreateOpen = true;
  }

  closeCreate(): void {
    this.isCreateOpen = false;
    this.createError = null;
  }

  addItemRow(): void {
    this.itemRows.push({
      productId: this.products[0]?.id ?? null,
      warehouseId: this.warehouses[0]?.id ?? null,
      quantity: 1
    });
  }

  removeItemRow(index: number): void {
    this.itemRows.splice(index, 1);
  }

  /** Volné kusy produktu na skladu – pro okamžitou kontrolu ve formuláři. */
  availableAt(productId: number | null, warehouseId: number | null): number {
    if (productId === null || warehouseId === null) {
      return 0;
    }
    const product = this.stockOverview.find((p) => p.productId === productId);
    const stock = product?.stocks.find((s) => s.warehouseId === warehouseId);
    return stock ? stock.availableQuantity : 0;
  }

  rowError(row: OrderItemRow): string | null {
    if (row.productId === null || row.warehouseId === null) {
      return 'Vyberte produkt i sklad.';
    }
    if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
      return 'Množství musí být kladné celé číslo.';
    }
    const available = this.availableAt(row.productId, row.warehouseId);
    if (row.quantity > available) {
      return `Na skladě je volných pouze ${available} ks.`;
    }
    return null;
  }

  createTotal(): number {
    return this.itemRows.reduce((sum, row) => {
      const product = this.products.find((p) => p.id === row.productId);
      return sum + (product ? product.sellingPrice * row.quantity : 0);
    }, 0);
  }

  /** Blokace uložení při nevalidních položkách nebo chybějícím zákazníkovi. */
  createBlocked(): boolean {
    if (this.itemRows.length === 0) {
      return true;
    }
    if (this.itemRows.some((row) => this.rowError(row) !== null)) {
      return true;
    }
    if (this.customerMode === 'existing') {
      return this.selectedCustomerId === null;
    }
    return !this.newCustomer.name.trim() || !this.newCustomer.email.trim();
  }

  submitCreate(): void {
    if (this.customerMode === 'existing' && this.selectedCustomerId === null) {
      this.createError = 'Vyberte zákazníka.';
      return;
    }
    if (this.customerMode === 'new') {
      if (!this.newCustomer.name.trim() || !this.newCustomer.email.trim()) {
        this.createError = 'Jméno a e-mail zákazníka jsou povinné.';
        return;
      }
    }
    if (this.itemRows.length === 0) {
      this.createError = 'Objednávka musí mít alespoň jednu položku.';
      return;
    }

    const invalidRow = this.itemRows.find((row) => this.rowError(row) !== null);
    if (invalidRow) {
      this.createError = this.rowError(invalidRow);
      return;
    }

    const customer =
      this.customerMode === 'existing'
        ? this.customerDtoFrom(
            this.customers.find((c) => c.id === this.selectedCustomerId)!
          )
        : this.newCustomer;

    const dto: CreateOrderDto = {
      customer,
      items: this.itemRows.map((row) => ({
        productId: row.productId as number,
        warehouseId: row.warehouseId as number,
        quantity: row.quantity
      }))
    };

    this.isSubmitting = true;
    this.createError = null;

    this.orderService.createOrder(dto).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.isCreateOpen = false;
        this.showToast(`Objednávka ${res.data.orderNumber} byla rezervována.`);
        this.loadOrders();
        this.loadCustomers();
        this.loadStock();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.createError = err.error?.error || 'Objednávku se nepodařilo založit.';
        this.cdr.markForCheck();
      }
    });
  }

  ship(order: Order): void {
    this.orderService.shipOrder(order.id).subscribe({
      next: (res) => {
        this.showToast(`Objednávka ${order.orderNumber} expedována.`);
        if (this.detailOrder?.id === order.id) {
          this.detailOrder = res.data;
        }
        this.loadOrders();
        this.loadStock();
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Expedice se nepodařila.';
        this.cdr.markForCheck();
      }
    });
  }

  cancel(order: Order): void {
    const reason = prompt(`Důvod storna objednávky ${order.orderNumber}:`);
    if (!reason || reason.trim().length === 0) {
      return;
    }

    this.orderService.cancelOrder(order.id, reason.trim()).subscribe({
      next: () => {
        this.showToast(`Objednávka ${order.orderNumber} byla stornována.`);
        if (this.detailOrder?.id === order.id) {
          this.detailOrder = null;
        }
        this.loadOrders();
        this.loadStock();
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Storno se nepodařilo.';
        this.cdr.markForCheck();
      }
    });
  }

  openDetail(order: Order): void {
    this.orderService.getOrderById(order.id).subscribe({
      next: (res) => {
        this.detailOrder = res.data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = 'Detail objednávky se nepodařilo načíst.';
        console.error(err);
        this.cdr.markForCheck();
      }
    });
  }

  closeDetail(): void {
    this.detailOrder = null;
  }

  showToast(message: string): void {
    this.successMessage = message;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.successMessage = null;
      this.cdr.markForCheck();
    }, 4000);
  }

  private customerDtoFrom(customer: Customer): CreateCustomerDto {
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      street: customer.street,
      city: customer.city,
      zip: customer.zip
    };
  }
}
