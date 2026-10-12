# Couche probabiliste du Shock Engine (`shock-proba-1.0.0`)

Module de recherche **indépendant** du moteur : il estime, pour chaque signal du Shock Engine, la
probabilité de gain, l'espérance en R, la probabilité d'atteindre +2 R et la probabilité que le prix
continue dans le sens du signal à 15 min, 1 h, 4 h et 16 h, puis mesure en walk-forward si ces
estimations font mieux qu'une prévision naïve.

- **Désactivé pour toute décision de trading.** Aucun fichier de `lib/`, `bot/` ou `app/` ne lit ce
  module (vérifié par test). Aucune règle, aucun paramètre du Shock Engine n'est modifié.
- **Plan d'analyse commité avant tout calcul** variable–résultat :
  [`research/preregistration/probabilistic-layer.md`](../preregistration/probabilistic-layer.md),
  configuration figée [`config.ts`](config.ts).
- **Rapport** : [`research/reports/proba/report.html`](../reports/proba/report.html).

## Résultat

Sur 912 trades chronologiquement hors entraînement (2021-01 → 2026-09), **aucun modèle ne fait
significativement mieux que la prévision naïve** (taux ou moyenne de l'échantillon d'entraînement) :

| Cible | Modèle | Hors entraînement | IC 95 % (bootstrap par mois) |
|---|---|---|---|
| P(R > 0) — test principal | logistique L2, 11 variables | Δ log-loss −0,0006, AUC 0,520 | Δ [−0,0031 ; +0,0018], AUC [0,474 ; 0,568] |
| E[R] | ridge | R² 1,0 %, Spearman 0,038 | Δ MSE [−0,085 ; +0,494] |
| E[R] | ridge, Q5 − Q1 | +0,70 R ; **+0,16 R sans les 5 plus grands gagnants** | [−0,05 ; +1,90] |
| P(R ≥ 2) | logistique L2, 3 variables | Δ log-loss +0,0002 | [−0,0057 ; +0,0059] |
| Continuation 15 min / 1 h / 4 h / 16 h | logistique L2, 11 variables | Δ log-loss +0,0014 / −0,0015 / −0,0005 / −0,0013 | tous incluent 0 (p Holm = 1) |

Dans l'échantillon, le même modèle semble porter un peu d'information (AUC 0,566) : elle disparaît
hors entraînement. Un contrôle positif (effets plantés dans des labels synthétiques, mêmes plis, même
test) montre que le dispositif détecte un effet d'AUC ≈ 0,64 dans 9 tirages sur 10, mais un effet
d'AUC ≈ 0,57 seulement dans 2 sur 10 : le résultat exclut une information d'une taille utile, pas
toute information. **Le Shock Engine reste inchangé.** Le modèle figé et le journal prospectif sont
livrés pour vérifier ce verdict sur des signaux futurs.

Ce n'est pas un test prospectif : les règles du Shock Engine, dont E2, ont été choisies sur toute la
période ; le walk-forward ne protège que la couche probabiliste.

## Commandes

```
# Pipeline complet (≈ 2 min 20) : jeu de données, walk-forward, évaluation, modèle figé, rapport
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/run.ts
npm run research:proba

# Fiche d'un signal (heure d'entrée = clôture de la bougie de signal, UTC), sur un historique coupé à cette bougie
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --asset btc --at 2026-09-21T20:30:00Z [--html fiche.html] [--log]

# Suivi prospectif : noter les signaux postérieurs aux données du modèle et les ajouter au journal
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --latest
# Bilan du journal (test au premier bilan à 300 signaux prospectifs fermés)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --evaluate

# Tests (couche probabiliste seule ≈ 75 s ; suite complète de recherche ≈ 3 min 30)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test research/tests/proba.test.ts
npm run test:research
```

Aucune dépendance : TypeScript exécuté par Node 22 (comme le reste de `research/`), algèbre linéaire,
régressions et bootstrap écrits ici. Le moteur, les indicateurs et les données sont ceux du dépôt.

## Architecture

| Fichier | Rôle |
|---|---|
| `config.ts` | configuration figée : variables, transformations, cibles, plis, grille de λ, seuils, graines |
| `features.ts` | caractéristiques d'un signal à la clôture de la bougie i, depuis les séries du moteur (`prepare`) et un recalcul exact de `classify` (journées closes) |
| `dataset.ts` | reconstruction des 1 311 trades par le chemin de `research/shock/portfolio.ts --variant e2`, cibles, dates de connaissance des labels, CSV et schéma ; historique coupé (`truncatedContext`) |
| `models.ts` | écrêtage et standardisation, logistique L2 (Newton–Raphson), ridge, Platt |
| `walkforward.ts` | plis trimestriels, purge par date de connaissance du label + embargo d'un jour, validation interne chronologique de λ, règle EPV, calibration sur prévisions antérieures |
| `metrics.ts` | Brier, log-loss, AUC, calibration (Wilson), quintiles, bootstrap par mois apparié, Holm |
| `evaluate.ts` | évaluation hors entraînement, tests pré-spécifiés, segments, plis, contrôle positif |
| `frozen.ts` | modèle figé (`model.json`), scoring d'un signal (`scoreAt`, `scoreFromRunner`), journal JSONL et bilan prospectif |
| `card.ts`, `charts.ts`, `report.ts` | fiche « SHOCK ENGINE — PROBABILISTIC SIGNAL REPORT », graphiques SVG, rapport HTML |
| `run.ts`, `score.ts` | lignes de commande |

## Définitions

- **Observations** : les trades du portefeuille de référence (BTC 644, ETH 667), sleeves de
  `research/lib/frozen-shock.ts`, shorts limités au régime E2 (`research/lib/e2.ts`), commission
  0,045 % par exécution, bougie d'entrée ouverte entre le 2018-09-01 et le 2026-09-30. Le script
  s'arrête si les comptes diffèrent du rapport publié.
- **Entrée** : clôture de la bougie de signal i (l'ordre s'exécute à cette clôture, au prix c_i).
- **R** = PnL net / risque initial ; risque initial = quantité × `atrStopMult` × ATR d'entrée (stop
  initial du moteur, calculé depuis c_i, égal au prix d'exécution). Commissions comptées une fois,
  dans le PnL net. Le stop n'est posé qu'à la clôture de la bougie qui suit l'entrée (convention du
  script) : 73 trades sortent au-delà du stop (jusqu'à −7,3 R). 10 trades ont des commissions
  supérieures à 0,5 R (normalisation « ambiguë », conservés) ; aucun n'est impossible à normaliser.
- **Continuation** à h ∈ {1, 4, 16, 64} bougies : d·ln(P_{t+h}/P_t), P_t = c_i, P_{t+h} = dernière
  clôture connue à la clôture prévue de la bougie i + h (pas d'interpolation, trous marqués).
- **MFE / MAE** en R : résultats futurs, jamais utilisés comme variables.
- **Date de connaissance d'un label** : clôture de la bougie de sortie (R, gain, événements),
  clôture prévue de la bougie i + h (continuation). Un trade n'entre dans l'entraînement du pli k
  que si son label est connu un jour avant le début du pli.

Colonnes, unités et disponibilité à l'entrée : `research/reports/proba/dataset-schema.json`.

## Sorties (`research/reports/proba/`)

| Fichier | Contenu |
|---|---|
| `dataset.csv`, `dataset-schema.json` | une ligne par trade : identifiants, 11 variables des modèles et 13 descriptives, cibles, résultats |
| `predictions.csv` | chaque prévision hors entraînement : pli, date des labels, empreinte du modèle du pli, probabilités / E[R] de chaque modèle, résultat observé |
| `walkforward.json` | modèles de chaque pli : λ, coefficients, transformations, calibrations |
| `metrics.json`, `diagnostics.json` | toutes les mesures ; contrôle positif et comparaison dans l'échantillon |
| `model.json` | modèle figé (empreinte dans `manifest.json`) avec tirages bootstrap et verdicts |
| `report.html`, `cards/` | rapport, fiches d'exemple |
| `manifest.json` | commit, empreintes des données et des sorties, commande |
| `prospective/predictions.jsonl` | journal prospectif (créé au premier signal noté) |

Le pipeline est déterministe : relancé sur les mêmes données, il redonne les mêmes prévisions et le
même modèle (vérifié par test contre les fichiers commités).

## Scoring en temps réel (non intrusif)

`scoreFromRunner(model, sha, runner, 'BTC' | 'ETH', i, dir)` lit le marché, les séries préparées, le
régime et les barres journalières d'un `ShockRunner` du bot, sans appeler `push`, `decide` ni rien qui
modifie un état (test : décisions, positions et état de la stratégie identiques avec et sans
scoring). Le bot n'appelle pas cette fonction : la brancher (par exemple dans `ShadowEngine.onBar`,
derrière une option désactivée par défaut, pour journaliser la fiche) serait une décision séparée.

```ts
import { loadModel, scoreFromRunner, appendLog } from '../research/proba/frozen.ts'
const { model, sha } = loadModel('research/reports/proba/model.json')
const s = scoreFromRunner(model, sha, runner, 'BTC', runner.n - 1, 1)   // signal long à la dernière bougie close
appendLog('research/reports/proba/prospective/predictions.jsonl', s)
```

Suivi hors ligne (comme `e2-forward`) : après chaque mois de données, mettre à jour les données (voir
`research/README.md`), lancer `score.ts --latest`, commiter le journal. Un signal est « prospectif »
si sa bougie d'entrée se clôt après la fin des données du modèle (`model.data.prospectiveAfter`).
Ne pas relancer `run.ts` sur de nouvelles données pendant le suivi : cela produirait un autre modèle
(autre empreinte) et remettrait le compteur prospectif à zéro.

## Tests (`research/tests/proba.test.ts`)

Empreintes du moteur et du filtre E2 inchangées ; aucun import du module par le moteur, le bot ou le
site ; jeu de données = portefeuille publié (comptes, gagnants, payoff, shorts) ; définition de R et
commissions comptées une fois ; caractéristiques cohérentes avec les conditions d'entrée ; contexte
quotidien identique à `classify` à chaque bougie ; caractéristiques identiques sur un historique coupé
à la bougie de signal ; purge du walk-forward ; modèle d'un pli inchangé quand on réécrit tous les
labels et variables inconnus à sa date ; calibration estimée sur les seuls plis antérieurs ; règle
EPV ; reproductibilité des prévisions et du modèle figé commités ; scoring = prédiction directe,
stable ; scoring non intrusif sur le runner du bot ; journal sans doublon ; optimalité de la
logistique et de la ridge ; mesures sur des cas calculés à la main. Contrôle des tests : une fuite
introduite volontairement (entraînement sur les trades entrés avant T sans attendre leur sortie) fait
échouer les tests de purge et de fuite.
