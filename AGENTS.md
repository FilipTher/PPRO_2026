# Instrukce a zásady pro AI asistenta (AGENTS.md)

Tento soubor definuje pravidla chování, pracovní postupy a omezení pro AI asistenta pracujícího na tomto repozitáři.

---

## 1. Základní principy fungování

1. **Zachování kontextu a ověřování pravidel**:
   - Před každým návrhem, úpravou kódu, refaktoringem nebo architektonickou změnou si **vždy nejprve přečti [README.md](file:///u:/PPRO/README.md)**.
   - Respektuj absolutní pravidla, architektonické vrstvy a již zaznamenaná rozhodnutí v [README.md](file:///u:/PPRO/README.md).
   - Při každém novém architektonickém nebo doménovém rozhodnutí ihned aktualizuj příslušnou sekci v [README.md](file:///u:/PPRO/README.md).

2. **Povinné minimum projektu (PPRO)**:
   - Třívrstvá architektura se striktně jednosměrnými závislostmi.
   - Relační databáze běžící v Dockeru s verzovanými migracemi.
   - Nejméně 5 doménových entit a alespoň jedna vazba M:N.
   - Automatizované testy (unit a integrační).
   - Celý projekt musí být kdykoli spustitelný jediným příkazem: `docker compose up`.
   - Žádná reálná osobní data ani citlivé přístupové údaje v repozitáři (pouze syntetická data a `.env.example`).

---

## 2. Pravidla pro práci s Gitem

1. **Striktní zákaz automatického pushování**:
   - **NIKDY neprováděj `git push` bez předchozího explicitního schválení uživatelem.**
   - Po dokončení commitu informuj uživatele o stavu a vyčkej na jeho pokyn k odeslání do vzdáleného repozitáře.

2. **Commitování**:
   - Vždy používej přepínač `-m` s výstižnou, strukturovanou a smysluplnou commit zprávou.
   - Dodržuj konvenci [Conventional Commits](https://www.conventionalcommits.org/) (např. `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`).
   - Před commitem vždy zkontroluj stav repozitáře (`git status`, `git diff`), aby se do commitu nedostal nechtěný balast, binárky, dočasné soubory ani tajemství.

3. **Integrita historie**:
   - Neprováděj destruktivní operace (`git reset --hard`, `git push --force`) bez výslovného souhlasu uživatele.

---

## 3. Styl komunikace a návrhu kódu

1. **Vynucení pravidel v kódu**:
   - Obchodní a doménová pravidla musí být vynucena aplikační logikou a databází, nikdy ne spoléháním na slušnost či správné chování uživatele.
2. **Přístup k nejasnostem**:
   - Pokud klient/zadání nechává věc otevřenou, aktivně nabídni varianty s jejich pro a proti, navrhni doporučené řešení a po odsouhlasení ho zapiš do [README.md](file:///u:/PPRO/README.md) v sekci *Rozhodnutí*.
3. **Komunikace**:
   - Komunikuj primárně v češtině, stručně, věcně a srozumitelně.
   - Odkazuj na soubory klikatelnými markdown odkazy ve formátu `[název](file:///cesta)`.
