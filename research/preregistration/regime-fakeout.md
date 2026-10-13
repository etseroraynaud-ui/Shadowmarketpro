# Pré-spécification — régime directionnel avant le signal et coût des faux départs

Rédigé le 2026-10-13 et commité, avec les fonctions de mesure (`research/lib/regime-er.ts`), **avant
tout calcul reliant l'Efficiency Ratio, l'ADX ou la fréquence des faux départs à un résultat de
trade**. Script : `research/shock/regime-fakeout.ts` ; rapport : `research/reports/regime-fakeout/`.

## 0. Ce qui ne change pas

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`, de `research/lib/e2.ts`
  ni du bot n'est modifié (empreintes vérifiées par le script avant tout calcul, celles de
  `research/preregistration/e2-forward.md` § 0).
- Les variantes sont des **listes d'entrées** (argument `override` de `simulate`) et, pour V3, une
  **sélection du jeu de réglages** (argument `select`) : exactement les mécanismes déjà utilisés pour
  E2. Chaque variante est rejouée en portefeuille complet : retirer ou déplacer un trade peut en
  permettre d'autres.
- La version de référence (V0, Shock Engine E2) reste la référence. Une variante qui passerait la
  règle du § 6 deviendrait au mieux une **candidate**, à valider en forward (shadow) avec un plan
  séparé, avant tout changement du live.

## 1. Ce qui était connu à la rédaction

- Portefeuille E2 BTC/ETH (1 311 trades, Sharpe 1,88) ; couche probabiliste
  (`research/reports/proba/`) : parmi les signaux sélectionnés, 11 caractéristiques d'entrée
  (dont la distance à la moyenne 60 min et le percentile de volatilité) ne prévoient ni le gain, ni
  R, ni la continuation, hors entraînement.
- Mesure rapide de la convention du stop sur la première bougie (effet net ≈ +10 R sur ΣR = 736).
- Étude des entrées short sur les 8 actifs vierges (`research/reports/short-entry-study/`) : les
  résultats de la v1 (sans E2) sur ces actifs ont été vus.
- **Jamais calculés, sur aucune donnée** : l'Efficiency Ratio, l'ADX et la fréquence des faux départs
  à l'entrée d'un trade, leur relation avec R, et les variantes V1 à V3.

## 2. Hypothèse

Le Shock Engine capture des continuations après un choc. Son coût principal pourrait venir des faux
départs dans des marchés oscillants (H−) ; à l'inverse, de grands mouvements peuvent naître d'une
longue consolidation (H+), et un filtre anti-range supprimerait alors une partie de l'alpha. La
question : **peut-on identifier, avant l'entrée, les environnements où le coût des faux départs
dépasse la valeur des grandes continuations capturées ?** L'étude est bilatérale.

## 3. Mesures avant le signal (bougie de signal i exclue)

Toutes calculées sur les bougies 15 min de l'actif, avec seulement les bougies 0 … i − 1.

- **ER_n** (Kaufman) : `|c[i−1] − c[i−1−n]| / Σ_{k=i−n}^{i−1} |c[k] − c[k−1]|`, entre 0 et 1
  (0 si le dénominateur est nul). **Principal : n = 20** (5 h). Secondaire : n = 96 (24 h).
- **ADX(14, 14)** à la bougie i − 1 (`dmi` de `lib/backtest/indicators.ts`). Secondaire.
- **Fréquence des faux départs** (secondaire) : une cassure à la bougie j est une clôture au-dessus du
  plus haut (ou sous le plus bas) des 20 bougies j − 20 … j − 1 ; elle est un **faux départ** si une
  des 4 clôtures suivantes revient de l'autre côté de ce niveau. Fréquence à i : part des faux
  départs parmi les cassures j des 672 bougies précédentes (7 jours) dont l'issue est connue
  (j + 4 ≤ i − 1) ; au moins 10 cassures, sinon non définie.
- **Régime** : percentile causal de chaque mesure, part des valeurs des 8 640 bougies précédentes
  (90 jours) qui sont ≤ la valeur courante ; au moins 2 880 valeurs (30 jours), sinon non défini.
  Quartiles du percentile ER_20 :

| Groupe | Percentile ER_20 |
|---|---|
| Range marqué | [0 ; 0,25[ |
| Range modéré | [0,25 ; 0,5[ |
| Tendance modérée | [0,5 ; 0,75[ |
| Tendance forte | [0,75 ; 1] |

  Mêmes quartiles pour ER_96, l'ADX et la fréquence des faux départs (secondaires).

## 4. Phase 1 — matrice de rendement conditionnel

Pour chaque groupe : trades, taux de gain (Wilson 95 %), R moyen (bootstrap par mois, 95 %), R
médian, gain moyen / perte moyenne en R, profit factor en R, MFE et MAE médians en R, probabilité de
**réintégrer le range** (une clôture revient de l'autre côté du niveau cassé par l'entrée — plus haut
ou plus bas des `rangeWin` bougies du jeu qui décide — dans les 1, 4 ou 16 bougies suivantes), part
des **grands gagnants** (R ≥ 90e centile de R de l'échantillon) et part de la somme des R.

R = PnL net / risque initial (définition de `research/proba/`). Échantillons :

- **BTC/ETH** (1 311 trades de référence) : développement, descriptif.
- **8 actifs vierges** (XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC ; mêmes données, fenêtres et coûts
  que `research/shock/short-entry-study.ts` : commission 0,045 %, glissement 0,01 % par ordre) avec
  la stratégie E2 telle quelle : réplication de la matrice.

Statistique de phase 1, rapportée sur les deux échantillons : **D1 = R moyen (range marqué) − R
moyen (trois autres groupes)**, intervalle bootstrap à 95 % (bilatéral). Descriptif : la décision
porte sur la phase 3.

## 5. Phase 2 — variantes (fixées ici, aucun réglage ultérieur)

« Range » = percentile ER_20 < 0,25 à la bougie de signal. Un signal sans percentile défini n'est
jamais « range ».

| Variante | Définition |
|---|---|
| **V0** | Shock Engine E2 inchangé (référence) |
| **V1** anti-range | entrées en range retirées |
| **V2** confirmation retardée en range | une entrée en range à la bougie i est déplacée à la clôture de i + 1 si `d·(c[i+1] − niveau cassé) > 0`, si la bougie i + 1 ne suit pas un trou, si un jeu de réglages décide à i + 1 et autorise ce sens (et, pour un short, si le régime E2 est baissier à i + 1) ; sinon elle est retirée. Entrées hors range inchangées |
| **V3** sorties adaptées au régime | entrées en range décidées par le jeu calme : sorties du jeu agité existant (stop 1,1 ATR, stop suiveur 3,2 ATR, TP1 0,9 ATR sur 20 %) ; aucun nouveau paramètre ; entrées identiques à V0 |

## 6. Phase 3 — validation et décision

**Test confirmatoire (actifs vierges).** Pour l'actif a et la variante k, `S(k,a)` = Sharpe des
rendements journaliers (√365,25) de la stratégie complète sur sa fenêtre. Statistique :

```
Δ(k) = moyenne sur les 8 actifs de [ S(k,a) − S(V0,a) ]
```

- Bootstrap par mois civils de l'union des fenêtres, mêmes mois pour tous les actifs et toutes les
  variantes, 10 000 réplications, graine 20261013 ; `p = (1 + #{Δ* ≤ 0}) / (1 + B)` unilatéral.
- **Holm** sur V1, V2, V3 (α = 0,05).
- **« Avantage démontré »** pour k si : p ajusté < 0,05 ; `S(k,a) > S(V0,a)` sur au moins 6 des 8
  actifs ; Δ(k) > 0 avec des coûts × 2. Sinon : « avantage non démontré ».
- Même si une variante passe, elle n'est qu'une candidate (§ 0).

**Mesures secondaires (descriptives)** : pour chaque variante, sur chaque actif vierge et sur le
portefeuille BTC/ETH 50/50 sans rebalancement (convention de `research/shock/portfolio.ts`) :
Sharpe, CAGR, drawdown maximal, profit factor, nombre de trades, ΣR, part des 5 % meilleurs trades
dans la somme des R. Écart de Sharpe BTC/ETH avec intervalle bootstrap par mois. **Fenêtres
chronologiques** : écart de Sharpe et de rendement par année civile (portefeuille BTC/ETH ; actifs
vierges mis en commun), part des années où la variante fait mieux.

## 7. Contrôles bloquants

Empreintes du moteur (§ 0) ; V0 sur BTC/ETH redonne exactement 644 + 667 trades et le Sharpe publié
du portefeuille E2 ; V3 redonne exactement les entrées de V0 quand aucune bougie n'est en range ;
les mesures du § 3 sont identiques sur un historique coupé à la bougie de signal.

## 8. Interdits

Changer n, les fenêtres, le seuil de 0,25, la définition des faux départs, les variantes, la
statistique ou la règle après avoir vu un résultat ; ajouter une variante « qui marche » ; modifier
le Shock Engine à cause de l'étude. Tout écart est consigné dans le rapport.
