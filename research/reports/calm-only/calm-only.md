# V1-calme : surajustement de sélection (CSCV-PBO, walk-forward, Sharpe dégonflé)

Plan : `research/preregistration/calm-only.md`, commité avant tout calcul. Script : `research/shock/calm-only.ts` (commit `c3fe6a8`). Moteur non modifié. V1-calme = E2 sans nouvelles entrées en régime agité, réglages inchangés, BTC/ETH 50/50. Son résultat contre E2 était déjà connu : l'étude mesure le risque que ce choix vienne de la sélection, pas un test indépendant.

## Réponse

**Verdict (règle du § 6) : candidate fragile.**

- **PBO** (16 configurations, 16 blocs, 12 870 découpages) : **19,2 %** (faible). La configuration la meilleure dans l'échantillon est V1-calme dans 57 % des découpages ; rang relatif moyen hors échantillon : V1-calme 89 %, E2 61 %.
- **Walk-forward** (recalage annuel 2020 → 2026, passé seulement) : le sélecteur E2 / V1-calme retient V1-calme à 7 recalages sur 7. Hors échantillon 2020-01 → 2026-09, Sharpe : sélecteur sur les 16 1,88, sélecteur E2 / V1-calme 1,98, E2 1,83, V1-calme fixe 1,98 ; Δ sélecteur 16 − E2 +0,051 (IC 95 % −0,163 à +0,265) → favorable.
- **DSR du gain sur E2** (série V1-calme − E2, N = 15 alternatives) : ratio d'information 0,56 par an, PSR(0) 93,7 %, seuil dû aux essais 0,89, **DSR 18,0 %** → gain non démontré. Avec des commissions doublées : DSR 48,5 %.
- **DSR du Sharpe absolu de V1-calme** : 100,0 % contre l'univers A ; contre la lignée des réglages (écart type des 206 candidats 0,60), 99,9 % à N = 16, 87,6 % à N = 222, 21,5 % à N = 6 266, 1,3 % à N = 128 547. Il passe sous 0,95 au-delà de N ≈ 109 essais (E2 : 53).

## 1. Univers A rejoué

Chaque configuration redonne le Sharpe publié de son étude (écart < 1e-6 ; contrôles en fin de rapport).

| n° | Configuration | Étude | Sharpe | Sharpe, commissions × 2 | Δ dû aux frais |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | v1 (live, sans filtre E2) | short-entry V0 | 1,726 | 1,406 | −0,320 |
| 2 | shorts : symétrie de bougie | short-entry V1 | 1,691 | 1,397 | −0,294 |
| 3 | shorts : symétrie tendance 60 min | short-entry V2 | 1,680 | 1,397 | −0,282 |
| 4 | shorts : V1 + V2 | short-entry V3 | 1,624 | 1,354 | −0,270 |
| 5 | sans shorts | short-entry V4 | 1,518 | 1,227 | −0,292 |
| 6 | shorts : lambda + volume miroir | short-entry E1 | 1,672 | 1,353 | −0,319 |
| 7 | E2 (référence) | short-entry E2 | 1,878 | 1,610 | −0,268 |
| 8 | E2, entrées en range retirées | regime-fakeout V1 | 1,866 | 1,622 | −0,244 |
| 9 | E2, confirmation retardée en range | regime-fakeout V2 | 1,893 | 1,632 | −0,261 |
| 10 | E2, sorties agitées en range | regime-fakeout V3 | 1,913 | 1,624 | −0,289 |
| 11 | V1-calme | agitated-regime V1 | 2,024 | 1,878 | −0,146 |
| 12 | E2, stop agité 3,3 ATR, taille inchangée | agitated-regime V2a | 1,860 | 1,624 | −0,235 |
| 13 | E2, stop agité 3,3 ATR, même risque | agitated-regime V2b | 1,998 | 1,818 | −0,180 |
| 14 | E2, invalidation à 4 bougies | early-invalidation V1 | 1,908 | 1,588 | −0,320 |
| 15 | E2, invalidation à 2 bougies | early-invalidation S2 | 1,719 | 1,391 | −0,329 |
| 16 | E2, invalidation à 8 bougies | early-invalidation S8 | 1,793 | 1,481 | −0,311 |

## 2. CSCV-PBO

| Matrice | Découpages | PBO | λ (10 / 50 / 90 %) | P(perte hors éch.) | Pente de dégradation | Sharpe hors éch. du choix (moy.) | V1-calme choisie | Rang hors éch. V1-calme | Rang hors éch. E2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **16 configurations, S = 16 (principal)** | 12870 | 19,2 % | −0,88 / +1,54 / +2,77 | 0,0 % | −0,95 | 1,90 | 57 % | 89 % | 61 % |
| S = 10 | 252 | 18,3 % | −0,61 / +2,01 / +2,77 | 0,0 % | −0,94 | 1,91 | 59 % | 90 % | 61 % |
| commissions × 2 | 12870 | 1,9 % | +2,01 / +2,77 / +2,77 | 0,0 % | −0,97 | 1,84 | 88 % | 93 % | 63 % |
| 10 configurations bâties sur E2 | 12870 | 22,7 % | −1,50 / +1,50 / +2,30 | 0,0 % | −0,98 | 1,93 | 59 % | 84 % | 46 % |

Configurations retenues dans l'échantillon (principal) et rang relatif moyen hors échantillon (50 % = médiane) :

| Configuration | Retenue | Rang hors échantillon moyen |
| --- | ---: | ---: |
| 11 · V1-calme | 7359 (57 %) | 89 % |
| 13 · E2, stop agité 3,3 ATR, même risque | 2404 (19 %) | 87 % |
| 10 · E2, sorties agitées en range | 561 (4 %) | 70 % |
| 14 · E2, invalidation à 4 bougies | 1047 (8 %) | 67 % |
| 9 · E2, confirmation retardée en range | 46 (0 %) | 65 % |
| 7 · E2 (référence) | 0 (0 %) | 61 % |
| 8 · E2, entrées en range retirées | 350 (3 %) | 59 % |
| 12 · E2, stop agité 3,3 ATR, taille inchangée | 421 (3 %) | 58 % |
| 16 · E2, invalidation à 8 bougies | 11 (0 %) | 44 % |
| 1 · v1 (live, sans filtre E2) | 389 (3 %) | 40 % |
| 2 · shorts : symétrie de bougie | 3 (0 %) | 31 % |
| 15 · E2, invalidation à 2 bougies | 4 (0 %) | 31 % |
| 6 · shorts : lambda + volume miroir | 153 (1 %) | 29 % |
| 3 · shorts : symétrie tendance 60 min | 2 (0 %) | 29 % |
| 5 · sans shorts | 120 (1 %) | 20 % |
| 4 · shorts : V1 + V2 | 0 (0 %) | 20 % |

## 3. Walk-forward chronologique

| Recalage | Sélecteur sur les 16 (Sharpe passé) | Sélecteur E2 / V1-calme (Sharpe passé) |
| --- | ---: | ---: |
| 2020-01-01 | 6 · shorts : lambda + volume miroir (2,39) | 11 · V1-calme (2,23) |
| 2021-01-01 | 13 · E2, stop agité 3,3 ATR, même risque (2,10) | 11 · V1-calme (2,07) |
| 2022-01-01 | 13 · E2, stop agité 3,3 ATR, même risque (2,06) | 11 · V1-calme (1,99) |
| 2023-01-01 | 13 · E2, stop agité 3,3 ATR, même risque (2,01) | 11 · V1-calme (1,99) |
| 2024-01-01 | 13 · E2, stop agité 3,3 ATR, même risque (1,90) | 11 · V1-calme (1,88) |
| 2025-01-01 | 13 · E2, stop agité 3,3 ATR, même risque (2,02) | 11 · V1-calme (2,01) |
| 2026-01-01 | 11 · V1-calme (2,04) | 11 · V1-calme (2,04) |

| Hors échantillon 2020-01-01 → 2026-09-30 | Sharpe | CAGR | Drawdown max. | Δ Sharpe contre E2 [IC 95 %] |
| --- | ---: | ---: | ---: | ---: |
| Sélecteur sur les 16 | 1,88 | 61,1 % | −18,8 % | +0,051 [−0,163 ; +0,265] |
| Sélecteur E2 / V1-calme | 1,98 | 63,4 % | −17,8 % | +0,157 [−0,029 ; +0,328] |
| E2 fixe | 1,83 | 57,0 % | −19,1 % | — |
| V1-calme fixe (choisie en 2026) | 1,98 | 63,4 % | −17,8 % | +0,157 [−0,029 ; +0,328] |

Année par année (Sharpe ; 2018 et 2026 partielles) :

| Année | Jours | E2 | V1-calme | Δ | E2 (× 2) | V1-calme (× 2) | Δ (× 2) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2018 | 122 | 4,97 | 5,22 | +0,24 | 4,83 | 5,11 | +0,28 |
| 2019 | 365 | 0,43 | 0,45 | +0,03 | 0,11 | 0,24 | +0,13 |
| 2020 | 366 | 1,66 | 1,82 | +0,16 | 1,34 | 1,69 | +0,35 |
| 2021 | 365 | 1,84 | 1,80 | −0,05 | 1,57 | 1,69 | +0,12 |
| 2022 | 365 | 1,75 | 2,00 | +0,24 | 1,51 | 1,84 | +0,33 |
| 2023 | 365 | 1,09 | 1,35 | +0,26 | 0,74 | 1,08 | +0,34 |
| 2024 | 366 | 3,07 | 3,13 | +0,06 | 2,72 | 3,03 | +0,31 |
| 2025 | 365 | 1,91 | 2,24 | +0,33 | 1,65 | 2,11 | +0,46 |
| 2026 | 273 | 1,78 | 1,95 | +0,17 | 1,56 | 1,81 | +0,25 |

## 4. Sharpe dégonflé

Sharpe annualisés ; calcul sur les rendements journaliers (2952 jours), asymétrie et kurtosis comprises. Écart type des Sharpe des essais : univers A 0,137 ; 206 candidats de la recherche des réglages 0,602 (Sharpe moyen −0,25, de −2,29 à 1,18).

**(a) Sharpe absolu**

| Stratégie | Sharpe | Asymétrie / kurtosis | PSR(0) | DSR, N = 16 (écart type A) | DSR, N = 16 (écart type B) | DSR, N = 222 (écart type B) | DSR, N = 6 266 (écart type B) | DSR, N = 128 547 (écart type B) | N* où DSR < 95 % (A · B) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1-calme | 2,02 | 3,65 / 28,8 | 100,00 % | 100,00 % (seuil 0,25) | 99,9 % (seuil 1,08) | 87,6 % (seuil 1,69) | 21,5 % (seuil 2,26) | 1,3 % (seuil 2,68) | > 10¹⁵ · 109 |
| E2 | 1,88 | 3,37 / 25,7 | 100,00 % | 100,00 % (seuil 0,25) | 99,6 % (seuil 1,08) | 73,8 % (seuil 1,69) | 10,4 % (seuil 2,26) | 0,4 % (seuil 2,68) | > 10¹⁵ · 53 |

**(b) Gain de V1-calme sur E2** (série quotidienne V1-calme − E2)

| Commissions | Ratio d'information | Asymétrie / kurtosis | PSR(0) | N | Écart type des essais | Seuil | DSR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| × 1 | 0,558 | −1,96 / 52,7 | 93,7 % | 15 | 0,503 | 0,891 | **18,0 %** |
| × 2 | 1,073 | −1,07 / 48,9 | 99,8 % | 15 | 0,614 | 1,087 | **48,5 %** |

| Alternative à E2 | Ratio d'information contre E2 (× 1) |
| --- | ---: |
| 13 · E2, stop agité 3,3 ATR, même risque | 0,655 |
| 11 · V1-calme | 0,558 |
| 12 · E2, stop agité 3,3 ATR, taille inchangée | 0,344 |
| 1 · v1 (live, sans filtre E2) | 0,160 |
| 9 · E2, confirmation retardée en range | 0,134 |
| 2 · shorts : symétrie de bougie | 0,133 |
| 3 · shorts : symétrie tendance 60 min | 0,059 |
| 6 · shorts : lambda + volume miroir | 0,009 |
| 4 · shorts : V1 + V2 | −0,119 |
| 10 · E2, sorties agitées en range | −0,222 |
| 8 · E2, entrées en range retirées | −0,242 |
| 14 · E2, invalidation à 4 bougies | −0,437 |
| 16 · E2, invalidation à 8 bougies | −0,661 |
| 15 · E2, invalidation à 2 bougies | −0,892 |
| 5 · sans shorts | −1,239 |

## Lecture

- **Le choix est stable dans le temps.** PBO 19,2 % : choisir la meilleure configuration sur une moitié des blocs donne, sur l'autre moitié, une configuration au-dessus de la médiane dans 81 % des cas. V1-calme est la meilleure dans l'échantillon dans 57 % des découpages et se classe en moyenne à 89 % hors échantillon. Elle fait mieux que E2 8 années sur 9 (9 sur 9 avec des commissions doublées), et un choix fait en temps réel entre E2 et V1-calme l'aurait retenue à chaque recalage depuis 2020.
- **Mais l'écart est petit devant le bruit.** Le gain quotidien de V1-calme sur E2 a un ratio d'information de 0,56 par an et une distribution à queues épaisses (asymétrie −1,96, kurtosis 53). Seul, sans correction, il n'atteint pas 95 % (PSR(0) 93,7 %) ; rapporté aux 15 alternatives essayées contre E2, le DSR tombe à 18,0 %. Le walk-forward le confirme : Δ Sharpe hors échantillon +0,157 pour V1-calme, IC 95 % −0,029 à +0,328.
- **Une alternative fait presque pareil.** Le stop agité élargi à risque égal (n° 13) a un ratio d'information contre E2 de 0,65, est retenu dans 19 % des découpages et par le sélecteur sur les 16 à 5 recalages sur 7. Les deux réduisent l'exposition du régime agité (aucune nouvelle entrée, ou une taille divisée par 3) : c'est ce point commun que les données soutiennent, pas spécifiquement la suppression.
- **La tenue aux frais est mécanique.** Doubler les commissions coûte 0,146 de Sharpe à V1-calme contre 0,268 à E2 : 716 trades contre 1311. Avec des commissions doublées, l'avantage est plus net (ratio d'information 1,07, PSR(0) 99,8 %) mais le DSR reste à 48,5 %.
- **Le Sharpe absolu ne résiste pas à toute la recherche des réglages.** Avec la dispersion des 206 candidats dont viennent les réglages (écart type 0,60), le DSR passe sous 95 % au-delà d'environ 53 essais pour E2 et 109 pour V1-calme ; la lignée en compte au moins 222. Deux réserves vont dans l'autre sens : les réglages ont été choisis sur BTC seul (ETH, la moitié du portefeuille, n'a pas servi à les choisir), et la dispersion des candidats, en moyenne perdants (Sharpe moyen −0,25), mêle bruit et vraies différences, ce qui rend le DSR sévère. Le Sharpe historique de 1,9 à 2,0 ne peut pas être pris pour argent comptant ; seul le forward le validera.
- **Verdict : candidate fragile.** V1-calme est une simplification cohérente dans le temps et moins sensible aux frais, mais son avantage sur E2 n'est pas démontré au-delà du hasard de sélection. E2 reste la référence ; rien ne change dans le live. La suite logique est un test forward pré-enregistré de V1-calme en shadow à côté de E2, avec un critère de décision fixé avant de voir les données.

## Limites

- Exploratoire : BTC/ETH sont les données de développement ; V1-calme a été construite après avoir vu ces données.
- CSCV traite les blocs comme échangeables (un bloc d'entraînement peut suivre un bloc de test) ; le walk-forward ne lit que le passé mais n'a que 7 recalages.
- La pente de dégradation négative tient surtout au découpage : les deux moitiés sont complémentaires, une moitié forte pour toutes les configurations laisse une moitié faible. Elle ne mesure pas à elle seule un surajustement.
- Les 16 configurations partagent l'essentiel de leurs trades : elles sont très corrélées, ce qui réduit le nombre effectif d'essais (le DSR avec N = 16 est prudent sur ce point) mais rend le PBO sensible à de petites différences.
- Univers B : les 206 candidats ont été choisis sur BTC avec les coûts du script ; ils sont rejoués ici tels quels en portefeuille BTC/ETH aux coûts du portefeuille, seulement pour estimer la dispersion des Sharpe d'essais.

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | lib/strategies/shock/market.ts |
| empreinte lib/strategies/shock/strategy.ts | OK | lib/strategies/shock/strategy.ts |
| empreinte lib/strategies/shock/broker.ts | OK | lib/strategies/shock/broker.ts |
| empreinte lib/strategies/shock/engine.ts | OK | lib/strategies/shock/engine.ts |
| empreinte lib/strategies/shock/params.ts | OK | lib/strategies/shock/params.ts |
| empreinte lib/strategies/shock/presets.ts | OK | lib/strategies/shock/presets.ts |
| empreinte lib/strategies/shock/regimes.ts | OK | lib/strategies/shock/regimes.ts |
| empreinte research/lib/frozen-shock.ts | OK | research/lib/frozen-shock.ts |
| empreinte research/lib/e2.ts | OK | research/lib/e2.ts |
| n° 1 v1 (live, sans filtre E2) : Sharpe publié retrouvé | OK | 1.7260527 / 1.726052721 |
| n° 2 shorts : symétrie de bougie : Sharpe publié retrouvé | OK | 1.6909173 / 1.690917266 |
| n° 3 shorts : symétrie tendance 60 min : Sharpe publié retrouvé | OK | 1.6795267 / 1.679526666 |
| n° 4 shorts : V1 + V2 : Sharpe publié retrouvé | OK | 1.6241519 / 1.62415195 |
| n° 5 sans shorts : Sharpe publié retrouvé | OK | 1.5180763 / 1.518076326 |
| n° 6 shorts : lambda + volume miroir : Sharpe publié retrouvé | OK | 1.6722839 / 1.672283877 |
| n° 7 E2 (référence) : Sharpe publié retrouvé | OK | 1.8775665 / 1.877566513 |
| n° 7 E2 (référence) : Sharpe publié (commissions × 2) retrouvé | OK | 1.6098551 / 1.6098551 |
| n° 8 E2, entrées en range retirées : Sharpe publié retrouvé | OK | 1.8660309 / 1.8660309 |
| n° 8 E2, entrées en range retirées : Sharpe publié (commissions × 2) retrouvé | OK | 1.6217228 / 1.6217228 |
| n° 9 E2, confirmation retardée en range : Sharpe publié retrouvé | OK | 1.8926432 / 1.8926432 |
| n° 9 E2, confirmation retardée en range : Sharpe publié (commissions × 2) retrouvé | OK | 1.6315084 / 1.6315084 |
| n° 10 E2, sorties agitées en range : Sharpe publié retrouvé | OK | 1.9129879 / 1.9129879 |
| n° 10 E2, sorties agitées en range : Sharpe publié (commissions × 2) retrouvé | OK | 1.6242347 / 1.6242347 |
| n° 11 V1-calme : Sharpe publié retrouvé | OK | 2.0242079 / 2.0242079 |
| n° 11 V1-calme : Sharpe publié (commissions × 2) retrouvé | OK | 1.8782281 / 1.8782281 |
| n° 12 E2, stop agité 3,3 ATR, taille inchangée : Sharpe publié retrouvé | OK | 1.8595614 / 1.8595614 |
| n° 12 E2, stop agité 3,3 ATR, taille inchangée : Sharpe publié (commissions × 2) retrouvé | OK | 1.6244047 / 1.6244047 |
| n° 13 E2, stop agité 3,3 ATR, même risque : Sharpe publié retrouvé | OK | 1.9978611 / 1.9978611 |
| n° 13 E2, stop agité 3,3 ATR, même risque : Sharpe publié (commissions × 2) retrouvé | OK | 1.8182868 / 1.8182868 |
| n° 14 E2, invalidation à 4 bougies : Sharpe publié retrouvé | OK | 1.9077079 / 1.9077079 |
| n° 14 E2, invalidation à 4 bougies : Sharpe publié (commissions × 2) retrouvé | OK | 1.5875167 / 1.5875167 |
| n° 15 E2, invalidation à 2 bougies : Sharpe publié retrouvé | OK | 1.7192486 / 1.7192486 |
| n° 16 E2, invalidation à 8 bougies : Sharpe publié retrouvé | OK | 1.7926057 / 1.7926057 |
| E2 : Sharpe du portefeuille publié | OK | 1.877566513 |
| V1-calme : valeurs figées (CALM_ONLY_REFERENCE) | OK | 2.0242079 / 1.8782281 |
| fenêtre commune 2018-09-01 → 2026-09-30 | OK | 2018-09-01 → 2026-09-30, 2952 jours |
| univers B : 206 candidats (graine 5) | OK | 206 |
| dates de recalage dans la fenêtre | OK | 487, 853, 1218, 1583, 1948, 2314, 2679 |

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/calm-only.ts
```
