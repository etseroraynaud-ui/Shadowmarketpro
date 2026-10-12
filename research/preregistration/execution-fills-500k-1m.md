# Pré-enregistrement — exécutabilité des ordres du Shock Engine à 500 k$ et 1 M$

Rédigé le 2026-10-12 et commité **avant** tout téléchargement et tout calcul sur les exécutions.
Seul un contrôle de faisabilité a été fait au préalable, sur deux jours sans rapport avec les signaux
(BTC 2024-06-12, ETH 2021-02-03) : fréquence des ordres agresseurs de 250 k$ et plus. Signaux,
logique prédictive et paramètres du Shock Engine inchangés.

## 1. Question

Pour un capital de 500 k$ puis 1 M$, combien des entrées et sorties du portefeuille E2 auraient été
**intégralement exécutables**, à quel prix et dans quel délai, d'après la liquidité historique
réellement observable ? Avec ces exécutions : distributions des coûts (P50, P95, P99), taux de
remplissage, puis Sharpe, CAGR, Sortino et drawdown recalculés, pour le bot actuel et pour une
version optimisée, mêmes signaux.

## 2. Marché observable et marché d'exécution

- **Démonstration sur Binance USDⓈ-M** (BTCUSDT, ETHUSDT), seul marché dont l'historique public
  gratuit permet de voir des exécutions réelles à la milliseconde (`aggTrades`, toutes les
  transactions) et la profondeur agrégée (`bookDepth`, ± 1 % à ± 5 %, environ toutes les 30 s
  depuis 2023).
- **Hyperliquid** (marché du bot) : pas d'historique gratuit du carnet ni des transactions à la
  milliseconde. Résultats donnés seulement comme **bornes conditionnelles** (§ 7), avec la liste
  précise de ce qui manque.

## 3. Population et tailles

- Toutes les exécutions du portefeuille E2 dans la fenêtre Binance (2020-01 → 2026-09) relevées par
  l'étude de capacité (`events.json` : entrées, fermetures FLIP, stops et stops suiveurs, TP1).
- Taille d'un ordre : Q = part exécutée × A / 2 (une sleeve sur deux), A ∈ {500 k$ ; 1 M$}, comme
  l'étude de capacité. Pour les bornes Hyperliquid : Q ∈ {250 k$ ; 500 k$ ; 1 M$ ; 2 M$}.

## 4. Mesures, exécution par exécution (transactions Binance)

- **Référence** : entrées et FLIP, dernier prix avant la clôture T ; stops et TP1, niveau converti
  sur Binance (`events.json`), heure de franchissement = première transaction au niveau ou au-delà
  dans la minute repérée (à défaut, la minute elle-même, signalée).
- **Heure d'arrivée** de l'ordre t_a = référence + latence L (§ 5).
- **Prix d'arrivée** : dernier prix échangé à t_a, plus le demi-spread effectif de l'exécution
  (médiane des secondes avec achats et ventes agresseurs dans les 30 min avant, comme le pilote P1).
- **Coût immédiat de Q au-delà du meilleur prix**, observé : les ordres agresseurs réels sont
  reconstitués (transactions agrégées de même milliseconde et de même côté) dans
  [t_a − 120 s ; t_a + 120 s], du même côté que notre ordre ; pour chaque ordre réel de taille ≥ Q,
  coût des Q premiers dollars par rapport à son premier prix. Coût retenu : la médiane. S'il n'y en a
  aucun : coût **estimé** par un modèle calibré sur les exécutions observées du même actif,
  log coût = a + b log Q + c log σ₆₀ + d log V₂₄, et signalé comme estimé.
- **Exécutable intégralement dans la limite du bot** (± 0,5 % du prix de référence de l'ordre) :
  (i) preuve par les ordres réels : le Q-ième dollar d'un ordre réel de taille ≥ Q est resté à moins
  de 50 pb de son premier prix ; (ii) depuis 2023, profondeur `bookDepth` à ± 1 % du côté consommé
  ≥ Q au dernier relevé avant t_a (borne : exécutable à moins de 1 %). Une exécution sans preuve est
  comptée « non démontrée », jamais « exécutable ».
- **Délai** : ordre immédiat, exécuté à l'arrivée ; délai = L. Un ordre non exécutable en une fois
  est signalé avec le délai jusqu'au premier ordre réel de taille ≥ Q.
- **TP1** (ordre limite au repos) : rempli dans la bougie du contact seulement si une transaction a
  lieu strictement au-delà du niveau (le niveau est alors épuisé, notre ordre compris) ; sinon, non
  rempli (borne basse ; le backtest le remplit au simple contact). La quantité non remplie reste dans
  la position et sort avec elle : **rejeu exact** du moteur (signaux inchangés, la décision ne
  dépend pas de la taille de la position). Frais maker du TP1 rempli.
- Coûts appliqués : coût d'exécution mesuré (dérive + demi-spread + coût immédiat) en plus des frais
  du backtest, comme l'étude de capacité ; correction des frais (maker du TP1, palier taker selon le
  volume sur 14 jours) donnée **séparément**.

## 5. Versions comparées (mêmes signaux)

| | Entrées et FLIP | Stops | TP1 |
|---|---|---|---|
| **Bot actuel** | IOC à T + 5 s (mesuré sur le bot réel) | stop natif déclenché sur le prix mark : arrivée au franchissement + 3 s (hypothèse : mise à jour du mark ≈ 3 s, non mesurable historiquement) | limite au repos |
| **Bot optimisé** | IOC à T + 0,5 s (cible de la réduction de latence depuis l'Europe) ; sensibilité 1 s | stop géré sur le dernier prix : franchissement + 0,5 s ; sensibilité : stop natif + 3 s conservé | limite au repos |

## 6. Statistiques et portefeuille

- Par actif, famille, version et capital : P50, P95, P99 du coût (pb), part exécutable démontrée,
  part estimée, délai.
- Portefeuille : coûts appliqués exécution par exécution (`research/capacity/lib.ts`, `netDaily`) sur
  le rejeu du moteur avec la règle TP1 ; Sharpe, CAGR, Sortino, drawdown maximal ; intervalles par
  bootstrap des mois (2 000 tirages, graine 20261012) ; écart apparié actuel → optimisé.
- Décomposition : backtest → bot actuel (correction des hypothèses) → bot optimisé (gain
  d'exécution), et effet séparé des frais et du TP1.

## 7. Hyperliquid : bornes conditionnelles

Coût sur Hyperliquid = dérive mesurée sur Binance (même délai) + coût immédiat d'un ordre Binance de
taille Q / ρ, ρ = profondeur Hyperliquid / profondeur Binance au même instant, ρ ∈ {1 ; 0,5 ; 0,25}.
Ni ρ aux instants de choc, ni l'écart de prix entre les deux marchés, ni le prix mark historique ne
sont observables gratuitement : ce sont les données manquantes, mesurables à partir de maintenant
par la sonde de clôture et sur le serveur du bot.

## 8. Écarts

Toute modification après lecture des données est signalée comme écart dans le rapport.
