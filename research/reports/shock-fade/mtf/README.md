# Shock Fade multi-timeframe (M30, H1, H4) — synthèse

Étude pré-enregistrée (`research/preregistration/shock-fade-mtf.md`, commit `5302de0`, avant tout rendement),
échantillon principal P = perpétuels Binance 2020-07 → 2026-09, réplication R = comptant Binance 2018-01 →
2019-12 (jamais utilisé auparavant). Détail : [01-results.md](01-results.md) ; comptages préalables :
[00-counts.md](00-counts.md) ; contrôle négatif : [02-negative-control.md](02-negative-control.md) ; contrôles a
posteriori : [03-race-checks.md](03-race-checks.md).

> **Verdict.** La dynamique change bien avec la durée du choc, mais **vers la continuation, pas la réversion**.
> À 5 min, un choc est neutre ; dès 15–30 min et jusqu'à H4, le prix prolonge le choc de 50 % plus souvent qu'il
> ne le reprend de 50 % (55 à 62 % des cas en H1/H4), sur 2020–2026 comme sur 2018–2019. Aucun Fade M30, H1 ou
> H4 n'a d'espérance positive, ni avant ni après coûts. L'intuition d'un déséquilibre plus lent à se résorber
> n'est pas confirmée à ces durées.

## 1. Combien d'événements indépendants ?

| TF | k | chocs indépendants P (groupes BTC+ETH fusionnés) | indépendants R | EMD sur g, horizon long (pb) |
|---|---:|---:|---:|---:|
| M30 | 3 | 3 164 (2 114) | 1 094 | 10 (4 h) |
| M30 | 4 | 1 554 (1 097) | 600 | 17 (4 h) |
| H1 | 3 | 1 496 (938) | 496 | 27 (16 h) |
| H1 | 4 | 811 (549) | 299 | 37 (16 h) |
| H4 | 3 | 410 (265) | 124 | 95 (48 h) |
| H4 | 4 | 205 (149) | 63 | 128 (48 h) |

En H4, seul un effet moyen d'environ 1 % sur 48 h serait détectable : les moyennes H4 sont trop bruitées
pour conclure, d'où l'intérêt de la course 50 % (une probabilité, moins sensible aux queues).

## 2. Réversion ou continuation ? (course 50 % : P(reprise de 50 % avant une extension de 50 %), 0,5 = martingale)

| TF | k = 3, P | k = 3, R | k = 4, P | k = 4, R | p Holm (P, famille primaire) |
|---|---:|---:|---:|---:|---|
| M5 (réf.) | 0,515 | 0,482 | 0,498 | 0,453 | hors famille |
| M15 (réf.) | 0,458 | 0,404 | 0,429 | 0,338 | hors famille |
| M30 | 0,476 | 0,370 | **0,428** | 0,312 | 0,41 · **0,0002** |
| H1 | **0,451** | 0,386 | **0,425** | 0,383 | **0,028** · **0,008** |
| H4 | **0,410** | 0,312 | **0,377** | 0,288 | **0,033** · **0,049** |

Les cinq tests significatifs après Holm sont **répliqués** sur R (p unilatéral ≤ 0,001). Sur une martingale
simulée avec le même pipeline, la course regroupée vaut 0,45–0,53 : la continuation n'est pas un artefact. Elle vaut pour
les chocs haussiers **et** baissiers (ce n'est pas la tendance de fond), sur BTC et sur ETH.

Moyennes du Fade aux horizons primaires : aucune n'est positive de façon significative ; elles deviennent plus
négatives avec la durée (H1 à 16 h : −26 à −29 pb ; H4 à 48 h : −57 à −64 pb), sans significativité après Holm.
Structure par terme : à 48 h, la fraction du choc « reprise » vaut −0,12 à −0,26 de M30 à H4 (le prix a
continué d'un huitième à un quart du choc). Après coûts et financement, toutes les moyennes nettes sont négatives.

## 3. Un choc H4 n'est pas un grand choc M5

| TF | sauts 1 min dans le sens du choc | efficacité du chemin | plus grande sous-barre de 5 min | intensité Hawkes à la clôture / taux de base |
|---|---:|---:|---:|---:|
| M5 | 1,0 | 0,91 | — | 20,7 |
| M30 | 2,2 | 0,47 | 54 % du mouvement | 11,1 |
| H1 | 2,8 | 0,36 | 44 % | 4,3 |
| H4 | 4,2 | 0,20 | 33 % | 1,0 |

Un choc H4 est une suite d'épisodes (quatre sauts en moyenne, chemin sinueux), et l'excitation Hawkes est
retombée à son niveau de base quand la barre se clôture : votre mise en garde est confirmée par les données.

## 4. Régime calme ou agité, cassure propre ou rejetée

- **Régime** (règle de V1). Sur les moyennes, la différence calme − agité est négative dans les 18 cas (calme :
  plus de continuation), significative après Holm dans un seul cas (H4, k = 4, 48 h : −146 pb en calme contre
  +114 pb en agité, p Holm 0,021), **non répliquée** sur R (t = −0,6). Course (a posteriori) : continuation plus
  nette en calme (H1/H4 : 0,36–0,44) qu'en agité (0,42–0,46).
- **Cassure rejetée à la clôture du choc** : presque inexistante (un très grand mouvement de clôture à clôture finit
  presque toujours au-delà de l'extrême ; 9 cas en H4). **Rejet différé** (cassure propre réintégrée deux barres plus
  tard) contre cassure tenue : aucune différence significative (meilleure p Holm 1,0), effectifs faibles en H4 (20).
- Course a posteriori : les **cassures propres** portent la continuation (H1/H4 : 0,35–0,43) ; les chocs sans cassure
  ou rejetés sont neutres (0,51–0,54), ce qui ne fait pas pour autant un Fade.
- Choc abrupt (sauts) ou graduel : aucune différence.

## 5. Conséquences

1. **Le Fade reste rejeté à toutes les durées testées** (M5 → H4). Il n'y a pas de réversion lente à exploiter.
2. Ce qui est robuste est l'inverse : **continuation après les chocs de 15 min à 4 h**, surtout sur cassure propre et
   en régime calme. C'est cohérent avec la logique de V1 (continuation, régime calme), mais ce n'est **pas** une
   validation de ses règles : les découpages par régime et par cassure de la course sont a posteriori, et aucune
   règle de trading n'a été testée ici.
3. Une suite éventuelle relèverait d'une étude de continuation séparée, pré-enregistrée, avec walk-forward et fenêtre
   prospective (par exemple H1/H4, cassure propre, régime calme). La moyenne de continuation nette reste à démontrer :
   les IC actuels incluent zéro.
