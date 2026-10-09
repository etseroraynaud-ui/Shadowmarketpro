# Validation forward de E2 · BTC/ETH · évaluation de 2026-09

Plan : `research/preregistration/e2-forward.md`. Coupure : 2026-10-01 (données jusqu'à la dernière bougie avant cette date). Fenêtre forward depuis le 2026-10-12. Produit par `node research/shock/e2-forward.ts` au commit `f59ee70`.

La v1 reste figée. E2 est un challenger en shadow : aucun signal live n'est ajouté, retiré ou redimensionné.

Simulation sur données de marché après coûts modélisés. Pas une performance live.

## Statut

**EN COURS**

La fenêtre forward n'a pas encore commencé à cette coupure : premier mois évalué, octobre 2026 (coupure du 2026-11-01).

| | Shorts fermés | Moyenne de R |
|---|---|---|
| E2 baissier (N1) | 0 | — |
| E2 non baissier (N0) | 0 | — |
| D = écart | | — |

Shorts forward encore ouverts à la coupure : 0. Prochain regard : N1 = 25 (intermédiaire), puis final à N1 ≥ 100 et N0 ≥ 100.

La valeur de p n'est calculée qu'aux regards prévus.

## Regards effectués

Aucun.

## Par actif (descriptif)

| Actif | N1 | Moyenne R (E2 baissier) | N0 | Moyenne R (non baissier) | D |
|---|---|---|---|---|---|
| BTC | 0 | — | 0 | — | — |
| ETH | 0 | — | 0 | — | — |

## Challenger en shadow (descriptif)

Pas encore de fenêtre forward.

## Référence historique (données déjà vues, hors décision)

Shorts de la v1 entrés avant le 2026-10-12 : N1 = 251 (moyenne R +0,503), N0 = 543 (moyenne R +0,080), D = +0,423, intervalle bootstrap à 90 % +0,103 à +0,836. Par actif : BTC D = +0,307 (143 / 287) ; ETH D = +0,565 (108 / 256). E2 a été choisie après avoir vu ces données : ce chiffre ne valide rien.

## Écarts au pré-enregistrement

Aucun.

## Contrôles (18/18)

- ✔ empreinte lib/strategies/shock/market.ts · b69ad8f8f89a4ded
- ✔ empreinte lib/strategies/shock/strategy.ts · fafb22d6373b19bf
- ✔ empreinte lib/strategies/shock/broker.ts · bad42836b9d61569
- ✔ empreinte lib/strategies/shock/engine.ts · 15211a3e185b1214
- ✔ empreinte lib/strategies/shock/params.ts · 5f7cd0c941d70273
- ✔ empreinte lib/strategies/shock/presets.ts · f97449733ec945bb
- ✔ empreinte lib/strategies/shock/regimes.ts · d72f79d1d97c214d
- ✔ empreinte lib/strategies/shock/live.ts · 05caf82ece9ad7f8
- ✔ empreinte research/lib/frozen-shock.ts · be445aa726433c3e
- ✔ initialisation : coupure au plus tôt le 2026-10-01 · coupure 2026-10-01
- ✔ BTC : horodatages sur la grille 15 min, croissants · 341641 barres jusqu'au 2026-09-30T23:45:00.000Z, 33 trous
- ✔ BTC : régime recalculé = régime du moteur · 0 écart(s) sur 377044 barres
- ✔ ETH : horodatages sur la grille 15 min, croissants · 283081 barres jusqu'au 2026-09-30T23:45:00.000Z, 23 trous
- ✔ ETH : régime recalculé = régime du moteur · 0 écart(s) sur 319294 barres
- ✔ initialisation : pas d'instantané existant · baseline.json et state.json absents
- ✔ base historique : trades de la v1 fermés avant le 2026-10-01 identiques à l'instantané · 1967 trades, a69ca1e1b45f8158 (instantané a69ca1e1b45f8158, 1967 trades)
- ✔ σ journalière définie pour chaque short · 0 shorts forward, 794 shorts historiques
- ✔ E2 sans look-ahead : recalculé sur l'historique coupé à la barre = valeur utilisée · 200 barres (100 tirées au hasard par actif + 0 entrées de shorts forward), 0 écart(s)
