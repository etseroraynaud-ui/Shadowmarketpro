# Shock Engine V1 sur GC · H4 (240 min) — dossier (étude sur substitut)

**Suite exploratoire (additif n° 3, `futures-k-transfer-proxy-3.md`)** : chocs sur bougies de H4 (240 min), décidée après les résultats à 15 min ; le test final 2023 – 2026 avait déjà été regardé à 15 min. Holm sur les 8 hypothèses de la suite ; Sharpe dégonflé avec les essais de 15 min, H1 et H4.

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md`, additif `futures-k-transfer-proxy.md`. Étape de développement : [`dev.md`](dev.md) ; données : `research/futures-transfer/DATA.md` ; audit de la méthode : `research/futures-transfer/AUDIT.md`. Aucune valeur absolue de seuil (dépôt public).

## Conclusion sur le substitut : **D — les données disponibles ne permettent pas de conclure**

Contrôle(s) de données en échec : au plus 25 trous imprévus de plus de 60 min par an. Conclusion principale D selon l'additif. **Analyse secondaire** (additif n° 2, contrôles de couverture ignorés, mêmes calculs et mêmes critères, non confirmatoire) : **C — le phénomène n'est pas suffisamment démontré sur ce marché** (méthode A : critères non tous remplis ; méthode B : critères non tous remplis).

Conclusion sur les futures GC : **D** (aucune donnée de futures ; un résultat sur substitut ne vaut ni validation sur futures ni recommandation d'usage réel). Les règles de V1 BTC/ETH, le bot et le site ne sont pas modifiés.

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
| F1 · entrées qualifiées de V1 (seuil figé) | 66 | +0,095 (−0,064 à +0,252) | +0,279 (+0,000 à +0,575) | +1,143 (+0,296 à +2,026) | +0,746 (−0,651 à +2,148) |
| F2 · chocs bruts, régime calme | 238 | +0,048 (−0,050 à +0,155) | +0,082 (−0,062 à +0,235) | +0,272 (−0,056 à +0,588) | +0,741 (+0,066 à +1,418) |
| F3 · chocs bruts dans le sens de la tendance 60 min, régime calme | 190 | +0,050 (−0,056 à +0,158) | +0,141 (−0,021 à +0,301) | +0,356 (−0,075 à +0,778) | +0,496 (−0,202 à +1,196) |
| F4 · chocs bruts, régime agité (descriptif) | 166 | +0,062 (−0,041 à +0,170) | −0,021 (−0,176 à +0,149) | −0,011 (−0,327 à +0,303) | −0,208 (−0,805 à +0,375) |

Porte : G1 oui · G2 oui · G3 **non**. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [`dev.md`](dev.md).

## Calibration de k

26 configurations effectives sur 26 ; 1 valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : **non** ; PBO 59,1 % ; méthode A **non tradée** (meilleur plateau sous 1) au test final.

## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)

| segment | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · validation 2016 – 2022 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · test final 2023-01 → 2026-09 | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| A · hors échantillon complet | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 |
| B · validation 2016 – 2022 | 0,2 % | 0,06 | 0,06 | 0,08 | 0,02 | −9,9 % | 1,11 | 19 |
| B · test final 2023-01 → 2026-09 | 5,9 % | 0,64 | 0,77 | 0,91 | 0,58 | −10,1 % | 5,35 | 7 |
| B · hors échantillon complet | 2,1 % | 0,33 | 0,37 | 0,47 | 0,21 | −10,1 % | 2,18 | 26 |

| méthode | t NW | p | p Holm (4) | PF scénario haut | hasard battu | gain moyen | retardé d'1 bougie | DSR (N) | DSR N = 222 · 6 266 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | — | 1,0000 | 1,0000 | — | 0 % | — | — | 0,062 (81) | 0,040 · 0,010 |
| B | 1,21 | 0,1127 | 0,7891 | 2,15 | 43 % | 0,931 % | 0,753 % | 0,329 (81) | 0,255 · 0,107 |

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
| 2023 | 10,1 % | 4 |
| 2024 | 15,8 % | 2 |
| 2025 | 0,0 % | 0 |
| 2026 | −2,9 % | 1 |

| scénario | CAGR | Sharpe | PF | DD max |
| --- | ---: | ---: | ---: | ---: |
| sans coûts | 5,9 % | 0,64 | 5,39 | −10,1 % |
| bas (2,00 $ ; 0,5 pas) | 5,9 % | 0,64 | 5,37 | −10,1 % |
| référence (3,50 $ ; 1 pas) | 5,9 % | 0,64 | 5,35 | −10,1 % |
| haut (5,00 $ ; 2 pas) | 5,8 % | 0,63 | 5,31 | −10,1 % |
| stress (5,00 $ ; 4 pas) | 5,8 % | 0,63 | 5,24 | −10,1 % |

Sharpe par moitié du test final : 1,26 puis −0,14. Exposition 26,3 % · gagnants 57 % · gain moyen 6,94 % · perte moyenne −1,73 % · payoff 4,01 · asymétrie 0,50 · part des 5 % meilleurs trades 58 %.

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

