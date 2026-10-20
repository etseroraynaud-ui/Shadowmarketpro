# Shock Engine V1 sur GC — dossier (étude sur substitut)

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md`, additif `futures-k-transfer-proxy.md`. Étape de développement : [`dev.md`](dev.md) ; données : `research/futures-transfer/DATA.md` ; audit de la méthode : `research/futures-transfer/AUDIT.md`. Aucune valeur absolue de seuil (dépôt public).

## Conclusion sur le substitut : **D — les données disponibles ne permettent pas de conclure**

Contrôle(s) de données en échec : au plus 25 trous imprévus de plus de 60 min par an. Conclusion principale D selon l'additif. **Analyse secondaire** (additif n° 2, contrôles de couverture ignorés, mêmes calculs et mêmes critères, non confirmatoire) : **C — le phénomène n'est pas suffisamment démontré sur ce marché** (méthode A : critères non tous remplis ; méthode B : critères non tous remplis).

Conclusion sur les futures GC : **D** (aucune donnée de futures ; un résultat sur substitut ne vaut ni validation sur futures ni recommandation d'usage réel). Les règles de V1 BTC/ETH, le bot et le site ne sont pas modifiés.

## Critères (fixés avant calcul)

Tableau de l'analyse secondaire (C1 sans les contrôles de couverture) ; en analyse principale, C1 est **non** pour les deux méthodes.

| critère | méthode A (seuil fixe) | méthode B (Q99 %) |
| --- | ---: | ---: |
| C1 — phénomène présent (porte de l'étude d'événement) et données conformes | **non** | **non** |
| C2 — validation : Sharpe > 0,3, PF > 1,1, ≥ ½ des années positives | oui | oui |
| C3 — test final : Sharpe > 0, PF > 1 ; PF > 1 au scénario haut (hors échantillon complet) | oui | oui |
| C4 — Sharpe significatif hors échantillon complet (Newey–West, Holm sur 4) | oui | oui |
| C5 — bat ≥ 90 % des entrées au hasard ; retard d'une bougie ≥ 50 % du gain moyen | oui | oui |
| C6 — plateau ± 2 crans et PBO < 0,5 (méthode A) | oui | oui |
| C7 — Sharpe dégonflé ≥ 0,95 (N = configurations effectives + 1) | **non** | oui |
| **toutes** | **non** | **non** |

## Étude d'événement au seuil figé (avant calibration)

| famille | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 · entrées qualifiées de V1 (seuil figé) | 471 | +0,060 (−0,047 à +0,165) | +0,155 (−0,054 à +0,365) | +0,521 (+0,094 à +0,966) | +1,028 (+0,374 à +1,675) |
| F2 · chocs bruts, régime calme | 2 735 | −0,001 (−0,043 à +0,040) | +0,081 (+0,006 à +0,157) | +0,122 (−0,006 à +0,252) | +0,100 (−0,079 à +0,284) |
| F3 · chocs bruts dans le sens de la tendance 60 min, régime calme | 1 798 | −0,026 (−0,079 à +0,027) | +0,065 (−0,035 à +0,172) | +0,065 (−0,128 à +0,256) | +0,235 (−0,075 à +0,543) |
| F4 · chocs bruts, régime agité (descriptif) | 2 575 | −0,013 (−0,048 à +0,023) | −0,053 (−0,123 à +0,016) | −0,080 (−0,186 à +0,024) | −0,295 (−0,445 à −0,141) |

Porte : G1 **non** · G2 oui · G3 oui. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [`dev.md`](dev.md).

## Calibration de k

26 configurations effectives sur 26 ; 12 valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : oui ; PBO 7,0 % ; méthode A tradée au test final.

## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)

| segment | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · validation 2016 – 2022 | 2,8 % | 0,80 | 0,69 | 1,49 | 0,86 | −3,3 % | 2,18 | 67 |
| A · test final 2023-01 → 2026-09 | 6,1 % | 1,30 | 1,18 | 2,48 | 1,96 | −3,1 % | 3,01 | 53 |
| A · hors échantillon complet | 4,0 % | 1,00 | 0,88 | 1,88 | 0,90 | −4,4 % | 2,51 | 120 |
| B · validation 2016 – 2022 | 5,9 % | 1,16 | 1,11 | 2,18 | 1,76 | −3,4 % | 2,37 | 123 |
| B · test final 2023-01 → 2026-09 | 7,2 % | 1,29 | 1,28 | 2,47 | 2,51 | −2,9 % | 4,43 | 39 |
| B · hors échantillon complet | 6,4 % | 1,21 | 1,17 | 2,28 | 1,67 | −3,8 % | 2,79 | 162 |

| méthode | t NW | p | p Holm (4) | PF scénario haut | hasard battu | gain moyen | retardé d'1 bougie | DSR (N) | DSR N = 222 · 6 266 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 2,98 | 0,0014 | 0,0043 | 2,41 | 100 % | 0,360 % | 0,312 % | 0,926 (27) | 0,741 · 0,369 |
| B | 3,90 | 0,0000 | 0,0002 | 2,66 | 100 % | 0,423 % | 0,362 % | 0,987 (27) | 0,920 · 0,661 |

### Méthode A · test final : années et coûts

| année | rendement | trades |
| --- | ---: | ---: |
| 2023 | 6,7 % | 27 |
| 2024 | 3,2 % | 12 |
| 2025 | 4,0 % | 11 |
| 2026 | 9,2 % | 3 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 6,3 % | 1,34 | 3,13 | −3,1 % |
| bas (2,00 $ ; 0,5 pas) | 6,2 % | 1,32 | 3,07 | −3,1 % |
| référence (3,50 $ ; 1 pas) | 6,1 % | 1,30 | 3,01 | −3,1 % |
| haut (5,00 $ ; 2 pas) | 6,0 % | 1,27 | 2,91 | −3,2 % |
| stress (5,00 $ ; 4 pas) | 5,7 % | 1,21 | 2,74 | −3,2 % |

Sharpe par moitié du test final : 1,11 puis 1,48. Exposition 10,0 % · gagnants 42 % · gain moyen 1,56 % · perte moyenne −0,37 % · payoff 4,24 · asymétrie 2,06 · part des 5 % meilleurs trades 60 %.

### Méthode B · test final : années et coûts

| année | rendement | trades |
| --- | ---: | ---: |
| 2023 | 6,1 % | 23 |
| 2024 | 5,4 % | 4 |
| 2025 | 3,3 % | 9 |
| 2026 | 12,2 % | 3 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 7,3 % | 1,31 | 4,62 | −2,9 % |
| bas (2,00 $ ; 0,5 pas) | 7,2 % | 1,30 | 4,52 | −2,9 % |
| référence (3,50 $ ; 1 pas) | 7,2 % | 1,29 | 4,43 | −2,9 % |
| haut (5,00 $ ; 2 pas) | 7,1 % | 1,27 | 4,28 | −2,9 % |
| stress (5,00 $ ; 4 pas) | 6,9 % | 1,24 | 4,03 | −2,9 % |

Sharpe par moitié du test final : 1,24 puis 1,35. Exposition 11,9 % · gagnants 41 % · gain moyen 2,16 % · perte moyenne −0,34 % · payoff 6,37 · asymétrie 2,07 · part des 5 % meilleurs trades 49 %.

## Tests multiples

| hypothèse | p | p Holm |
| --- | ---: | ---: |
| gold · A | 0,0014 | 0,0043 |
| gold · B | 0,0000 | 0,0002 |
| nasdaq · A | 1,0000 | 1,0000 |
| nasdaq · B | 0,0912 | 0,1824 |

## Configuration retenue

Aucune (seule une conclusion A en donne une).

