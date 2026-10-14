# Shock Engine V1 — comment se clôturent les trades

Rejeu en lecture seule du moteur figé (V1 = E2 sans entrée en régime agité, preset adaptatif 15, commission 0,045 %, fenêtre 2018-09-01 → 2026-09-30) : **716 trades** (358 BTC, 358 ETH), +767 R au total. R = PnL net / risque initial (3,3 × ATR(30) d'entrée). MFE / MAE = meilleure / pire excursion latente avant la sortie, en R. « Rendu » = MFE − R final. Généré par `research/fade/v1/exit-report.ts` ; liste complète : [trades.md](trades.md), [trades.csv](trades.csv).

## Les mécanismes de sortie de V1

- **Stop initial (SL)** : stop fixe à 3,3 ATR(30) de l'entrée, touché dans la bougie (ou à l'ouverture si le prix ouvre au-delà).
- **Signal inverse (FLIP)** : choc principal dans le sens opposé : clôture au prix de clôture de la bougie (sortie « flip » du script).
- **Trailing (TRAIL)** : stop suiveur de 50 ATR, activé après +50 ATR de gain latent.
- Inactifs dans V1 : TP1 (désactivé), VWAP (réservé aux fades, désactivés), liquidation (sans levier). Aucun trade n'est encore ouvert à la fin de la fenêtre.

## 1. Répartition par type de sortie

| sortie | trades | part | gagnants | R moyen | R médian | R total | part du R total | MFE médiane (R) | durée médiane |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Stop initial (SL) | 439 | 61 % | 0 % | −1,11 | −1,09 | −487,9 | −64 % | 0,6 | 5,5 h |
| Signal inverse (FLIP) | 273 | 38 % | 80 % | +4,24 | +1,91 | +1156,2 | 151 % | 5,1 | 1,9 j |
| Trailing (TRAIL) | 4 | 1 % | 100 % | +24,58 | +25,33 | +98,3 | 13 % | 35,8 | 6,5 j |
| **tous** | 716 | 100 % | 31 % | +1,07 | −1,06 | +766,6 | 100 % | 1,3 | 13,0 h |

**BTC**

| sortie | trades | part | gagnants | R moyen | R médian | R total | part du R total | MFE médiane (R) | durée médiane |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Stop initial (SL) | 229 | 64 % | 0 % | −1,14 | −1,11 | −260,1 | −34 % | 0,6 | 4,3 h |
| Signal inverse (FLIP) | 125 | 35 % | 82 % | +4,23 | +1,53 | +528,8 | 69 % | 4,7 | 1,9 j |
| Trailing (TRAIL) | 4 | 1 % | 100 % | +24,58 | +25,33 | +98,3 | 13 % | 35,8 | 6,5 j |
| **tous** | 358 | 100 % | 30 % | +1,03 | −1,07 | +367,0 | 48 % | 1,3 | 11,5 h |

**ETH**

| sortie | trades | part | gagnants | R moyen | R médian | R total | part du R total | MFE médiane (R) | durée médiane |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Stop initial (SL) | 210 | 59 % | 0 % | −1,08 | −1,07 | −227,7 | −30 % | 0,6 | 6,5 h |
| Signal inverse (FLIP) | 148 | 41 % | 79 % | +4,24 | +2,30 | +627,4 | 82 % | 5,3 | 1,9 j |
| **tous** | 358 | 100 % | 33 % | +1,12 | −1,05 | +399,6 | 52 % | 1,4 | 14,9 h |

## 2. Répartitions croisées

Chaque cellule : nombre de trades · R total.

### actif × sortie

| actif | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| BTC | 358 | 229 · −260 R | 125 · +529 R | 4 · +98 R | 30 % | +367,0 |
| ETH | 358 | 210 · −228 R | 148 · +627 R | — | 33 % | +399,6 |

### sens × sortie

| sens | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| long | 466 | 285 · −319 R | 178 · +792 R | 3 · +75 R | 32 % | +548,1 |
| short | 250 | 154 · −169 R | 95 · +364 R | 1 · +24 R | 29 % | +218,6 |

### année d'entrée × sortie

| année d'entrée | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| 2018 | 37 | 24 · −27 R | 13 · +151 R | — | 24 % | +123,7 |
| 2019 | 104 | 65 · −70 R | 38 · +89 R | 1 · +30 R | 31 % | +49,7 |
| 2020 | 74 | 40 · −44 R | 33 · +105 R | 1 · +18 R | 36 % | +79,0 |
| 2021 | 52 | 25 · −27 R | 27 · +62 R | — | 42 % | +35,4 |
| 2022 | 117 | 72 · −79 R | 45 · +135 R | — | 29 % | +56,3 |
| 2023 | 124 | 82 · −94 R | 41 · +202 R | 1 · +27 R | 30 % | +134,8 |
| 2024 | 47 | 24 · −27 R | 23 · +152 R | — | 40 % | +125,3 |
| 2025 | 93 | 60 · −66 R | 33 · +136 R | — | 28 % | +69,4 |
| 2026 | 68 | 47 · −55 R | 20 · +124 R | 1 · +24 R | 25 % | +93,1 |

### tendance journalière à l'entrée × sortie

| tendance journalière à l'entrée | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| haussière | 244 | 145 · −163 R | 97 · +394 R | 2 · +57 R | 32 % | +288,5 |
| neutre | 109 | 66 · −75 R | 42 · +211 R | 1 · +18 R | 37 % | +153,2 |
| baissière | 363 | 228 · −250 R | 134 · +551 R | 1 · +24 R | 29 % | +324,9 |

### régime de volatilité à la sortie × sortie

| régime de volatilité à la sortie | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| calme | 668 | 431 · −479 R | 235 · +690 R | 2 · +45 R | 28 % | +255,5 |
| agité | 48 | 8 · −9 R | 38 · +466 R | 2 · +54 R | 79 % | +511,1 |

Toutes les entrées sont en régime calme (règle de V1) ; toutes sont des impulsions (IMP). Tendance journalière : clôture par rapport à sa moyenne 50 jours et pente sur 10 jours, dernier jour clos (règle E2). Régime à la sortie : règle de volatilité de V1, dernier jour clos.

### durée de détention × sortie

| durée de détention | trades | SL | FLIP | TRAIL | gagnants | R total |
|---|---:|---:|---:|---:|---:|---:|
| 0–4 h | 182 | 182 · −207 R | — | — | 0 % | −206,9 |
| 4–24 h | 275 | 203 · −222 R | 71 · +56 R | 1 · +27 R | 16 % | −138,7 |
| 1–3 j | 162 | 52 · −57 R | 110 · +275 R | — | 56 % | +218,5 |
| 3–7 j | 81 | 2 · −2 R | 78 · +573 R | 1 · +30 R | 88 % | +600,5 |
| 7–14 j | 15 | — | 13 · +249 R | 2 · +41 R | 100 % | +290,5 |
| > 14 j | 1 | — | 1 · +3 R | — | 100 % | +2,8 |

## 3. Distribution du R final par type de sortie

| R final | SL | FLIP | TRAIL | tous |
|---|---:|---:|---:|---:|
| < −1,1 | 170 | — | — | 170 |
| [−1,1 ; −0,9[ | 269 | 3 | — | 272 |
| [−0,9 ; 0,0[ | — | 51 | — | 51 |
| [0,0 ; 1,0[ | — | 49 | — | 49 |
| [1,0 ; 2,0[ | — | 35 | — | 35 |
| [2,0 ; 5,0[ | — | 66 | — | 66 |
| [5,0 ; 10,0[ | — | 35 | — | 35 |
| [10,0 ; 20,0[ | — | 24 | 1 | 25 |
| ≥ 20 | — | 10 | 3 | 13 |

## 4. Ce qui s'est passé avant la sortie

### Gain latent atteint avant la sortie (MFE), par type de sortie

| MFE atteinte | SL (n · R total) | FLIP (n · R total) | TRAIL (n · R total) | tous |
|---|---:|---:|---:|---:|
| < 0,5 | 196 · −220 | 1 · 0 | — | 197 |
| [0,5 ; 1,0[ | 124 · −137 | 4 · −1 | — | 128 |
| [1,0 ; 2,0[ | 61 · −67 | 30 · −9 | — | 91 |
| [2,0 ; 3,0[ | 27 · −30 | 38 · +15 | — | 65 |
| [3,0 ; 5,0[ | 21 · −23 | 60 · +71 | — | 81 |
| [5,0 ; 10,0[ | 9 · −10 | 80 · +260 | — | 89 |
| ≥ 10 | 1 · −1 | 60 · +821 | 4 · +98 | 65 |

- **Stops initiaux après un gain latent** : 119 des 439 SL avaient d'abord atteint +1 R, 58 avaient atteint +2 R, 31 avaient atteint +3 R, avant de revenir jusqu'au stop.
- **Sorties FLIP** : R médian +1,91 ; 219 / 273 gagnantes ; 11 suivies d'une entrée inverse dans la même bougie. Rendu médian des FLIP gagnantes : 2,8 R (MFE médiane 5,8 R).
- **Trades gagnants (toutes sorties)** : 223 ; rendu médian 2,9 R, soit 47 % de la MFE ; 87 trades ayant atteint +2 R finissent ≤ 0.

### Exécution des stops initiaux

Sur 439 SL : 426 exécutés au niveau du stop, 13 au-delà (ouverture en gap) ; glissement moyen des gaps −0,38 R, pire −1,08 R. R médian d'un SL : −1,09 (commission comprise, 0,085 R de frais médians).

## 5. Très gros gagnants et pires perdants (5 % chacun, 36 trades)

| groupe | trades | SL | FLIP | TRAIL | R total | durée médiane | MFE médiane |
|---|---:|---:|---:|---:|---:|---:|---:|
| 36 meilleurs | 36 | — | 32 | 4 | +707 | 5,8 j | 20,2 |
| 36 pires | 36 | 36 | — | — | −50 | 1,9 h | 0,4 |

Les 36 meilleurs trades font 92 % du R total.

