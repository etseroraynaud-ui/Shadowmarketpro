# OU Trend Channel · Top 1 H1 gelé sur BTC, ETH et SOL

Pré-spécification : `research/preregistration/ou-multi.md`. Top 1 H1 (z 2,2 · réintégration 1 · mèche 0,7 · sans filtre volume · stop 4,5 ATR) choisi sur BTC 2017 – 2022, aucun réglage réestimé ; commission 0,045 % par ordre ; validation 2023-01-01 → 2026-09-30. Variante HTF : longs si clôture 4 h > EMA 21 (4 h), shorts si en dessous. Produit par `node research/ou-channel/ou-multi.ts`.

| Actif | Variante | Période | CAGR | Sharpe | MDD | PF | Trades (par an) | Win rate | Sharpe validation | Transfert |
|---|---|---|---|---|---|---|---|---|---|---|
| BTC/USD Bitstamp (référence, déjà vu) | tel quel | 2017-01-01 → 2026-09-30 | 38,1 % | 0,95 | −56,0 % | 1,93 | 201 (21) | 31,8 % | 0,87 | — |
| BTC/USD Bitstamp (référence, déjà vu) | filtre HTF | 2017-01-01 → 2026-09-30 | −0,4 % | 0,04 | −47,3 % | 1,04 | 13 (1) | 15,4 % | −0,38 | — |
| ETH/USDT Binance | tel quel | 2017-10-16 → 2026-09-30 | −18,6 % | −0,21 | −91,7 % | 1,01 | 162 (18) | 19,8 % | −0,68 | non |
| ETH/USDT Binance | filtre HTF | 2017-10-16 → 2026-09-30 | −3,2 % | −0,16 | −44,0 % | 0,33 | 10 (1) | 20,0 % | −0,09 | non |
| SOL/USDT Binance | tel quel | 2020-10-10 → 2026-09-30 | −16,1 % | 0,02 | −89,8 % | 1,02 | 113 (19) | 27,4 % | −0,26 | non |
| SOL/USDT Binance | filtre HTF | 2020-10-10 → 2026-09-30 | −3,2 % | −0,25 | −30,2 % | 0,52 | 5 (1) | 20,0 % | 0,37 | non |

| Portefeuille équipondéré | Période | CAGR | Sharpe | MDD | Trades par an (3 actifs) | Sharpe validation | CAGR validation | MDD validation |
|---|---|---|---|---|---|---|---|---|
| tel quel | 2020-10-10 → 2026-09-30 | −0,5 % | 0,12 | −66,8 % | 58 | −0,13 | −4,8 % | −39,3 % |
| filtre HTF | 2020-10-10 → 2026-09-30 | −1,7 % | −0,33 | −14,1 % | 3 | −0,00 | −0,1 % | −9,7 % |

Filtre HTF : Sharpe de validation amélioré sur 2/3 actifs ; retenu. ETH et SOL qui transfèrent (variante HTF) : 0/2. **Verdict : aucun edge démontré.** Essais : 6 (842 avec la recherche OU précédente).
