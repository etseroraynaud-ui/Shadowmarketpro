# Récapitulatif — Shock Engine BTC/ETH : travail réalisé

État au 2026-10-08. Branche de travail : `claude/shock-engine-portfolio-g79j1v`.

Tous les résultats sont des **simulations historiques après coûts modélisés, pas des performances live**.
La stratégie v1 (préréglage choisi sur BTC, appliqué tel quel à ETH) n'a jamais été modifiée.

## État en un coup d'œil

| Élément | Où | Statut |
|---|---|---|
| Portefeuille BTC/ETH 50/50 (rapport, CSV, manifeste) | `main` et production | publié |
| Site : accueil, `/shock-engine`, `/shock-engine/portfolio`, `/research`, `/institutional` | `main` et production | en ligne, vérifié |
| Attribution de la baisse du Sharpe (2,13 → 1,29) | branche seulement | fait |
| Étude pré-enregistrée de l'entrée des shorts + avenant BTC/ETH | branche seulement | fait |
| Protocole E2 (filtre de tendance journalière pour les shorts) | — | proposé, pas lancé |
| Adresse e-mail institutionnelle | variable Vercel | à configurer par vous |

Les travaux « branche seulement » sont de la recherche : ils ne changent ni le site ni la stratégie (le
dossier `research/` est exclu du déploiement).

---

## 1. Portefeuille Shock Engine BTC/ETH 50/50

**Construction.** Deux sleeves de 50, chacune compose seulement son propre capital ; valeur = somme des
deux ; pas de rebalancement, pas de levier implicite. Coûts validés : 0,045 % par ordre, glissement nul
(stress × 0, × 1, × 2). Diagnostics : B (rebalancement mensuel) et C (risque égal causal sur 90 jours,
exploratoire). Aucune optimisation des poids, des paramètres, des coûts ou de la période.

**Période commune** : 2018-09-01 → 2026-09-30 (2 952 jours, 8,1 ans).

| | BTC | ETH | Portefeuille 50/50 |
|---|---|---|---|
| Sharpe (journalier) | 1,53 | 1,50 | **1,73** |
| CAGR | 56,4 % | 70,5 % | 64,5 % |
| Drawdown maximal | −28,5 % | −32,8 % | −23,5 % |
| Volatilité annualisée | 32,4 % | 40,9 % | 31,7 % |
| Rendement total | +3 612 % | +7 352 % | +5 482 % |
| Trades | 886 | 918 | 1 804 |

- Corrélation BTC/ETH des stratégies : 0,38 (journalière), 0,45 (hebdomadaire), 0,29 (mensuelle) ;
  médiane glissante 90 jours 0,41.
- Ratio de diversification 1,20 ; Sharpe du portefeuille 1,13 fois celui de la meilleure sleeve ;
  drawdown ramené à 82 % de celui de BTC.
- Bootstrap par mois (5 000 tirages, mêmes mois pour les deux sleeves) : Sharpe 1,29 à 2,18 (90 %).
- Pire mois : février 2022, −10,8 %. Calmar 2,75.
- 38 contrôles sur 38 réussis (pas de double capital, pas de double composition, causalité, frais
  comptés une fois par exécution, reproduction exacte des backtests validés…).
- Mentions obligatoires présentes : « Ethereum parameters were inherited from Bitcoin and were not
  calibrated on ETH. », « Historical simulation after modeled transaction costs. Not live
  performance. », « Capacity and market impact are not yet modeled. »

Fichiers : `research/reports/btc-eth-portfolio/` (rapport HTML, CSV, `portfolio_summary.json`,
`shock-engine-v1-manifest.json`) ; code `research/shock/portfolio.ts`, `research/lib/portfolio.ts`,
`research/lib/frozen-shock.ts`.

## 2. Site

- Accueil centré sur le Shock Engine ; indicateurs et tarifs inchangés.
- Nouvelles pages : `/shock-engine`, `/shock-engine/portfolio`, `/research`, `/institutional`, avec
  séparation nette HISTORICAL / LIVE et fichiers téléchargeables.
- Les pages lisent seulement `lib/research/btc-eth-portfolio.json` et `public/research/btc-eth-portfolio/`,
  écrits par `research/shock/publish-portfolio.ts` (qui refuse de publier si un contrôle échoue).
- `.vercelignore` exclut `/research/` et `/bot/` du déploiement.
- Contact institutionnel : lien e-mail lu dans `NEXT_PUBLIC_INSTITUTIONAL_EMAIL` ; **adresse à
  configurer** dans Vercel (sans elle, le bouton ouvre le rapport complet).

## 3. Mise en production

- Merge de la branche dans `main` : commit `a1ebdee`, sans changement de contenu, de chiffres ni de
  design.
- Déploiement Vercel de production terminé ; les 5 pages répondent sans erreur.
- URL publique : <https://www.shadowmarketpro.com>.
- Seul incident : l'accès réseau aux domaines de production était bloqué depuis l'environnement de
  travail ; résolu après votre autorisation.

## 4. Attribution de la baisse du Sharpe entre les deux moitiés

Moitiés de 1 476 jours : 2018-09-01 → 2022-09-15, puis 2022-09-16 → 2026-09-30. Sharpe du portefeuille
**2,13 puis 1,29**. Attribution exacte (valeurs de Shapley), aucun paramètre modifié.

1. **La baisse vient presque entièrement des shorts** : gain moyen par trade des shorts −1,82 de Sharpe,
   longs +0,12 ; la baisse de volatilité compense en partie (+0,60). Contribution annuelle des shorts :
   +46,8 % puis +2,8 % ; des longs : +31,8 % puis +33,9 %.
2. **Les tendances n'ont pas raccourci** : en unités de volatilité journalière, le gagnant moyen grandit
   (BTC 1,59 → 1,86 σ, ETH 1,33 → 1,72 σ). En %, il baisse parce que la volatilité du marché a baissé
   d'environ un tiers.
3. **C'est le taux de gain qui a changé** (BTC 35 % → 26 %, ETH 33 % → 26 %), surtout sur les shorts
   (BTC 32 % → 21 %, ETH 33 % → 24 %).
4. **E[R | choc] ne tend pas vers 0**, sauf pour les signaux shorts d'ETH (excès à 1 h : +0,42 → −0,14 ATR).
5. **Les shorts gagnent surtout en années baissières** (2018, 2022) ; 2023 négatif.
6. **La corrélation BTC/ETH (0,34 → 0,45) pèse peu** (−0,07). Les frais prennent 23 % de l'alpha brut
   contre 11 %, parce que l'alpha brut des shorts a disparu.
7. **Prudence** : intervalle à 90 % de la baisse −1,78 à +0,04 ; probabilité de baisse 94 %.

Fichiers : `research/reports/btc-eth-portfolio/sharpe-attribution.{md,json}` ;
code `research/shock/sharpe-attribution.ts`.

## 5. Étude pré-enregistrée de l'entrée des shorts

**Méthode.** Plan écrit et commité **avant tout calcul** (`research/preregistration/short-entry-v1.1.md`,
commit `6b91ec7`). Les variantes sont des masques sur la liste des entrées short : longs, sorties,
sizing, régime, coûts et paramètres inchangés. Mesure principale : espérance nette d'un short par unité
de risque, R = (PnL net / equity) / σ journalière des 30 jours précédents.

| Variante | Définition |
|---|---|
| V0 | v1 inchangée |
| V1 | symétrie de la bougie (corps > 55 %, clôture dans le quart bas, seuils du long) |
| V2 | symétrie de la tendance 60 min (moyenne en baisse, même définition que le long) |
| V3 | V1 + V2 — variante principale |
| V4 | sans shorts — référence économique |
| E1 (exploratoire) | lambda + volume miroir |
| E2 (exploratoire) | shorts seulement en tendance journalière baissière (moyenne 50 jours, pente sur 10 jours) |

### 5.1 Verdict pré-enregistré — 8 actifs jamais utilisés

XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC (Binance 15 min, préréglage BTC sans calibration).

**AMÉLIORATION NON DÉMONTRÉE.**

| Variante | Δ par short (σ) | p | Actifs améliorés |
|---|---|---|---|
| V1 | −0,017 | 0,83 | 4/8 |
| V2 | +0,026 | 0,12 | 6/8 |
| **V3 (principale)** | **+0,006** | **0,44** | 6/8 |
| E1 | +0,004 | 0,27 | 4/8 |
| E2 | +0,117 | 0,005 | 8/8 |

- Valeur des shorts actuels sur ces actifs : +0,028 σ par short (90 % : −0,06 à +0,12), non démontrée.
- Écart au plan, documenté : le contrôle de grille horaire a été limité à la fenêtre simulée (81 bougies
  de la panne Binance de février 2018 dans le préchauffage de BNB et LTC). Un contrôle montre qu'elles
  ne changent ni le régime ni aucune entrée. 123 contrôles sur 123 réussis.

### 5.2 Avenant — mêmes variantes sur BTC et ETH (données déjà vues, descriptif)

| Variante | Δ par short (σ) | p | Sharpe 50/50 | CAGR | Drawdown max | Sharpe 2018–22 | Sharpe 2022–26 |
|---|---|---|---|---|---|---|---|
| V0 · v1 | — | — | 1,73 | 64,5 % | −23,5 % | 2,13 | 1,29 |
| V1 | +0,018 | 0,23 | 1,69 | 63,3 % | −23,5 % | 2,06 | 1,45 |
| V2 | +0,058 | 0,09 | 1,68 | 61,5 % | −22,1 % | 1,92 | 1,50 |
| V3 | +0,069 | 0,11 | 1,62 | 57,1 % | −18,9 % | 1,98 | 1,48 |
| V4 · sans shorts | — | — | 1,52 | 33,5 % | −16,1 % | 1,41 | 1,66 |
| E2 (exploratoire) | +0,279 | 0,01 | 1,88 | 61,6 % | −19,1 % | 2,03 | 1,78 |

- Les filtres de symétrie améliorent chaque short mais en retirent trop : le Sharpe du portefeuille baisse.
- Les shorts actuels valent beaucoup sur BTC/ETH : sans eux, le CAGR passe de 64,5 % à 33,5 %.
- E2 est la seule variante qui améliore le portefeuille (+0,15 de Sharpe, 90 % : −0,14 à +0,43), mais
  elle a été choisie après avoir vu les données : **rien ici ne la valide**.

Fichiers : `research/reports/short-entry-study/short-entry-study.{md,json}` et
`short-entry-btc-eth.{md,json}` ; code `research/shock/short-entry-study.ts` ; données
`research/data/{xrp,bnb,doge,trx,ada,link,xlm,ltc}usdt_15m.csv.gz`.

## 6. Avis sur votre protocole E2 (proposé, pas encore lancé)

- **Principe** : les tests historiques peuvent seulement éliminer E2, pas la valider. Seul le forward
  peut l'adopter.
- **Déjà fait** : BTC, ETH et portefeuille ; bootstrap E2 − V0 ; années. L'audit anti-look-ahead est à
  étendre à toutes les barres de BTC et ETH.
- **À faire en priorité** :
  1. shorts acceptés contre shorts rejetés, sur les trades de V0 (statistique principale) ;
  2. placebo par décalage du régime (garde la persistance des phases baissières) ;
  3. placebo par tirage au hasard, par actif puis par actif et par année ;
  4. stress du funding (le bot vise Hyperliquid, des perpétuels ; les shorts de E2 tombent en marché
     baissier, où le short paie souvent le funding).
- **Durée du forward** : sur BTC/ETH seuls, environ 30 shorts acceptés et 60 rejetés par an, dispersion
  de R d'environ 1,6 à 2 σ. Il faudrait environ 3 ans pour une chance sur deux de conclure, 6 à 7 ans
  pour quatre chances sur cinq. En ajoutant les 8 autres cryptos en shadow : plutôt 1 à 3 ans.
- **Recommandation** : garder V0 en live, noter le drapeau E2 sur chaque short, fixer l'échéance en
  nombre de shorts, et décider d'avance qu'un résultat non concluant veut dire rester en V0.

## 7. Reste à faire

- Configurer `NEXT_PUBLIC_INSTITUTIONAL_EMAIL` dans Vercel.
- Décider si l'on rédige et lance le pré-enregistrement de E2 (tests d'élimination + shadow forward).
- Décider si les données des 8 actifs restent dans le dépôt (environ 39 Mo).
- Optionnel : fusionner dans `main` les commits de recherche de la branche (sans effet sur le site).

## Commits de la branche

| Commit | Contenu |
|---|---|
| `d85266b` | Portefeuille BTC/ETH : code |
| `2b15c84` | Portefeuille BTC/ETH : rapport |
| `b1e565f` | Site : Shock Engine en vedette, pages Portfolio, Research, Institutional |
| `a1ebdee` | Merge dans `main` (production) |
| `ccd4148` | Attribution de la baisse du Sharpe |
| `6b91ec7` | Pré-enregistrement de l'étude des shorts (avant tout calcul) |
| `c134c52` | Étude des shorts : script et données des 8 actifs |
| `b36831b` | Étude des shorts : avenant BTC/ETH |
| `916b3ae` | Rapports de l'étude des shorts et de l'avenant |
