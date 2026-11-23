# Skladový systém Dřevěnka (PPRO 2026/2027, Zadání B)

Semestrální projekt do PPRO. Je to skladový systém pro malý e-shop s dřevěnými hračkami. Řeší hlavně to, aby se neprodalo zboží, které fyzicky není na skladě, a aby se dal dohledat každý pohyb zásob.

Aplikace se skládá z Angular frontendu, Express API a SQLite databáze. Celé to jde pustit jedním příkazem:

```bash
docker compose up --build
```

- UI: http://localhost:4200
- API: http://localhost:3100/api/products

---

## 1. Spuštění

### Přes Docker

`docker compose up --build` spustí databázi, backend i frontend. Při startu se toho udělá víc automaticky:

- backend pustí `prisma migrate deploy`, takže se migrace aplikují na prázdnou databázi,
- potom se spustí seed s ukázkovými daty a nakonec server,
- backend má healthcheck na `/api/health` a frontend startuje až po něm, aby UI nenaběhlo dřív než API,
- SQLite soubor je v Docker volume `drevenka_sqlite_data`, takže data přežijí restart kontejneru,
- Nginx ve frontend kontejneru servíruje Angular a přesměrovává `/api/*` na backend.

Reset do čistého stavu (smaže i data): `docker compose down -v` a pak znovu `docker compose up --build`.

Porty jde změnit v `docker-compose.yml` (`3100:3000`, `4200:80`). Pokud Docker neznáš, je v `docs/DOCKER.md` postup od instalace a řešení častých chyb.

### Lokálně při vývoji

Backend:

```bash
cd backend
npm install
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npx prisma migrate dev
npx ts-node prisma/seed.ts
npm run dev
```

`npm install` sám spouští `prisma generate` (skript `postinstall`). Bez `.env` Prisma i server spadnou na `Environment variable not found: DATABASE_URL`.

Frontend:

```bash
cd frontend
npm install
npm start
```

Běží na http://localhost:4200 a volání `/api/*` přesměrovává na backend na portu 3100. Když máš zároveň spuštěné kontejnery, porty 3100 a 4200 jsou obsazené – buď kontejnery zastav (`docker compose stop`), nebo lokální server pustíš na jiném portu.

### Testy

```bash
cd backend && npm test    # 134 testů
cd frontend && npm test   # 34 testů
```

Backend testy pokrývají validace produktů a kategorií, příjem, přesun, inventuru, rezervace, expedici, storno, editaci položek, měsíční obrat a alerty nízkých zásob. Frontend testy kontrolují validace formulářů (nedostatek zásob, povinný důvod storna), výpočty (marže, rozdíly, metriky), filtry a nově i našeptávač zákazníka.

Integrační testy jedou nad vývojovou databází, takže před prvním spuštěním musí proběhnout migrace a seed. Data si po sobě uklízejí.

---

## 2. Zadání

- **Klient:** Petr Doležal, Dřevěnka s.r.o.
- **Doména:** výroba a prodej dřevěných hraček, zhruba 400 položek, dva sklady (Hradec Králové a sezónní garáž v Třebechovicích).
- **Problém:** firma vedla sklad ve sdíleném Excelu a objednávky z e-shopu přepisovala ručně. Dvakrát měsíčně se stalo, že prodala něco, co už na skladě nebylo.
- **Cíl:** nahradit Excel systémem, který prodej nedostupného zboží zablokuje a u každého pohybu nechá stopu.

Z toho vyplynulo, co bylo v projektu nejdůležitější: rozlišit fyzický a disponibilní stav a nedovolit záporné zásoby.

### Pravidla ze zadání, která jsem musel dodržet

1. Třívrstvá architektura a závislosti jen jedním směrem (UI → aplikační logika → databáze).
2. Obchodní pravidla musí být v kódu a v databázi, ne jen ve formuláři.
3. Relační databáze v Dockeru se všemi změnami schématu přes migrace.
4. Alespoň 5 doménových entit a jedna vazba M:N.
5. Celý projekt spustitelný přes `docker compose up`.
6. Automatizované testy na klíčová pravidla.
7. Žádná reálná data ani hesla v repozitáři, jen syntetická data a `.env.example`.

---

## 3. Architektura

### Technologie

- **Backend:** Node.js, TypeScript, Express. Vrstvy Controllers → Services → Repositories.
- **Frontend:** Angular 22, standalone komponenty, bez zone.js.
- **Databáze:** SQLite přes Prisma ORM, migrace.
- **Testy:** Jest + Supertest (backend), Vitest (frontend).
- **Docker:** Docker Compose, Nginx pro SPA a proxy na API.

### Vrstvy

```text
Angular SPA
   │ HTTP / REST
   ▼
Controllers (validace vstupů, mapování chyb na HTTP kódy)
   ▼
Services / doménová logika (obchodní pravidla, rozhraní repozitářů)
   ▼
Repozitáře a Prisma (SQLite, migrace)
```

### Struktura projektu

```text
backend/src/
  controllers/   product, category, stock, order, customer, report
  services/      product, category, stock, order, customer, report
  repositories/  product, category, stock, order, customer, report
  routes/        registrace endpointů
  types/         DTO a filtry
  errors/        DomainValidationError, NotFoundError, ConflictError
  domain/        čisté doménové typy bez závislosti na Prisma

frontend/src/app/
  components/    layout, products, stock (zásoby, inventura, pohyby),
                 orders, dashboard, reports
  services/      product, category, stock, order, customer, report
  models/        product, stock, order, report
  app.routes.ts  routing
```

### Datový model

1. **Product** – kód, název, ceny, minimum zásob, volitelná vazba na nadřazený produkt (varianty).
2. **Category** – název a popis.
3. **ProductCategory** – vazba M:N mezi produktem a kategorií.
4. **Warehouse** – sklad, příznak sezónnosti.
5. **WarehouseStock** – fyzický a rezervovaný stav produktu na skladu.
6. **Customer** – zákazník, nikdy se nemaže.
7. **Order** – číslo, stav, datum vytvoření a expedice, důvod storna.
8. **OrderItem** – produkt, sklad, množství a cena zafixovaná v okamžiku objednávky.
9. **StockMovement** – auditní záznam každé změny (typ, změna, stav po změně, důvod).

---

## 4. Jak fungují zásoby a objednávky

U každého produktu na skladu jsou dvě čísla:

- `physicalQuantity` – kolik kusů tam opravdu leží,
- `reservedQuantity` – kolik z nich je slíbeno objednávkám,
- **disponibilní = fyzický − rezervovaný**. Jen tohle číslo smí nová objednávka použít.

### Vytvoření objednávky

1. Zkontroluje se zákazník a položky – množství musí být kladné celé číslo a produkt musí existovat a být aktivní.
2. Duplicitní položky (stejný produkt a sklad) se sečtou, jinak by šlo rezervovat dvakrát.
3. Ceny se zafixují z aktuálního ceníku do `OrderItem.unitPrice`.
4. V jedné transakci se znovu zkontroluje disponibilní množství a přičte se rezervace.
5. Když kusy nejsou, vrátí API chybu 400 a objednávka ani rezervace nevznikne.

Fyzický stav se při objednávce nemění, jen se kus zamkne pro zákazníka.

### Expedice

Expedice jde jen z objednávky ve stavu `RESERVED`. Pro každou položku se v transakci odečte fyzický i rezervovaný stav, zapíše se pohyb `DISPATCH` a objednávka se přepne na `SHIPPED` s datem expedice.

### Storno a editace

| Operace | Rezervace | Fyzický stav |
|---|---|---|
| Storno (`POST /api/orders/:id/cancel`) | uvolní | beze změny |
| Editace položek (`PUT /api/orders/:id/items`) | uvolní staré a vytvoří nové | beze změny |
| Expedice (`POST /api/orders/:id/ship`) | uvolní | odečte a zapíše `DISPATCH` |

Expedovanou objednávku už nejde stornovat ani editovat, řeší se vratkou nebo reklamací.

### Přesuny a inventura

- Přesun bere jen volné kusy, zdroj a cíl musí být jiný sklad. Vzniknou dva spárované pohyby `TRANSFER_OUT` a `TRANSFER_IN` se stejným číslem převodky.
- Inventura zapíše skutečně napočítaný stav. Rozdíl se uloží jako `INVENTORY_ADJUSTMENT` a musí mít důvod; když je stav stejný, nezapisuje se nic.
- Příjem zvyšuje fyzický stav a zapisuje pohyb `RECEIPT`.

Každá změna zásob má tedy svůj záznam v `StockMovement`, takže jde zpětně zjistit, proč je na skladě sedmnáct kusů a ne dvacet.

---

## 5. REST API

| Oblast | Endpointy |
|---|---|
| Produkty | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` (filtr `search`, `isActive`, `categoryId`) |
| Kategorie | `GET /api/categories` |
| Zákazníci | `GET /api/customers` |
| Sklad | `GET /api/stock/warehouses`, `GET /api/stock/overview`, `POST /api/stock/receipt`, `POST /api/stock/transfer`, `POST /api/stock/inventory`, `GET /api/stock/movements` |
| Objednávky | `GET/POST /api/orders`, `GET /api/orders/:id`, `PUT /api/orders/:id/items`, `POST /api/orders/:id/ship`, `POST /api/orders/:id/cancel` |
| Reporty | `GET /api/reports/category-turnover?year=&month=`, `GET /api/reports/low-stock` |
| Provoz | `GET /api/health` |

Chyby: validační chyba 400, nenalezeno 404, duplicitní kód produktu 409.

---

## 6. Rozhodnutí

Tady jsou věci, které zadání nechávalo otevřené, a jak jsem je vyřešil.

| ID | Téma | Rozhodnutí | Stav |
|---|---|---|---|
| ADR-001 | Práce s repem | AI asistent nesmí pushovat bez souhlasu, musí dodržet vrstvy a testy. Pravidla jsou v `AGENTS.md`. | Schváleno |
| ADR-002 | Výběr zadání | Zadání B, sklad pro malý e-shop. | Schváleno |
| ADR-003 | Objednávka ze dvou skladů | `OrderItem.warehouseId` určí, odkud se expeduje. Expedice odečte z každého skladu zvlášť a zapíše vlastní pohyb. | Implementováno |
| ADR-004 | Co znamená „dost zásob“ | Rozlišuji fyzický a disponibilní stav. Objednávka hned rezervuje, fyzicky se odečte až při expedici. | Implementováno |
| ADR-005 | Záporný stav a inventura | Záporný stav hlídá databáze přes `CHECK` constraint (fyzický i rezervovaný stav ≥ 0, rezervovaný ≤ fyzický). Inventura nesmí jít pod rezervované množství a rozdíl zapisuje s povinným důvodem. | Implementováno |
| ADR-006 | Varianty | Varianty (tři barvy káči) jsou samostatné produkty s vlastním kódem a zásobou, propojené přes `isVariantOfId`. | Implementováno |
| ADR-007 | Změna objednávky | Editovat jde jen do expedice. Editace v jedné transakci uvolní staré rezervace a vytvoří nové. Storno vyžaduje důvod a ukládá ho k objednávce. | Implementováno |
| ADR-008 | První řez | Začal jsem produktem: Prisma → repozitář → služba → API → Angular. Pak jsem stejně přidal sklad, objednávky a reporty. | Schváleno |
| ADR-009 | Change detection | Angular 22 běží bez zone.js, takže async callbacky samy nepřekreslí. Komponenty proto po HTTP odpovědi volají `ChangeDetectorRef.markForCheck()`. | Schváleno |
| ADR-010 | Produkty a kategorie | Produkt může být ve více kategoriích (M:N). Kategorie se jen čtou, zakládá je seed, protože klient jejich správu nechtěl. | Implementováno |
| ADR-011 | Zásoby po skladech | `GET /api/stock/overview` vrací fyzický, rezervovaný a disponibilní stav po skladech a příznak nízkého stavu. V UI je samostatná stránka `/zasoby` s příjmem a přesunem. | Implementováno |
| ADR-012 | Obrat po kategoriích | Počítají se jen expedované objednávky, měsíc podle data expedice, cena z `OrderItem.unitPrice`. Produkt ve více kategoriích se započítá do každé z nich, takže součet podílů může přesáhnout 100 %. | Implementováno |
| ADR-013 | Alerty nízkých zásob | Staví se z celkové fyzické zásoby napříč sklady. Při nule je `CRITICAL`, jinak `WARNING`. Doporučené množství doplní stav na minimum, na přesném minimu doporučí aspoň 1 kus. | Implementováno |
| ADR-014 | Vyhledávání zákazníka | Do výběru zákazníka jde psát a seznam se filtruje (viz kapitola 8). | Implementováno |

---

## 7. Demo data

Seed běží při startu backendu nebo ručně přes `npx ts-node prisma/seed.ts`. Je idempotentní, takže opakované spuštění nic nezduplikuje.

- 7 produktů včetně dvou variant káči,
- 2 sklady a 3 kategorie (káča je ve dvou, aby bylo M:N vidět),
- 3 zákazníci a 3 objednávky: jedna k expedici, jedna odeslaná, jedna stornovaná,
- 8 pohybů všech typů,
- káča modrá má 2 kusy při minimu 10, takže dashboard hned ukáže „Co hoří“.

---

## 8. Úprava po konzultaci s vyučujícím

Na konzultaci mi vyučující řekl, že výběr zákazníka v dialogu nové objednávky je jen obyčejný select, a chtěl, aby šlo do pole psát a zákazníka si tak rychle najít. Upravil jsem to.

Jak to teď funguje:

- Pole pro zákazníka je textové. Když do něj začnu psát, rozbalí se seznam a filtruje se podle jména, e-mailu i telefonu.
- Na vybraného zákazníka se dostanu kliknutím nebo šipkami a Enterem, zavřít seznam jde Escapem.
- Po výběru zůstane v poli jméno i e-mail, takže je vidět, kdo je vybraný.
- Jakmile začnu psát znovu, výběr se zruší. Bez vybraného zákazníka tlačítko „Rezervovat objednávku“ zůstane zakázané, stejně jako předtím.
- Seznam se zavře i při kliknutí mimo něj.

Logika je v `frontend/src/app/components/orders/orders.page.ts`, šablona v `orders.page.html` a styl v `frontend/src/styles.css`. Přidal jsem k tomu test, který ověří, že filtr opravdu zužuje seznam a že nesmyslný text nevrátí nic.

---

## 9. Omezení a co bych ještě dodělal

- **Přihlašování** zadání nechce, systém počítá s jednou obsluhou skladu.
- **Rezervace** nejsou samostatný pohyb v auditní knize, protože pohyby zaznamenávají jen fyzické změny. Dohledat je jde přes položky objednávek a stav `RESERVED`.
- **Fulltext** v pohybech filtruje jen načtenou stránku, ne celou databázi. Při větším objemu bych přidal serverové hledání a stránkování.
- **Souběh** řeším transakcemi a opakovanou kontrolou stavu uvnitř nich. Test s pěti souběžnými objednávkami na jeden kus prošel, zátěžový test jsem ale nedělal.
- **Kategorie** se zakládají seedem, správa v UI není.
- **Docker** jsem spustil a funguje, backend naběhne healthy a UI jde otevřít na portu 4200.

Pravidla pro práci s tímto repem (git, vrstvy, testy) jsou v `AGENTS.md`.
