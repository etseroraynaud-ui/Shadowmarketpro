# Pré-spécification — OU Trend Channel, Top 1 H1 gelé sur ETH et SOL, avec et sans filtre HTF

Rédigé le 2026-10-20 et commité avant tout calcul sur ETH et SOL. Script : `research/ou-channel/ou-multi.ts`.

## Ce qui est gelé

Top 1 H1 choisi sur BTC 2017 – 2022 (`research/reports/ou-channel/ou-channel-60m.md`) : z 2,2, réintégration 1,
mèche 0,7, sans filtre volume, stop 4,5 × ATR(30), sortie sur piège opposé, une position, 100 % du capital,
sans levier, commission 0,045 % par ordre, signal à la clôture et exécution à l'ouverture suivante. Aucun
réglage n'est réestimé.

## Essais (6, comptés avec les 836 précédents)

- Actifs : BTC/USD Bitstamp (référence, déjà vu), ETH/USDT et SOL/USDT Binance (bougies 60 min regroupées
  depuis les fichiers 15 min du dépôt ; jamais utilisés pour l'indicateur OU).
- Variante 0 : Top 1 tel quel. Variante 1 : filtre HTF de l'indicateur (`htfBullish` / `htfBearish` :
  clôture 4 h contre EMA 21 de la clôture 4 h), lu sur la dernière bougie de 4 h close : longs seulement si
  haussier, shorts seulement si baissier ; un signal opposé bloqué ferme quand même la position.
- Périodes : entraînement jusqu'au 2022-12-31 et validation 2023-01-01 → 2026-09-30, comme pour BTC ; pour ETH
  et SOL, toute la période est hors échantillon. Début : 2017-01-01 pour BTC, 60 jours après la première
  bougie pour ETH et SOL. Portefeuille équipondéré (moyenne journalière des trois) sur les jours communs.

## Lecture (fixée ici)

- **Transfert** du Top 1 à un actif : Sharpe > 0,3 et PF > 1,1 sur toute la période, et Sharpe de validation
  > 0 (seuils zéro-shot du projet).
- **Filtre HTF retenu** s'il augmente le Sharpe de validation sur au moins 2 des 3 actifs et celui du
  portefeuille ; sinon rejeté.
- Verdict : **edge robuste** si ETH et SOL transfèrent et que le portefeuille a un Sharpe de validation > 0,5 ;
  **prometteur mais fragile** si un seul des deux transfère ou si le portefeuille de validation est entre 0
  et 0,5 ; **aucun edge démontré** sinon.
