# Pré-spécification — diagnostics historiques de E2 (BTC/ETH)

Rédigé le 2026-10-08 et commité **avant tout calcul** de ces diagnostics. Script :
`research/shock/e2-diagnostics.ts` ; rapport : `research/reports/e2-diagnostics/`.

## Portée

- Données **déjà vues** : BTC et ETH, là où E2 a été choisie. Ces diagnostics peuvent seulement
  **éliminer** E2 ; ils ne peuvent pas la valider.
- Ils ne modifient pas la validation forward (`research/preregistration/e2-forward.md`) : le plan,
  E2, les seuils et le calendrier restent tels quels, quel que soit le résultat.
- La v1 et le bot ne sont pas modifiés. Les variantes sont des listes d'entrées short passées au
  moteur figé (`override` de `simulate`).

## Échantillon et définitions communes

- **Runs** : la v1 exactement comme dans `research/lib/frozen-shock.ts` (BTC/USD Bitstamp depuis
  2017-01-01, ETH/USDT Binance depuis 2018-09-01, coûts 0,045 % par ordre).
- **Shorts** : les shorts de la v1 fermés par une vraie sortie, avec une barre de sortie close avant
  le 2026-10-01. C'est l'échantillon de la référence historique du forward : 794 shorts, dont 251 en
  régime E2 baissier.
- **E2** : régime de tendance baissier de `classify` (`regimes.ts`) à la barre d'entrée, exactement
  comme dans le forward.
- **R** = (PnL net / equity à l'entrée) / σ journalière des 30 jours précédents.
- **D** = moyenne de R des shorts gardés − moyenne de R des shorts rejetés. Pour E2 : gardés = E2
  baissier.
- **Portefeuille** : 50/50 officiel sans rebalancement, période commune 2018-09-01 → 2026-09-30,
  Sharpe journalier.
- **Sélection** : pour comparer E2 et ses placebos au niveau du portefeuille, le moteur reçoit comme
  entrées short seulement les barres d'entrée des shorts v1 sélectionnés. Contrôle : sélectionner
  tous les shorts v1 redonne la v1 exactement.

## 1. Placebo par sous-échantillonnage aléatoire

- **Tirage** : on garde au hasard **exactement autant de shorts v1 que E2 en garde, par actif**
  (BTC 143, ETH 108), parmi les shorts v1 de cet actif.
- **Niveau trade** : 10 000 tirages ; `p1 = part des tirages où D ≥ D(E2)`. Variante secondaire :
  même nombre de shorts gardés par actif **et par année**.
- **Niveau portefeuille** : 1 000 tirages ; part des tirages où le Sharpe 50/50 ≥ celui de la
  sélection E2. On rapporte aussi le nombre de shorts réellement exécutés.
- **Élimination** : E2 est éliminée si `p1 ≥ 0,05` (niveau trade, par actif).

## 2. Placebo par décalage temporel du régime

- **Décalage** : la série E2 de chaque actif, au pas de 15 min sur sa fenêtre simulée, est décalée
  circulairement de k jours. Le même k s'applique aux deux actifs. La persistance des phases
  baissières et la part de temps en régime baissier sont donc conservées.
- **Décalages admis** : au moins 180 jours, dans un sens ou dans l'autre, en distance circulaire.
- **Niveau trade** : tous les décalages admis, en jours entiers ; `p2 = part des décalages où D ≥ D(E2)`.
- **Niveau portefeuille** : 400 décalages répartis régulièrement parmi les décalages admis ; part
  où le Sharpe 50/50 ≥ celui de la sélection E2.
- **Élimination** : E2 est éliminée si `p2 ≥ 0,10`. Le seuil est plus lâche qu'au § 1, parce que
  8 ans ne contiennent que quelques phases baissières indépendantes.

## 3. Funding des perpétuels et glissement

- **Funding historique** :
  - Binance USDⓈ-M (BTCUSDT, ETHUSDT), de janvier 2020 à septembre 2026, au pas de 8 h, depuis les
    archives `data.binance.vision` ;
  - **avant 2020** : hypothèse d'un taux constant de +0,01 % par 8 h (taux de base de Binance) ;
  - **secondaire** : funding Hyperliquid (plateforme du bot) à la place de Binance de mai 2023 à
    septembre 2026.
- **Signe** : à chaque versement, une position reçoit `−sens × taux × quantité × prix`. Un short
  (sens −1) reçoit donc le funding quand le taux est positif et le paie quand il est négatif. Une
  position touche les versements dont l'horodatage tombe après la clôture de sa barre d'entrée et au
  plus tard à l'ouverture de sa barre de sortie.
- **Application** : ajoutée au PnL de chaque trade (R recalculé). Pour le portefeuille, elle est
  ajoutée aux rendements journaliers de la sleeve, en part de son equity de la veille, sans
  recomposer la taille des positions.
- **Stress** :
  1. funding historique (Binance, avec l'hypothèse d'avant 2020) ;
  2. idem avec Hyperliquid depuis mai 2023 ;
  3. shorts payant en permanence 0,01 % par 8 h.
- **Glissement** : 0 ; 0,01 % ; 0,02 % ; 0,05 % par ordre, en plus de la commission, appliqué aux
  runs v1 et E2. E2 est ici le challenger du forward : entrées short masquées hors régime baissier.
- **Rapporté** :
  - D ;
  - Sharpe, CAGR et drawdown du portefeuille, v1 et E2 ;
  - funding net reçu ou payé par les shorts de chaque groupe ;
  - le tout par année.
- **Élimination** : E2 est éliminée si D ≤ 0 avec le funding historique (stress 1).

## 4. Stabilité

- **Par année** : D (avec les nombres de shorts) et Sharpe du portefeuille v1 et E2 (challenger).
- **Fenêtres glissantes de 12 et 24 mois**, terminées à chaque fin de mois :
  - écart de Sharpe du portefeuille, E2 − v1, sur rendements journaliers ;
  - D sur les shorts entrés dans la fenêtre.
- **Résumé** : part des fenêtres où l'écart est positif, médiane, P10, P90, minimum, maximum. Séries
  complètes en CSV.
- **Pas d'élimination.** Mention « fragile » si l'écart de Sharpe sur 24 mois est positif dans moins
  de la moitié des fenêtres.

## Conclusion

- **« E2 éliminée »** si un critère d'élimination des § 1 à 3 est atteint.
- **« E2 non éliminée »** sinon : elle a résisté à ces tentatives de réfutation, ce qui n'est pas une
  validation.
- **Graines** : 20261013 pour le placebo aléatoire, et la grille régulière décrite au § 2 pour le
  décalage.
