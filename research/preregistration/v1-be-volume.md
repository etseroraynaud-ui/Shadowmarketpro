# Pré-enregistrement — point mort et volume directionnel 2 h / 4 h pour Shock Engine V1

Rédigé le 2026-10-13 et commité **avant tout calcul de performance d'une variante ou d'un contrôle**. Code :
`research/fade/v1/` (copie isolée du broker et de la boucle, agrégation du volume `taker15.py`, script
`be-volume-study.ts`) ; rapport unique : `research/reports/shock-fade/v1-be-volume/report.md`.

**Ce qui était connu avant ce protocole.**
- Sorties de V1 (`research/reports/shock-fade/v1-exits/`) : 439 SL (−488 R), 273 FLIP (+1 156 R), 4 TRAIL (+98 R).
  119 SL avaient d'abord atteint +1 R, 58 +2 R, 31 +3 R. Les 36 meilleurs trades (5 %) font 92 % du R total.
  Tous les trades de moins de 4 h sont des SL (182, −207 R).
- Sur E2 (pas V1), un point mort après +1 R, estimé au premier ordre, valait net −203 R
  (`research/reports/loss-anatomy/`). Une invalidation à 1 h sans confirmation ne donnait pas de candidate
  (`research/reports/early-invalidation/`). Le volume y était le volume total après le choc, pas sa direction.
- Les 11 variantes de trailing (`research/reports/shock-fade/v1-trailing/`) dégradent toutes V1.
- Le flux agresseur Binance a servi au modèle OU de Shock Fade (perpétuel), jamais sur les trades de V1.

Aucune variante, aucun contrôle et aucune mesure du volume sur les trades de V1 n'ont été calculés avant ce
commit. Seuls ont été calculés les contrôles d'identité du moteur et l'agrégation du volume.

## 0. Ce qui ne change pas

Aucun fichier de V1 (`lib/strategies/shock/`, `research/lib/`), du bot ni du site n'est modifié. Les règles
passent par la copie isolée `research/fade/v1/trail-broker.ts` (ajouts marqués `[be-volume]`, inactifs par
défaut) et `trail-sim.ts`. Les décisions à la clôture restent celles de la stratégie figée.

Tout le reste est identique à V1 :
- mêmes entrées (E2 sans entrée en régime agité) ;
- mêmes frais (commission de 0,045 % par ordre, glissement nul, 100 % de l'equity, sans levier) ;
- même stop initial (3,3 ATR), même FLIP, même trailing de 50 ATR ;
- mêmes conventions d'exécution (ordres de sortie à la clôture de la barre qui suit l'entrée, trajet intrabarre,
  exécution à l'ouverture au-delà d'un niveau) ;
- même fenêtre 2018-09-01 → 2026-09-30, portefeuille BTC/ETH 50/50 sans rebalancement.

**Contrôles avant résultats.** Le script s'arrête si l'un d'eux échoue.
- La copie (spécification V1, puis avec des règles impossibles à déclencher) reproduit au bit près les
  positions et l'equity du moteur figé, sur BTC et sur ETH.
- Le rejeu apparié reproduit les 716 trades (358 + 358) et les sorties exportées
  (`v1-exits/trades.csv`).
- Sharpe 2,0242 ; CAGR 67,7 % ; drawdown −17,8 % ; 439 SL, 273 FLIP, 4 TRAIL.

## 1. Volume directionnel

- **Source.** Bougies 1 min Binance comptant BTCUSDT et ETHUSDT déjà téléchargées (manifeste
  `research/reports/shock-fade/data-manifest.json`). On prend le volume `v` et le volume acheteur agresseur
  `tbv`, le volume vendeur valant `v − tbv`. Agrégation en tranches de 15 min UTC par `taker15.py`, sans
  téléchargement.
- **Mesure.** I_H = d · (V_achat − V_vente) / V_total sur [entrée, entrée + H), avec H = 2 h ou 4 h. L'entrée
  est la clôture de la bougie de signal ; d = +1 pour un long, −1 pour un short.
- **Décision.** À la première clôture de V1 située au moins H après l'entrée. C'est normalement exactement
  entrée + H ; ce sera plus tard si la série de V1 a un trou, cas compté. Seules des minutes déjà closes sont
  lues.
- **Données insuffisantes.** Si moins de 90 % des minutes de la fenêtre sont présentes, ou si le volume total
  est nul, aucune décision de volume n'est prise : la position garde le comportement de V1 et est comptée
  « donnée manquante ». Le volume n'est jamais remplacé par zéro.
- **Correspondance (BTC).** V1 trade BTC sur Bitstamp ; le volume de Binance sert de proxy. On rapporte :
  - la corrélation des rendements 15 min Bitstamp / Binance ;
  - l'accord de signe des rendements sur les fenêtres 2 h et 4 h des trades ;
  - la couverture des fenêtres.
- **Correspondance (ETH).** V1 trade ETH sur Binance comptant : on vérifie l'égalité des clôtures 15 min.

## 2. Variantes (8, liste fermée) et contrôles

Notation : R = risque initial (3,3 × ATR(30) d'entrée). Le gain latent vaut d · (clôture − entrée) / R à la
clôture de décision. Dans ce protocole, « V1 » à « V4 » désignent des variantes de volume ; la stratégie de
référence est **B0**.

| Id | Règle |
|---|---|
| B0 | V1 inchangée (référence) |
| B1 | point mort dès +2 R |
| B2 | point mort dès +3 R |
| V1 | à 2 h, sortie si I_2h < 0 |
| V2 | à 4 h, sortie si I_4h < 0 |
| V3 | à 2 h, sortie si I_2h < 0 **et** gain latent < +0,5 R |
| V4 | à 4 h, sortie si I_4h < 0 **et** gain latent < +0,5 R |
| C1 | B2 + V3 |
| C2 | B2 + V4 |

**Point mort.**
- Activation : à la clôture de chaque barre où les ordres de sortie sont en place (dès la barre qui suit
  l'entrée), si la MFE observée depuis l'entrée (plus hauts et plus bas des bougies closes) atteint +2 R (B1)
  ou +3 R (B2). L'activation se fait à la clôture, comme un script Pine qui déplace son stop en fin de bougie,
  et non en cours de bougie.
- Niveau : prix d'entrée exécuté, hors commission. Une sortie au point mort coûte donc les deux commissions,
  ≈ −0,09 R.
- Fonctionnement : ce stop s'ajoute aux autres et le plus serré s'applique. Il est testé à la clôture
  d'activation (sortie à cette clôture si le prix y est déjà revenu), puis dans les bougies suivantes selon les
  conventions du simulateur. Il n'est jamais retiré ni redescendu.

**Sortie anticipée.**
- Une seule décision par position, et seulement si la position est encore ouverte à l'échéance.
- Exécution au marché à la clôture de décision, comme FLIP, commission comprise.
- Le stop initial, le FLIP et le trailing restent actifs avant et après la décision.

**Contrôles de prix seul** (ni candidats, ni comptés dans Holm ou le PBO), à la même échéance :

| Contrôle | Règle | Contrôle de |
|---|---|---|
| P1 / P2 | sortie à 2 h / 4 h si le gain latent < 0 | V1 / V2 (direction du prix au lieu de celle du flux) |
| P3 / P4 | sortie à 2 h / 4 h si le gain latent < +0,5 R | V3 / V4 |
| PC1 / PC2 | B2 + P3 / B2 + P4 | C1 / C2 |

**Rejeux de diagnostic** (appariés seulement) : X2 / X4 = sortie inconditionnelle à 2 h / 4 h, pour mesurer le
R obtenu en sortant à l'échéance.

## 3. Mesures

**A. Diagnostic des 716 trades.** Rejeu apparié : chemin chronologique du simulateur, pas la MFE / MAE. Pour
chaque règle :
- nombre de trades évalués (encore ouverts à l'échéance), de données manquantes et de déclenchements ;
- trades concernés, c'est-à-dire dont la sortie change, répartis par BTC / ETH, long / short et année ;
- perdants sauvés (R V1 ≤ 0 dont le R augmente) et R récupérés (Σ ΔR sur les perdants V1) ;
- gagnants coupés (R V1 > 0 dont le R baisse) et R sacrifiés (Σ ΔR sur les gagnants V1) ;
- nombre des 36 meilleurs trades V1 touchés, et leur ΔR.

**B. Analyse appariée** (mêmes entrées, sorties seules) : ΔR moyen et ΔR total, par actif. IC à 95 % par
bootstrap des mois d'entrée (2 000 tirages).

**C. Portefeuille complet**, avec les entrées supplémentaires que permet une sortie anticipée :
- Sharpe, CAGR, drawdown maximal, Calmar ;
- profit factor (sur les rendements des trades), taux de gain, payoff (R moyen gagnant / |R moyen perdant|),
  R total ;
- nombre de trades, exposition (part des bougies en position) ;
- Sharpe et CAGR par sleeve, Sharpe avec commissions doublées ;
- parmi les 36 meilleurs trades V1, nombre conservés (même bougie d'entrée, R ≥ 75 % du R V1).

## 4. Le volume apporte-t-il plus que le prix ?

Analyse descriptive, sans seuil ajusté.
- **Rejeu complet.** Sharpe(V_k) − Sharpe(P_k), et de même pour C1 / PC1 et C2 / PC2 : bootstrap par mois, p
  unilatéral, signe sur chaque moitié chronologique (2018-09-01 → 2022-06-30, 2022-07-01 → 2026-09-30).
- **Décomposition** sur les trades ouverts à l'échéance. Soit R_garder = R V1 − R d'une sortie à l'échéance
  (rejeu X). Parmi les trades dont le gain latent est < +0,5 R :
  - V3 / V4 ne coupent que ceux à I < 0 ;
  - P3 / P4 les coupent tous ;
  - on compare la moyenne de R_garder des groupes I < 0 et I ≥ 0 (IC par bootstrap des mois), par moitié et
    par actif.
- **Information.** Corrélation partielle de Spearman entre I_H et R_garder, à gain latent donné, sur tous les
  trades ouverts à l'échéance. IC par bootstrap des mois ; calculée par moitié et par actif.

## 5. Contrôles statistiques

- **ΔSharpe portefeuille contre B0.** Bootstrap par blocs de mois calendaires sur les rendements journaliers
  appariés (2 000 tirages). IC à 95 % par percentiles ; p unilatéral = P(ΔSharpe ≤ 0) ; Holm sur les 8
  variantes. Même bootstrap pour chaque sleeve.
- **Par année.** ΔR apparié par année d'entrée ; écart de rendement annuel du portefeuille.
- **PBO.** CSCV sur 9 configurations (B0 + 8), 16 blocs.
- **Sharpe dégonflé.**
  - Niveau de la meilleure variante, avec N = 241 essais connus : au moins 222 configurations de la lignée de
    V1 (`research/shock/calm-only.ts`), plus les 11 trailings, plus les 8 variantes d'ici. Les règles de
    sortie déjà explorées sur E2 (point mort, invalidation précoce) y sont incluses ou en plus ; N est donc un
    minimum.
  - Série d'écart à B0, avec N = 8.
- **Walk-forward rétrospectif.** Recalage annuel 2020 → 2026, choix au meilleur Sharpe passé parmi les 9
  configurations. Ce n'est **pas** une validation prospective indépendante : tout l'historique a servi à
  développer V1.

## 6. Règle de décision

Une variante est **convaincante** si les six conditions suivantes sont toutes remplies :
1. ΔSharpe > 0, avec l'IC à 95 % qui exclut zéro (borne basse > 0) et un p de Holm < 0,05 ;
2. ΔSharpe > 0 sur la sleeve BTC **et** sur la sleeve ETH ;
3. drawdown maximal non dégradé (≥ celui de B0) ;
4. Sharpe avec commissions doublées > celui de B0 avec commissions doublées ;
5. au moins 30 des 36 meilleurs trades V1 conservés dans le rejeu complet ;
6. pour une variante de volume (V1 à V4, C1, C2) : Sharpe > celui du contrôle de prix correspondant, avec un p
   bootstrap unilatéral < 0,05, et un écart positif sur chacune des deux moitiés chronologiques.

Si plusieurs variantes sont convaincantes, on retient celle qui change le moins de sorties dans le rejeu
apparié. **Si aucune ne l'est, V1 reste inchangée.** Toute variante retenue reste exploratoire jusqu'à une
validation prospective séparée (sur le modèle de `research/preregistration/e2-forward.md`).
