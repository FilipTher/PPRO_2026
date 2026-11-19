---
name: Dřevěnka – skladový systém
description: Dílenský výkres pro sklad dřevěných hraček – rýsovací papír, grafit a jediná červená tužka pro poplach.
colors:
  paper: "#f1ede2"
  rail: "#e9e3d4"
  sheet: "#fbf8ef"
  sheet-2: "#f4efe2"
  ink: "#20221d"
  ink-2: "#4b4d44"
  muted: "#64665b"
  rule: "#d6cebc"
  rule-strong: "#b3a88f"
  red: "#a6331f"
  red-bg: "#f4e3dd"
  green: "#2f6b45"
  green-bg: "#e5edde"
  amber: "#7d530f"
  amber-bg: "#f4e9d1"
  blue: "#2b4f7a"
  blue-bg: "#e3e9f2"
  violet: "#5b3f7a"
  violet-bg: "#ece3f2"
typography:
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  label:
    fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace"
    fontSize: "0.64rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  data:
    fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace"
    fontSize: "0.9rem"
    fontWeight: 700
rounded:
  none: "0"
  sm: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    height: "34px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    height: "34px"
  nav-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
    height: "34px"
  status-stamp:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "2px 7px"
---

# Design System: Dřevěnka – skladový systém

## Overview

**Creative North Star: "Dílenský výkres"**

Sklad je vedený jako technický výkres: rýsovací papír, grafitové linky, kóty a rohový popisový blok. Čísla mají svůj sloupec, stavy mají razítko a jediná červená tužka patří tomu, co hoří. Rozhraní je husté, ale klidné – informace nese mřížka, ne dekorace.

Svět pochází z dílny a skladové karty, ne z marketingového dashboardu. Všechny plochy jsou ploché, pravoúhlé a oddělené linkou; hloubku vytváří jen překryv dialogu. Šrafování není ornament: jeho hustota znamená závažnost stavu.

**Key Characteristics:**
- Světlý papír a grafitový inkoust, žádné gradienty, glass ani záře.
- Dvě velikosti zaoblení: 0 a 2 px; vše ostatní je pravý úhel.
- Mono písmo pro čísla, kódy, štítky a razítka; system UI pro text.
- Šrafování 45° jako nositel stavu (kritické = hustší).
- Červená jen pro poplach a destruktivní akce.

## Colors

Paleta je papírová neutrální škála s jedním poplachovým akcentem; barvy nesou význam, ne náladu.

### Primary
- **Poplachová tužka** (#a6331f): kritické zásoby, destruktivní akce, aktivní stav nízkých zásob. Nikdy dekorace.

### Secondary
- **Stavová zelená** (#2f6b45), **jantarová** (#7d530f), **modrá** (#2b4f7a), **fialová** (#5b3f7a): pouze razítka stavů pohybů a objednávek, vždy na vlastním světlém podkladu.

### Neutral
- **Rýsovací papír** (#f1ede2): podklad stránky s jemnou měřicí mřížkou.
- **List** (#fbf8ef) a **druhý list** (#f4efe2): panely, tabulky, formuláře, hlavičky tabulek.
- **Grafit** (#20221d) a **měkký grafit** (#4b4d44): text a primární tlačítka.
- **Linky** (#d6cebc, silná #b3a88f): veškeré dělení; žádné stíny.

**The One Red Rule.** Červená se objeví jen tam, kde je problém nebo nevratná akce; pokud červená zdobí, je to chyba.

## Typography

**Display Font:** system-ui / Segoe UI (bez vlastního webfontu)
**Body Font:** system-ui / Segoe UI
**Label/Mono Font:** ui-monospace / Consolas

**Character:** Pracovní strojová sazba: běžný text čitelný, čísla zarovnaná do sloupců, štítky jako popisky na výkrese.

### Hierarchy
- **Title** (700, 1.6rem, 1.2): nadpis stránky, pod ním 1px silná linka.
- **Body** (400, 0.875rem, 1.45): text a popisy, měřítko do 70ch.
- **Label** (600, 0.64rem, 0.08em, uppercase, mono): hlavičky tabulek, formulářové popisky, razítka.
- **Data** (700, 0.9rem, mono, tabular-nums): ceny, počty, kódy, částky.

**The Figures Rule.** Každé číslo, které se sčítá, je mono s tabulkovými figurami a zarovnané doprava.

## Layout

Pevný levý rejstřík 228 px (název, sedm sekcí, blok „Pod minimem“), vpravo pracovní list s maximem 1280 px. Stránka začíná titulkem a linkou, následuje pás metrik nebo nástrojová lišta, pak tabulka či mřížka karet. Hustota je vysoká, rytmus 4/8/14/22 px.

Pod 1100 px se rejstřík mění na horní lištu s hamburgerem. Pod 1024 px se tabulky překlápějí na karty s popisky polí. Pod 900 px se pás metrik skládá do 2×2 a filtry do plné šířky. Mřížka na pozadí je součást měřicí plochy, ne dekorace.

## Elevation & Depth

Systém je plochý. Hloubku nese pouze 1px linka a změna podkladu (list vs. druhý list). Jediná výjimka je modal, který se nad stránku zvedá papírovým stínem `0 24px 60px rgba(24,24,18,0.22)` a poloprůhledným podkladem bez rozostření.

## Shapes

Pravé úhly. Zaoblení 2 px jen u tlačítek, polí a razítek, 0 px u karet, panelů a tabulek. Oddělení obstarává linka, ne rámeček s radiusem. Šrafování 45° je geometrická textura stavu.

## Components

### Buttons
- **Shape:** 2px radius, 1px linka, výška 34 px.
- **Primary:** grafitový podklad (#20221d), papírový text, žádný stín; hover ztmaví na #34362f.
- **Hover / Focus:** focus-visible 2px obrys inkoustu s odsazením 2 px.
- **Ghost / Row:** průhledné nebo papírové, linka `--rule`; řádkové akce 28 px vysoké, mono 0.72rem.

### Status stamps
- **Style:** mono uppercase 0.62rem, 1px linka, 2px radius, světlý podklad podle stavu (zelená/jantarová/červená/modrá/fialová).
- **State:** žádné vyplněné pill prvky; razítko má vždy text a linku.

### Cards / Containers
- **Corner Style:** 0 px (karty, panely), 2 px (tlačítka a pole).
- **Background:** list #fbf8ef, druhý list #f4efe2 pro hlavičky a vsazené bloky.
- **Shadow Strategy:** žádný stín v klidu; viz Elevation.
- **Border:** 1px `--rule`, silná `--rule-strong` pro hlavičky a modaly.
- **Internal Padding:** 10–17 px podle hustoty.

### Inputs / Fields
- **Style:** papírový podklad, 1px linka, 2px radius, výška 34 px.
- **Focus:** linka zčerná a přidá 2px měkký obrys; bez záře.
- **Error / Disabled:** chybové hlášení v červeném rámečku, disabled jen snížením opacity.

### Navigation
- **Style:** levý rejstřík na rail podkladu, 34px řádky, 16px linkové ikony, mono popisek sekce nahoře.
- **States:** aktivní řádek má papírový podklad, linku a 6px červený čtverec na konci.
- **Mobile:** horní lišta s brandem a hamburgerem; menu se rozbaluje pod lištu.

## Do's and Don'ts

### Do:
- **Do** držet všechny plochy ploché a oddělené 1px linkou.
- **Do** používat mono a tabulkové figury pro každé číslo.
- **Do** označovat závažnost šrafováním a razítkem, ne barvou podkladu celé karty.
- **Do** nechat červenou pouze pro poplach a nevratné akce.

### Don't:
- **Don't** používat gradienty, glass, záře ani barevné stíny.
- **Don't** zaoblovat karty a panely nad 2 px.
- **Don't** míchat poplachovou červenou s běžnými daty nebo prodejní cenou.
- **Don't** nahrazovat husté tabulky „hero“ kartami; data patří do sloupců.
