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

## 2. Vybrané zadání

*(Zatím nevybráno – bude doplněno po volbě z níže uvedených 4 variant)*

### Kandidáti:
- **Varianta A: Rezervace v ordinaci** (MUDr. Jana Hrubá, Ordinace Na Vyhlídce)
  - *Kde se návrh láme:* Překrývání termínů a význam/chování zrušené rezervace.
- **Varianta B: Sklad pro malý e-shop** (Petr Doležal, Dřevěnka s.r.o.)
  - *Kde se návrh láme:* Okamžik odečtení zásoby a auditovatelná dohledatelnost pohybů.
- **Varianta C: Kurzy vzdělávacího centra** (Ing. Lucie Bartošová, Akademie Trutnov)
  - *Kde se návrh láme:* Pořadník zájemců a pravidlo pro úspěšné dokončení kurzu.
- **Varianta D: Půjčovna vybavení** (Martin Řehák, Hory a voda)
  - *Kde se návrh láme:* Rezervace konkrétního kusu vs. rezervace typu/kapacity.

---

## 3. Technická dokumentace a architektura

### Použitý technologický stack:
*(Bude upřesněno po volbě zadání)*
- **Backend**: *TBD*
- **Databáze**: Relační (PostgreSQL / MySQL / MariaDB) v Dockeru
- **Frontend**: *TBD*
- **Kontejnerizace**: Docker Compose

### Struktura vrstev a komponent:
```text
[ Prezentace (REST API / Web UI) ]
                │
                ▼
[ Doménová a aplikační logika (Entities, Use Cases, Validace) ]
                │
                ▼
[ Infrastruktura & Perzistence (ORM / Repositories, Migrace, DB) ]
```

### Datový model:
*(Zde bude po schválení vložen ER diagram a popis entit a jejich vazeb)*

---

## 4. Seznam rozhodnutí (Architecture Decision Log)

Tato sekce slouží k zaznamenání všech klíčových rozhodnutí, zejména k otevřeným bodům ze zadání (jak jsme je vyřešili a proč).

| ID | Téma / Otevřený bod | Přijaté rozhodnutí a odůvodnění | Stav |
|---|---|---|---|
| ADR-001 | Správa repozitáře a zásady AI | AI agent nesmí provádět `git push` bez souhlasu; striktní dodržování tří vrstev a testů. Pravidla uložena v [AGENTS.md](file:///u:/PPRO/AGENTS.md). | Schváleno |
| *ADR-xxx* | *(doplní se dle vybraného zadání)* | | *Navrženo* |

---

## 5. Příručka pro spuštění a vývoj

### Požadavky:
- Docker & Docker Compose
- Git

### Spuštění projektu:
```bash
docker compose up --build
```

### Spuštění testů:
*(Bude doplněno dle zvoleného jazyka/frameworku)*
