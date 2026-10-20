# Shock Engine V1 sur NQ — dossier (étude sur substitut)

**Substitut, pas des futures** : CFD Nasdaq-100 USATECH.IDX/USD (Dukascopy, prix acheteur) — substitut de NQ. Protocole `research/preregistration/futures-k-transfer.md`, additif `futures-k-transfer-proxy.md`. Étape de développement : [`dev.md`](dev.md) ; données : `research/futures-transfer/DATA.md` ; audit de la méthode : `research/futures-transfer/AUDIT.md`. Aucune valeur absolue de seuil (dépôt public).

## Conclusion sur le substitut : **D — les données disponibles ne permettent pas de conclure**

Contrôle(s) de données en échec : bougies manquantes < 2 % par an (heures prévues, fériés exclus) ; au plus 25 trous imprévus de plus de 60 min par an. Conclusion principale D selon l'additif. **Analyse secondaire** (additif n° 2, contrôles de couverture ignorés, mêmes calculs et mêmes critères, non confirmatoire) : **C — le phénomène n'est pas suffisamment démontré sur ce marché** (méthode A : critères non tous remplis ; méthode B : critères non tous remplis).

Conclusion sur les futures NQ : **D** (aucune donnée de futures ; un résultat sur substitut ne vaut ni validation sur futures ni recommandation d'usage réel). Les règles de V1 BTC/ETH, le bot et le site ne sont pas modifiés.

## Critères (fixés avant calcul)

Tableau de l'analyse secondaire (C1 sans les contrôles de couverture) ; en analyse principale, C1 est **non** pour les deux méthodes.

| critère | méthode A (seuil fixe) | méthode B (Q99 %) |
| --- | ---: | ---: |
| C1 — phénomène présent (porte de l'étude d'événement) et données conformes | **non** | **non** |
| C2 — validation : Sharpe > 0,3, PF > 1,1, ≥ ½ des années positives | **non** | **non** |
| C3 — test final : Sharpe > 0, PF > 1 ; PF > 1 au scénario haut (hors échantillon complet) | **non** | oui |
| C4 — Sharpe significatif hors échantillon complet (Newey–West, Holm sur 4) | **non** | **non** |
| C5 — bat ≥ 90 % des entrées au hasard ; retard d'une bougie ≥ 50 % du gain moyen | **non** | **non** |
| C6 — plateau ± 2 crans et PBO < 0,5 (méthode A) | **non** | oui |
| C7 — Sharpe dégonflé ≥ 0,95 (N = configurations effectives + 1) | **non** | **non** |
| **toutes** | **non** | **non** |

## Étude d'événement au seuil figé (avant calibration)

| famille | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 · entrées qualifiées de V1 (seuil figé) | 246 | +0,013 (−0,133 à +0,159) | +0,065 (−0,222 à +0,368) | −0,038 (−0,588 à +0,490) | −0,041 (−0,742 à +0,623) |
| F2 · chocs bruts, régime calme | 2 358 | +0,092 (+0,048 à +0,137) | +0,204 (+0,111 à +0,300) | +0,201 (+0,053 à +0,364) | +0,135 (−0,084 à +0,352) |
| F3 · chocs bruts dans le sens de la tendance 60 min, régime calme | 1 460 | +0,129 (+0,068 à +0,195) | +0,292 (+0,164 à +0,417) | +0,232 (+0,008 à +0,465) | +0,001 (−0,307 à +0,325) |
| F4 · chocs bruts, régime agité (descriptif) | 2 392 | +0,037 (−0,009 à +0,081) | +0,060 (−0,034 à +0,154) | +0,135 (−0,013 à +0,285) | +0,178 (−0,026 à +0,384) |

Porte : G1 **non** · G2 **non** · G3 oui. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [`dev.md`](dev.md).

## Calibration de k

26 configurations effectives sur 26 ; 0 valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : **non** ; PBO 30,4 % ; méthode A **non tradée** (meilleur plateau sous 1) au test final.

## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)

| segment | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · validation 2017 – 2022 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · test final 2023-01 → 2026-09 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · hors échantillon complet | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| B · validation 2017 – 2022 | 1,5 % | 0,65 | 0,63 | 1,12 | 0,68 | −2,2 % | 1,80 | 54 |
| B · test final 2023-01 → 2026-09 | 1,3 % | 0,30 | 0,26 | 0,51 | 0,17 | −7,6 % | 1,26 | 64 |
| B · hors échantillon complet | 1,4 % | 0,43 | 0,39 | 0,73 | 0,18 | −7,9 % | 1,44 | 118 |

| méthode | t NW | p | p Holm (4) | PF scénario haut | hasard battu | gain moyen | retardé d'1 bougie | DSR (N) | DSR N = 222 · 6 266 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | — | 1,0000 | 1,0000 | — | 0 % | — | — | 0,052 (27) | 0,012 · 0,001 |
| B | 1,33 | 0,0912 | 0,1824 | 1,42 | 67 % | 0,120 % | 0,125 % | 0,386 (27) | 0,177 · 0,043 |

### Méthode A · test final : années et coûts

| année | rendement | trades |
| --- | ---: | ---: |
| 2023 | 0,0 % | 0 |
| 2024 | 0,0 % | 0 |
| 2025 | 0,0 % | 0 |
| 2026 | 0,0 % | 0 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 0,0 % | — | — | 0,0 % |
| bas (2,00 $ ; 0,5 pas) | 0,0 % | — | — | 0,0 % |
| référence (3,50 $ ; 1 pas) | 0,0 % | — | — | 0,0 % |
| haut (5,00 $ ; 2 pas) | 0,0 % | — | — | 0,0 % |
| stress (5,00 $ ; 4 pas) | 0,0 % | — | — | 0,0 % |

Sharpe par moitié du test final : — puis —. Exposition 0,0 % · gagnants — · gain moyen — · perte moyenne — · payoff — · asymétrie — · part des 5 % meilleurs trades —.

### Méthode B · test final : années et coûts

| année | rendement | trades |
| --- | ---: | ---: |
| 2023 | 1,8 % | 35 |
| 2024 | 4,6 % | 12 |
| 2025 | 1,6 % | 6 |
| 2026 | −3,0 % | 11 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 1,4 % | 0,32 | 1,28 | −7,5 % |
| bas (2,00 $ ; 0,5 pas) | 1,3 % | 0,31 | 1,27 | −7,5 % |
| référence (3,50 $ ; 1 pas) | 1,3 % | 0,30 | 1,26 | −7,6 % |
| haut (5,00 $ ; 2 pas) | 1,2 % | 0,29 | 1,25 | −7,6 % |
| stress (5,00 $ ; 4 pas) | 1,1 % | 0,27 | 1,23 | −7,8 % |

Sharpe par moitié du test final : 0,36 puis 0,24. Exposition 7,6 % · gagnants 25 % · gain moyen 1,66 % · perte moyenne −0,44 % · payoff 3,78 · asymétrie 4,38 · part des 5 % meilleurs trades 298 %.

## Tests multiples

| hypothèse | p | p Holm |
| --- | ---: | ---: |
| gold · A | 0,0014 | 0,0043 |
| gold · B | 0,0000 | 0,0002 |
| nasdaq · A | 1,0000 | 1,0000 |
| nasdaq · B | 0,0912 | 0,1824 |

## Configuration retenue

Aucune (seule une conclusion A en donne une).

