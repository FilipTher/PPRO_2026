# Docker tutoriál pro projekt Dřevěnka

Tenhle dokument je pro někoho, kdo Docker nikdy nepoužíval. Vysvětluje, co se při
`docker compose up --build` vlastně děje, a dává přesný postup od instalace po úklid.

---

## 1. Co je Docker a proč ho projekt používá

Docker umí zabalit aplikaci i s jejím prostředím (Node.js, knihovny, konfigurace) do
**image** – jakési šablony. Z image se spustí **kontejner** – izolovaný běžící proces,
který se chová stejně na každém počítači.

Čtyři pojmy, které stačí znát:

| Pojem | Co to je | V projektu |
|---|---|---|
| **Image** | Neměnná šablona (jako instalátor) | `drevenka-backend`, `drevenka-frontend` |
| **Kontejner** | Spuštěná instance image | `drevenka-backend`, `drevenka-frontend` |
| **Volume** | Trvalé úložiště mimo kontejner | `drevenka_sqlite_data` – SQLite databáze |
| **Síť (network)** | Virtuální síť, kde se kontejnery vidí jménem | frontend volá `http://backend:3000` |

Proč to projekt používá: zadání vyžaduje, aby celá aplikace (backend + frontend +
databáze) naběhla **jediným příkazem** bez ručního nastavování. Docker zajistí, že to
funguje i na jiném počítači, kde nejsou nainstalované správné verze Node.js.

---

## 2. Instalace (Windows)

1. **WSL2** – Docker Desktop na Windows běží nad Linuxem. V PowerShellu (jako správce):
   ```powershell
   wsl --install
   ```
   Potom restartuj počítač.
2. **Docker Desktop**:
   ```powershell
   winget install Docker.DockerDesktop
   ```
   nebo stáhni z <https://www.docker.com/products/docker-desktop/>. Po instalaci
   Docker Desktop spusť a nech ho běžet (v oznamovací oblasti je ikona velryby).
3. Ověření:
   ```powershell
   docker --version
   docker compose version
   docker info
   ```

Když `docker info` napíše `Cannot connect to the Docker daemon`, Docker Desktop
neběží – stačí ho spustit a chvíli počkat.

---

## 3. Co přesně udělá `docker compose up --build`

Projekt má dva Dockerfily a jeden `docker-compose.yml`.

### Backend (`backend/Dockerfile`)

1. Vezme základní image `node:20-alpine` (miniaturní Linux s Node.js 20).
2. Nainstaluje `openssl` (potřebuje ho Prisma).
3. Zkopíruje `package.json`, `package-lock.json` a `prisma/` a spustí `npm ci` –
   nainstalují se závislosti a `postinstall` vygeneruje Prisma klienta.
4. Zkopíruje `src/` a `tsconfig*.json`, přeloží TypeScript (`npm run build`).
5. Při startu kontejneru spustí:
   ```sh
   npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/index.js
   ```
   - `migrate deploy` vytvoří/aktualizuje tabulky,
   - `seed` naplní demo data (je idempotentní – opakování nic nezduplikuje),
   - `node dist/index.js` spustí API na portu **3000 uvnitř kontejneru**.

### Frontend (`frontend/Dockerfile`)

1. Ve fázi „build“ vezme `node:24-alpine` (Angular 22 vyžaduje Node 22+), nainstaluje
   závislosti a spustí `ng build`.
2. Ve druhé fázi vezme `nginx:alpine`, zkopíruje jen hotový `dist/.../browser` a
   konfiguraci Nginx. Nginx servíruje statické soubory a přesměrovává `/api/*` na
   `http://backend:3000` – jméno `backend` je název služby v compose síti.

### `docker-compose.yml`

- Postaví oba image (`build`).
- Namapuje porty: **3100 → 3000** (API) a **4200 → 80** (UI).
- Připojí volume `drevenka_sqlite_data` do `/app/data`, takže databáze přežije restart.
- Spustí backend, čeká na **healthcheck** (`/api/health`), a teprve až je healthy,
  spustí frontend (`depends_on: condition: service_healthy`).

---

## 4. Postup krok za krokem

> Před spuštěním zastav lokální vývojové servery (`npm run dev`, `npm start`) – jinak
> bude port 3100 nebo 4200 obsazený.

Z kořene projektu (`D:\Škola\PPRO\PPRO_2026`):

```powershell
# 1) poprvé: postaví image a spustí vše; první build trvá několik minut
docker compose up --build
```

Výstup sleduj: u backendu uvidíš migraci, seed a start serveru, u frontendu start
Nginx. Až oba běží, otevři:

- UI: <http://localhost:4200>
- API health: <http://localhost:3100/api/health>

Ověření v druhé PowerShellu:

```powershell
docker compose ps                                   # oba kontejnery, backend "healthy"
docker compose logs -f backend                      # živé logy (Ctrl+C je neukončí)
Invoke-RestMethod http://localhost:3100/api/health
```

### Běžné denní příkazy

| Příkaz | Co udělá |
|---|---|
| `docker compose up -d` | spustí na pozadí (bez blokování terminálu) |
| `docker compose ps` | seznam kontejnerů a jejich stav/health |
| `docker compose logs -f backend` | sleduje logy backendu |
| `docker compose stop` | zastaví kontejnery, data zůstanou |
| `docker compose start` | znovu spustí zastavené kontejnery |
| `docker compose down` | zastaví a smaže kontejnery a síť, **volume s daty zůstane** |
| `docker compose down -v` | totéž + smaže volume → čistá databáze |
| `docker compose up --build` | po změně kódu znovu postaví image a spustí |
| `docker compose build backend` | jen přebuildí backend bez spuštění |

Po každé změně zdrojáků je potřeba **rebuild** (`up --build`) – kontejner nevidí tvůj
editor. Pro každodenní vývoj je proto pohodlnější lokální běh (`npm run dev` +
`npm start`) a Docker použít na ověření čistého startu.

### Když chceš vidět databázi

SQLite soubor je uvnitř volume. Nejjednodušší je zkopírovat ho ven:

```powershell
docker compose cp backend:/app/data/sklad.db .\sklad-kopie.db
```

Pak ho otevři v libovolném SQLite prohlížeči (např. DB Browser for SQLite – zdarma).

### Úklid místa na disku

```powershell
docker system df          # kolik zabírají image, kontejnery, volume
docker image prune -a     # smaže nepoužívané image (pozor, stáhne se znovu)
```

---

## 5. Časté problémy

| Problém | Příčina a řešení |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop neběží – spusť ho. |
| `port is already allocated` (3100/4200) | Něco port používá. Zjisti: `Get-NetTCPConnection -LocalPort 3100,4200 -State Listen`, pak zastav daný proces nebo změň port v `docker-compose.yml`. |
| `wsl` hláška při instalaci | Chybí WSL2: `wsl --install`, restart. |
| Build trvá dlouho | Poprvé se stahují image a závislosti; další buildy jsou rychlé. |
| `backend` je `unhealthy` | Koukni do `docker compose logs backend` – nejčastěji chyba migrace nebo obsazený port. |
| Data se nezměnila, i když jsem upravil seed | Seed je idempotentní; pro nová demo data `docker compose down -v` a znovu `up --build`. |
| Chci začít úplně od nuly | `docker compose down -v`, pak `docker compose up --build`. |
| Docker zabírá moc RAM | Docker Desktop → Settings → Resources – omez CPU/RAM. |

---

## 6. Co si z toho odnést

- **Image** = šablona, **kontejner** = běžící instance, **volume** = data mimo kontejner.
- Projekt používá **dva kontejnery**, které se najdou po jménu služby (`backend`).
- `docker compose up --build` = postav image + spusť; migrace a seed proběhnou samy.
- Data drží volume `drevenka_sqlite_data`; `down -v` je smaže.
- Porty navenek: **4200** (UI) a **3100** (API); uvnitř kontejnerů 80 a 3000.

Kdyby cokoli selhalo, první krok je vždy `docker compose logs backend` (nebo
`frontend`) – devět z deseti problémů je vidět tam.
