# Additif — étude sur substituts Dukascopy (XAU/USD comptant pour GC, CFD USATECH.IDX/USD pour NQ)

Rédigé le 2026-10-20 à la demande explicite du propriétaire (« fais avec ça » : données gratuites
Dukascopy, sans clé d'API), après le protocole `futures-k-transfer.md` (commit `c7de6ab`), et commité
**avant tout calcul de l'étude sur ces données**. Tout ce que ce texte ne change pas reste celui du
protocole.

**Déjà regardé avant ce texte.** (1) Pour le CFD Nasdaq : la présence de données à quelques dates et
l'échelle des prix (2010-03-03 : aucune donnée ; 2012-03-06 : 393 minutes actives sur 1 440, ouverture
2 614,92 ; 2013-03-05 : 391 minutes ; 2014-03-04 : 1 350 minutes ; 2026-09-29 : 1 335 minutes). Aucun
rendement après événement, aucune simulation. (2) Pour l'or comptant : l'étude zéro-shot existante,
déjà décrite au § 0 du protocole (étude non aveugle).

## 1. Données

- **Or** : `research/data/xauusd_15m.csv.gz` (Dukascopy XAU/USD, prix acheteur, déjà dans le dépôt,
  bougies de 2012-01-01 à 2026-09-30), pas de prix 0,01 (comme `zero-shot.ts`).
- **Nasdaq** : `research/data/usatechidxusd_15m.csv.gz`, construit par
  `python3 research/data/fetch-dukascopy.py USATECHIDXUSD 2012-01-01 2026-10-01` (prix acheteur,
  minutes sans transaction ignorées, échelle 1 000), commité comme les autres fichiers Dukascopy du
  dépôt ; pas de prix = plus petit écart de prix observé (il ne sert qu'au plancher de l'étendue d'une
  bougie dans V1).
- Partout : étiquette **« substitut, pas des futures »**. Ni roulement ni ajustement (prix continus).
  Le mode de construction du CFD (indice au comptant ou dérivé des futures) n'est pas documenté ici :
  les plus forts mouvements sont listés par l'audit, aucun n'est corrigé.
- **Début de couverture continue** D_ext : premier jour de la première suite de 20 séances
  consécutives (18 h → 17 h, heure de New York) ayant chacune au moins 80 % de leurs bougies prévues.
  Aucune bougie antérieure à D_ext n'est utilisée, même pour le préchauffage (le CFD Nasdaq ne couvre
  que la séance au comptant en 2012 – 2013).
- **Contrôles bloquants** : ceux du § 1 du protocole, sur la période d'évaluation, avec deux seuils
  adaptés aux substituts, fixés ici avant tout calcul : bougies manquantes **< 2 %** par an (au lieu de
  1 % : Dukascopy omet les quarts d'heure sans tick, et les clôtures anticipées des jours fériés
  américains pèsent à elles seules environ 0,7 %) ; au plus **25** trous imprévus de plus de 60 min par
  an (au lieu de 10 : une dizaine de clôtures anticipées par an créent des trous de 4 à 5 h). Mauvais
  ticks : au plus 20, inchangé. Un contrôle en échec donne la conclusion D pour ce substitut.
- Volume : volume de ticks Dukascopy, utilisé tel quel par les filtres de V1 (limite déclarée).

## 2. Périodes

- Préchauffage : 12 mois à partir de D_ext. E0 = premier 1er janvier au moins 12 mois après D_ext.
- Validation (walk-forward, méthodes A et B) : années civiles de max(2015, année(E0) + 2) à 2022, pour
  garder au moins deux ans d'entraînement au premier pli.
- Test final : 2023-01-01 → 2026-09-30, inchangé, exécuté une seule fois après le commit des
  résultats de développement (empreinte SHA-256 du fichier privé de développement inscrite dans le
  rapport public commité ; l'étape finale refuse de tourner si elle ne correspond pas).
- Étude d'événement au seuil figé : de E0 au 2026-09-30 (§ 3 du protocole).

## 3. Coûts

Scénarios du § 7 du protocole (frais par contrat et glissement en pas de GC ou NQ), appliqués au prix
du substitut comme s'il s'agissait du prix du future : la question économique reste celle d'un trading
de GC ou NQ. Aucun scénario de coûts CFD n'est évalué.

## 4. Conclusions

- Les conclusions A, B, C, D du § 8 sont rendues **pour le substitut** (« A (substitut) », etc.).
- La conclusion sur les futures GC et NQ reste **D** tant que l'étude n'a pas été refaite sur des
  futures. Une conclusion A sur un substitut n'est ni une validation sur futures ni une recommandation
  d'usage réel.
- Holm sur 2 marchés × 2 méthodes (C4) et Sharpe dégonflé avec N_eff + 1 (C7), inchangés.

## 5. Interdits

Ceux du § 11 du protocole, plus : changer D_ext, les seuils de contrôle des données, les périodes ou
l'étiquetage après avoir vu un résultat de l'étude ; évaluer un autre substitut (QQQ, autre CFD, autre
source) dans cette étude.
