# Semestrální projekt PPRO (2026/2027)

> **DŮLEŽITÉ PRO AI ASISTENTA**: Tento soubor je primárním zdrojem pravdy o architektuře, pravidlech a rozhodnutích projektu. Před jakýmkoli zásahem do kódu je povinné si tento soubor projít, aby nedošlo ke ztrátě kontextu.

---

## 1. Absolutní pravidla aplikace (Dogmata)

Těmito pravidly se projekt striktně řídí a nesmí být porušena za žádných okolností:

1. **Třívrstvá architektura se závislostmi jedním směrem**:
   - **Prezentační vrstva (UI / API)** závisí na aplikační/doménové vrstvě, nikoli naopak.
   - **Doménová / Aplikační vrstva** obsahuje čistá obchodní pravidla a nesmí být závislá na konkrétním frameworku UI nebo konkrétním driveru databáze.
   - **Datová / Infrastrukturní vrstva** realizuje perzistenci a externí služby. Závislosti tečou striktně jedním směrem (inverze závislostí).
2. **Vynucení obchodních pravidel v jádře aplikace**:
   - Žádné pravidlo nesmí spoléhat na „slušnost“ nebo pozornost uživatele ani pouze na validaci ve webovém formuláři.
   - Pravidla (např. zákaz překryvu termínů, výdej nad stav skladu, překročení kapacity) musí být garantována doménovou logikou a databázovými integritními omezeními (unikátní indexy, transakce, constrainty).
3. **Relační databáze s verzovanými migracemi**:
   - Databáze běží v kontejneru v Dockeru.
   - Veškeré změny schématu jsou řízeny výhradně verzovanými migračními skripty, nikdy manuálními úpravami v DB nástrojích.
4. **Rozsah datového modelu**:
   - Minimálně 5 plnohodnotných doménových entit.
   - Minimálně jedna vazba M:N (many-to-many).
5. **Jednoduchá a reprodukovatelná spustitelnost**:
   - Kompletní prostředí (databáze, backend, frontend) musí jít spustit z kořene projektu příkazem:
     ```bash
     docker compose up
     ```
6. **Automatizované testování**:
   - Každé klíčové obchodní pravidlo musí být pokryto unit testy.
   - Kritické toky musí být ověřeny integračními testy.
7. **Bezpečnost a syntetická data**:
   - Žádná reálná data, osobní údaje reálných osob ani přístupová tajemství (hesla, tokeny) nesmí být nahrána do repozitáře.
   - Konfigurace se načítá z proměnných prostředí (`.env`, vzor v `.env.example`).

---

## 2. Vybrané zadání: Zadání B – Sklad pro malý e-shop

- **Klient**: Petr Doležal, Dřevěnka s.r.o.
- **Doména**: Výroba a prodej dřevěných hraček, ~400 položek v nabídce, růst tržeb, 2 fyzické sklady (centrála Hradec Králové, sezónní garáž Třebechovice pod Orebem).
- **Cíl systému**: Nahradit nepřehledný sdílený Excel a ruční přepisování objednávek z e-shopu specializovaným skladovým systémem, který zabrání prodeji nedostupného zboží a zajistí stoprocentní auditovatelnost skladových zásob a pohybů.
- **Kde se návrh láme**: Okamžik odečtení zásoby (disponibilní vs. fyzická zásoba) a nezpochybnitelná dohledatelnost každého pohybu (zákaz záporných stavů, audit log).

---

## 3. Technická dokumentace a architektura

### Použitý technologický stack:
- **Backend**: Node.js (TypeScript, Express) – REST API (třívrstvá architektura: Controllers → Services/Domain → Repositories)
- **Frontend**: Angular 22 (standalone komponenty, zoneless) – responzivní SPA pro desktop i skladový mobil/tablet
- **Databáze**: SQLite přes Prisma ORM, verzované migrace
- **Testy**: Jest + Supertest (backend), Vitest (frontend)
- **Kontejnerizace & Orchestrace**: Docker Compose (`docker compose up --build`), Nginx pro SPA a proxy

### Struktura vrstev a komponent:
```text
[ Angular Frontend (SPA) ]
          │  HTTP / REST API
          ▼
[ API / Controllers (Prezentační vrstva) ]
          │  DTOs, validace vstupů, mapování chyb na HTTP kódy
          ▼
[ Aplikační & Doménová logika (Services, Business Rules) ]
          │  Inverze závislostí (rozhraní repozitářů)
          ▼
[ Perzistence & Infrastruktura (Prisma repozitáře, migrace, SQLite) ]
```

### Realizovaná struktura projektu:
```text
backend/src/
  controllers/   product, category, stock, order, customer, report
  services/      product, category, stock, order, customer, report
  repositories/  product, category, stock, order, customer, report
  routes/        registrace endpointů, napojení do app.ts
  types/         DTO a filtry (product, stock, order, report)
  errors/        DomainValidationError, NotFoundError, ConflictError
frontend/src/app/
  components/    layout (navbar), products, stock (+inventura, pohyby),
                 orders, dashboard, coming-soon
  services/      product, category, stock, order, customer, report
  models/        product, stock, order, report
  app.routes.ts  routing celé SPA
backend/src/domain/
  models.ts      čisté doménové typy (bez závislosti na Prisma/DB driveru)
```

### Datový model (Navržené entity pro Zadání B):
1. **Product** (id, code, name, description, purchasePrice, sellingPrice, minStockLimit, isVariantOfId)
2. **Category** (id, name, description)
3. **ProductCategory** (productId, categoryId) – *vazba M:N*
4. **Warehouse** (id, name, code, address, isSeasonal) – *Hradec Králové, Garáž Třebechovice*
5. **WarehouseStock** (id, warehouseId, productId, physicalQuantity, reservedQuantity) – *aktuální stav a rezervace*
6. **Customer** (id, name, email, phone, street, city, zip) – *zákazník se nikdy nemaže*
7. **Order** (id, customerId, orderNumber, status [PENDING, RESERVED, SHIPPED, REJECTED, CANCELLED], createdAt, shippedAt)
8. **OrderItem** (id, orderId, productId, warehouseId, quantity, unitPrice) – *zafixovaná cena v okamžiku prodeje*
9. **StockMovement** (id, productId, warehouseId, orderId, movementType [RECEIPT, DISPATCH, TRANSFER_IN, TRANSFER_OUT, INVENTORY_ADJUSTMENT], quantityChange, quantityAfter, reason, note, createdAt) – *auditní stopa pro dohledatelnost každého kusu*

---

## 4. Seznam rozhodnutí (Architecture Decision Log)

Tato sekce zaznamenává klíčová architektonická rozhodnutí a řešení otevřených bodů ze zadání.
Stavy: **Schváleno** = odsouhlaseno na začátku, **Implementováno** = rozhodnutí je v kódu a pokryté testy, **K odsouhlasení** = čeká na klienta.

| ID | Téma / Otevřený bod | Přijaté rozhodnutí a odůvodnění | Stav |
|---|---|---|---|
| ADR-001 | Správa repozitáře a zásady AI | AI agent nesmí provádět `git push` bez souhlasu; striktní dodržování tří vrstev a testů. Pravidla uložena v [AGENTS.md](file:///D:/Škola/PPRO/PPRO_2026/AGENTS.md). | Schváleno |
| ADR-002 | Výběr zadání | Vybráno Zadání B (Sklad pro malý e-shop – Dřevěnka s.r.o.). | Schváleno |
| ADR-003 | Objednávka ze dvou skladů naráz (Bod 1) | Objednávka může mít položky z různých skladů – `OrderItem.warehouseId` určuje, odkud se expeduje. Expedice odepíše z každého skladu zvlášť a zapíše vlastní `DISPATCH` pohyb. | Implementováno |
| ADR-004 | Co znamená „dost zásob“ (Bod 2) | Rozlišujeme **fyzický** a **disponibilní** stav (`disponibilní = fyzický − rezervovaný`). Při přijetí objednávky se zásoba okamžitě **rezervuje** (`reservedQuantity +=`), takže se stejný kus neprodá dvakrát. K fyzickému odpisu a pohybu `DISPATCH` dochází až při expedici. | Implementováno |
| ADR-005 | Záporný stav a inventura (Bod 3) | Záporný stav garantuje databáze: migrace `20261119120100` přidává `CHECK` na `WarehouseStock` (`physicalQuantity >= 0`, `reservedQuantity >= 0`, `reservedQuantity <= physicalQuantity`). Doména navíc kontroluje volné kusy u přesunu/expedice a u inventury odmítne stav nižší než rezervované množství. Nesoulad v garáži řeší **Inventura**, která zapíše `INVENTORY_ADJUSTMENT` s povinným důvodem (bez rozdílu se nezapisuje). | Implementováno |
| ADR-006 | Varianty produktu (Bod 4) | Varianty (3 barvy téže káči) jsou samostatné produkty s vlastním kódem a zásobou, propojené volitelnou vazbou `isVariantOfId` na nadřazený produkt. | Implementováno |
| ADR-007 | Změna objednávky po zaplacení (Bod 5) | Editace položek je povolena jen do expedice (`RESERVED`); expedovanou ani stornovanou objednávku měnit nelze. Editace v jedné transakci uvolní staré rezervace, znovu ověří disponibilitu a založí nové (ADR-003). Storno ukládá povinný důvod do `Order.cancelReason` kvůli dohledatelnosti. | Implementováno |
| ADR-008 | Vertikální řez pro demo (Produkt) | První řez byl realizován entitou `Product` (Prisma SQLite → repozitář → doménová služba s validacemi → Express REST API → Angular SPA). Na něj navázaly další vertikální řezy (sklad, objednávky, reporty). | Schváleno |
| ADR-009 | Change detection ve frontendu (Angular 22 = zoneless) | Angular 22 běží bez `zone.js`, takže asynchronní callbacky (HTTP odpovědi, `setTimeout`) samy nespustí překreslení. Každá komponenta, která v async callbacku mění stav, volá `ChangeDetectorRef.markForCheck()`; jinak UI zůstane viset ve stavu před odpovědí. | Schváleno |
| ADR-010 | Produkty a kategorie (požadavek 1) | Produkt patří do více kategorií naráz – vazba M:N (`ProductCategory`) je vystavena v API (`GET /api/categories`, `categoryIds` při vytvoření produktu, filtr `GET /api/products?categoryId=`) i v UI (filtr, štítky na kartě, zaškrtávací výběr v dialogu). Kategorie se pouze čtou, zakládají se seedem – klient jejich správu nepožaduje. | Implementováno |
| ADR-011 | Zásoby po skladech (požadavek 2) | `GET /api/stock/overview` vrací pro každý aktivní produkt fyzický, rezervovaný a disponibilní stav po skladech a flag `isLowStock`. UI má samostatnou routu `/zasoby` s tabulkou produkt × sklad a akcemi příjmu a přesunu (Kroky 4.1–4.2). | Implementováno |
| ADR-012 | Měsíční obrat po kategoriích (požadavek 8) | Do obratu vstupují výhradně expedované objednávky (`SHIPPED`), měsíc určuje datum expedice (`shippedAt`) a cena je zafixovaná v `OrderItem.unitPrice`. Produkt ve více kategoriích se započítá plnou tržbou do každé z nich, proto se součet podílů může překrývat (nad 100 %); celkové tržby firmy se počítají z položek, ne součtem kategorií. | Implementováno |
| ADR-013 | Alerty kritických zásob (požadavek 7) | Alert se vyhodnocuje z celkové fyzické zásoby napříč sklady (`fyzicky <= minStockLimit`), závažnost `CRITICAL` při nule, jinak `WARNING`. Doporučené množství k doobjednání je `max(minimum − fyzický stav, 1)` – doplní stav na minimum a na přesném minimu doporučí alespoň 1 kus. | Implementováno |

---

## 5. Příručka pro spuštění a vývoj

### Požadavky:
- Node.js (v20+) a npm
- Docker & Docker Compose (pro spuštění celé aplikace jediným příkazem)

### 1. Spuštění v Dockeru (jediným příkazem):
```bash
docker compose up --build
```
- Aplikace (Angular UI): `http://localhost:4200`
- REST API (Backend): `http://localhost:3100/api/products`

Co se při startu stane automaticky:
- backend kontejner spustí `prisma migrate deploy` (aplikace migrací na prázdnou DB), seed s ukázkovými daty a poté server;
- backend má healthcheck na `/api/health` a frontend se spustí až po jeho ozdravení (`depends_on: service_healthy`), takže UI nenaběhne dřív než API;
- SQLite databáze je v pojmenovaném volume `drevenka_sqlite_data` (`/app/data`), takže data přežijí restart kontejneru;
- Nginx ve frontend kontejneru servíruje Angular SPA a přesměrovává `/api/*` na `backend:3000`.

Reset do čistého stavu (smaže i data): `docker compose down -v` a znovu `docker compose up --build`.
Hostitelské porty lze změnit v [docker-compose.yml](file:///D:/Škola/PPRO/PPRO_2026/docker-compose.yml) (`3100:3000`, `4200:80`).

> Docker nikdy nepoužíval? Podrobný postup od instalace, vysvětlení image/kontejner/volume a řešení častých problémů je v [docs/DOCKER.md](file:///D:/Škola/PPRO/PPRO_2026/docs/DOCKER.md).

### 2. Spuštění lokálně během vývoje:

**Spuštění backendu:**
```bash
cd backend
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
npx prisma migrate dev
npx ts-node prisma/seed.ts
npm run dev
```
`npm install` automaticky spouští `prisma generate` (skript `postinstall`). Bez souboru `.env` Prisma i server hlásí `Environment variable not found: DATABASE_URL`.

**Spuštění frontendu:**
```bash
cd frontend
npm install
npm start
```
Frontend se spustí na `http://localhost:4200` a automaticky přesměrovává volání `/api/*` na backend port 3100.

### 3. Spuštění automatizovaných testů:
```bash
cd backend
npm test        # 134 testů: unit (doménová pravidla) + integrační HTTP nad SQLite
```
```bash
cd frontend
npm test        # 28 testů: komponenty (katalog, zásoby, inventura, pohyby,
                # objednávky, dashboard) a shell s routingem
```
Backend testy pokrývají validace produktů a kategorií, příjem/přesun/inventuru, rezervace, expedici, storno, editaci položek, měsíční obrat a alerty nízkých zásob. Frontend testy ověřují validace formulářů (nedostatek zásob, povinný důvod), výpočty (marže, rozdíly, metriky) a filtry.

Integrační testy pracují s vývojovou databází, takže před prvním spuštěním musí proběhnout migrace a seed (viz kroky výše). Testovací data si po sobě uklízejí.


---

## 6. Obchodní toky (kde se návrh láme)

Klientův problém: *„Dvakrát měsíčně se stane, že se prodá něco, co není.“* Proto jsou ve skladové kartě **dvě čísla**:

- `physicalQuantity` – kolik kusů fyzicky leží na skladě,
- `reservedQuantity` – kolik z nich je slíbeno objednávkám,
- **disponibilní = fyzický − rezervovaný** – jen tohle smí nová objednávka použít.

### Vytvoření objednávky = okamžitá rezervace

```text
POST /api/orders
  ├─ validace zákazníka a položek (kladná celá množství, existující aktivní produkty)
  ├─ sloučení duplicit (stejný produkt + sklad se sčítá, jinak by šlo rezervovat dvakrát)
  ├─ ceny se zafixují z aktuálního ceníku do OrderItem.unitPrice
  └─ JEDNA TRANSAKCE
       ├─ volné = fyzicky − rezervováno  (kontrola i uvnitř transakce)
       ├─ nedostatek → 400 „Nedostatek zásob: Produkt … má na skladě X ks, volných pouze Y ks.“
       │               (nevznikne objednávka ani rezervace)
       ├─ rezervováno += požadavek
       └─ objednávka ve stavu RESERVED
```

Fyzický stav se při objednávce **nemění** – jen se „zamkne“ kus pro zákazníka.

### Expedice = fyzický odpis a auditní stopa

```text
POST /api/orders/:id/ship
  ├─ povoleno jen z RESERVED (kontrola i uvnitř transakce)
  └─ transakce pro každou položku
       ├─ fyzicky     -= množství
       ├─ rezervováno -= množství
       ├─ StockMovement: DISPATCH, quantityChange = -množství, quantityAfter, orderId
       └─ objednávka SHIPPED + shippedAt
```

### Storno a editace před expedicí

| Operace | Co udělá s rezervacemi | Co udělá s fyzickým stavem |
|---|---|---|
| `POST /api/orders/:id/cancel` | uvolní rezervace (`rezervováno -=`) | nic |
| `PUT /api/orders/:id/items` | uvolní staré a založí nové rezervace (jedna transakce) | nic |
| `POST /api/orders/:id/ship` | uvolní rezervace | odečte kusy + `DISPATCH` |

Expedovanou objednávku už nelze stornovat ani editovat (řeší se vratkou/reklamací).

### Přesuny a inventura

- `POST /api/stock/transfer` – jen volné kusy (`fyzicky − rezervováno`), zdroj ≠ cíl, dva spárované pohyby `TRANSFER_OUT`/`TRANSFER_IN` se stejným číslem převodky.
- `POST /api/stock/inventory` – zadání skutečně napočítaného stavu, rozdíl se zapíše jako `INVENTORY_ADJUSTMENT` s povinným důvodem; beze změny se nezapisuje nic.
- `POST /api/stock/receipt` – navýšení fyzického stavu + pohyb `RECEIPT`.

**Každá změna stavu zásob** má tedy odpovídající záznam v `StockMovement` – proto jde odpovědět na otázku „proč jich je sedmnáct a ne dvacet“.

---

## 7. REST API – přehled

| Oblast | Endpointy |
|---|---|
| Produkty | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` (filtr `search`, `isActive`, `categoryId`) |
| Kategorie | `GET /api/categories` |
| Zákazníci | `GET /api/customers` |
| Sklad | `GET /api/stock/warehouses`, `GET /api/stock/overview`, `POST /api/stock/receipt`, `POST /api/stock/transfer`, `POST /api/stock/inventory`, `GET /api/stock/movements` (filtry produkt, sklad, typ, objednávka, datum) |
| Objednávky | `GET/POST /api/orders`, `GET /api/orders/:id`, `PUT /api/orders/:id/items`, `POST /api/orders/:id/ship`, `POST /api/orders/:id/cancel` |
| Reporty | `GET /api/reports/category-turnover?year=&month=`, `GET /api/reports/low-stock` |
| Provoz | `GET /api/health` |

Chybové stavy: doménové validační chyby → **400**, nenalezené entity → **404**, duplicitní kód produktu → **409**.

---

## 8. Demo data (seed)

Seed běží při startu backendu (a ručně přes `npx ts-node prisma/seed.ts`). Je **idempotentní** – opakované spuštění nic nezduplikuje.

- 7 produktů včetně variant káči (`KACA-CERVENA`, `KACA-MODRA` s vazbou `isVariantOfId`),
- 2 sklady a 3 kategorie (M:N – káča patří do dvou kategorií),
- 3 zákazníci a 3 objednávky: `ORD-SEED-0001` k expedici (RESERVED), `ORD-SEED-0002` odeslaná (SHIPPED), `ORD-SEED-0003` stornovaná,
- 8 auditních pohybů všech typů (příjem, expedice, inventura, přesun),
- káča modrá 2 ks při minimu 10 a červená 9 ks → dashboard hned ukáže „Co hoří“.

Pro čisté demo: `docker compose down -v` a znovu `docker compose up --build` (seed vytvoří historii s aktuálními daty).

---

## 9. Omezení a možná rozšíření

- **Autentizace** není součástí zadání – systém je navržený pro jednu skladovou obsluhu.
- **Rezervace** nejsou samostatné pohyby v auditní knize (pohyby zaznamenávají fyzické změny); dohledatelné jsou přes položky objednávek a stav `RESERVED` (ADR-004).
- **Fulltext** v auditní knize filtruje načtenou stránku pohybů, ne server; při velkých objemech doplnit serverové hledání a stránkování.
- **Souběh** je řešen transakcemi a opakovanou kontrolou stavu uvnitř nich; test 5 souběžných objednávek na 1 kus prošel bez přeprodeje, zátěžový test ale nebyl proveden.
- **Kategorie** se zakládají seedem (klient nepožadoval jejich správu v UI).
- **Docker** je nakonfigurovaný; na vývojovém stroji bez Dockeru nešel ověřit, ale `docker compose up --build` byl spuštěn uživatelem (backend healthy).
