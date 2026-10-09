# Pré-spécification — alpha résiduel du Shock Engine face à des stratégies de tendance simples

Rédigé le 2026-10-09 et commité **avant tout calcul** de cette étude. Script :
`research/shock/residual-alpha.ts` ; rapport : `research/reports/residual-alpha/`.

**Ce qui était connu au moment de la rédaction.** Les chiffres publiés du portefeuille (Sharpe 50/50
1,88, CAGR 61,6 %, drawdown −19,1 %, corrélation des deux sleeves 0,36, corrélation des cours BTC/ETH
0,82, 26 % du temps en position, détention médiane 4 h). Le test C de la batterie de falsification
de E2 (gains de Sharpe et de drawdown de la condition de tendance en grande partie génériques).
**Aucune** corrélation ni régression du Shock Engine contre une stratégie de tendance n'a été
calculée ou vue. Une attente a été formulée avant l'étude : chargement partiel probable sur le
facteur tendance, corrélation « modérée plausible ».

## Question

Une fois retirées l'exposition au marché (buy & hold BTC et ETH) et l'exposition à des stratégies de
tendance simples, standard, non optimisées, le Shock Engine garde-t-il un rendement moyen positif
(α) significatif ?

Ce n'est pas un test hors échantillon. Les règles du Shock Engine ont été choisies sur des données
BTC qui couvrent toute la période, et la condition de tendance des shorts a été spécifiée en
octobre 2026 après étude de cette période. L'étude dit si des facteurs simples **reproduisent** le
résultat historique, pas si l'alpha persistera.

Rien n'est optimisé ni modifié : ni le Shock Engine (version publique, `--variant e2`), ni les
paramètres des stratégies de référence, fixés ci-dessous avant tout calcul.

## Données et échantillon

- **Rendements du Shock Engine** : rendements journaliers UTC publiés de
  `research/reports/btc-eth-portfolio-e2/portfolio_daily_returns.csv` (portefeuille 50/50 sans
  rebalancement, sleeve BTC, sleeve ETH), du 2018-09-01 au 2026-09-30 (2 952 jours), après
  commissions de 0,045 % par ordre.
- **Prix des références** : les mêmes barres que les sleeves (BTC/USD Bitstamp 15 min, ETH/USDT
  Binance 15 min, `research/lib/frozen-shock.ts`), tout l'historique disponible avant 2018-09-01
  servant au calcul des signaux. Clôture journalière = clôture de la dernière barre du jour UTC
  (même convention que le portefeuille, `dayCloses`).

## Stratégies de référence (paramètres fixés ici)

Pour chaque actif (BTC, ETH), position ∈ {−1, 0, +1} (exposition unitaire, sans levier), décidée à la
clôture du jour t avec les seules données ≤ t, appliquée au rendement du jour t + 1. Commission de
0,045 % × |variation de position| à chaque changement (comme le Shock Engine). Pas de funding.

1. **BH** : buy & hold, position +1 en permanence, sans coût.
2. **TSMOM(L)**, L ∈ {30, 90, 180} jours : position = signe de `close_t / close_{t−L} − 1`.
3. **DONCH(55/20)** : à plat, entrée longue si `close_t > max(close_{t−55..t−1})`, courte si
   `close_t < min(close_{t−55..t−1})` ; sortie d'un long si `close_t < min(close_{t−20..t−1})`, d'un
   short si `close_t > max(close_{t−20..t−1})`. Une sortie est examinée avant une entrée le même jour.
4. **EMA(20/100)** : position +1 si EMA20 > EMA100, −1 sinon ; EMA classiques (α = 2/(n+1)),
   initialisées sur la première clôture disponible.
5. **DONCH15(96/48)**, tendance intrajournalière : mêmes règles que DONCH sur les clôtures 15 min,
   entrée sur 96 barres (24 h), sortie sur 48 barres (12 h), position appliquée à la barre suivante,
   commission à chaque changement ; rendement journalier tiré de l'equity aux clôtures journalières.

Facteurs du portefeuille : moyenne 50/50 (rebalancée chaque jour) des versions BTC et ETH de chaque
référence de tendance ; BH_BTC et BH_ETH restent deux facteurs distincts. Les variantes « long
seulement » ne sont pas ajoutées : avec des positions ±1, leur rendement est (à coûts près) la
moyenne de la version long/short et de BH, déjà dans l'espace des régresseurs.

## Modèles

MCO avec constante, rendements journaliers simples.

- **M0 (marché)** : R = α + β₁·BH_BTC + β₂·BH_ETH + ε.
- **M1 (tendance journalière)** : M0 + TSMOM30 + TSMOM90 + TSMOM180 + DONCH + EMA.
- **M2 (principal)** : M1 + DONCH15.

Pour les sleeves : mêmes modèles avec les seules références de l'actif (BH de l'actif et ses
versions des tendances).

## Statistiques

- **α annualisé** = α journalier × 365,25.
- **t de α** avec écarts types de Newey–West (noyau de Bartlett, retard
  ⌊4·(T/100)^(2/9)⌋, soit 8 sur 2 952 jours).
- **Ratio d'information résiduel** = α / σ(ε) × √365,25 ; R² et R² ajusté ; part du rendement moyen
  du Shock Engine non expliquée par les facteurs (α / moyenne de R).
- **Bootstrap par mois civils** : 5 000 tirages de mois avec remise, les mêmes mois pour toutes les
  séries (dépendance conservée), graine 20261009 ; intervalles à 90 et 95 % de α annualisé et
  P(α ≤ 0).
- Pour chaque référence : Sharpe, CAGR, drawdown maximal, corrélation avec le Shock Engine.

## Lecture (fixée d'avance)

Sur **M2, portefeuille 50/50** :

- **« alpha résiduel démontré (en échantillon) »** si α > 0, t de Newey–West ≥ 3,0 **et**
  P(α ≤ 0) bootstrap ≤ 0,01. Le seuil de 3 suit Harvey, Liu et Zhu (2016) pour un facteur testé
  parmi beaucoup d'autres ;
- **« indicatif »** si 2,0 ≤ t < 3,0 ;
- **« non démontré »** si t < 2,0.

Les sleeves, M0, M1 et les sensibilités sont descriptifs ; ils ne changent pas le verdict.

## Sensibilités (fixées d'avance, descriptives)

- **S1, réplication optimiste** : M2 remplacé par une grille complète, toutes les versions dans la
  même régression : TSMOM L ∈ {10, 20, 30, 60, 90, 120, 180, 250} ; DONCH ∈ {20/10, 55/20, 100/50} ;
  EMA ∈ {10/50, 20/100, 50/200} ; DONCH15 ∈ {48/24, 96/48, 192/96} ; plus BH_BTC et BH_ETH
  (19 régresseurs). Cette version avantage délibérément les références.
- **S2, demi-périodes** : M2 sur 2018-09-01 → 2022-09-15 et 2022-09-16 → 2026-09-30.
- **S3, hebdomadaire** : M2 sur rendements hebdomadaires composés (semaines ISO), retard de
  Newey–West ⌊4·(T/100)^(2/9)⌋.
- **S4, références sans frais** : M2 avec des références sans commission (avantage aux références).

## Contrôles (avant lecture des résultats)

1. Les rendements lus reproduisent les Sharpe publiés du portefeuille, de BTC et d'ETH (écart
   < 10⁻⁶).
2. Les rendements journaliers des cours BTC et ETH reproduisent la corrélation publiée
   `underlyingDaily` (écart < 10⁻⁹) : même convention journalière que le portefeuille.
3. Pas de regard vers le futur : sur 200 dates tirées au hasard par référence, modifier tous les
   prix après la date ne change aucune position jusqu'à cette date incluse.
4. MCO et Newey–West : sur données simulées à coefficients connus, les coefficients sont retrouvés et,
   avec un retard 0, l'écart type de Newey–West égale celui de White.
5. Bootstrap déterministe (même graine, mêmes résultats).

Si un contrôle échoue, le rapport le dit et aucun verdict n'est donné.

## Ce qui ne sera pas fait

Pas de recherche de la référence la plus corrélée hors de la grille S1, pas de changement des
paramètres après les résultats, pas de modification du Shock Engine, du bot ni des pages publiques
sur la base de cette étude sans nouvelle décision explicite.
