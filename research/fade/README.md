# Shock Fade Engine (recherche)

Projet indépendant de Shock Engine V1 : détecter les chocs de BTC/ETH dont l'impact serait transitoire et
vérifier si un Fade a une espérance positive **après coûts**, en comparant des règles simples à un modèle
hybride Merton (sauts) × Hawkes (intensité) × Ornstein-Uhlenbeck (transitoire latent). Rien ici n'importe ni ne
modifie `lib/strategies/shock/`, le bot ou le site (test `tests/test_frozen_v1.py`).

- Protocole pré-enregistré : [`research/preregistration/shock-fade.md`](../preregistration/shock-fade.md)
- Rapports et dossier : [`research/reports/shock-fade/`](../reports/shock-fade/) — commencer par
  [`00-dossier.md`](../reports/shock-fade/00-dossier.md)

## Installation

```
pip install -r research/fade/requirements.txt
```

## Reproduire (dans l'ordre)

```
cd research/fade
python3 -m shockfade.fetch                 # bougies 1 min Binance perp + comptant, SHA-256 vérifiées (≈ 1,4 Go, hors git)
python3 -m shockfade.quality               # 01-data-quality
python3 -m pytest                          # tests : processus simulés, non-fuite, empreintes V1
python3 -m shockfade.run_synthetic         # 02-synthetic-controls (contrôles négatif et positif)
python3 -m shockfade.run_structural BTCUSDT && python3 -m shockfade.run_structural ETHUSDT
python3 -m shockfade.run_events BTCUSDT && python3 -m shockfade.run_events ETHUSDT
python3 -m shockfade.eventstudy            # 03-event-study (période E)
python3 -m shockfade.hypotheses            # 04-hypotheses (H1–H4, Holm)
python3 -m shockfade.identifiability       # 05-identifiability
python3 -m shockfade.run_validation        # 06-walkforward (V) et sélection
python3 -m shockfade.run_holdout           # 07-holdout (C), une seule fois après le commit de la sélection
```

Chaque script qui lit des rendements ou estime un modèle sur données réelles ajoute une ligne à
`research/reports/shock-fade/trial-log.md`.

## Modules

| module | rôle |
|---|---|
| `fetch.py`, `data.py`, `quality.py` | données 1 min, grille, agrégation causale, diagnostic |
| `vol.py` | saisonnalité intrajournalière (60 j passés), variation bipuissance locale (360 min passées) |
| `jumps.py` | Lee–Mykland (seuil de Gumbel), BNS journalier |
| `hawkes.py` | Hawkes exponentiel bivarié ± : MLE à gradient analytique, stabilité, changement de temps, Ogata |
| `ou.py` | état-espace prix = permanent + transitoire OU piloté par le flux (Kalman, MLE), OU naïf (contrôle) |
| `pipeline.py` | estimations trimestrielles, filtre continu, table d'événements et caractéristiques causales |
| `stats.py`, `walkforward.py` | inférence (groupée, HAC, bootstrap par blocs, Holm/BH, Clark–West), modèles M1–M7 |
| `synthetic.py` | simulateur à paramètres connus pour les contrôles du pipeline |
