# Transfert de Shock Engine V1 aux futures GC et NQ

Question : le phénomène de continuation après un choc qualifié, mesuré sur BTC/ETH, existe-t-il sur
les futures or (GC) et E-mini Nasdaq-100 (NQ), et une recalibration du seul seuil de choc k suffit-elle
à l'exploiter hors échantillon ? V1 BTC/ETH, le bot et le site ne sont pas modifiés.

## État au 2026-10-20

| étape | état |
| --- | --- |
| 1. Audit de la calibration historique | fait : [`AUDIT.md`](AUDIT.md) |
| 2. Données GC et NQ | **indisponibles** depuis l'environnement : [`DATA.md`](DATA.md), [`probe-2026-10-20.json`](probe-2026-10-20.json) |
| Protocole pré-enregistré | commité avant toute donnée : [`../preregistration/futures-k-transfer.md`](../preregistration/futures-k-transfer.md) |
| Interaction des seuils dans le code | vérifiée : [`lib/k-grid.ts`](lib/k-grid.ts), `research/tests/futures-k-grid.test.ts` |
| 3 à 7. Étude d'événement, grille de k, walk-forward, économie, méthodes A / B | **non calculés** (pas de données) |
| 8. Dossiers et conclusions | [`gold`](../reports/futures-transfer/gold/README.md) : **D** · [`nasdaq`](../reports/futures-transfer/nasdaq/README.md) : **D** |

D = les données disponibles ne permettent pas de conclure. Aucun substitut (comptant, CFD, ETF,
perpétuel) n'a été utilisé.

## Commandes

```
bash research/futures-transfer/probe-sources.sh > research/futures-transfer/probe-AAAA-MM-JJ.json
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test research/tests/futures-k-grid.test.ts
```

## Confidentialité

Le dépôt est public : aucun fichier de cette étude n'écrit une valeur absolue de seuil. Les données de
futures (sous licence) vont dans `research/data/futures/` et les seuils absolus dans
`research/private/futures-transfer/`, tous deux exclus de git.
