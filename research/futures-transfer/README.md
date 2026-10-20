# Transfert de Shock Engine V1 aux futures GC et NQ

Question : le phénomène de continuation après un choc qualifié, mesuré sur BTC/ETH, existe-t-il sur
les futures or (GC) et E-mini Nasdaq-100 (NQ), et une recalibration du seul seuil de choc k suffit-elle
à l'exploiter hors échantillon ? V1 BTC/ETH, le bot et le site ne sont pas modifiés.

## Conclusions au 2026-10-20

| marché | futures (question posée) | substitut, conclusion principale | substitut, analyse secondaire (non confirmatoire) |
| --- | --- | --- | --- |
| Or | **D** : aucune donnée GC accessible | **D** : XAU/USD comptant, 31 trous imprévus en 2014 (> 25) | **C** : phénomène non démontré au seuil figé (excès à 4 bougies non significatif) |
| Nasdaq | **D** : aucune donnée NQ accessible | **D** : CFD USATECH, 14 à 39 % de bougies manquantes en 2015 – 2018, ≈ 4 % ensuite | **C** : les entrées de V1 ne montrent aucune continuation |

Dossiers : [`gold`](../reports/futures-transfer/gold/README.md) et [`nasdaq`](../reports/futures-transfer/nasdaq/README.md)
(conclusion, critères, résultats hors échantillon), avec leurs étapes de développement (`dev.md`).

**Suite exploratoire en H1 et H4** (additif n° 3, décidée après les résultats à 15 min, test final déjà
regardé à 15 min ; réglages de V1 inchangés en nombre de bougies, seul k varie) :

| substitut | H1 (60 min) | H4 (240 min) |
| --- | --- | --- |
| Or | principal D · secondaire **C** : 193 entrées, excès positif mais borne basse à 4 bougies −0,006 ; méthode A non tradée au test final (PBO 81 %) ; méthode B remplit C2 à C7 (Sharpe hors échantillon 0,79, Holm p = 0,047 sur 8) | principal D · secondaire **C** : 66 entrées (< 150) |
| Nasdaq | principal D · secondaire **C** : 45 entrées | principal D · secondaire **C** : 13 entrées |

Dossiers : `../reports/futures-transfer/{gold,nasdaq}/{h1,h4}/README.md`.

## Étapes

| étape | où |
| --- | --- |
| 1. Audit de la calibration historique | [`AUDIT.md`](AUDIT.md) |
| 2. Données (futures indisponibles ; substituts Dukascopy à la demande du propriétaire) | [`DATA.md`](DATA.md), [`probe-2026-10-20.json`](probe-2026-10-20.json) |
| Protocole, puis additifs, chacun commité avant le calcul qu'il encadre | [`futures-k-transfer.md`](../preregistration/futures-k-transfer.md) (`c7de6ab`), [`-proxy.md`](../preregistration/futures-k-transfer-proxy.md) (`4fc13b9`), [`-proxy-2.md`](../preregistration/futures-k-transfer-proxy-2.md) (`c27ffcf`) |
| Script de l'étude, commité avant le premier calcul sur les substituts | [`study.ts`](study.ts) (`fce2de4`), bibliothèques dans [`lib/`](lib/) |
| 3 à 7. Étude d'événement, grille de k, walk-forward, économie, méthodes A et B | `dev.md` (résultats de développement commités avant le test final) puis `README.md` de chaque marché |

## Commandes

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/futures-transfer/study.ts --stage dev
# commit des rapports dev.{md,json}
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/futures-transfer/study.ts --stage holdout
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test research/tests/futures-k-grid.test.ts research/tests/futures-transfer.test.ts
bash research/futures-transfer/probe-sources.sh > research/futures-transfer/probe-AAAA-MM-JJ.json
```

L'étape de développement vérifie d'abord les empreintes des fichiers figés et refait la sleeve BTC
publiée de V1 avec le harnais (signaux, capital, 358 trades, Sharpe : identiques). L'étape finale refuse
de tourner si les rapports de développement ne sont pas commités.

## Confidentialité

Le dépôt est public : aucun fichier versionné de cette étude n'écrit une valeur absolue de seuil (les
rapports parlent en crans de grille relatifs). Les seuils absolus vont dans
`research/private/futures-transfer/` (exclu de git), les éventuelles données de futures sous licence
dans `research/data/futures/` (exclu de git).
