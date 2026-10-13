# Un seul jeu de règles dans tous les régimes de volatilité

Protocole : `research/preregistration/single-set.md` (commité avant calcul). Exploratoire : la variante S est proposée après avoir vu les résultats d'E2 et de V1 ; elle est la 17e configuration essayée sur le portefeuille. Commission 0,045 % par ordre, 100 % du capital de chaque marché par position, sans levier ni financement.

## Portefeuille BTC/ETH 50/50 (2018-09-01 → 2026-09-30)

| Variante | Sharpe | Sortino | CAGR | volatilité | drawdown max. | Calmar | rendement total | PF | trades (longs / shorts) | dont ouverts en régime agité | Sharpe, commissions × 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 · deux jeux, régime agité tradé avec son jeu | 1,88 | 4,25 | 61,6 % | 27,6 % | −19,1 % | 3,22 | 4748 % | 1,96 | 1311 (1061 / 250) | 597 | 1,61 |
| V1 · règles publiées, pas d'entrée en régime agité | 2,02 | 4,73 | 67,7 % | 27,4 % | −17,8 % | 3,79 | 6436 % | 2,46 | 716 (466 / 250) | 0 | 1,88 |
| S · jeu du régime calme dans tous les régimes | 1,36 | 2,55 | 51,9 % | 35,1 % | −36,9 % | 1,41 | 2838 % | 1,55 | 1357 (831 / 526) | 651 | 1,15 |

## BTC seul, même période

| Variante | Sharpe | Sortino | CAGR | volatilité | drawdown max. | Calmar | rendement total | PF | trades (longs / shorts) | dont ouverts en régime agité | Sharpe, commissions × 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 · deux jeux, régime agité tradé avec son jeu | 1,46 | 3,18 | 41,0 % | 25,8 % | −22,3 % | 1,84 | 1509 % | 1,84 | 644 (508 / 136) | 286 | 1,18 |
| V1 · règles publiées, pas d'entrée en régime agité | 1,46 | 3,23 | 39,6 % | 25,0 % | −24,8 % | 1,60 | 1381 % | 2,18 | 358 (222 / 136) | 0 | 1,29 |
| S · jeu du régime calme dans tous les régimes | 0,99 | 1,93 | 33,6 % | 35,2 % | −35,2 % | 0,95 | 937 % | 1,47 | 674 (399 / 275) | 322 | 0,78 |

## ETH seul, même période

| Variante | Sharpe | Sortino | CAGR | volatilité | drawdown max. | Calmar | rendement total | PF | trades (longs / shorts) | dont ouverts en régime agité | Sharpe, commissions × 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 · deux jeux, régime agité tradé avec son jeu | 1,75 | 4,04 | 72,2 % | 34,3 % | −26,8 % | 2,70 | 7986 % | 2,05 | 667 (553 / 114) | 311 | 1,53 |
| V1 · règles publiées, pas d'entrée en régime agité | 1,93 | 4,62 | 80,0 % | 33,3 % | −24,1 % | 3,31 | 11490 % | 2,68 | 358 (244 / 114) | 0 | 1,80 |
| S · jeu du régime calme dans tous les régimes | 1,33 | 2,50 | 61,6 % | 42,8 % | −41,9 % | 1,47 | 4739 % | 1,61 | 683 (432 / 251) | 329 | 1,15 |

## BTC seul, tout l'historique (2017 → 2026)

| Variante | Sharpe | Sortino | CAGR | volatilité | drawdown max. | Calmar | rendement total | PF | trades (longs / shorts) | dont ouverts en régime agité | Sharpe, commissions × 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 · deux jeux, régime agité tradé avec son jeu | 1,52 | 3,38 | 42,9 % | 25,5 % | −22,3 % | 1,92 | 3160 % | 1,87 | 774 (620 / 154) | 378 | 1,24 |
| V1 · règles publiées, pas d'entrée en régime agité | 1,52 | 3,45 | 41,0 % | 24,5 % | −24,8 % | 1,66 | 2754 % | 2,27 | 396 (242 / 154) | 0 | 1,37 |
| S · jeu du régime calme dans tous les régimes | 1,20 | 2,38 | 44,6 % | 35,9 % | −35,2 % | 1,27 | 3546 % | 1,60 | 765 (464 / 301) | 376 | 1,00 |

## BTC seul, rendement par année (2018-09 → 2026-09)

| Variante | 2018* | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 | 18,8 % | 64,5 % | 15,5 % | 33,6 % | 46,1 % | 52,5 % | 114,0 % | −4,0 % | 16,7 % |
| V1 | 16,2 % | 55,5 % | 21,2 % | 28,3 % | 40,1 % | 59,3 % | 105,2 % | 1,2 % | 13,8 % |
| S | 9,7 % | 58,5 % | 71,2 % | 45,3 % | −18,1 % | 52,5 % | 93,4 % | 3,6 % | −4,2 % |

\* année partielle.

## Écarts de Sharpe du portefeuille (bootstrap par mois, 5 000 tirages, IC 95 %)

| Écart | point | IC 95 % | part des tirages > 0 |
|---|---:|---:|---:|
| S − V1 | −0,66 | −1,04 à −0,29 | 0 % |
| S − E2 | −0,51 | −0,84 à −0,19 | 0 % |
| V1 − E2 | 0,15 | −0,00 à 0,29 | 97 % |

## 8 cryptos (consultées dans l'étude du régime agité : pas vierges)

| | XRP | BNB | DOGE | TRX | ADA | LINK | XLM | LTC | moyenne |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sharpe E2 | 0,78 | 0,58 | 0,53 | 0,30 | 0,57 | 0,68 | 0,51 | 0,13 | 0,51 |
| Sharpe V1 | 0,72 | 0,84 | 0,14 | 0,32 | 0,40 | 0,82 | 0,58 | 0,37 | 0,52 |
| Sharpe S | 0,64 | 0,78 | 0,61 | 0,35 | 0,57 | 0,40 | 0,56 | −0,08 | 0,48 |
| Δ S − V1 | −0,08 | −0,07 | 0,47 | 0,03 | 0,17 | −0,43 | −0,03 | −0,44 | −0,05 |

## Lecture (règle fixée avant calcul)

La condition n'est pas remplie (écart S − V1 : −0,66, IC −1,04 à −0,29 ; Δ moyen sur les 8 cryptos −0,05) : les règles publiées ne changent pas.

## Contrôles

- OK — E2 : Sharpe du portefeuille = publié : 1.877566513286129 / 1.8775665
- OK — V1 : Sharpe du portefeuille = publié : 2.0242078888605257 / 2.0242079
- OK — E2 et V1 : commissions × 2 = publiées : 1.6098550666896807 · 1.878228130093312
- OK — BTC : entrées calmes de V1 retrouvées dans S : 389 / 396
- OK — ETH : entrées calmes de V1 retrouvées dans S : 354 / 358
