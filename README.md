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
- **Backend**: Node.js (TypeScript) – REST API (třívrstvá architektura: Controllers -> Services/Domain -> Repositories)
- **Frontend**: Angular (TypeScript) – responzivní SPA pro desktop i skladový mobil/tablet
- **Databáze**: Relační databáze s verzovanými migracemi (SQLite / PostgreSQL)
- **Kontejnerizace & Orchestrace**: Docker Compose (`docker compose up`)

### Struktura vrstev a komponent:
```text
[ Angular Frontend (SPA) ]
          │  HTTP / REST API
          ▼
[ API / Controllers (Prezentační vrstva) ]
          │  DTOs, Validace
          ▼
[ Aplikační & Doménová logika (Services, Business Rules) ]
          │  Inverze závislostí
          ▼
[ Perzistence & Infrastruktura (TypeORM/Prisma Repositories, Migrace, Relační DB) ]
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

| ID | Téma / Otevřený bod | Přijaté rozhodnutí a odůvodnění | Stav |
|---|---|---|---|
| ADR-001 | Správa repozitáře a zásady AI | AI agent nesmí provádět `git push` bez souhlasu; striktní dodržování tří vrstev a testů. Pravidla uložena v [AGENTS.md](file:///u:/PPRO/AGENTS.md). | Schváleno |
| ADR-002 | Výběr zadání | Vybráno Zadání B (Sklad pro malý e-shop – Dřevěnka s.r.o.). | Schváleno |
| ADR-003 | Objednávka ze dvou skladů naráz (Bod 1) | Systém umožní odbavit objednávku z více skladů rozdělením položek (OrderItem obsahuje `warehouseId`). Pokud sklad nemá dostatek kusů, nabídne se expedice z druhého skladu, nebo přesun mezi sklady. | K odsouhlasení |
| ADR-004 | Co znamená „dost zásob“ (Bod 2) | Rozlišujeme **fyzický stav** a **disponibilní stav** (`disponibilní = fyzický - rezervovaný`). Při přijetí objednávky se zásoba okamžitě **rezervuje** (zabrání se prodeji téhož kusu jinému zákazníkovi). K fyzickému odpisu a záznamu do `StockMovement` dochází při expedici. | K odsouhlasení |
| ADR-005 | Záporný stav a inventura (Bod 3) | **Záporný stav je v systému striktně zakázán** integritním omezením (`physicalQuantity >= 0`). Nesoulad v garáži se řeší výhradně modulem **Inventura**, který zaznamená inventurní rozdíl jako samostatný auditovaný pohyb s odůvodněním. | K odsouhlasení |
| ADR-006 | Varianty produktu (Bod 4) | Varianty (např. 3 barvy téže káči) jsou modelovány jako samostatné produkty s vlastním kódem a skladovou zásobou, sdílející volitelnou vazbu na nadřazený produkt (`parentProductId`). | K odsouhlasení |
| ADR-007 | Změna objednávky po zaplacení (Bod 5) | Editace objednávky po potvrzení/zaplacení je povolena pouze obsluze skladu do okamžiku expedice. Jakákoli změna položek automaticky přepočítá rezervace a zaznamená revizi. Po expedici je změna možná pouze standardní vratkou/reklamací. | K odsouhlasení |
| ADR-008 | Vertikální řez pro demo (Produkt) | Pro první schválení klientem byl realizován kompletní vertikální řez entitou `Product` (Prisma SQLite -> Repozitář -> Doménová služba s validacemi -> Express REST API -> Angular SPA). Pokryto 12 unit a integračními testy. | Schváleno |
| ADR-009 | Change detection ve frontendu (Angular 22 = zoneless) | Angular 22 běží bez `zone.js`, takže asynchronní callbacky (HTTP odpovědi, `setTimeout`) samy nespustí překreslení. Každá komponenta, která v async callbacku mění stav, volá `ChangeDetectorRef.markForCheck()` (viz `frontend/src/app/app.ts`); nové komponenty se řídí stejně, jinak UI zůstane viset ve stavu před odpovědí. | Schváleno |
| ADR-010 | Produkty a kategorie (požadavek 1) | Produkt patří do více kategorií naráz – vazba M:N (`ProductCategory`) je vystavena v API (`GET /api/categories`, `categoryIds` při vytvoření produktu, filtr `GET /api/products?categoryId=`) i v UI (filtr, štítky na kartě, zaškrtávací výběr v dialogu). Kategorie se pouze čtou, zakládají se seedem – klient jejich správu nepožaduje. | K odsouhlasení |
| ADR-011 | Zásoby po skladech (požadavek 2) | `GET /api/stock/overview` vrací pro každý aktivní produkt fyzický, rezervovaný a disponibilní stav po skladech a flag `isLowStock`. UI ho zobrazuje jako tabulku produkt × sklad; do zavedení routingu (Krok 4.1) je to záložka „Zásoby po skladech“ vedle katalogu, nikoli samostatná routa. | K odsouhlasení |

---

## 5. Příručka pro spuštění a vývoj

### Požadavky:
- Node.js (v20+) a npm
- Docker & Docker Compose (volitelně pro kontejnerizaci)

### 1. Spuštění v Dockeru (jediným příkazem):
```bash
docker compose up --build
```
- Aplikace (Angular UI): `http://localhost:4200`
- REST API (Backend): `http://localhost:3100/api/products`

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
npm test
```
Provede všechny unit testy doménových pravidel i integrační HTTP testy nad SQLite.
Integrační testy pracují s vývojovou databází, takže před prvním spuštěním musí proběhnout migrace a seed (viz kroky výše).

