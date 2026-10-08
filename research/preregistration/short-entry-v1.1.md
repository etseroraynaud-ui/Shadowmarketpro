# Pré-enregistrement — entrée des shorts du Shock Engine (étude « v1.1-shorts »)

Rédigé le 2026-10-08 et commité **avant tout calcul** des variantes ci-dessous. Le commit qui
ajoute ce fichier fait foi : tout résultat de l'étude est produit par un commit postérieur.

Base : branche `claude/shock-engine-portfolio-g79j1v`, commit `ccd4148`. Stratégie figée v1
(manifeste `research/reports/btc-eth-portfolio/shock-engine-v1-manifest.json`, paramètres
`c6ac30464bce14ddb6e5625cbcf08f68e69e3cc5e5454a0c2268583070a74435`).

## 0. Ce que l'étude ne change pas

- La v1 reste figée : live, site, rapports publiés et manifeste ne sont pas modifiés.
- Aucun fichier de `lib/strategies/shock/` n'est modifié. Les variantes sont des **masques sur la
  liste des entrées short** passée au moteur (argument `override` de `simulate`). Les longs, les
  sorties (stop, trailing, TP1, VWAP, flip), le sizing, le régime de volatilité, les coûts et tous
  les paramètres sont identiques à la v1. Le flip lit les chocs bruts (`impulseShort`), pas la
  liste des entrées : masquer une entrée short ne change aucune sortie.
- Une variante retenue devient au mieux une **candidate v1.1**. Elle tourne d'abord en parallèle
  dans le shadow mode du bot (3 à 6 mois), avec des critères de bascule pré-enregistrés à part,
  avant le début du shadow. Les résultats publiés restent ceux de la v1.

Empreintes SHA-256 des fichiers figés au moment du pré-enregistrement :

| Fichier | SHA-256 |
|---|---|
| `lib/strategies/shock/market.ts` | `b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff` |
| `lib/strategies/shock/strategy.ts` | `fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc` |
| `lib/strategies/shock/broker.ts` | `bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b` |
| `lib/strategies/shock/engine.ts` | `15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f` |
| `lib/strategies/shock/params.ts` | `5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6` |
| `lib/strategies/shock/presets.ts` | `f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2` |
| `lib/strategies/shock/regimes.ts` | `d72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8` |
| `lib/strategies/shock/live.ts` | `05caf82ece9ad7f8c355f0390bbda4fe6e3bffe1802933d0952b5c3dc10edeb2` |
| `research/lib/frozen-shock.ts` | `be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710` |

Le script de l'étude vérifie ces empreintes avant de calculer quoi que ce soit.

## 1. Ce qui a déjà été vu (divulgation)

- **BTC/USD (Bitstamp) 2017–2026 et ETH/USDT (Binance) 2018–2026** : backtests complets de la v1,
  portefeuille 50/50 et attribution de la baisse du Sharpe entre les deux moitiés. On y a vu que
  l'avantage des shorts a presque disparu en seconde moitié (2022-09 → 2026-09) et que 2023 est
  négatif pour les shorts. Ces données ne peuvent donc pas confirmer une règle short : elles sont
  rapportées à titre **descriptif** seulement.
- **Déjà testés avec la v1** (exclus des actifs vierges) : SOL/USDT, TAO/USDT, ETH/USD Dukascopy,
  XAU/USD, WTI, et les séries Hyperliquid (BTC, ETH, NVDA).
- **Jamais calculées, sur aucune donnée** à la date de ce commit : les variantes V1, V2, V3, E1 et
  E2. Sur les actifs vierges, seule la disponibilité des fichiers a été vérifiée (code HTTP de
  l'archive pour quelques mois), sans télécharger ni lire de prix.

## 2. Hypothèse

Dans `lib/strategies/shock/market.ts` (fonction `prepare`), un short entre sur moins de preuves
qu'un long : le long exige une bougie pleine (corps > 55 % du range, clôture dans le quart haut)
et une moyenne 60 min **montante**. Le short exige seulement une clôture sous cette moyenne. Cette
asymétrie existe depuis le script d'origine ; elle n'a pas été construite à partir des résultats.

Hypothèse principale : appliquer aux shorts le **miroir exact** des conditions déjà validées sur
les longs, sans aucun nouveau paramètre, améliore l'espérance nette d'un short par unité de risque.

## 3. Variantes

Notation, à la barre `i` (15 min) et pour le jeu de réglages qui décide de l'entrée (`select[i]`,
toujours le jeu calme pour un short : le jeu agité n'autorise pas les shorts) :

- `s0[i]` : liste des entrées short de la v1, exactement celle du moteur
  (`impulseEntryShort` du jeu actif, `allowShort`, bougie qui suit un trou exclue) ;
- `rng = max(h − l, mintick)`, `bodyShare = |c − o| / rng`, `closePos = (c − l) / rng` : mêmes
  expressions que `market.ts` ;
- `htfVal[i]` : moyenne de tendance 60 min du moteur. Dans le code, c'est une **moyenne simple**
  de 70 clôtures horaires (paramètre nommé `htfEmaLen`) ;
- `htfPrev[i]` : la même moyenne 3 barres horaires plus tôt (jeu calme : `htfSlopeMode = 'htf'`,
  `htfSlopeBars = 3`), exactement la série qu'utilise le long (`bullStrong = bull && hv > htfPrev`).
  Le script la lit dans le cache du moteur, sans la recalculer.

### Confirmatoires

| Variante | Entrées short | Rôle |
|---|---|---|
| **V0** | `s0` | référence, v1 inchangée |
| **V1** | `s0 ∧ bodyShare > 0,55 ∧ closePos < 0,25` | symétrie de la bougie (seuils du long) |
| **V2** | `s0 ∧ htfVal < htfPrev` | symétrie de la tendance (`c < htfVal` est déjà exigé par `s0`) |
| **V3** | `V1 ∧ V2` | **variante principale** : symétrisation minimale |
| **V4** | aucune | référence économique : valeur réelle de la sleeve short |

### Exploratoires (ne peuvent pas devenir la variante retenue)

| Variante | Entrées short |
|---|---|
| **E1** | `s0 ∧ lamPct > 55 ∧ volZ > 0` (miroir de `longRegimeOK`) |
| **E2** | `s0 ∧` tendance journalière baissière : dernier jour clos sous sa moyenne 50 jours, moyenne en baisse sur 10 jours (`classify` de `regimes.ts`) |

Aucun seuil existant (choc, mèche, range, volume, stop, sorties) n'est retouché pour les shorts.

## 4. Données

### Actifs vierges (confirmatoires)

**XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC**, paires USDT au comptant Binance, bougies 15 min de
l'archive publique `data.binance.vision` (`research/data/fetch-binance.py`), du premier mois
disponible à 2026-09 inclus.

Règle de choix : grandes cryptomonnaies hors stablecoins, avec un historique 15 min Binance USDT
qui commence au plus tard en juillet 2019 et toujours cotées en septembre 2026, jamais utilisées
dans ce dépôt. Exclues : BTC, ETH, SOL, TAO (déjà vues), les stablecoins, les jetons emballés ou à
levier, et BCH (série raccordée BCHABC → BCH). La liste est close : aucun actif n'est ajouté ni
retiré après les calculs.

- **Préchauffage** : toutes les données disponibles avant le début de la simulation.
- **Début de la simulation** : premier jour du mois qui suit (première barre + 365 jours), même
  règle que pour ETH et SOL.
- **Fin** : dernière barre du 2026-09-30 (même fin que BTC et ETH).
- **Régime de volatilité** : barres journalières reconstruites à partir des barres 15 min, comme
  pour ETH.
- **Préréglage** : `adaptivePreset(15, mintick)`, celui de BTC, sans aucune calibration.
- **Coûts** : commission 0,045 % par ordre et glissement 0,01 % par ordre (règle de SOL), capital
  10 000, 100 % de l'equity, sans levier. Test de stress à coûts × 2.
- **mintick** : `10^(⌊log10(plus basse clôture de la fenêtre simulée)⌋ − 4)`. Dans le moteur, il
  sert seulement de plancher au range d'une bougie et à l'ATR.

### Déjà vus (descriptifs)

BTC et ETH exactement comme dans le portefeuille v1, ainsi que le portefeuille officiel 50/50
sans rebalancement.

## 5. Mesure principale

Pour chaque position short fermée :

```
R = (PnL net / equity à l'entrée) / σ_d
```

- **PnL net** : après commission et glissement.
- **σ_d** : écart type (population) des 30 rendements log journaliers (clôtures UTC) qui précèdent
  le jour de l'entrée, comme dans `research/shock/sharpe-attribution.ts`.

Pour l'actif `a` et la variante `k`, `Ē(k,a)` est la moyenne de `R` sur les shorts entrés dans la
fenêtre simulée. Statistique de comparaison, à poids égal par actif :

```
Δ(k) = moyenne sur les 8 actifs de [ Ē(k,a) − Ē(V0,a) ]
```

## 6. Règle de décision

**H3 (principale) : V3 améliore V0.** H0 est rejetée si les deux conditions suivantes sont
remplies :

1. **Bootstrap** : p unilatéral < 0,05, avec `p = part des réplications où Δ*(V3) ≤ 0` ;
2. **Constance** : `Ē(V3,a) > Ē(V0,a)` sur au moins 6 des 8 actifs. Un actif sans short V3 compte
   comme non amélioré.

**Garde-fous**, tous nécessaires pour déclarer V3 « candidate v1.1 » :

- **G1** : au moins 100 shorts V3 au total sur les 8 actifs. Sinon, la conclusion est
  « non concluant », pas « échec ».
- **G2** : avec des coûts × 2, Δ(V3) reste > 0 (estimation ponctuelle).
- **G3** : la médiane, sur les 8 actifs, de l'écart de Sharpe journalier de la stratégie complète
  (longs + shorts), V3 − V0, est ≥ 0.

Conclusions possibles :

- **« V3 candidate v1.1 »** : H3 rejetée et G1 à G3 respectés. Étape suivante : un
  pré-enregistrement forward, puis le shadow mode.
- **« Amélioration non démontrée »** dans tous les autres cas. Si G1 échoue :
  « non concluant ».

**V1 et V2 (attribution)** :

- Elles sont testées seulement si H3 est rejetée.
- Méthode de Holm : la plus petite des deux p-valeurs est comparée à 0,025, l'autre à 0,05.
  Chacune doit aussi remplir la condition de constance (6/8).
- Elles servent seulement à dire d'où vient l'effet. Elles ne remplacent pas V3 comme candidate.

**V4 (valeur de la sleeve short)** :

- Indicateurs rapportés :
  - `Ē(V0)`, mis en commun sur les 8 actifs, avec son intervalle bootstrap à 90 % ;
  - la médiane des écarts de Sharpe de la stratégie complète, V0 − V4.
- Conclusion « valeur des shorts démontrée hors échantillon » si la borne basse de l'intervalle
  est > 0 et que cette médiane est > 0.
- Ce constat ne modifie pas la v1.

**E1 et E2** :

- Mêmes statistiques que les variantes confirmatoires, marquées EXPLORATOIRE.
- Aucune n'est déclarée gagnante. Un résultat prometteur ne vaut que comme hypothèse pour un
  nouveau pré-enregistrement testé en forward.

## 7. Bootstrap

- **Blocs** : les mois civils de l'union des fenêtres des 8 actifs. Un bloc contient, pour chaque
  actif et chaque variante, les shorts entrés ce mois-là.
- **Tirage** : autant de mois que l'union en compte, avec remise. Les mêmes mois sont tirés pour
  tous les actifs et toutes les variantes, ce qui garde la corrélation entre cryptos et
  l'appariement des variantes.
- **Actif sans short** : si un actif n'a aucun short dans une réplication pour l'une des deux
  variantes comparées, il sort de la moyenne de cette réplication.
- **Réglages** : 10 000 réplications, graine 20261008, générateur `rng` de
  `research/lib/portfolio.ts`.

## 8. Mesures secondaires (rapportées, hors décision sauf G1 à G3)

Pour chaque actif et chaque variante :

- nombre de shorts et shorts par an ;
- taux de réussite ;
- `Ē`, et rendement net moyen par short en % ;
- profit factor des shorts : somme des PnL nets positifs sur somme des PnL nets négatifs ;
- risque de baisse : semi-écart de `R` sous 0, pire `R`, drawdown maximal de la somme cumulée des
  rendements nets des shorts ;
- contribution aux crises : somme des rendements nets et des `R` des shorts entrés pendant les 7
  épisodes nommés du rapport portefeuille, et pendant les jours où l'actif est à plus de 30 % sous
  son plus haut sur un an ;
- stratégie complète : Sharpe journalier, CAGR, drawdown maximal ;
- `Ē` par moitié (jusqu'au 2022-09-15, puis après) et par année.

Pour BTC, ETH et le portefeuille 50/50 officiel : les mêmes mesures par variante, plus le Sharpe,
le CAGR et le drawdown maximal du portefeuille, au total et par moitié. Ces résultats sont
**descriptifs** (données déjà vues).

## 9. Contrôles d'intégrité

Ils doivent tous passer avant toute lecture des résultats ; en cas d'échec, aucun résultat n'est
publié.

- Les empreintes des fichiers figés sont identiques au tableau du § 0.
- V0 sur BTC et ETH reproduit exactement les métriques validées de la v1, ainsi que le Sharpe
  publié du portefeuille 50/50.
- Les entrées long et short reconstruites à partir des composantes (`bodyShare`, `closePos`,
  `htfPrev`…) sont égales, barre par barre, à celles du moteur. Les miroirs sont donc construits
  sur les séries exactes du moteur.
- Chaque variante est un sous-ensemble de `s0`. Les entrées long sont identiques dans toutes les
  variantes.
- Causalité de E2 : tronquer l'historique après la barre `i` ne change pas la décision en `i`.
- Actifs vierges : horodatages sur la grille 15 min UTC, croissants, sans doublon. Le nombre de
  trous est rapporté.

## 10. Interdits et écarts

- **Interdits** :
  - retoucher un seuil pour les shorts ;
  - ajouter, retirer ou remplacer un actif ;
  - changer la fenêtre, les coûts, la mesure principale, le seuil de 6/8, les garde-fous ou le
    nombre de réplications après avoir vu un résultat.
- **Écarts** : tout écart à ce document (correction d'erreur de code, donnée défectueuse) est
  listé dans le rapport avec sa raison. Le résultat du plan initial reste alors rapporté à côté.
- **Sorties prévues** :
  - script : `research/shock/short-entry-study.ts` ;
  - rapport : `research/reports/short-entry-study/short-entry-study.{md,json}`.
