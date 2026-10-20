# Pré-spécification — divergences prix / Regime Wave (MRE v1.5 VWAP) sur BTC

Rédigé le 2026-10-20 et commité avant tout calcul. Script : `research/mre/mre-divergence.ts`.

## Indicateur

Regime Wave de « Markov Regime Engine v1.5 VWAP » (profil CRYPTO, réglages par défaut, mode Turbo actif),
portée ligne à ligne : VWAP glissant 20 (HLC3), z-score du spread sur 50, tendance (seuil 0,8, persistance 1),
volatilité (écart type des variations du spread sur 20, z-score sur 100, SuperSmoother 5, seuils ±1, persistance
2), momentum (MACD 12/26 normalisé par l'ATR 14, pente 3, SuperSmoother 5, z-score 50, zone morte 0,2,
persistance 2), amplitude par l'Efficiency Ratio (14, plancher 0,15, puissance 1,8), pondérations 0,5 / 0,3 / 0,2,
pénalité de volatilité 0,4, vitesse limitée (pas 0,08 × 2,7), lissage EMA 2. Les probabilités de Markov ne
servent pas à la wave et ne sont pas portées.

## Divergence (définition fixée)

Pivots du prix (`ta.pivothigh` / `ta.pivotlow`, L bougies à gauche et à droite, confirmés L bougies plus tard).
- **Baissière → short** : pivot haut p plus haut que le pivot haut précédent p0 (5 à 60 bougies avant), et
  W(p) < W(p0), avec W = maximum de la wave sur [pivot − L, pivot + L] et W(p0) > 0.
- **Haussière → long** : miroir (pivots bas, plus bas plus bas, W = minimum, W(p) > W(p0), W(p0) < 0).
- Signal à la clôture de la bougie de confirmation (p + L), exécution à l'ouverture suivante.

## Essais (18)

Timeframes 15 min, 1 h, 4 h (4 h regroupé depuis 1 h) × L ∈ {3, 5, 8} × 2 sorties : (S1) stop 3,3 × ATR(30) et
sortie sur divergence opposée ; (S2) idem + objectif à 2 R. Une position, 100 % du capital, sans levier,
commission 0,045 % par ordre. Entraînement 2017-01-01 → 2022-12-31, validation 2023-01-01 → 2026-09-30.

## Lecture (fixée ici)

- **Étude d'événement** (méthode de `research/futures-transfer/lib/event-study.ts`) : rendement dans le sens
  du signal en ATR(30) à 1, 4, 16 et 64 bougies, excès sur la bougie quelconque de la même année au même quart
  d'heure de New York, bootstrap des mois, événements au hasard (1 000 tirages). **Divergence prédictive** pour
  un (timeframe, L) si, à l'entraînement, excès > 0 à 4 et 16 bougies avec borne basse à 90 % > 0 et p hasard
  < 0,05 à 16 bougies, et en validation excès > 0 à 16 bougies avec p hasard < 0,10.
- **Stratégie** : la meilleure des 18 à l'entraînement (Sharpe journalier, au moins 30 trades) est jugée en
  validation : Sharpe > 0,3, PF > 1,1, Sharpe > 0 avec frais doublés.
- Verdict : **edge robuste** si au moins un (timeframe, L) est prédictif et que la meilleure stratégie passe la
  validation ; **prometteur mais fragile** si une seule des deux conditions est remplie ; **aucun edge démontré**
  sinon. Toutes les configurations sont rapportées, favorables ou non.
