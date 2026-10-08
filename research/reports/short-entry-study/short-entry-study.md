# Étude pré-enregistrée — entrée des shorts du Shock Engine

Plan : `research/preregistration/short-entry-v1.1.md` (commit `6b91ec7`, antérieur à tout calcul). Résultats produits par `node research/shock/short-entry-study.ts` au commit `b36831b`. La v1 reste figée ; rien ici ne modifie le live, le site ni les rapports publiés.

Simulation historique après coûts modélisés. Pas une performance live.

## Verdict selon la règle pré-enregistrée

**AMÉLIORATION NON DÉMONTRÉE**

| Condition | Valeur | Seuil | Résultat |
|---|---|---|---|
| H3 · bootstrap, p unilatéral de Δ(V3) | 0,4402 | < 0,05 | non |
| H3 · constance, actifs où Ē(V3) > Ē(V0) | 6 / 8 | ≥ 6 | oui |
| G1 · shorts V3 sur les 8 actifs | 1485 | ≥ 100 | oui |
| G2 · Δ(V3) à coûts × 2 | +0,007 | > 0 | oui |
| G3 · médiane de l'écart de Sharpe stratégie complète, V3 − V0 | +0,034 | ≥ 0 | oui |

Δ(V3) = +0,006 σ par short (intervalle bootstrap à 90 % : −0,049 à +0,060).

V1 et V2 ne sont pas testées : la règle ne les teste que si H3 est rejetée. Leurs chiffres ci-dessous sont descriptifs.

**V4 · valeur de la sleeve short hors échantillon** : Ē(V0) mis en commun = +0,028 σ par short (90 % : −0,058 à +0,123) ; moyenne à poids égal par actif +0,033 (90 % : −0,053 à +0,129). Médiane de l'écart de Sharpe V0 − V4 : +0,019. Conclusion : valeur des shorts non démontrée hors échantillon (constat seulement, la v1 n'est pas modifiée).

## Mesure principale par actif vierge

R = (PnL net / equity à l'entrée) / σ journalière des 30 jours précédents. Ē = moyenne de R sur les shorts, coûts × 1.

| Actif | Shorts V0 | Ē(V0) | Shorts V3 | Ē(V3) | Ē(V3) − Ē(V0) | Ē(V1) | Ē(V2) | Ē(E1) | Ē(E2) |
|---|---|---|---|---|---|---|---|---|---|
| XRP | 334 | +0,024 | 178 | +0,031 | +0,006 | +0,006 | +0,016 | +0,038 | +0,064 |
| BNB | 365 | −0,002 | 222 | +0,035 | +0,037 | +0,007 | +0,009 | −0,014 | +0,353 |
| DOGE | 270 | −0,000 | 155 | +0,035 | +0,035 | +0,025 | +0,014 | +0,015 | +0,008 |
| TRX | 374 | −0,058 | 216 | −0,023 | +0,035 | −0,047 | +0,016 | −0,060 | −0,055 |
| ADA | 310 | +0,098 | 184 | +0,175 | +0,077 | +0,066 | +0,156 | +0,086 | +0,202 |
| LINK | 275 | +0,152 | 165 | −0,005 | −0,158 | +0,022 | +0,191 | +0,178 | +0,304 |
| XLM | 294 | +0,025 | 182 | −0,009 | −0,035 | −0,010 | +0,058 | +0,018 | +0,175 |
| LTC | 359 | +0,021 | 183 | +0,071 | +0,050 | +0,060 | +0,008 | +0,031 | +0,149 |

## Tests bootstrap (mois civils tirés en commun, 10 000 réplications)

| Variante | Δ (σ par short) | Δ à coûts × 2 | 90 % | p unilatéral | Actifs améliorés | Statut |
|---|---|---|---|---|---|---|
| V1 · symétrie bougie | −0,017 | −0,016 | −0,047 à +0,013 | 0,8277 | 4/8 | descriptif (H3 non rejetée) |
| V2 · symétrie tendance 60 min | +0,026 | +0,027 | −0,010 à +0,060 | 0,1188 | 6/8 | descriptif (H3 non rejetée) |
| V3 · V1 + V2 (principale) | +0,006 | +0,007 | −0,049 à +0,060 | 0,4402 | 6/8 | confirmatoire (principale) |
| E1 · lambda + volume miroir (exploratoire) | +0,004 | +0,004 | −0,006 à +0,014 | 0,2740 | 4/8 | EXPLORATOIRE |
| E2 · tendance journalière baissière (exploratoire) | +0,117 | +0,118 | +0,040 à +0,210 | 0,0045 | 8/8 | EXPLORATOIRE |

## Mesures secondaires, actifs vierges (coûts × 1)

Somme ou médiane sur les 8 actifs. Risque de baisse : semi-écart de R, pire R. Crises : shorts entrés pendant les 7 épisodes nommés, ou un jour où l'actif était à plus de 30 % sous son plus haut sur un an.

| Variante | Shorts | Shorts/an (médiane) | Réussite | Rendement net moyen | PF | Semi-écart R | Pire R | Épisodes : shorts · Σ net | Baisse > 30 % : shorts · Ē | Sharpe stratégie complète (médiane) |
|---|---|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | 2581 | 44,7 | 26 % | 0,10 % | 1,08 | 0,53 | −4,80 | 169 · 538 % | 2016 · +0,017 | 0,37 |
| V1 · symétrie bougie | 2167 | 35,8 | 25 % | 0,02 % | 1,01 | 0,55 | −4,80 | 156 · 482 % | 1699 · +0,005 | 0,17 |
| V2 · symétrie tendance 60 min | 1780 | 31,0 | 25 % | 0,15 % | 1,11 | 0,52 | −2,38 | 149 · 388 % | 1420 · +0,055 | 0,40 |
| V3 · V1 + V2 (principale) | 1485 | 24,8 | 25 % | 0,08 % | 1,06 | 0,55 | −3,41 | 129 · 406 % | 1191 · +0,050 | 0,19 |
| V4 · sans shorts | 0 | 0,0 | — | — | — | — | — | 0 · 0 % | 0 · — | 0,30 |
| E1 · lambda + volume miroir (exploratoire) | 2457 | 42,0 | 26 % | 0,12 % | 1,09 | 0,53 | −4,80 | 156 · 544 % | 1917 · +0,021 | 0,36 |
| E2 · tendance journalière baissière (exploratoire) | 1201 | 21,2 | 28 % | 0,44 % | 1,38 | 0,48 | −2,38 | 131 · 432 % | 1097 · +0,113 | 0,55 |

### Sharpe de la stratégie complète par actif (coûts × 1)

| Actif | Fenêtre | V0 | V1 | V2 | V3 | V4 | E1 | E2 |
|---|---|---|---|---|---|---|---|---|
| XRP | 2019-06-01 → 2026-09-30 | 0,67 | 0,63 | 0,60 | 0,66 | 0,75 | 0,72 | 0,78 |
| BNB | 2018-12-01 → 2026-09-30 | 0,08 | 0,11 | 0,15 | 0,21 | 0,27 | 0,03 | 0,58 |
| DOGE | 2020-08-01 → 2026-09-30 | 0,53 | 0,58 | 0,62 | 0,61 | 0,57 | 0,56 | 0,53 |
| TRX | 2019-07-01 → 2026-09-30 | 0,08 | 0,12 | 0,26 | 0,18 | 0,34 | 0,11 | 0,30 |
| ADA | 2019-05-01 → 2026-09-30 | 0,46 | 0,32 | 0,54 | 0,52 | 0,35 | 0,45 | 0,57 |
| LINK | 2020-02-01 → 2026-09-30 | 0,65 | 0,20 | 0,63 | 0,14 | 0,26 | 0,72 | 0,68 |
| XLM | 2019-06-01 → 2026-09-30 | 0,28 | 0,14 | 0,26 | 0,13 | 0,20 | 0,27 | 0,51 |
| LTC | 2019-01-01 → 2026-09-30 | −0,00 | 0,03 | −0,14 | −0,00 | −0,34 | 0,04 | 0,13 |

### Ē par moitié et par année, actifs vierges mis en commun

| Variante | Jusqu'au 2022-09-15 | Après | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | +0,018 (1171) | +0,037 (1410) | −0,39 (1) | +0,21 (221) | −0,11 (282) | −0,17 (276) | +0,10 (520) | −0,09 (416) | +0,02 (255) | +0,20 (302) | +0,08 (308) |
| V1 · symétrie bougie | −0,009 (1001) | +0,034 (1166) | −0,39 (1) | +0,24 (186) | −0,20 (231) | −0,23 (231) | +0,07 (474) | −0,03 (297) | −0,02 (203) | +0,17 (279) | +0,08 (265) |
| V2 · symétrie tendance 60 min | +0,044 (818) | +0,065 (962) | −0,39 (1) | +0,27 (160) | −0,21 (182) | −0,15 (195) | +0,18 (375) | −0,01 (271) | +0,08 (168) | +0,15 (230) | +0,04 (198) |
| V3 · V1 + V2 (principale) | +0,046 (688) | +0,031 (797) | −0,39 (1) | +0,32 (134) | −0,24 (145) | −0,24 (166) | +0,18 (328) | −0,01 (200) | −0,02 (134) | +0,13 (209) | +0,05 (168) |
| E1 · lambda + volume miroir (exploratoire) | +0,032 (1103) | +0,031 (1354) | −0,39 (1) | +0,20 (210) | −0,09 (261) | −0,16 (254) | +0,11 (500) | −0,10 (402) | +0,01 (248) | +0,19 (295) | +0,09 (286) |
| E2 · tendance journalière baissière (exploratoire) | +0,106 (558) | +0,169 (643) | −0,39 (1) | +0,32 (128) | −0,00 (65) | −0,04 (120) | +0,12 (314) | +0,25 (120) | −0,02 (126) | +0,37 (160) | +0,05 (167) |

## BTC, ETH et portefeuille 50/50 (déjà vus : descriptif)

| Variante | BTC shorts · Ē | ETH shorts · Ē | BTC Sharpe | ETH Sharpe | Portefeuille Sharpe | CAGR | Drawdown max | Sharpe 1re moitié | Sharpe 2de moitié |
|---|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | 430 · +0,237 | 365 · +0,184 | 1,55 | 1,50 | 1,73 | 64,5 % | −23,5 % | 2,13 | 1,29 |
| V1 · symétrie bougie | 361 · +0,230 | 297 · +0,229 | 1,50 | 1,54 | 1,69 | 63,3 % | −23,5 % | 2,06 | 1,45 |
| V2 · symétrie tendance 60 min | 308 · +0,258 | 247 · +0,280 | 1,39 | 1,56 | 1,68 | 61,5 % | −22,1 % | 1,92 | 1,50 |
| V3 · V1 + V2 (principale) | 250 · +0,270 | 197 · +0,289 | 1,39 | 1,52 | 1,62 | 57,1 % | −18,9 % | 1,98 | 1,48 |
| V4 · sans shorts | 0 · — | 0 · — | 1,27 | 1,26 | 1,52 | 33,5 % | −16,1 % | 1,41 | 1,66 |
| E1 · lambda + volume miroir (exploratoire) | 395 · +0,257 | 357 · +0,155 | 1,56 | 1,41 | 1,67 | 60,3 % | −22,8 % | 2,08 | 1,23 |
| E2 · tendance journalière baissière (exploratoire) | 154 · +0,402 | 114 · +0,579 | 1,52 | 1,75 | 1,88 | 61,6 % | −19,1 % | 2,03 | 1,78 |

Sharpe BTC et ETH : stratégie complète sur la fenêtre de chaque sleeve. Portefeuille : 50/50 au départ, sans rebalancement, période commune ; par moitié, 50/50 au début de chaque moitié (comme l'attribution).

## Données

| Actif | Données | Simulation | Barres simulées | Trous | mintick |
|---|---|---|---|---|---|
| BTC | BTC/USD · Bitstamp spot | 2017-01-01 → 2026-10-04 | 341941 | 33 | 1 |
| ETH | ETH/USDT · Binance spot | 2018-09-01 → 2026-09-30 | 283081 | 23 | 0.01 |
| XRP | XRP/USDT · Binance spot | 2019-06-01 → 2026-09-30 | 256979 | 19 | 0.00001 |
| BNB | BNB/USDT · Binance spot | 2018-12-01 → 2026-09-30 | 274387 | 21 | 0.0001 |
| DOGE | DOGE/USDT · Binance spot | 2020-08-01 → 2026-09-30 | 216099 | 10 | 1e-7 |
| TRX | TRX/USDT · Binance spot | 2019-07-01 → 2026-09-30 | 254103 | 18 | 1e-7 |
| ADA | ADA/USDT · Binance spot | 2019-05-01 → 2026-09-30 | 259915 | 20 | 0.000001 |
| LINK | LINK/USDT · Binance spot | 2020-02-01 → 2026-09-30 | 233512 | 15 | 0.0001 |
| XLM | XLM/USDT · Binance spot | 2019-06-01 → 2026-09-30 | 256979 | 19 | 0.000001 |
| LTC | LTC/USDT · Binance spot | 2019-01-01 → 2026-09-30 | 271411 | 21 | 0.001 |

Coûts des actifs vierges : commission 0,045 % et glissement 0,01 % par ordre (× 2 pour G2). BTC et ETH : coûts de la v1.

## Écarts au pré-enregistrement

1. **Contrôle de grille limité à la fenêtre simulée.** Le plan demandait des horodatages sur la grille 15 min pour les actifs vierges, sans préciser la portée. Au premier lancement, le contrôle a arrêté le script avant toute simulation : BNB a 81 bougies hors grille (2018-02-09T09:58 → 2018-02-10T05:58 UTC), LTC a 81 bougies hors grille (2018-02-09T09:58 → 2018-02-10T05:58 UTC), soit la panne Binance de février 2018, dans le préchauffage, environ 10 mois avant le début de la simulation. Les données sont gardées telles que téléchargées ; le contrôle porte sur la fenêtre simulée (comme dans portfolio.ts), et un contrôle ajouté montre qu'en retirant ces bougies, le régime et toutes les listes d'entrées (V0 à E2) de la fenêtre simulée restent identiques barre par barre. Aucun résultat n'avait été calculé avant cet écart.

## Contrôles (123/123)

- ✔ empreinte lib/strategies/shock/market.ts · b69ad8f8f89a4ded
- ✔ empreinte lib/strategies/shock/strategy.ts · fafb22d6373b19bf
- ✔ empreinte lib/strategies/shock/broker.ts · bad42836b9d61569
- ✔ empreinte lib/strategies/shock/engine.ts · 15211a3e185b1214
- ✔ empreinte lib/strategies/shock/params.ts · 5f7cd0c941d70273
- ✔ empreinte lib/strategies/shock/presets.ts · f97449733ec945bb
- ✔ empreinte lib/strategies/shock/regimes.ts · d72f79d1d97c214d
- ✔ empreinte lib/strategies/shock/live.ts · 05caf82ece9ad7f8
- ✔ empreinte research/lib/frozen-shock.ts · be445aa726433c3e
- ✔ XRP : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 256979 barres simulées, 0 hors grille, 19 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ XRP : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ BNB : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 274387 barres simulées, 0 hors grille, 21 trous ; préchauffage : 81 bougie(s) hors grille
- ✔ BNB : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ DOGE : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 216099 barres simulées, 0 hors grille, 10 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ DOGE : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ TRX : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 254103 barres simulées, 0 hors grille, 18 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ TRX : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ ADA : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 259915 barres simulées, 0 hors grille, 20 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ ADA : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ LINK : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 233512 barres simulées, 0 hors grille, 15 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ LINK : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ XLM : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 256979 barres simulées, 0 hors grille, 19 trous ; préchauffage : 0 bougie(s) hors grille
- ✔ XLM : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ LTC : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon · 271411 barres simulées, 0 hors grille, 21 trous ; préchauffage : 81 bougie(s) hors grille
- ✔ LTC : fenêtre jusqu'au 2026-09-30 · dernière barre 2026-09-30T23:45:00.000Z
- ✔ BTC jeu calme : entrées reconstruites = moteur, barre par barre · 341941 barres, 0 écart(s) ; 762 entrées long et 1512 entrées short brutes
- ✔ BTC jeu agité : entrées reconstruites = moteur, barre par barre · 341941 barres, 0 écart(s) ; 1103 entrées long et 2716 entrées short brutes
- ✔ BTC : régime recalculé = régime du moteur · 0 écart(s) sur 377044 barres
- ✔ BTC : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ BTC : chaque variante est un sous-ensemble des shorts v1 · V0 812, V1 595, V2 546, V3 395, V4 0, E1 732, E2 290
- ✔ ETH jeu calme : entrées reconstruites = moteur, barre par barre · 283081 barres, 0 écart(s) ; 756 entrées long et 1300 entrées short brutes
- ✔ ETH jeu agité : entrées reconstruites = moteur, barre par barre · 283081 barres, 0 écart(s) ; 988 entrées long et 2220 entrées short brutes
- ✔ ETH : régime recalculé = régime du moteur · 0 écart(s) sur 319294 barres
- ✔ ETH : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ ETH : chaque variante est un sous-ensemble des shorts v1 · V0 672, V1 464, V2 449, V3 299, V4 0, E1 629, E2 225
- ✔ XRP jeu calme : entrées reconstruites = moteur, barre par barre · 256979 barres, 0 écart(s) ; 626 entrées long et 1020 entrées short brutes
- ✔ XRP jeu agité : entrées reconstruites = moteur, barre par barre · 256979 barres, 0 écart(s) ; 820 entrées long et 1799 entrées short brutes
- ✔ XRP : régime recalculé = régime du moteur · 0 écart(s) sur 294492 barres
- ✔ XRP : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ XRP : chaque variante est un sous-ensemble des shorts v1 · V0 582, V1 401, V2 408, V3 276, V4 0, E1 538, E2 296
- ✔ BNB jeu calme : entrées reconstruites = moteur, barre par barre · 274387 barres, 0 écart(s) ; 619 entrées long et 1121 entrées short brutes
- ✔ BNB jeu agité : entrées reconstruites = moteur, barre par barre · 274387 barres, 0 écart(s) ; 928 entrées long et 2117 entrées short brutes
- ✔ BNB : régime recalculé = régime du moteur · 0 écart(s) sur 311547 barres
- ✔ BNB : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ BNB : chaque variante est un sous-ensemble des shorts v1 · V0 679, V1 533, V2 455, V3 359, V4 0, E1 638, E2 258
- ✔ DOGE jeu calme : entrées reconstruites = moteur, barre par barre · 216099 barres, 0 écart(s) ; 522 entrées long et 861 entrées short brutes
- ✔ DOGE jeu agité : entrées reconstruites = moteur, barre par barre · 216099 barres, 0 écart(s) ; 677 entrées long et 1581 entrées short brutes
- ✔ DOGE : régime recalculé = régime du moteur · 0 écart(s) sur 253671 barres
- ✔ DOGE : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ DOGE : chaque variante est un sous-ensemble des shorts v1 · V0 502, V1 361, V2 356, V3 264, V4 0, E1 460, E2 314
- ✔ TRX jeu calme : entrées reconstruites = moteur, barre par barre · 254103 barres, 0 écart(s) ; 538 entrées long et 1108 entrées short brutes
- ✔ TRX jeu agité : entrées reconstruites = moteur, barre par barre · 254103 barres, 0 écart(s) ; 851 entrées long et 1961 entrées short brutes
- ✔ TRX : régime recalculé = régime du moteur · 0 écart(s) sur 290830 barres
- ✔ TRX : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ TRX : chaque variante est un sous-ensemble des shorts v1 · V0 688, V1 587, V2 439, V3 384, V4 0, E1 641, E2 251
- ✔ ADA jeu calme : entrées reconstruites = moteur, barre par barre · 259915 barres, 0 écart(s) ; 559 entrées long et 1028 entrées short brutes
- ✔ ADA jeu agité : entrées reconstruites = moteur, barre par barre · 259915 barres, 0 écart(s) ; 912 entrées long et 1862 entrées short brutes
- ✔ ADA : régime recalculé = régime du moteur · 0 écart(s) sur 296140 barres
- ✔ ADA : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ ADA : chaque variante est un sous-ensemble des shorts v1 · V0 581, V1 421, V2 424, V3 305, V4 0, E1 546, E2 323
- ✔ LINK jeu calme : entrées reconstruites = moteur, barre par barre · 233512 barres, 0 écart(s) ; 482 entrées long et 849 entrées short brutes
- ✔ LINK jeu agité : entrées reconstruites = moteur, barre par barre · 233512 barres, 0 écart(s) ; 763 entrées long et 1645 entrées short brutes
- ✔ LINK : régime recalculé = régime du moteur · 0 écart(s) sur 269931 barres
- ✔ LINK : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ LINK : chaque variante est un sous-ensemble des shorts v1 · V0 529, V1 369, V2 383, V3 259, V4 0, E1 506, E2 224
- ✔ XLM jeu calme : entrées reconstruites = moteur, barre par barre · 256979 barres, 0 écart(s) ; 490 entrées long et 911 entrées short brutes
- ✔ XLM jeu agité : entrées reconstruites = moteur, barre par barre · 256979 barres, 0 écart(s) ; 780 entrées long et 1809 entrées short brutes
- ✔ XLM : régime recalculé = régime du moteur · 0 écart(s) sur 291894 barres
- ✔ XLM : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ XLM : chaque variante est un sous-ensemble des shorts v1 · V0 544, V1 401, V2 394, V3 296, V4 0, E1 510, E2 312
- ✔ LTC jeu calme : entrées reconstruites = moteur, barre par barre · 271411 barres, 0 écart(s) ; 600 entrées long et 1093 entrées short brutes
- ✔ LTC jeu agité : entrées reconstruites = moteur, barre par barre · 271411 barres, 0 écart(s) ; 811 entrées long et 1931 entrées short brutes
- ✔ LTC : régime recalculé = régime du moteur · 0 écart(s) sur 307995 barres
- ✔ LTC : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ LTC : chaque variante est un sous-ensemble des shorts v1 · V0 654, V1 443, V2 434, V3 300, V4 0, E1 613, E2 281
- ✔ XRP : filtre journalier E2 causal (historique tronqué après la barre) · 12 barres testées, 0 écart(s)
- ✔ BNB sans bougies hors grille jeu calme : entrées reconstruites = moteur, barre par barre · 274387 barres, 0 écart(s) ; 619 entrées long et 1121 entrées short brutes
- ✔ BNB sans bougies hors grille jeu agité : entrées reconstruites = moteur, barre par barre · 274387 barres, 0 écart(s) ; 928 entrées long et 2117 entrées short brutes
- ✔ BNB sans bougies hors grille : régime recalculé = régime du moteur · 0 écart(s) sur 311466 barres
- ✔ BNB sans bougies hors grille : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ BNB sans bougies hors grille : chaque variante est un sous-ensemble des shorts v1 · V0 679, V1 533, V2 455, V3 359, V4 0, E1 638, E2 258
- ✔ BNB : les 81 bougies hors grille du préchauffage ne changent ni le régime ni les entrées de la fenêtre simulée · 2018-02-09T09:58:15.787Z → 2018-02-10T05:58:15.787Z ; 274387 barres comparées, 0 écart(s)
- ✔ LTC sans bougies hors grille jeu calme : entrées reconstruites = moteur, barre par barre · 271411 barres, 0 écart(s) ; 600 entrées long et 1093 entrées short brutes
- ✔ LTC sans bougies hors grille jeu agité : entrées reconstruites = moteur, barre par barre · 271411 barres, 0 écart(s) ; 811 entrées long et 1931 entrées short brutes
- ✔ LTC sans bougies hors grille : régime recalculé = régime du moteur · 0 écart(s) sur 307914 barres
- ✔ LTC sans bougies hors grille : tous les shorts v1 viennent du jeu calme · le jeu agité n'autorise pas les shorts
- ✔ LTC sans bougies hors grille : chaque variante est un sous-ensemble des shorts v1 · V0 654, V1 443, V2 434, V3 300, V4 0, E1 613, E2 281
- ✔ LTC : les 81 bougies hors grille du préchauffage ne changent ni le régime ni les entrées de la fenêtre simulée · 2018-02-09T09:58:16.812Z → 2018-02-10T05:58:16.812Z ; 271411 barres comparées, 0 écart(s)
- ✔ BTC : liste des entrées long identique dans toutes les variantes · 959 entrées long, même tableau pour les 7 variantes
- ✔ ETH : liste des entrées long identique dans toutes les variantes · 867 entrées long, même tableau pour les 7 variantes
- ✔ XRP : liste des entrées long identique dans toutes les variantes · 697 entrées long, même tableau pour les 7 variantes
- ✔ BNB : liste des entrées long identique dans toutes les variantes · 748 entrées long, même tableau pour les 7 variantes
- ✔ DOGE : liste des entrées long identique dans toutes les variantes · 573 entrées long, même tableau pour les 7 variantes
- ✔ TRX : liste des entrées long identique dans toutes les variantes · 629 entrées long, même tableau pour les 7 variantes
- ✔ ADA : liste des entrées long identique dans toutes les variantes · 719 entrées long, même tableau pour les 7 variantes
- ✔ LINK : liste des entrées long identique dans toutes les variantes · 615 entrées long, même tableau pour les 7 variantes
- ✔ XLM : liste des entrées long identique dans toutes les variantes · 610 entrées long, même tableau pour les 7 variantes
- ✔ LTC : liste des entrées long identique dans toutes les variantes · 716 entrées long, même tableau pour les 7 variantes
- ✔ BTC V0 × 1 = rapport validé de la v1 · research/reports/shock-15m-zeroshot-btc.json, écart relatif max 0.0e+0
- ✔ BTC V0 × 2 = rapport validé de la v1 · research/reports/shock-15m-zeroshot-btc.json, écart relatif max 0.0e+0
- ✔ ETH V0 × 1 = rapport validé de la v1 · research/reports/shock-15m-zeroshot-ethusdt.json, écart relatif max 0.0e+0
- ✔ ETH V0 × 2 = rapport validé de la v1 · research/reports/shock-15m-zeroshot-ethusdt.json, écart relatif max 0.0e+0
- ✔ BTC V4 : aucun short · 620 positions
- ✔ ETH V4 : aucun short · 553 positions
- ✔ XRP V4 : aucun short · 422 positions
- ✔ BNB V4 : aucun short · 502 positions
- ✔ DOGE V4 : aucun short · 384 positions
- ✔ TRX V4 : aucun short · 427 positions
- ✔ ADA V4 : aucun short · 457 positions
- ✔ LINK V4 : aucun short · 413 positions
- ✔ XLM V4 : aucun short · 412 positions
- ✔ LTC V4 : aucun short · 504 positions
- ✔ BTC : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ ETH : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ XRP : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ BNB : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ DOGE : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ TRX : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ ADA : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ LINK : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ XLM : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ LTC : σ journalière définie pour chaque short · 0 short(s) sans σ
- ✔ Portefeuille 50/50 V0 : Sharpe total et par moitié = rapport publié · 1.726052721 vs 1.726052721 ; 2.125914698 vs 2.125914698 ; 1.285919865 vs 1.285919865
