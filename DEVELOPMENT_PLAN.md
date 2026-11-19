# Detailní plán vývoje semestrálního projektu PPRO (2026/2027)
## Zadání B: Sklad pro malý e-shop (Dřevěnka s.r.o.)

Tento dokument slouží jako **kompletní vývojová mapa a zásobník mikrozadání** pro inkrementální vývoj skladového systému. Projekt striktně dodržuje třívrstvou architekturu, relační databázi s migracemi, automatizované testování a jednopříkazové spuštění přes Docker Compose.

> **AKTUÁLNÍ STAV VÝVOJE (Kde jsme skončili)**:
> - **Poslední dokončený krok**: **Krok 3.2 – Alerty kritických zásob („Co hoří“)** `[DOKONČENO]`
> - **Příští krok na řadě**: **Krok 4.1: Routing, Navigace a Responzivní Shell aplikace**
> - **Celkem automatizovaných testů**: **128 testů** (100% průchodnost)

---

## Přehled fází a stavu projektu

| Fáze | Název fáze | Zaměření | Stav |
|---|---|---|---|
| **Fáze 0** | **Projektový základ & Vertikální řez Produkt** | Schéma DB, Docker, architektura vrstev, entita `Product` (CRUD, validace cen, soft delete, 12 testů, Angular UI). | **HOTOVO** |
| **Fáze 1** | **Jádro skladových zásob a pohybů (Stock & Movements)** | Disponibilita vs. fyzický stav, zákaz záporných stavů, naskladnění, přesun mezi sklady HK a Třebechovice, inventura a audit log. | **ROZPRACOVÁNO (Kroky 1.1 a 1.2 hotovy)** |
| **Fáze 2** | **Objednávky a rezervace (Kde se návrh láme)** | Životní cyklus objednávky (`PENDING` -> `RESERVED` -> `SHIPPED` / `CANCELLED`), fixace cen položek, odmítnutí při nedostatku, objednávka ze 2 skladů. | **PŘIPRAVENO** |
| **Fáze 3** | **Reporting a manažerské alerty** | Alerty zásob pod minimem („co hoří“), měsíční obrat po kategoriích, doporučení k doobjednání. | **PŘIPRAVENO** |
| **Fáze 4** | **Frontend aplikace (Angular SPA & Mobilní UI)** | Modulární routing, zobrazení skladů, dialog naskladnění a přesunu, modul inventury, expedice objednávek, manažerský dashboard. | **PŘIPRAVENO** |
| **Fáze 5** | **Dokumentace, Docker & Příprava na obhajobu** | Obohacení seed dat, Docker Compose ověření, aktualizace [README.md](file:///u:/PPRO/README.md), finální testy. | **PŘIPRAVENO** |

---

## FÁZE 1: Jádro skladových zásob a auditních pohybů

V této fázi vybudujeme doménovou logiku pro práci se sklady a pohyby. Zde se láme klíčový požadavek klienta: *"Každá změna stavu zásob musí být dohledatelná. Chci vidět, proč jich je sedmnáct a ne dvacet."* a *"Vydat víc, než je na skladě, nesmí jít."*

---

### Krok 1.1: Repozitáře a typy pro Sklady, Zásoby a Pohyby [DOKONČENO]
- **Cíl**: Vytvořit typové definice (DTOs, filtry, návratové typy) a rozhraní repozitářů pro entity `Warehouse`, `WarehouseStock` a `StockMovement`.
- **Co se vytvoří / upraví**:
  - `backend/src/types/stock.types.ts`: Typy pro příjem na sklad, přesun mezi sklady, inventuru, filtry pohybů a agregované stavy.
  - `backend/src/repositories/stock.repository.ts`: Rozhraní `IStockRepository` a implementace `PrismaStockRepository` s metodami:
    - `findStocksByProductId(productId: number)`
    - `findStock(warehouseId: number, productId: number)`
    - `findAllWarehouses()`
    - `recordMovement(...)` – zápis auditní stopy
    - `updateStockQuantities(...)` – atomická změna fyzického/rezervovaného stavu
    - `getMovements(filters)` – vyhledávání v historii pohybů
- **Doménová integrita**: Transakční bezpečnost při souběžné změně stavu a zápisu pohybu.
- **Verifikace**: TypeScript kompilace bez chyb.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 1.1: Vytvoř typy pro skladové zásoby v `backend/src/types/stock.types.ts` a implementuj `IStockRepository` a `PrismaStockRepository` v `backend/src/repositories/stock.repository.ts`. Zajisti transakční zápis změn zásob a pohybů."*

---

### Krok 1.2: Doménová služba `StockService` (Příjem na sklad & Audit log) [DOKONČENO]
- **Cíl**: Implementovat čistou doménovou logiku pro příjem zboží na sklad (`RECEIPT`) s garancí neměnné historie a zákazu záporných stavů.
- **Co se vytvoří / upraví**:
  - `backend/src/services/stock.service.ts`: Metoda `receiveStock(dto: ReceiveStockDto)`.
  - Kontrola: Množství příjmu musí být kladné celé číslo (`qty > 0`). Produkt i sklad musí existovat a být aktivní.
  - Přepočet nového stavu a automatické vytvoření auditního záznamu `StockMovement` s `movementType: 'RECEIPT'`, `quantityChange: +qty`, `quantityAfter: newPhysical`.
  - `backend/tests/stock.service.test.ts`: Sada unit testů s in-memory mockem pro ověření výpočtů a validačních chyb.
- **Doménová integrita**: Žádná změna fyzického stavu neproběhne bez odpovídajícího záznamu ve `StockMovement`.
- **Verifikace**: `npm test` projde všemi novými testy.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 1.2: Vytvoř doménovou službu `StockService` v `backend/src/services/stock.service.ts` s metodou pro příjem zboží na sklad (`receiveStock`) a vytvořením auditního pohybu `RECEIPT`. Pokryj metodu unit testy v `backend/tests/stock.service.test.ts`."*

---

### Krok 1.3: Přesun mezi sklady a Modul Inventury (ADR-003, ADR-005)
- **Cíl**: Realizovat přesun zboží mezi centrálním skladem v HK a sezónní garáží v Třebechovicích a modul inventurního narovnání stavu.
- **Co se vytvoří / upraví**:
  - `backend/src/services/stock.service.ts`:
    - Metoda `transferStock(dto: TransferStockDto)`:
      - Validace: Zdrojový a cílový sklad se nesmí rovnat.
      - Kontrola disponibility na zdrojovém skladu: `(physicalQuantity - reservedQuantity) >= qty`. Pokud ne, vyhodí `DomainValidationError('Nedostatek volných zásob pro přesun')`.
      - Atomická operace: Snížení fyzické zásoby ve zdroji, zvýšení v cíli.
      - Vytvoření 2 spárovaných pohybů: `TRANSFER_OUT` na zdroji a `TRANSFER_IN` na cíli s odkazem na číslo převodky.
    - Metoda `reconcileInventory(dto: InventoryAdjustmentDto)`:
      - Zadání zjištěného fyzického stavu (`actualPhysicalQuantity >= 0`).
      - Výpočet rozdílu: `diff = actualPhysicalQuantity - currentPhysicalQuantity`.
      - Pokud `diff === 0`, operace se přeskočí.
      - Nastavení nového fyzického stavu a vytvoření pohybu `INVENTORY_ADJUSTMENT` s povinným textovým důvodem (např. *Manko při inventuře garáže*).
  - Rozšíření unit testů v `backend/tests/stock.service.test.ts` pro mezní případy (nedostatek zásob, záporný stav, shodný zdroj/cíl).
- **Doménová integrita**: Zákaz záporného stavu na jakémkoli skladu; přesun je atomický (buď se provede celý, nebo selže).
- **Verifikace**: Všechny unit testy v `stock.service.test.ts` pro transfer a inventuru procházejí.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 1.3: Doplň do `StockService` metody pro mezi-skladový přesun (`transferStock`) a inventurní narovnání (`reconcileInventory`) včetně zápisu spárovaných pohybů. Přidej komplexní unit testy do `backend/tests/stock.service.test.ts`."*

---

### Krok 1.4: REST API kontrolery, routy a integrační testy pro Sklady a Pohyby
- **Cíl**: Vystavit API rozhraní pro skladové operace a auditní stopu a pokrýt je integračními HTTP testy.
- **Co se vytvoří / upraví**:
  - `backend/src/controllers/stock.controller.ts`:
    - `GET /api/stock/warehouses` – seznam skladů
    - `GET /api/stock/overview` – přehled zásob podle skladů a produktů
    - `POST /api/stock/receipt` – příjem na sklad
    - `POST /api/stock/transfer` – přesun mezi sklady
    - `POST /api/stock/inventory` – inventura
    - `GET /api/stock/movements` – historie pohybů s filtrováním (podle produktu, skladu, typu pohybu a data)
  - `backend/src/routes/stock.routes.ts` a napojení do `backend/src/app.ts`.
  - `backend/tests/stock.api.test.ts`: Integrační testy přes Supertest nad SQLite (úspěšný příjem, přesun, chybové stavy).
- **Verifikace**: `npm test` spustí a projde unit i integrační testy.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 1.4: Vytvoř `StockController` a router v `backend/src/controllers/stock.controller.ts` a `backend/src/routes/stock.routes.ts`. Připoj routy do `app.ts` a otestuj integračními testy v `backend/tests/stock.api.test.ts`."*

---

## FÁZE 2: Objednávkový systém a rezervace (Kde se návrh láme)

Tato fáze řeší ústřední problém klienta: *"Dvakrát měsíčně se stane, že se prodá něco, co není. Zákazníkovi pak volám a omlouvám se, a to je ta nejhorší část mojí práce."* Zavedeme striktní rezervace, disponibilitu a ochranu cen.

---

### Krok 2.1: Repozitáře a DTO pro Zákazníky a Objednávky
- **Cíl**: Zadefinovat typové rozhraní pro správu zákazníků a objednávek včetně položek a zafixovaných cen.
- **Co se vytvoří / upraví**:
  - `backend/src/types/order.types.ts`: DTOs pro vytvoření objednávky, položky objednávky, změnu stavu a filtry.
  - `backend/src/repositories/order.repository.ts`: Rozhraní `IOrderRepository` a implementace `PrismaOrderRepository`:
    - `createOrderWithItems(...)`
    - `findOrderById(id: number)`
    - `findOrderByNumber(orderNumber: string)`
    - `findAllOrders(filters)`
    - `updateOrderStatus(id: number, status: OrderStatus, shippedAt?: Date)`
    - `updateOrderItems(...)`
  - `backend/src/repositories/customer.repository.ts`: Metody pro nalezení nebo vytvoření zákazníka (zákazník se nikdy nemaže).
- **Doménová integrita**: Fixace ceny položky (`OrderItem.unitPrice`) při vytvoření objednávky.
- **Verifikace**: Typová kontrola bez chyb.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 2.1: Implementuj typy a repozitáře pro zákazníky a objednávky v `backend/src/types/order.types.ts`, `backend/src/repositories/order.repository.ts` a `backend/src/repositories/customer.repository.ts`."*

---

### Krok 2.2: Doménová služba `OrderService` – Rezervace a Odmítnutí při nedostatku
- **Cíl**: Vytvořit metodu pro založení objednávky s přísnou kontrolou disponibilního stavu a atomickou rezervací.
- **Co se vytvoří / upraví**:
  - `backend/src/services/order.service.ts`: Metoda `createOrder(dto: CreateOrderDto)`.
  - **Klíčové obchodní pravidlo**:
    - Pro každou položku se ověří skladová karta daného produktu na daném skladu.
    - Výpočet: `availableQuantity = physicalQuantity - reservedQuantity`.
    - Pokud `requestedQuantity > availableQuantity`, operace je **okamžitě odmítnuta** s výjimkou `DomainValidationError('Nedostatek zásob: Produkt X má na skladě Y volných pouze Z kusů.')`.
    - Pokud je dostatek: v jedné databázové transakci se navýší `reservedQuantity += requestedQuantity`, objednávka přejde do stavu `RESERVED` a cena se zafixuje z aktuálního `Product.sellingPrice`.
  - `backend/tests/order.service.test.ts`: Unit testy (úspěšná rezervace, odmítnutí při nedostatku, fixace cen).
- **Doménová integrita**: Žádná objednávka nevznikne, pokud by její rezervace překročila disponibilní stav.
- **Verifikace**: Unit testy v `order.service.test.ts` procházejí na 100 %.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 2.2: Vytvoř `OrderService` v `backend/src/services/order.service.ts` s metodou `createOrder`. Implementuj kontrolu disponibilního stavu, okamžitou rezervaci a fixaci cen. Pokryj unit testy v `backend/tests/order.service.test.ts`."*

---

### Krok 2.3: Expedice objednávky (`SHIPPED`) a Storno (`CANCELLED`)
- **Cíl**: Implementovat proces fyzického výdeje ze skladu při expedici a uvolnění rezervací při stornu.
- **Co se vytvoří / upraví**:
  - `backend/src/services/order.service.ts`:
    - Metoda `shipOrder(orderId: number)`:
      - Validace: Objednávka musí být ve stavu `RESERVED`.
      - Pro každou položku: `physicalQuantity -= item.quantity`, `reservedQuantity -= item.quantity`.
      - Zápis do audit logu `StockMovement`: `movementType: 'DISPATCH'`, `quantityChange: -item.quantity`, `orderId: order.id`.
      - Přechod objednávky do stavu `SHIPPED`, nastavení `shippedAt: new Date()`.
    - Metoda `cancelOrder(orderId: number, reason: string)`:
      - Validace: Expedovanou objednávku již nelze stornovat (pouze reklamace/vratka).
      - Uvolnění rezervace: `reservedQuantity -= item.quantity`.
      - Přechod do stavu `CANCELLED`.
  - Rozšíření testů v `backend/tests/order.service.test.ts`.
- **Doménová integrita**: Fyzický odpis ze skladu nastává pouze při skutečné expedici, nikdy dříve.
- **Verifikace**: Testy na přechody stavů a záznam auditních pohybů procházejí.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 2.3: Přidej do `OrderService` metody pro expedici (`shipOrder`) a storno objednávky (`cancelOrder`). Zajisti korektní odpis fyzických zásob a zápis pohybu `DISPATCH`. Doplň unit testy do `backend/tests/order.service.test.ts`."*

---

### Krok 2.4: Objednávka ze dvou skladů a Editace před expedicí (ADR-003, ADR-007)
- **Cíl**: Umožnit rozdělení položek objednávky mezi Hradec a Třebechovice a povolit editaci položek do okamžiku expedice s přepočtem rezervací.
- **Co se vytvoří / upraví**:
  - `backend/src/services/order.service.ts`:
    - Podpora položek z různých skladů v rámci jedné objednávky (každý `OrderItem` má svůj `warehouseId`).
    - Metoda `updateOrderItems(orderId: number, newItems: OrderItemDto[])`:
      - Validace stavu: Pouze pokud stav !== `SHIPPED`.
      - Atomický přepočet: Staré rezervace se vrátí, ověří se disponibilita pro nové položky a založí se nové rezervace.
  - Unit testy pro kombinovanou objednávku a editaci před expedicí.
- **Doménová integrita**: Editace nikdy nesmí způsobit přečerpání disponibilních zásob.
- **Verifikace**: Testy úspěšně projdou.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 2.4: Doplň do `OrderService` podporu expedice z více skladů naráz a metodu pro editaci položek před expedicí (`updateOrderItems`) s přepočtem rezervací. Doplň unit testy."*

---

### Krok 2.5: REST API pro Zákazníky a Objednávky + Integrační testy
- **Cíl**: Vystavit kompletní REST API pro správu objednávek a zákazníků a ověřit HTTP komunikaci.
- **Co se vytvoří / upraví**:
  - `backend/src/controllers/order.controller.ts`:
    - `POST /api/orders` – vytvoření objednávky (vrátí 400 při nedostatku zásob)
    - `GET /api/orders` – seznam objednávek s filtrováním podle stavu
    - `GET /api/orders/:id` – detail objednávky včetně položek a zákazníka
    - `POST /api/orders/:id/ship` – expedice objednávky
    - `POST /api/orders/:id/cancel` – storno objednávky
    - `PUT /api/orders/:id/items` – editace položek
  - `backend/src/routes/order.routes.ts` a zapojení do `app.ts`.
  - `backend/tests/order.api.test.ts`: Integrační testy životního cyklu objednávky.
- **Verifikace**: Všechny integrační testy projdou.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 2.5: Implementuj `OrderController` a router v `backend/src/controllers/order.controller.ts` a `backend/src/routes/order.routes.ts`. Připoj do `app.ts` a vytvoř integrační testy v `backend/tests/order.api.test.ts`."*

---

## FÁZE 3: Reporting & Manažerské přehledy

V této fázi naplníme požadavky klienta na přehled o byznysu: *"Minimální zásoba a co doobjednat hned na úvodní stránce"* a *"Obrat po kategoriích za měsíc – chci vědět, co mě živí."*

---

### Krok 3.1: Doménová služba a API pro Měsíční obrat po kategoriích
- **Cíl**: Implementovat kalkulaci obratu (tržeb a počtu prodaných kusů) agregovanou podle kategorií hraček za zadaný kalendářní měsíc.
- **Co se vytvoří / upraví**:
  - `backend/src/services/report.service.ts`:
    - Metoda `getMonthlyCategoryRevenue(year: number, month: number)`:
      - Agregace dat z tabulky `Order` ve stavu `SHIPPED` pro daný měsíc.
      - Propojení přes `OrderItem` -> `Product` -> `ProductCategory` -> `Category`.
      - Výpočet: Celkový obrat v Kč, celkový počet prodaných kusů, procentuální podíl na celkových tržbách firmy.
  - `backend/src/controllers/report.controller.ts` a routa `GET /api/reports/category-turnover`.
  - `backend/tests/report.service.test.ts`: Test správnosti výpočtu tržeb a ignorování neexpedovaných objednávek.
- **Doménová integrita**: Do obratu se započítávají výhradně expedované (`SHIPPED`) objednávky a zafixované ceny v `OrderItem.unitPrice`.
- **Verifikace**: Testy projdou.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 3.1: Implementuj `ReportService` pro výpočet měsíčního obratu po kategoriích v `backend/src/services/report.service.ts` a vystav endpoint `GET /api/reports/category-turnover`. Napiš unit testy v `backend/tests/report.service.test.ts`."*

---

### Krok 3.2: Vyhodnocení kritických zásob pod minimem („Co hoří“)
- **Cíl**: Agregovat produkty, jejichž celková fyzická zásoba napříč sklady (nebo na konkrétním skladu) klesla pod limit `Product.minStockLimit`.
- **Co se vytvoří / upraví**:
  - `backend/src/services/report.service.ts`:
    - Metoda `getLowStockAlerts()`:
      - Vrátí seznam produktů se stavem `physicalQuantity <= minStockLimit`.
      - Spočítá doporučené množství k doobjednání / výrobě.
      - Barevná závažnost alertu: `CRITICAL` (stav 0), `WARNING` (stav <= minimum).
  - API endpoint `GET /api/reports/low-stock`.
  - Unit testy ověřující správné detekování kritických stavů.
- **Verifikace**: Testy projdou.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 3.2: Přidej do `ReportService` vyhodnocení nízkých zásob pod minimem (`getLowStockAlerts`) s doporučením k doobjednání. Vystav endpoint `GET /api/reports/low-stock` a otestuj."*

---

## FÁZE 4: Frontend aplikace (Angular SPA & Mobilní UI)

Klient Petr Doležal: *"Ať to jde používat i z mobilu, já jsem půlku dne ve skladu. Nejradši bych to měl barevně, ať vidím, co hoří."* V této fázi vytvoříme přehledné, responzivní uživatelské rozhraní.

---

### Krok 4.1: Routing, Navigace a Responzivní Shell aplikace
- **Cíl**: Přestavět hlavní komponentu `App` na moderní aplikační shell s postranním panelem / mobilní navigací a nastavit Angular Router.
- **Co se vytvoří / upraví**:
  - `frontend/src/app/app.routes.ts`: Routy pro Dashboard, Produkty, Skladové zásoby, Pohyby, Objednávky a Reporty.
  - `frontend/src/app/components/layout/navbar.component.ts`: Responzivní navigační lišta s ikonami, indikátorem počtu položek pod minimem a mobilním hamburger menu.
  - `frontend/src/app/app.html` a `app.css`: Čistý layout kontejner s `<router-outlet>`.
- **Verifikace**: Funkční přepínání mezi stránkami na desktopu i v mobilním viewportu.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.1: Nastav Angular routing v `frontend/src/app/app.routes.ts`, vytvoř responzivní navigační komponentu s mobilním zobrazením a uprav layout v `app.html` a `app.css`."*

---

### Krok 4.2: Komponenta Skladových zásob & Operací (HK vs. Garáž)
- **Cíl**: Vytvořit obrazovku skladů s kartami jednotlivých produktů, zobrazením fyzického vs. disponibilního stavu a dialogy pro příjem zboží a přesun.
- **Co se vytvoří / upraví**:
  - `frontend/src/app/services/stock.service.ts`: Angular HTTP klient pro skladové endpointy.
  - `frontend/src/app/components/stock/stock-overview.component`:
    - Tabulka / karty produktů se sloupci: Produkt, Hradec Králové (fyzicky / volno), Garáž Třebechovice (fyzicky / volno), Celkem.
    - Akční tlačítka pro každou řádku: `+ Naskladnit`, `↔ Přesunout mezi sklady`.
    - Modální dialog pro naskladnění (výběr skladu, počet kusů, poznámka).
    - Modální dialog pro přesun (zdrojový sklad, cílový sklad, počet kusů, validace disponibility).
- **Verifikace**: Úspěšný příjem a přesun ověřený v UI i v databázi.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.2: Vytvoř komponentu skladového přehledu a operací `StockOverviewComponent` v `frontend/src/app/components/stock/` včetně servisní vrstvy a modálů pro naskladnění a přesun mezi sklady."*

---

### Krok 4.3: Modul Inventury v UI (Řešení nesouladu v garáži)
- **Cíl**: Vytvořit specializované rozhraní pro inventuru, kde skladník zadá reálně napočítané kusy a systém přehledně zobrazí rozdíl před potvrzením.
- **Co se vytvoří / upraví**:
  - `frontend/src/app/components/stock/inventory-reconciliation.component`:
    - Výběr skladu (např. *Sezónní garáž Třebechovice*).
    - Seznam položek s políčkem pro zadání fyzicky zjištěného stavu.
    - Okamžitý dynamický výpočet diference:
      - Zelená: Přebytek (+X ks)
      - Červená: Manko (-X ks)
      - Šedá: Stav souhlasí (0 ks)
    - Povinné pole pro odůvodnění inventurní změny.
    - Odeslání do backendu a okamžitá aktualizace stavu.
- **Verifikace**: Provedení inventury v UI vytvoří v DB pohyb `INVENTORY_ADJUSTMENT`.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.3: Vytvoř komponentu pro inventuru `InventoryReconciliationComponent` s okamžitým barevným náhledem manka/přebytku, povinným odůvodněním a napojením na backend."*

---

### Krok 4.4: Auditní kniha pohybů v UI (Historie každého kusu)
- **Cíl**: Vytvořit auditní log pohybů odpovídající na dotaz klienta: *"Kde je ta káča, co jsem ji měl minulý týden?"*
- **Co se vytvoří / upraví**:
  - `frontend/src/app/components/stock/stock-movements.component`:
    - Přehledná tabulka / časová osa všech pohybů.
    - Sloupce: Datum a čas, Produkt, Sklad, Typ pohybu (barevné odznaky: Příjem zeleně, Výdej modře, Převod oranžově, Inventura fialově), Změna (+/- ks), Konečný stav po pohybu, Důvod / Číslo objednávky.
    - Filtry: Podle typu pohybu, skladu, produktu a fulltextové vyhledávání.
- **Verifikace**: Zobrazení všech historických pohybů s filtrováním.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.4: Vytvoř komponentu pro auditní knihu pohybů `StockMovementsComponent` s filtry, barevnými odznaky typů pohybů a zobrazením stavu po pohybu."*

---

### Krok 4.5: Správa objednávek v UI (Tvorba, Rezervace, Expedice & Storno)
- **Cíl**: Vytvořit rozhraní pro správu objednávek z e-shopu s jasnou vizualizací stavů a okamžitou kontrolou disponibility při zadávání.
- **Co se vytvoří / upraví**:
  - `frontend/src/app/services/order.service.ts`: Angular servis pro objednávky.
  - `frontend/src/app/components/orders/orders-list.component`: Seznam objednávek s filtry stavů (`Vše`, `K rezervaci`, `K expedici`, `Odesláno`, `Stornováno`).
  - Dialog pro vytvoření objednávky:
    - Výběr existujícího zákazníka nebo zadání nového.
    - Přidávání položek s volbou skladu expedice.
    - Okamžitá kontrola volných zásob přímo ve formuláři (červené varování a zablokování uložení při pokusu objednat víc než je disponibilní stav).
  - Tlačítka rychlých akcí: `Expedovat` (na 1 klik provede fyzický odpis a pohyb `DISPATCH`), `Stornovat` (uvolní rezervaci).
- **Verifikace**: Kompletní průchod objednávkou od zadání přes kontrolu zásob až po expedici a ověření odpisu ve skladu.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.5: Vytvoř komponentu pro správu a vytváření objednávek `OrdersListComponent` včetně modálu s okamžitou kontrolou volných zásob, akcí pro expedici na 1 klik a storno."*

---

### Krok 4.6: Dashboard („Co hoří“) & Manažerský přehled obratu
- **Cíl**: Vytvořit úvodní řídicí panel pro majitele firmy s barevným panelem kritických zásob a grafem měsíčního obratu po kategoriích.
- **Co se vytvoří / upraví**:
  - `frontend/src/app/components/dashboard/dashboard.component`:
    - Sekce **„Co hoří“ (Kritické zásoby)**: Zvýrazněná červená/oranžová sekce s položkami pod minimem a tlačítkem `Rychle naskladnit`.
    - Metriky skladu: Celková hodnota skladu (v nákupních i prodejních cenách), počet kusů v HK a v garáži, počet čekajících objednávek.
    - Sekce **Obrat po kategoriích**: Přehledná tabulka a vizuální progress bary podílů jednotlivých kategorií na tržbách za aktuální i minulé měsíce.
- **Verifikace**: Dashboard načítá reálná data z backendových reportovacích endpointů.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 4.6: Vytvoř úvodní manažerský dashboard `DashboardComponent` s barevným panelem položek pod minimem („co hoří“), skladovými metrikami a měsíčním obratem podle kategorií."*

---

## FÁZE 5: Dockerizace, E2E ověření a příprava na obhajobu

Cílem této závěrečné fáze je zaručit stoprocentní reprodukovatelnost, spustitelnost jediným příkazem a bezchybnou argumentaci pro obhajobu semestrální práce.

---

### Krok 5.1: Doladění Docker Compose & Produkční build
- **Cíl**: Zkontrolovat a optimalizovat kontejnerizaci tak, aby po `docker compose up --build` bez jakéhokoli dalšího zásahu naběhl čistý funkční systém s migracemi a seedem.
- **Co se vytvoří / upraví**:
  - Kontrola `backend/Dockerfile` a `frontend/Dockerfile`.
  - Verifikace automatického spuštění migrací a seedu při prvním startu kontejneru.
  - Ověření Nginx konfigurace frontendu a proxy na backend API.
- **Verifikace**: Příkaz `docker compose up --build` v čistém prostředí nastartuje aplikaci a endpointy na portech 4200 a 3100 odpovídají.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 5.1: Zkontroluj a optimalizuj Docker konfiguraci v `docker-compose.yml`, `backend/Dockerfile` a `frontend/Dockerfile`. Ověř, že kontejner provádí migrace i seed a Nginx správně směruje API volání."*

---

### Krok 5.2: Obohacení syntetických dat (Seed pro obhajobu)
- **Cíl**: Rozšířit seedovací data o realistický příběh firmy Dřevěnka s.r.o. pro prezentaci vyučujícímu (včetně rozdílu v garáži a rozpracovaných objednávek).
- **Co se vytvoří / upraví**:
  - `backend/prisma/seed.ts`:
    - Více produktů s variantami (např. *Káča přírodní*, *Káča červená*, *Káča modrá*).
    - Zákazníci s historií.
    - Různé stavy objednávek: jedna k expedici (`RESERVED`), jedna historická odeslaná (`SHIPPED`) pro měsíční obrat, jedna stornovaná.
    - Historické záznamy ve `StockMovement` (dokládající původní naskladnění a prodeje).
    - Produkt pod minimální zásobou (např. 2 kusy při minimu 10) pro demonstraci panelu „Co hoří“.
- **Verifikace**: `npx ts-node prisma/seed.ts` bezchybně naplní databázi ukázkovými daty.
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 5.2: Rozšiř seed skript v `backend/prisma/seed.ts` o kompletní sadu syntetických testovacích dat pro obhajobu (objednávky v různých stavech, auditní pohyby, položka pod minimem, varianty produktů)."*

---

### Krok 5.3: Aktualizace [README.md](file:///u:/PPRO/README.md) a Technická dokumentace k obhajobě
- **Cíl**: Zaznamenat do [README.md](file:///u:/PPRO/README.md) všechna finální rozhodnutí (ADR-003 až ADR-007), popsat architekturu, diagramy toků a argumentaci pro obhajobu.
- **Co se vytvoří / upraví**:
  - Doplnění schválených rozhodnutí v tabulce ADR.
  - Popis toků rezervace vs. fyzického odpisu (kde se návrh láme).
  - Popis spuštění a testování.
- **Verifikace**: Dokumentace odpovídá skutečné implementaci a požadavkům v [AGENTS.md](file:///u:/PPRO/AGENTS.md).
- **Prompt pro mikrozadání**:
  > *"Proveď Krok 5.3: Aktualizuj `README.md` – zapiš finální stavy všech architektonických rozhodnutí ADR, doplň diagram toku rezervace a expedice a připrav argumentační podklady k obhajobě."*

---

## Jak postupovat: Doporučený pracovní postup

1. Tento plán si ponechej jako řídicí přehled.
2. V každé iteraci mi stačí poslat mikrozadání (např. text z uvozovek u daného kroku: **„Proveď Krok 1.1...“**).
3. Já daný krok kompletně zrealizuji, spustím testy, zkontroluji funkčnost a poreferuji ti o výsledku.
4. Ty zkontroluješ výstup, v případě spokojenosti uděláš commit a zadáš další krok.
