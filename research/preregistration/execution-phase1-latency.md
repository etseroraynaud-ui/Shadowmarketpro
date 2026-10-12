# Pré-enregistrement — étude d'exécution, phase 1 : coût de la latence aux instants de signal

Rédigé le 2026-10-12 et commité **avant** tout téléchargement et tout calcul. Les signaux, la logique
prédictive et les paramètres du Shock Engine ne sont pas modifiés ; seule l'exécution est étudiée.

## 1. Question

Le bot envoie aujourd'hui ses ordres environ 5 s après la clôture de la bougie (mesure sur le
testnet : entrée à T + 5,01 s, stop à T + 4,79 s). Combien coûte, en points de base, chaque seconde
écoulée entre la clôture T et l'arrivée de l'ordre, **aux instants réels des exécutions du Shock
Engine** (et non à des instants quelconques) ?

Motif : la variante exploratoire « 2 s » de l'étude de capacité (`research/capacity/capacity.ts`,
`LATENCY_2S`) utilise la dérive à 2 s mesurée à des **instants aléatoires**
(`p1-pilot-random.json`), alors que le pilote pré-enregistré mesure, aux instants de signal, une
dérive bien plus forte dès 10 s. Cette variante mélange donc deux changements : un délai plus court
et une hypothèse de dérive moins défavorable. La présente mesure les sépare.

## 2. Échantillon

- Population : exécutions à la clôture du portefeuille E2 dans la fenêtre Binance
  (`research/data/binance/derived/events.json`, 2020-01 → 2026-09) : entrées (541 BTC, 556 ETH) et
  fermetures au marché à la clôture (FLIP : 103 BTC, 118 ETH).
- Tirage aléatoire simple sans remise, graine 20261013 : **40 entrées et 15 fermetures FLIP par
  actif** (110 exécutions). Aucune stratification sur le résultat du trade (le pilote P1, qui
  sur-représente les 5 % meilleurs trades, ne donne pas une moyenne de population).

## 3. Données

- Fichiers quotidiens `aggTrades` des perpétuels USDⓈ-M Binance (`data.binance.vision`), somme
  SHA-256 vérifiée, fenêtre [T − 60 s ; T + 60 s] ; fichiers supprimés après lecture. Intégrité
  rapportée (trous d'identifiants, désordre).
- Binance sert ici de marché de référence historique : le bot exécute sur Hyperliquid, dont
  l'historique à la milliseconde n'est pas disponible gratuitement. L'écart entre les deux marchés
  autour des clôtures sera mesuré prospectivement (sonde `research/execution/close-probe.ts`).

## 4. Mesures

- P₀ : prix de la dernière transaction strictement avant T.
- Pour x ∈ {0,25 ; 0,5 ; 1 ; 2 ; 3 ; 4 ; 5 ; 7 ; 10 ; 15 ; 30} s : dérive dans le sens de
  l'exécution d(x) = sens × (p(T + x) / P₀ − 1), p(T + x) étant le prix de la dernière transaction à
  T + x au plus tard. Positif = défavorable (prix parti dans le sens de l'ordre).
- Statistiques par actif et par famille (entrée, FLIP) : moyenne, médiane, intervalle de confiance à
  95 % par bootstrap des exécutions (2 000 tirages, graine 20261013).
- **Coût marginal de la latence**, apparié sur les mêmes exécutions : Δ(a → b) = d(b) − d(a) pour
  (a, b) ∈ {(0,5 ; 5), (1 ; 5), (2 ; 5), (0,5 ; 2)} s, moyenne et intervalle bootstrap.
- Régimes de volatilité : σ₆₀ (volatilité réalisée des 60 minutes avant T, déjà calculée sans
  information future dans `events.json`), terciles fixés **sur toute la population** de l'actif
  (entrées et FLIP), pas sur l'échantillon. Résultats par tercile indicatifs (≈ 18 exécutions).

## 5. Usage

- Uniquement la valorisation de la latence : composante « délai » de la référence réaliste du bot
  actuel (niveau 1) et du gain d'ingénierie (niveau 2). Aucun paramètre de la stratégie ni de
  l'exécution n'est choisi d'après ces résultats.
- La variante « 2 s » de l'étude de capacité sera recalculée avec la dérive mesurée ici aux
  instants de signal, et présentée à côté de la version d'origine, sans la remplacer.

## 6. Limites annoncées

- Marché de référence Binance, pas Hyperliquid.
- 40 entrées par actif : intervalles larges, surtout par tercile.
- Dernier prix échangé, pas le carnet : le rebond entre achat et vente est négligeable sur ces
  marchés (demi-spread effectif médian ≈ 0,01 pb BTC et 0,03 pb ETH, `p1-pilot.json`), mais il
  n'est pas retiré.

## 7. Écarts

Toute modification après lecture des données est signalée comme écart dans le rapport.
