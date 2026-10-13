# Walk-forward Bitcoin à fenêtres plus longues — 12 configurations — règles à deux régimes (E2)

Protocole : `research/preregistration/wf-longer-windows.md` (addendum § 6) (commité avant calcul). Règles précédentes à deux régimes (E2 : régimes calme et agité tradés, chacun re-sélectionné ; shorts en tendance baissière), BTC/USD Bitstamp 15 min, même méthode de plateaux, même période de test pour toutes : 2020-01-01 → 2026-10-04. Préréglage fixe sur la même période : Sharpe 1,49 (flatteur : choisi sur 2017–2026). Sharpe et Sortino sur les rendements par bougie de 15 min.

| Calibration / test | fenêtres | Sharpe | Sortino | CAGR | pire baisse | trades | walk-forward / fixe | réglages calmes : changements · distincts | réglages agités : changements · distincts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **36 mois / 3 mois (référence publiée)** | 28 | 1,11 | 1,57 | 32,5 % | −34,9 % | 502 | 74 % | 16 · 10 | 10 · 9 |
| 36 mois / 6 mois | 14 | 1,09 | 1,54 | 31,7 % | −40,4 % | 490 | 73 % | 6 · 6 | 7 · 7 |
| 36 mois / 12 mois | 7 | 1,12 | 1,58 | 32,7 % | −39,0 % | 471 | 75 % | 3 · 4 | 3 · 4 |
| 48 mois / 3 mois | 28 | 1,21 | 1,71 | 39,3 % | −32,6 % | 422 | 81 % | 10 · 6 | 12 · 7 |
| 48 mois / 6 mois | 14 | 1,29 | 1,82 | 44,1 % | −33,5 % | 397 | 87 % | 6 · 5 | 8 · 6 |
| 48 mois / 12 mois | 7 | 1,18 | 1,67 | 38,8 % | −33,0 % | 393 | 79 % | 1 · 2 | 3 · 4 |
| 60 mois / 3 mois | 28 | 1,22 | 1,72 | 39,9 % | −31,5 % | 399 | 82 % | 5 · 5 | 10 · 7 |
| 60 mois / 6 mois | 14 | 1,23 | 1,73 | 40,1 % | −32,7 % | 399 | 83 % | 5 · 5 | 6 · 6 |
| 60 mois / 12 mois | 7 | 1,12 | 1,58 | 34,9 % | −42,1 % | 393 | 75 % | 5 · 5 | 4 · 5 |
| croissante / 3 mois | 28 | 1,03 | 1,44 | 32,5 % | −53,6 % | 339 | 69 % | 7 · 4 | 4 · 2 |
| croissante / 6 mois | 14 | 1,24 | 1,75 | 43,0 % | −37,6 % | 338 | 83 % | 2 · 2 | 2 · 2 |
| croissante / 12 mois | 7 | 1,24 | 1,75 | 43,0 % | −37,6 % | 338 | 83 % | 1 · 2 | 2 · 2 |

**Médiane des 12 Sharpe : 1,19** (étendue 1,03 pour croissante / 3 mois à 1,29 pour 48 mois / 6 mois) ; rapport médian au préréglage fixe 80 %. 12 configurations sur 12 restent sous le préréglage fixe. Pire baisse médiane −36,3 %, la plus forte −53,6 %.

## Lecture (règle fixée avant calcul)

La médiane (1,19) est entre 1,00 et 1,20 : résultat mitigé.

La configuration 36/3 est le walk-forward publié auparavant pour ces règles. Un walk-forward reste un test sur l'historique déjà utilisé pour concevoir la stratégie ; il mesure le coût de la re-sélection des réglages, pas la performance future.

## Contrôles

- OK — 36/3 = résultat publié : Sharpe 1.11, 502 trades, préréglage 1.49
- OK — même période de test pour les 12 : 2020-01-01 → 2026-10-04
- OK — même préréglage fixe pour les 12 : 1.49
- OK — 12 configurations : 12
