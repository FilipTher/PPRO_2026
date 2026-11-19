import { Routes } from '@angular/router';
import { ProductsPage } from './components/products/products.page';
import { StockPage } from './components/stock/stock.page';
import { InventoryPage } from './components/stock/inventory.page';
import { MovementsPage } from './components/stock/movements.page';
import { OrdersPage } from './components/orders/orders.page';
import { ComingSoonPage } from './components/coming-soon/coming-soon.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'produkty' },
  {
    path: 'dashboard',
    component: ComingSoonPage,
    data: {
      title: 'Dashboard',
      note: 'Přehled „co hoří“ a měsíční obrat po kategoriích přinese Krok 4.6.'
    }
  },
  { path: 'produkty', component: ProductsPage },
  { path: 'zasoby', component: StockPage },
  { path: 'inventura', component: InventoryPage },
  { path: 'pohyby', component: MovementsPage },
  { path: 'objednavky', component: OrdersPage },
  {
    path: 'reporty',
    component: ComingSoonPage,
    data: {
      title: 'Reporty',
      note: 'Alerty nízkých zásob a obrat po kategoriích přinese Krok 4.6.'
    }
  },
  { path: '**', redirectTo: 'produkty' }
];
