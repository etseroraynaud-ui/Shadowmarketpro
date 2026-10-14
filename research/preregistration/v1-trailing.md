# Pré-enregistrement — trailing stop de Shock Engine V1 (régime calme)

Rédigé le 2026-10-13 et commité **avant tout résultat de variante**. Code : `research/fade/v1/` (copie isolée
du broker et de la boucle de simulation, script d'étude) ; sortie : `research/reports/shock-fade/v1-trailing/`.

**Ce qui était connu.** V1 utilise `atrTrailMult = 50` (activation et distance de 50 ATR, ≈ 15 R) : 4 sorties
TRAIL sur 716 trades. Sur les trades V1 : 223 gagnants rendent en médiane 2,9 R sur une MFE médiane de 5,9 R ;
87 trades ayant atteint +2 R finissent ≤ 0 ; les 5 % meilleurs trades font 91 % du R total. Études antérieures
(E2) : un stop au point mort après +1 R coûte −203 R (`research/reports/loss-anatomy/`) ; sur le diagnostic
15 min, le trailing du script (1,8 ATR) dégradait le résultat ; le walk-forward historique a choisi 50 pour le jeu
calme. Aucune variante de ce protocole n'a été simulée avant ce commit (seuls les contrôles d'identité de la
copie, avec V1 et avec `atrTrailMult = 10`, hors liste).

## 0. Ce qui ne change pas

Aucun fichier de V1 (`lib/strategies/shock/`, `research/lib/`), du bot ni du site n'est modifié. Les variantes
découplées et conditionnelles passent par une **copie isolée** (`research/fade/v1/trail-broker.ts`,
`trail-sim.ts`) ; la stratégie (décisions à la clôture) est celle du moteur figé, importée. Mêmes entrées
(V1 = E2 sans entrée en régime agité), mêmes conventions d'exécution (ordres de sortie posés à la clôture de la
barre qui suit l'entrée, trajet intrabarre, exécution à l'ouverture au-delà d'un niveau), mêmes coûts
(commission 0,045 % par ordre, glissement nul, 100 % de l'equity, sans levier), même fenêtre 2018-09-01 →
2026-09-30, portefeuille BTC/ETH 50/50 sans rebalancement.

**Contrôles avant résultats** (le script s'arrête sinon) : la copie avec la spécification V1 reproduit au
bit près les positions et l'equity du moteur figé sur BTC et ETH ; idem avec `atrTrailMult = 10` ; le rejeu
apparié (entrées imposées = entrées de V1) reproduit les 716 trades ; le Sharpe du portefeuille V1 est celui de
la fiche (2,0242).

## 1. Variantes (11, liste fermée)

R = risque initial = 3,3 × ATR(30) d'entrée. Le stop fixe initial, le FLIP et toutes les autres sorties de V1
restent actifs ; le plus serré des stops actifs s'applique.

| Famille | Id | Règle |
|---|---|---|
| 1. Trailing classique (moteur tel quel, activation = distance) | C8, C12, C16, C25 | `atrTrailMult` = 8, 12, 16, 25 ATR (≈ 2,4 / 3,6 / 4,8 / 7,6 R) au lieu de 50 |
| 2. Trailing découplé (copie isolée) | D3-2, D5-3, D5-4 | activation quand le prix atteint entrée + 3 R (resp. 5, 5) ; puis stop à 2 R (resp. 3, 4) du meilleur prix ; remplace le trailing de 50 ATR |
| 3. Trailing conditionnel au régime agité (copie isolée) | X2-1.5, X2-3, X4-1.5, X4-3 | trailing de V1 conservé ; à la clôture d'une barre dont le régime (règle de V1, dernier jour clos) est **agité**, si la MFE déjà observée depuis l'entrée est ≥ 2 R (resp. 4 R), un stop suiveur est posé à 1,5 R (resp. 3 R) du meilleur prix observé ; testé à cette clôture puis dans les barres suivantes ; une fois posé, il reste actif |

La famille 3 n'utilise que des informations connues à la clôture de la barre : régime du dernier jour UTC clos,
plus hauts/plus bas déjà observés.

## 2. Mesures

**Analyse appariée** (entrées imposées = les 716 entrées de V1, seules les sorties changent ; R = PnL net /
risque initial) :
- groupe G « rend ses gains » : trades V1 avec MFE ≥ 2 R et R < 1 R ; **ΔR récupéré** = Σ (R variante − R V1) sur G ;
- groupe TOP « très gros gagnants » : les 36 meilleurs trades V1 (5 %) ; **ΔR sacrifié** = Σ (R variante − R V1) sur TOP ;
- ΔR total, nombre de trades dont la sortie change ; « conservé » = R variante ≥ 75 % du R V1 ;
- par actif (BTC, ETH) ; IC à 95 % par bootstrap des mois d'entrée (2 000 tirages).

**Rejeu complet du portefeuille** (entrées de V1 selon ses règles : une sortie plus tôt peut permettre d'autres
entrées) : Sharpe, CAGR, drawdown maximal, Calmar, Sortino, profit factor, nombre de trades, temps en position ;
Sharpe et CAGR par sleeve (BTC, ETH) ; Sharpe avec commissions doublées ; parmi les 36 meilleurs trades V1,
nombre retrouvés (même bougie d'entrée) avec R ≥ 75 % du R V1.

## 3. Contrôles statistiques

- ΔSharpe portefeuille et par sleeve : bootstrap par blocs mobiles circulaires de 21 jours sur les rendements
  journaliers appariés (2 000 tirages) ; p unilatéral = P(ΔSharpe ≤ 0) ; **Holm sur les 11 variantes**.
- CSCV-PBO sur les 12 configurations (V1 + 11), 16 blocs.
- Sharpe dégonflé : meilleure variante avec N = 233 essais (lignée de V1 ≥ 222 + 11) ; série de différence
  (variante − V1) avec N = 11.
- Walk-forward **rétrospectif** (recalage annuel au 1er janvier 2020 … 2026, choix au meilleur Sharpe passé
  parmi les 12) : rapporté à titre descriptif. Ce n'est **pas** une validation prospective indépendante : tout
  l'historique a déjà servi à concevoir V1.

## 4. Règle de décision

Une variante est **convaincante** si toutes les conditions suivantes sont remplies :
1. ΔSharpe portefeuille > 0 avec IC bootstrap à 95 % strictement positif et p Holm < 0,05 ;
2. ΔSharpe > 0 sur la sleeve BTC **et** sur la sleeve ETH ;
3. drawdown maximal pas plus mauvais de plus d'un point et Calmar ≥ V1 ;
4. au moins 30 des 36 meilleurs trades V1 conservés dans le rejeu complet ;
5. ΔSharpe > 0 avec commissions doublées ;
6. PBO de l'ensemble < 25 %.

Si plusieurs variantes sont convaincantes, on retient celle qui modifie le moins de sorties dans l'analyse
appariée. **Si aucune ne l'est, le trailing de 50 ATR de V1 est conservé.** Une variante retenue ne serait
qu'une candidate : son adoption demanderait une validation prospective séparée, sur le modèle de
`research/preregistration/e2-forward.md`.
