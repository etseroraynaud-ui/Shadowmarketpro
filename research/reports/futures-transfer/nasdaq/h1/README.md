# Shock Engine V1 sur NQ · H1 (60 min) — dossier (étude sur substitut)

**Suite exploratoire (additif n° 3, `futures-k-transfer-proxy-3.md`)** : chocs sur bougies de H1 (60 min), décidée après les résultats à 15 min ; le test final 2023 – 2026 avait déjà été regardé à 15 min. Holm sur les 8 hypothèses de la suite ; Sharpe dégonflé avec les essais de 15 min, H1 et H4.

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
| C4 — Sharpe significatif hors échantillon complet (Newey–West, Holm sur 8) | **non** | **non** |
| C5 — bat ≥ 90 % des entrées au hasard ; retard d'une bougie ≥ 50 % du gain moyen | **non** | **non** |
| C6 — plateau ± 2 crans et PBO < 0,5 (méthode A) | **non** | oui |
| C7 — Sharpe dégonflé ≥ 0,95 (N = configurations effectives + 1) | **non** | **non** |
| **toutes** | **non** | **non** |

## Étude d'événement au seuil figé (avant calibration)

| famille | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 · entrées qualifiées de V1 (seuil figé) | 45 | −0,030 (−0,341 à +0,248) | +0,441 (+0,012 à +0,810) | +0,749 (+0,100 à +1,340) | +0,190 (−1,316 à +1,602) |
| F2 · chocs bruts, régime calme | 643 | +0,128 (+0,044 à +0,215) | +0,287 (+0,134 à +0,449) | +0,194 (−0,004 à +0,402) | +0,341 (−0,121 à +0,805) |
| F3 · chocs bruts dans le sens de la tendance 60 min, régime calme | 502 | +0,169 (+0,068 à +0,274) | +0,315 (+0,132 à +0,496) | +0,151 (−0,091 à +0,392) | +0,491 (−0,065 à +1,059) |
| F4 · chocs bruts, régime agité (descriptif) | 618 | −0,020 (−0,100 à +0,060) | −0,046 (−0,173 à +0,093) | +0,014 (−0,165 à +0,206) | +0,096 (−0,324 à +0,563) |

Porte : G1 **non** · G2 **non** · G3 **non**. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [`dev.md`](dev.md).

## Calibration de k

26 configurations effectives sur 26 ; 0 valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : **non** ; PBO 29,2 % ; méthode A **non tradée** (meilleur plateau sous 1) au test final.

## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)

| segment | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · validation 2017 – 2022 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · test final 2023-01 → 2026-09 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · hors échantillon complet | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| B · validation 2017 – 2022 | 0,6 % | 0,40 | 0,33 | 0,74 | 0,21 | −3,0 % | 2,51 | 7 |
| B · test final 2023-01 → 2026-09 | 0,0 % | 0,03 | 0,03 | 0,04 | 0,01 | −6,2 % | 1,04 | 12 |
| B · hors échantillon complet | 0,4 % | 0,17 | 0,16 | 0,26 | 0,07 | −6,2 % | 1,42 | 19 |

| méthode | t NW | p | p Holm (4) | PF scénario haut | hasard battu | gain moyen | retardé d'1 bougie | DSR (N) | DSR N = 222 · 6 266 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | — | 1,0000 | 1,0000 | — | 0 % | — | — | 0,062 (81) | 0,040 · 0,010 |
| B | 0,56 | 0,2879 | 1,0000 | 1,41 | 46 % | 0,224 % | 0,256 % | 0,162 (81) | 0,114 · 0,036 |

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
| 2023 | −4,4 % | 7 |
| 2024 | 0,9 % | 3 |
| 2025 | −0,5 % | 1 |
| 2026 | 4,3 % | 1 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 0,1 % | 0,03 | 1,05 | −6,1 % |
| bas (2,00 $ ; 0,5 pas) | 0,0 % | 0,03 | 1,04 | −6,1 % |
| référence (3,50 $ ; 1 pas) | 0,0 % | 0,03 | 1,04 | −6,2 % |
| haut (5,00 $ ; 2 pas) | 0,0 % | 0,02 | 1,03 | −6,2 % |
| stress (5,00 $ ; 4 pas) | 0,0 % | 0,02 | 1,02 | −6,2 % |

Sharpe par moitié du test final : −0,93 puis 0,79. Exposition 4,2 % · gagnants 33 % · gain moyen 1,94 % · perte moyenne −0,93 % · payoff 2,08 · asymétrie 1,33 · part des 5 % meilleurs trades 3152 %.

## Tests multiples

| hypothèse | p | p Holm |
| --- | ---: | ---: |
| gold · H1 (60 min) · A | 0,5892 | 1,0000 |
| gold · H1 (60 min) · B | 0,0059 | 0,0474 |
| nasdaq · H1 (60 min) · A | 1,0000 | 1,0000 |
| nasdaq · H1 (60 min) · B | 0,2879 | 1,0000 |
| gold · H4 (240 min) · A | 1,0000 | 1,0000 |
| gold · H4 (240 min) · B | 0,1127 | 0,7891 |
| nasdaq · H4 (240 min) · A | 1,0000 | 1,0000 |
| nasdaq · H4 (240 min) · B | 0,4474 | 1,0000 |

## Configuration retenue

Aucune (seule une conclusion A en donne une).

