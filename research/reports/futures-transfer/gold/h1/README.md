# Shock Engine V1 sur GC · H1 (60 min) — dossier (étude sur substitut)

**Suite exploratoire (additif n° 3, `futures-k-transfer-proxy-3.md`)** : chocs sur bougies de H1 (60 min), décidée après les résultats à 15 min ; le test final 2023 – 2026 avait déjà été regardé à 15 min. Holm sur les 8 hypothèses de la suite ; Sharpe dégonflé avec les essais de 15 min, H1 et H4.

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md`, additif `futures-k-transfer-proxy.md`. Étape de développement : [`dev.md`](dev.md) ; données : `research/futures-transfer/DATA.md` ; audit de la méthode : `research/futures-transfer/AUDIT.md`. Aucune valeur absolue de seuil (dépôt public).

## Conclusion sur le substitut : **D — les données disponibles ne permettent pas de conclure**

Contrôle(s) de données en échec : au plus 25 trous imprévus de plus de 60 min par an. Conclusion principale D selon l'additif. **Analyse secondaire** (additif n° 2, contrôles de couverture ignorés, mêmes calculs et mêmes critères, non confirmatoire) : **C — le phénomène n'est pas suffisamment démontré sur ce marché** (méthode A : critères non tous remplis ; méthode B : critères non tous remplis).

Conclusion sur les futures GC : **D** (aucune donnée de futures ; un résultat sur substitut ne vaut ni validation sur futures ni recommandation d'usage réel). Les règles de V1 BTC/ETH, le bot et le site ne sont pas modifiés.

## Critères (fixés avant calcul)

Tableau de l'analyse secondaire (C1 sans les contrôles de couverture) ; en analyse principale, C1 est **non** pour les deux méthodes.

| critère | méthode A (seuil fixe) | méthode B (Q99 %) |
| --- | ---: | ---: |
| C1 — phénomène présent (porte de l'étude d'événement) et données conformes | **non** | **non** |
| C2 — validation : Sharpe > 0,3, PF > 1,1, ≥ ½ des années positives | **non** | oui |
| C3 — test final : Sharpe > 0, PF > 1 ; PF > 1 au scénario haut (hors échantillon complet) | **non** | oui |
| C4 — Sharpe significatif hors échantillon complet (Newey–West, Holm sur 8) | **non** | oui |
| C5 — bat ≥ 90 % des entrées au hasard ; retard d'une bougie ≥ 50 % du gain moyen | **non** | oui |
| C6 — plateau ± 2 crans et PBO < 0,5 (méthode A) | **non** | oui |
| C7 — Sharpe dégonflé ≥ 0,95 (N = configurations effectives + 1) | **non** | oui |
| **toutes** | **non** | **non** |

## Étude d'événement au seuil figé (avant calibration)

| famille | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 · entrées qualifiées de V1 (seuil figé) | 193 | +0,194 (+0,050 à +0,343) | +0,259 (−0,006 à +0,506) | +0,627 (+0,174 à +1,089) | +1,421 (+0,398 à +2,442) |
| F2 · chocs bruts, régime calme | 793 | +0,058 (−0,009 à +0,129) | +0,100 (−0,011 à +0,217) | +0,274 (+0,100 à +0,455) | +0,550 (+0,151 à +0,972) |
| F3 · chocs bruts dans le sens de la tendance 60 min, régime calme | 621 | +0,051 (−0,021 à +0,124) | +0,049 (−0,078 à +0,171) | +0,279 (+0,067 à +0,497) | +0,513 (+0,054 à +0,994) |
| F4 · chocs bruts, régime agité (descriptif) | 624 | +0,006 (−0,072 à +0,084) | +0,057 (−0,078 à +0,197) | −0,028 (−0,187 à +0,129) | −0,024 (−0,365 à +0,315) |

Porte : G1 **non** · G2 oui · G3 oui. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [`dev.md`](dev.md).

## Calibration de k

26 configurations effectives sur 26 ; 1 valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : **non** ; PBO 81,1 % ; méthode A **non tradée** (meilleur plateau sous 1) au test final.

## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)

| segment | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · validation 2016 – 2022 | −0,3 % | −0,07 | −0,11 | −0,10 | −0,03 | −9,1 % | 0,92 | 55 |
| A · test final 2023-01 → 2026-09 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · hors échantillon complet | −0,2 % | −0,06 | −0,09 | −0,08 | −0,02 | −9,1 % | 0,92 | 55 |
| B · validation 2016 – 2022 | 3,3 % | 0,65 | 0,65 | 1,02 | 0,41 | −8,1 % | 2,07 | 51 |
| B · test final 2023-01 → 2026-09 | 6,8 % | 1,01 | 0,93 | 1,62 | 0,83 | −8,2 % | 4,34 | 22 |
| B · hors échantillon complet | 4,5 % | 0,79 | 0,76 | 1,25 | 0,55 | −8,2 % | 2,65 | 73 |

| méthode | t NW | p | p Holm (4) | PF scénario haut | hasard battu | gain moyen | retardé d'1 bougie | DSR (N) | DSR N = 222 · 6 266 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | −0,23 | 0,5892 | 1,0000 | 0,88 | 53 % | −0,034 % | −0,061 % | 0,191 (81) | 0,166 · 0,108 |
| B | 2,52 | 0,0059 | 0,0474 | 2,58 | 92 % | 0,681 % | 0,615 % | 0,972 (81) | 0,965 · 0,939 |

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
| 2023 | 3,1 % | 16 |
| 2024 | 5,8 % | 3 |
| 2025 | 10,9 % | 2 |
| 2026 | 5,8 % | 1 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 6,9 % | 1,02 | 4,46 | −8,0 % |
| bas (2,00 $ ; 0,5 pas) | 6,8 % | 1,02 | 4,39 | −8,1 % |
| référence (3,50 $ ; 1 pas) | 6,8 % | 1,01 | 4,34 | −8,2 % |
| haut (5,00 $ ; 2 pas) | 6,7 % | 1,00 | 4,24 | −8,3 % |
| stress (5,00 $ ; 4 pas) | 6,6 % | 0,98 | 4,08 | −8,6 % |

Sharpe par moitié du test final : 0,61 puis 1,73. Exposition 14,4 % · gagnants 41 % · gain moyen 3,71 % · perte moyenne −0,59 % · payoff 6,27 · asymétrie 1,32 · part des 5 % meilleurs trades 32 %.

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

