# Pré-enregistrement — validation forward de E2 sur BTC/ETH

Rédigé le 2026-10-08 et commité, avec le script d'évaluation `research/shock/e2-forward.ts`, **avant
le début de la fenêtre forward** (2026-10-12T00:00:00Z) : à la date du commit, aucune donnée de cette
fenêtre n'existe. Le commit qui ajoute ce fichier fait foi.

## 0. Ce qui ne change pas

- **La stratégie v1 reste figée.** Aucun fichier de `lib/strategies/shock/` n'est modifié (empreintes
  ci-dessous, vérifiées à chaque évaluation).
- **E2 est seulement un challenger en shadow.** Aucun signal live n'est ajouté, retiré ou redimensionné
  à cause de E2. Le bot (`bot/`) n'est pas modifié et ne lit rien de cette étude.
- **L'évaluation est hors ligne** (`research/`) : elle rejoue la v1 sur les nouvelles données de
  marché et note, pour chaque short, si le régime E2 était baissier à l'entrée.
- Le résultat, quel qu'il soit, ne change pas la v1 automatiquement. Si H1 est confirmée, E2 devient
  seulement une candidate ; tout changement du live demanderait une décision et un plan séparés.

| Fichier figé | SHA-256 |
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

## 1. Hypothèse

```
H1 : E[R_short | E2 = baissier] > E[R_short | E2 = non baissier]
H0 : E[R_short | E2 = baissier] ≤ E[R_short | E2 = non baissier]
```

Contexte : E2 a été retenue après avoir vu BTC et ETH 2017–2026 (étude des shorts, avenant
`research/reports/short-entry-study/short-entry-btc-eth.md`). L'historique ne peut donc pas la
valider ; cette fenêtre forward est le seul test valide.

## 2. Définitions (figées)

- **Shorts** : les positions short de la v1, exactement les sleeves du produit
  (`research/lib/frozen-shock.ts`) :
  - BTC/USD Bitstamp et ETH/USDT Binance, bougies 15 min ;
  - préréglage adaptatif 15 min ;
  - commission 0,045 % par ordre, glissement nul, capital 10 000, 100 % de l'equity, sans levier.
- **Fenêtre forward** : shorts dont la bougie d'entrée ouvre au plus tôt le **2026-10-12T00:00:00Z**.
  Seules les positions **fermées** par une vraie sortie (stop, trailing, TP1, flip, VWAP…) comptent.
  Une position encore ouverte à la date de coupure sera comptée à une évaluation suivante.
- **E2 à l'entrée** : le régime de tendance de `classify` (`lib/strategies/shock/regimes.ts`) est
  « baissier » pour le dernier jour UTC clos avant la clôture de la bougie d'entrée, c'est-à-dire :
  - clôture journalière < moyenne simple 50 jours des clôtures ;
  - et cette moyenne < sa valeur 10 jours plus tôt.

  Source journalière : celle du régime de la v1 (BTC : barres Bitstamp 60 min regroupées par jour ;
  ETH : barres Binance 15 min regroupées par jour). Aucun réglage de E2 ne peut changer.
- **R** = (PnL net / equity à l'entrée) / σ_d, où σ_d est l'écart type (population) des 30
  rendements log journaliers (clôtures UTC) qui précèdent le jour de l'entrée. Le funding n'est pas
  modélisé (données au comptant).

## 3. Test

- **Statistique** : `D = moyenne de R des shorts E2 = baissier − moyenne de R des shorts E2 = non
  baissier`, BTC et ETH mis en commun (poids 1 par short).
- **Inférence** :
  - bootstrap par mois civils de la fenêtre forward, avec les mêmes mois tirés pour les deux
    groupes et les deux actifs ;
  - 10 000 réplications, graine 20261012 ;
  - `p = part des réplications où D* ≤ 0` ; une réplication où un groupe est vide est écartée.
- **Regards** (`N1` = shorts E2 = baissier fermés, `N0` = shorts E2 = non baissier fermés) :
  - **intermédiaires** : à la première évaluation où `N1` atteint 25, puis 50, puis 75. H0 est
    rejetée si p < 0,001 (règle de Haybittle–Peto). Un seul regard par évaluation, même si plusieurs
    seuils sont franchis d'un coup ;
  - **final** : à la première évaluation où `N1 ≥ 100` **et** `N0 ≥ 100`. H0 est rejetée si
    p < 0,047. Si ce point n'est pas atteint à la coupure du 2031-10-01 ou après, le regard final a
    lieu à cette évaluation-là, avec le même seuil ;
  - risque d'erreur total ≤ 0,05 (3 × 0,001 + 0,047).
- **Conclusions possibles** :
  - **« H1 confirmée »** si H0 est rejetée à un regard ;
  - **« H1 non confirmée »** au regard final sinon, avec la mention « sens inverse » si D < 0 ;
  - **« en cours »** avant cela.
- **Après la conclusion** : les évaluations suivantes sont seulement descriptives.

## 4. Puissance (indicative)

Avec un écart type de R d'environ 1,85 (shorts de la v1 sur BTC et ETH, historique) et un test
unilatéral au seuil 0,047, au regard final :

| Écart réel D | N1 = 100, N0 = 200 | N1 = N0 = 100 |
|---|---|---|
| 0,2 σ | 21 % | 18 % |
| 0,3 σ | 36 % | 30 % |
| 0,4 σ | 54 % | 44 % |

Ces chiffres ignorent la corrélation des shorts d'un même mois, qui réduit encore la puissance.

- **Durée** : la v1 fait environ 89 shorts par an sur BTC + ETH, dont environ un tiers en régime E2
  baissier historiquement. `N1 = 100` demanderait donc environ 3 ans, moins en marché baissier
  prolongé, beaucoup plus en marché haussier.
- **Interprétation** : un résultat « non confirmée » voudra souvent dire « pas assez de données »
  plutôt que « E2 ne marche pas ». Ce plan l'accepte : il privilégie un test propre à un test rapide.

## 5. Calendrier et procédure

1. **Fréquence** : une évaluation après chaque mois civil complet couvert par les deux sources.
2. **Mise à jour des données** :
   - BTC : historique Bitstamp de
     <https://github.com/ff137/bitstamp-btcusd-minute-data>, puis `research/data/build-btc.ts` ;
   - ETH : archives mensuelles Binance, `python3 research/data/fetch-binance.py ETHUSDT 2017-08 AAAA-MM
     --out research/data/ethusdt_15m.csv.gz`.
3. **Évaluation** : `node research/shock/e2-forward.ts`, puis commit des données, du rapport et de
   `research/reports/e2-forward/state.json`.
4. **Coupure** : premier jour du mois qui suit le dernier mois complet couvert par les deux fichiers.
   La simulation s'arrête à la dernière bougie avant la coupure.
5. **Contenu des rapports mensuels** : nombres de shorts et moyennes descriptives. La valeur de p
   n'est calculée qu'aux regards prévus au § 3.

## 6. Contrôles bloquants (à chaque évaluation)

Si l'un échoue, aucun test n'est calculé ; le problème et sa correction sont consignés comme écart.

1. Les empreintes des fichiers figés sont identiques au § 0.
2. **Base historique** : tous les trades de la v1 (BTC et ETH) fermés avant le 2026-10-01 sont
   identiques à l'instantané `research/reports/e2-forward/baseline.json` pris au lancement. Ce contrôle
   détecte une révision des données passées.
3. Les shorts forward déjà rapportés par l'évaluation précédente sont reproduits à l'identique.
4. **Anti-look-ahead de E2** :
   - pour chaque short forward, E2 recalculé sur un historique coupé à la bougie d'entrée est
     identique à la valeur utilisée ;
   - même vérification sur 100 bougies historiques tirées au hasard par actif.
5. Le régime recalculé est identique à celui du moteur.
6. Données : horodatages sur la grille 15 min, croissants. Les trous sont rapportés.

## 7. Mesures secondaires (descriptives, hors décision)

- Moyennes de R par groupe et par actif ; part des shorts en régime E2 baissier.
- **Challenger en shadow** : la v1 dont les shorts de la fenêtre forward sont limités au régime E2
  baissier. Rendement de chaque sleeve et du 50/50 sur la fenêtre forward, comparé à la v1.
  Descriptif seulement.
- **Référence historique** (données déjà vues, hors décision) : D sur les shorts de la v1 entrés avant
  le 2026-10-12.

## 8. Interdits et écarts

Sont interdits pendant toute la durée de l'étude :

- changer E2 : longueur de la moyenne, pente, source journalière ;
- changer R, la statistique, le bootstrap, les regards, les seuils, la date de début ou les actifs ;
- ajouter un actif ;
- utiliser un résultat forward pour retoucher E2 ;
- modifier le live à cause de E2.

Tout écart (correction d'un bogue, donnée défectueuse) est consigné dans le rapport avec sa raison.
