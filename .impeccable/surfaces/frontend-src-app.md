---
version: 1
slug: "frontend-src-app"
primary_target: "frontend/src/app"
related_targets: []
---

# Surface: celá skladová SPA (shell + obrazovky)

Scope: navigační shell a všechny provozní obrazovky (dashboard, produkty, zásoby, inventura, pohyby, objednávky). Mód: Operate.

## Roll

Grounded list (pořadí podle rezonance):
1. Výdejka z truhlárny – uhlový kopírovací papír, razítka, ručně psané počty.
2. Vzorkovník dřevěných povrchů – očíslované čipy na kartonu.
3. Exportní katalog hraček – číslované tabule, halftone, sazba na mřížce.
4. Skladová karta v regálu – linkovaná, přírůstky a výdeje v sloupcích.
5. Zásilkový štítek a balicí list – mono bloky, šablonové značky.
6. **Dílenský technický výkres** – rýsovací papír, grafit, kóty, šrafování, rohový popisový blok. (assignment)
7. Šablonová cena/štítek z regálu – kraft, šablona, výrazné číslice.

Challenger verdikty (proti assignmentu, osy: identifikace publika / jasnost produktu):
- doujin event catalog: competitive (hustá mřížka a „zakroužkovaný“ stav sedí na sklad); raise: razítkový stav místo barevných pillů.
- dark-first developer console: declined (tmavý konzolový kostým, scéna je denní papír); donation: jedna linka odděluje panely, žádné stíny.
- boarding pass / gate board: competitive (tabulkové figury a ranking sedí na objednávky); raise: tabulkové sloupce s pevnou mřížkou.
- star atlas: declined (noční obloha, jiná scéna).
- zoo guide map: declined (expresivní plochy, mimo kategorii).
- exposure record: declined (tmavý backlit; duplikuje tmavý rut); donation: šrafování jako váha stavu (kritické = hustší šrafa).

## Direction contract

THESIS: Sklad jako dílenský výkres – čísla, kóty a stavy na rýsovacím papíru; odmítá SaaS dashboard s tmavými glass kartami, září a gradienty.

OWN-WORLD: Rýsovací papír #F1EDE2 a list #FBF8EF, grafitový inkoust #20221D, linky #D6CEBC, jediná červená tužka #A6331F pro to, co hoří. Písmo system UI, čísla v mono s tabulkovými figurami. Komponenty pravoúhlé (2 px), žádné stíny, oddělení linkami; šrafování 45° nese závažnost stavu.

STORY: Obsluha na první pohled ví, co je po termínu, co je rezervované a co volné; každá hodnota má svůj sloupec a zdroj. Důvěra z přesnosti, ne z dekorace.

FIRST VIEWPORT: Vlevo úzký rejstřík (název, 7 sekcí, počet položek pod minimem), vpravo list s hlavičkou „Dashboard“, pod ní kótovaný pás čtyř metrik a panel „Co hoří“ se šrafovanými řádky a akcí Naskladnit X ks; obrat jako dvě tabulky s pruhy.

FORM: assignment 6/7 seznamu; seed: ae87b163b050552d5c1d1cd86cc868d5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
