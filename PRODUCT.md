# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Jedna skladová obsluha a majitel malého e-shopu (Dřevěnka s.r.o.). Pracují v kanceláři u počítače a během dne se vrací k tabletu nebo telefonu přímo ve skladu či v garáži. Úloha: udržet zásoby ve shodě se skutečností, zaevidovat objednávku a expedici, dohledat každý pohyb kusu.

## Product Purpose

Nahradit sdílený Excel a ruční přepisování objednávek. Systém má zabránit prodeji zboží, které fyzicky není na skladě, a umožnit u každého kusu doložit, odkud se vydal a proč je zásob právě tolik. Úspěch znamená, že se objednávka na nedostupné zboží odmítne dřív, než vznikne problém, a že se historie dá dohledat zpětně.

## Positioning

Dvě oddělené hodnoty zásob (fyzická a rezervovaná) a neměnná auditní stopa každého pohybu. Rezervace při objednávce chrání konkrétní kusy; fyzický odpis nastává až expedicí. Tuhle dvojici mechanismů konkurenční skladový sešit neumí.

## Operating Context

Dva fyzické sklady: centrální v Hradci Králové a sezónní garáž v Třebechovicích pod Orebem. Provoz v českém jazyce, část práce na tabletu ve skladu, část u stolu. Objednávky vznikají ručně z e-shopové komunikace. Zboží se přijímá od truhláře, přesouvá mezi sklady a inventurou se srovnává skutečný stav.

## Capabilities and Constraints

Produkty s kategoriemi (M:N), varianty produktu jako samostatné položky, zásoby po skladech, příjem, přesun, inventura, auditní kniha pohybů, objednávky s rezervací a zafixovanou cenou, odmítnutí při nedostatku, expedice, storno, měsíční obrat po kategoriích, alerty nízkých zásob. Bez autentizace (jedna obsluha), bez fakturace a poštovného. Technicky: Node.js/TypeScript + Express, Angular 22, SQLite přes Prisma s migracemi, Docker Compose. Data jsou syntetická.

## Brand Commitments

Název a identita Dřevěnka s.r.o. (výrobce dřevěných hraček). Český jazyk rozhraní. Žádné firemní logo ani fotografie k dispozici; značka se nese názvem, materiálem a řemeslnou přesností, ne převzatými obrázky.

## Evidence on Hand

Funkční demo seed: 7 produktů včetně tří variant káči, 3 zákazníci, objednávky ve stavech RESERVED/SHIPPED/CANCELLED, 8 auditních pohybů, dvě položky pod minimem. Žádná reálná zákaznická data, reference ani loga; nic z toho se nesmí domýšlet.

## Product Principles

- Pravidla drží aplikace a databáze, ne pozornost obsluhy.
- Stav je vidět dřív než dekorace: co hoří, co je rezervované, co je volné.
- Čísla musí sedět na první pohled; zdroj a čas pohybu jsou vždy dohledatelné.
- Práce v terénu (tablet, rukavice, slabší světlo) nesmí být horší než práce u stolu.

## Accessibility & Inclusion

WCAG AA pro kontrast textu, ovladatelné klávesnicí s viditelným focusem, touch cíle přiměřené tabletu ve skladu.
