# Falsification Monte-Carlo de E2 · tests A et B

Pré-spécification : `research/preregistration/e2-falsification.md` (commitée avant tout calcul). Produit par `node research/shock/e2-falsification.ts` au commit `966e415`. E2 figée ; données historiques déjà vues ; simulation après coûts modélisés, pas une performance live.

Échantillon : 794 shorts v1 (BTC depuis 2017, ETH depuis 2018-09) fermés avant le 2026-10-01, dont 251 en régime E2 baissier. Stratégie complète : période commune 2018-09-01 → 2026-09-30.

## Test A — sélections aléatoires à fréquence égale

50000 sélections par stratification, autant de shorts que E2 dans chaque strate. p = (1 + nombre ≥ E2) / (1 + 50000) ; percentile = part des sélections sous E2. Drawdowns : « ≥ » veut dire moins profond.

### Stratifié par actif et par année (principal)

| Mesure | E2 | Placebo P5 | Médiane | P95 | Percentile de E2 | p Monte-Carlo |
|---|---|---|---|---|---|---|
| EV des shorts gardés (σ) | +0,503 | +0,193 | +0,333 | +0,484 | 96,8 | 0,0320 |
| PF des shorts gardés | 2,65 | 1,72 | 2,13 | 2,61 | 96,1 | 0,0387 |
| Payoff des shorts gardés | 6,11 | 4,33 | 5,04 | 5,81 | 98,8 | 0,0123 |
| D (gardés − rejetés, σ) | +0,423 | −0,030 | +0,175 | +0,395 | 96,8 | 0,0320 |
| Sharpe sleeve BTC | 1,49 | 1,21 | 1,42 | 1,62 | 71,0 | 0,2902 |
| Drawdown sleeve BTC | −22,3 % | −29,6 % | −22,6 % | −20,0 % | 54,1 | 0,4592 |
| Sharpe sleeve ETH | 1,74 | 1,39 | 1,55 | 1,72 | 96,3 | 0,0372 |
| Drawdown sleeve ETH | −29,5 % | −33,9 % | −25,7 % | −19,9 % | 21,9 | 0,7808 |
| Sharpe 50/50 | 1,89 | 1,58 | 1,74 | 1,89 | 94,5 | 0,0555 |
| Drawdown 50/50 | −19,1 % | −23,1 % | −18,6 % | −14,7 % | 43,8 | 0,5622 |

### Stratifié par actif (secondaire)

| Mesure | E2 | Placebo P5 | Médiane | P95 | Percentile de E2 | p Monte-Carlo |
|---|---|---|---|---|---|---|
| EV des shorts gardés (σ) | +0,503 | +0,059 | +0,212 | +0,379 | 99,8 | 0,0022 |
| PF des shorts gardés | 2,65 | 1,19 | 1,63 | 2,13 | 99,9 | 0,0009 |
| Payoff des shorts gardés | 6,11 | 3,51 | 4,39 | 5,35 | 99,7 | 0,0025 |
| D (gardés − rejetés, σ) | +0,423 | −0,226 | −0,002 | +0,242 | 99,8 | 0,0022 |
| Sharpe sleeve BTC | 1,49 | 1,14 | 1,36 | 1,58 | 83,1 | 0,1693 |
| Drawdown sleeve BTC | −22,3 % | −31,4 % | −24,3 % | −21,0 % | 79,8 | 0,2023 |
| Sharpe sleeve ETH | 1,74 | 1,12 | 1,33 | 1,54 | 99,9 | 0,0006 |
| Drawdown sleeve ETH | −29,5 % | −35,5 % | −27,6 % | −21,3 % | 33,6 | 0,6639 |
| Sharpe 50/50 | 1,89 | 1,44 | 1,62 | 1,80 | 99,1 | 0,0085 |
| Drawdown 50/50 | −19,1 % | −23,2 % | −18,7 % | −14,4 % | 45,2 | 0,5481 |

**Validation du retrait additif** (1 000 premières sélections actif × année, re-simulées exactement) : écart absolu moyen de Sharpe 50/50 0,0004, maximum 0,0014 (seuil 0,02 : retrait additif retenu). Re-simulation exacte : E2 1,885 (additif 1,885), placebo P5 1,59, médiane 1,74, P95 1,91, p Monte-Carlo 0,0739 ; drawdown exact : p 0,5844.

## Test B — décalages circulaires du régime

Propriétés de la série E2 (pas journalier), conservées par le décalage sauf à la couture :

| Actif | Jours | Part du temps baissier | Phases baissières · autres | Durée moyenne (médiane) baissière | Durée moyenne (médiane) autre | Autocorrélation 90 j · 180 j · 365 j |
|---|---|---|---|---|---|---|
| BTC | 3560 | 33,2 % | 66 · 67 | 17,9 j (8.5) | 35,5 j (6) | 0,07 · −0,01 · −0,04 |
| ETH | 2952 | 35,4 % | 47 · 47 | 22,2 j (11) | 40,6 j (12) | −0,05 · −0,06 · 0,00 |

| kmin | Analyse | Décalages | D(E2) | Placebo P5 | Médiane | P95 | Percentile de E2 | p Monte-Carlo |
|---|---|---|---|---|---|---|---|---|
| 180 j (principal) | BTC | 3201 | +0,307 | −0,331 | −0,029 | +0,374 | 90,7 | 0,0934 |
| 180 j (principal) | ETH | 2593 | +0,565 | −0,328 | −0,020 | +0,353 | 99,9 | 0,0012 |
| 180 j (principal) | Portefeuille égal : D_eq | 2593 | +0,436 | −0,281 | −0,006 | +0,269 | 99,6 | 0,0046 |
| 180 j (principal) | Shorts mis en commun : D | 2593 | +0,423 | −0,281 | −0,009 | +0,266 | 99,5 | 0,0058 |
| 90 j | BTC | 3381 | +0,307 | −0,328 | −0,031 | +0,369 | 91,2 | 0,0884 |
| 90 j | ETH | 2773 | +0,565 | −0,330 | −0,022 | +0,348 | 99,9 | 0,0011 |
| 90 j | Portefeuille égal : D_eq | 2773 | +0,436 | −0,276 | −0,016 | +0,262 | 99,6 | 0,0043 |
| 90 j | Shorts mis en commun : D | 2773 | +0,423 | −0,275 | −0,019 | +0,260 | 99,5 | 0,0054 |
| 365 j | BTC | 2831 | +0,307 | −0,333 | −0,023 | +0,387 | 89,5 | 0,1056 |
| 365 j | ETH | 2223 | +0,565 | −0,341 | −0,027 | +0,354 | 99,9 | 0,0013 |
| 365 j | Portefeuille égal : D_eq | 2223 | +0,436 | −0,289 | −0,007 | +0,279 | 99,5 | 0,0054 |
| 365 j | Shorts mis en commun : D | 2223 | +0,423 | −0,286 | −0,010 | +0,278 | 99,4 | 0,0067 |

Sharpe 50/50 en ne gardant que les shorts du régime décalé (kmin 180, retrait additif) : E2 1,89, placebo P5 1,38, médiane 1,61, P95 1,81, p 0,0108.

## Lecture pré-spécifiée

- Test A (EV, actif × année) : p = 0,0320 → avantage **exceptionnel** face à ce test.
- Test B (D_eq, kmin 180) : p = 0,0046 → avantage **exceptionnel** face à ce test.
- Données déjà vues : un résultat « exceptionnel » ici ne valide pas E2 ; il dit seulement que ces contrefactuels ne l'expliquent pas.

## Contrôles (16/16)

- ✔ empreinte lib/strategies/shock/market.ts · b69ad8f8f89a4ded
- ✔ empreinte lib/strategies/shock/strategy.ts · fafb22d6373b19bf
- ✔ empreinte lib/strategies/shock/broker.ts · bad42836b9d61569
- ✔ empreinte lib/strategies/shock/engine.ts · 15211a3e185b1214
- ✔ empreinte lib/strategies/shock/params.ts · 5f7cd0c941d70273
- ✔ empreinte lib/strategies/shock/presets.ts · f97449733ec945bb
- ✔ empreinte lib/strategies/shock/regimes.ts · d72f79d1d97c214d
- ✔ empreinte lib/strategies/shock/live.ts · 05caf82ece9ad7f8
- ✔ empreinte research/lib/frozen-shock.ts · be445aa726433c3e
- ✔ BTC : régime recalculé = régime du moteur · 0 écart(s)
- ✔ ETH : régime recalculé = régime du moteur · 0 écart(s)
- ✔ BTC : décomposition des rendements journaliers par position = rendements de la v1 · écart max 4.1e-16 sur 2792 jours (160 jours avec un long à TP1 partiel exclus) ; frais = 0,045 % × (entrée + sortie) à 3.7e-16 près ; shorts à TP1 : 0
- ✔ ETH : décomposition des rendements journaliers par position = rendements de la v1 · écart max 5.2e-16 sur 2780 jours (172 jours avec un long à TP1 partiel exclus) ; frais = 0,045 % × (entrée + sortie) à 3.1e-16 près ; shorts à TP1 : 0
- ✔ échantillon = référence historique du forward · 794 shorts, 251 en régime E2, D = 0.4228
- ✔ mesure de la v1 complète = portefeuille publié · Sharpe 1.726053 vs 1.726053, drawdown -0.2346
- ✔ décalage nul = E2 · 794 shorts
