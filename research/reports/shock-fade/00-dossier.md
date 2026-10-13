# Shock Fade Engine — dossier de recherche

Merton (sauts) × Hawkes (intensité) × Ornstein-Uhlenbeck (transitoire latent) sur BTC et ETH, perpétuels
Binance USDⓈ-M, 2020-07 → 2026-09. Rédigé le 2026-10-13. Projet indépendant de Shock Engine V1 : aucun fichier de
V1, du bot ou du site n'a été modifié (empreintes vérifiées par `research/fade/tests/test_frozen_v1.py`).

> **Verdict.** Aucun alpha exploitable. Sur 6 357 chocs de 5 min (|Z| ≥ 4) en conception et 2 463 en holdout,
> le Fade n'a pas d'espérance brute positive (−4 à +1 pb selon l'horizon) et perd 13 à 18 pb par trade après
> des coûts de 14 pb aller-retour. Aucun des sept modèles, du Fade naïf à l'hybride complet, n'a de R² hors
> échantillon positif ni d'espérance nette positive en walk-forward, et le holdout le confirme. Le modèle
> « simple » à conserver est **l'absence de Fade** : le failed breakout n'a pas d'avantage non plus.
> Ce qui est statistiquement réel mais non rentable : Hawkes prévoit les nouveaux sauts bien mieux qu'un
> Poisson ; une composante transitoire existe, mais sa demi-vie est inférieure à une minute ; deux signaux
> conditionnels (dislocation perp–comptant, choc « sans volume ») vont dans le bon sens sans couvrir les coûts.

## Résumé des preuves

| Question | Réponse | Où |
|---|---|---|
| Le Fade après un choc a-t-il une espérance brute positive ? | Non : −3,0 pb à h = 4 (t = −2,2) sur E, −2,3 pb sur C ; aucun horizon ni aucune fréquence n'est positif de façon significative | [03](03-event-study.md), [07](07-holdout.md) |
| Après coûts ? | −13 à −18 pb par trade ; aucun niveau de frais ne le rend positif (brut ≤ 0) | [03](03-event-study.md) |
| Les « récupérations » prouvent-elles une réversion ? | Non : 67 % des chocs reprennent 50 % du mouvement, mais 64 % s'étendent aussi de 50 % | [03](03-event-study.md) § 4 |
| H1 failed breakout, H2 liquidité, H3 épuisement, H4 dislocation ? | Aucune ne survit à Holm (meilleure p ajustée 0,31) ; H2b et H4a gardent leur signe sur C, sans couvrir les coûts | [04](04-hypotheses.md), [07](07-holdout.md) (c) |
| Hawkes ajoute-t-il de l'information ? | Sur les **événements** oui (Brier ≪ Poisson, AUC 0,56–0,60) ; sur le **rendement** non | [04](04-hypotheses.md), [06](06-walkforward.md) |
| L'OU identifie-t-il un transitoire exploitable ? | Le transitoire identifié s'éteint en < 1 min ; à la décision, la réversion prévue dépasse 14 pb dans 0,5 % des chocs | [05](05-identifiability.md) |
| Le modèle hybride bat-il les règles simples ? | Non : R²_OOS ≤ 0 pour tous les modèles, aucun Clark–West significatif, aucune couche n'ajoute de P&L | [06](06-walkforward.md) |
| Le pipeline détecte-t-il une vraie réversion quand elle existe ? | Oui : contrôle positif simulé détecté (t ≈ 18), contrôle négatif muet | [02](02-synthetic-controls.md) |

## 1. Explication économique du Fade et des trois processus

Un Fade parie qu'une partie d'un mouvement brutal n'est pas de l'information mais de la pression temporaire
(ordres forcés, liquidations, carnet vidé) que des fournisseurs de liquidité finiront par absorber. Le prix
observé est décomposé en X_t = F_t + Q_t : F, la valeur « permanente », n'a pas de mémoire ; Q, l'écart
temporaire, revient vers zéro. Un Fade n'a d'espérance positive que si, au moment où l'on peut entrer,
Q est encore grand, revient assez vite et assez loin pour payer les coûts, **et** si le risque que le choc
se prolonge (nouveaux sauts dans le même sens) ne détruit pas ce gain. Le profil d'un Fade est celui d'une
vente d'option : beaucoup de petits gains, quelques grosses pertes quand le choc était de l'information ou
le début d'une cascade.

- **Merton** décrit F avec des sauts : il sert à dire si un mouvement est un saut statistique, de quelle
  taille, dans quel sens. Son intensité de Poisson constante est **remplacée par Hawkes**.
- **Hawkes** décrit le regroupement des sauts : chaque saut augmente la probabilité de sauts suivants, dans
  le même sens (cascade) ou en sens opposé (aller-retour). Il mesure le risque de continuation, pas le
  signe du rendement.
- **Ornstein-Uhlenbeck** décrit Q : vitesse de retour κ, demi-vie ln 2/κ, part transitoire d'un choc. Q n'est
  pas observé : il faut l'identifier, ici avec un modèle état-espace et le flux agresseur signé.

## 2. Équations effectivement implémentées

Détail complet et seuils : [protocole § 3–6](../../preregistration/shock-fade.md).

- Volatilité prévisible à 1 min : saisonnalité par créneau de 30 min sur les 60 jours précédents ;
  variation bipuissance des 360 minutes précédentes σ̂²_i = (1/(K−2)) Σ |r̃_j||r̃_{j−1}| ; v_i = (π/2)σ̂²_i s_i².
- Sauts (Lee–Mykland) : L_i = r̃_i/σ̂_i, saut si |L_i| > 5,777 (Gumbel, α = 1 %, n = 1 440). BNS journalier.
- Hawkes bivarié : λ_k(t) = μ_k + Σ_{τ_j<t} α_{k,s_j} e^{−β_{k,s_j}(t−τ_j)}, dix paramètres, MLE exacte,
  ρ(α/β) < 0,99, réestimé chaque trimestre sur 180 jours ; prévisions par simulation de Ogata.
- État-espace : x_i = F_i + Q_i + e_i, F_i = F_{i−1} + λ_F√v_i u_i + η^F_i, Q_i = φQ_{i−1} + λ_Q√v_i u_i + η^Q_i,
  variances proportionnelles à v_i et à L_i² aux minutes de saut (part transitoire des sauts ψ_J = σ²_QJ/(σ²_FJ + σ²_QJ)),
  u_i = flux agresseur signé normalisé ; filtre de Kalman, MLE ; réversion prévue ρ_h = d(φ − φ^{1+hΔ})Q̂_T.
- Choc : Z_t = R_t/σ_t^(Δ) avec σ connue avant la barre, |Z| ≥ 4 ; entrée une minute après la clôture.
- Modèles M1–M7 (régressions trimestrielles purgées) dont l'hybride
  Ê = (1 − p_same)·g₀ + p_same·g₁, g₀ et g₁ estimées sur les chocs sans et avec saut de continuation réalisé :
  la réversion OU et le risque Hawkes ne sont pas additionnés comme s'ils étaient indépendants.

## 3. Données : qualité et disponibilité

[01-data-quality.md](01-data-quality.md), [00-audit.md](00-audit.md). Bougies 1 min Binance USDⓈ-M et comptant
BTCUSDT/ETHUSDT 2020-01 → 2026-09 (3,55 M minutes par série, sommes SHA-256 vérifiées) : perpétuels complets
(≈ 0,01 % de minutes sans volume), comptant 99,93 % (pannes jusqu'à 6 h), base perp–comptant médiane de −5 à
+5 pb. Le flux signé vient du volume acheteur agresseur des bougies : c'est un proxy de l'order flow à la
minute, **pas** le carnet. Ni carnet complet, ni trades individuels, ni liquidations sur 2020–2026 ; le CVD du
Market Flow n'a que 35 jours d'historique. Les données du dépôt (15 min) étaient trop grossières pour les
sauts. Défauts du script Pine relevés à l'audit : conditions λ contradictoires qui bloquent le Fade, « VWAP »
qui est une SMA de hlc3, `fadeLong` qui n'est pas un failed breakout, Fade désactivé dans V1.

## 4. Identifiabilité des composantes latentes

[05-identifiability.md](05-identifiability.md).

- **Sauts** : 4 à 7 sauts « identifiés » par jour (taille médiane ≈ 5,8 écarts types diffusifs), des centaines
  de fois le taux de fausses détections d'une diffusion. Le test rejette la diffusion locale ; il ne prouve
  pas une discontinuité (une volatilité de quelques minutes donne le même signal).
- **Hawkes** : auto-excitation et excitation croisée massivement significatives (LR contre Poisson et contre
  deux Hawkes univariés) ; à la décision, l'intensité de continuation vaut 24 fois son niveau de base (7 fois
  deux barres plus tard). Mais le changement de temps hors échantillon rejette le modèle dans 49 % des
  trimestres : le taux de base n'est pas stable, les niveaux prévus sont biaisés vers le bas.
- **Transitoire** : la composante identifiée a une demi-vie de 0,25 à 0,9 minute, reprend 14–28 % de
  l'impact instantané du flux et 10–23 % des sauts (erreurs types faibles). Elle a disparu quand une entrée
  devient possible. Une composante lente (1–8 h) n'est pas exclue (profil de vraisemblance, ratios de
  variance VR(15–60) ≈ 0,87–0,93), mais le modèle à une composante ne la sépare pas de la rapide et ne
  permet pas d'en attribuer une part à un choc donné. σ_Q et σ_e ne sont pas séparément identifiés.
- **OU naïf sur le prix brut** : il « trouve » une demi-vie médiane de 197 min, comme il en trouve une sur
  une marche aléatoire simulée (biais de Dickey–Fuller) ; il n'a aucun pouvoir prédictif hors échantillon.

## 5. Étude d'événements BTC/ETH

[03-event-study.md](03-event-study.md) (E : 2020-07 → 2024-12), [07-holdout.md](07-holdout.md) (C).

| h (barres de 5 min) | 1 | 2 | 4 | 8 | 16 | 32 |
|---|---:|---:|---:|---:|---:|---:|
| Fade brut moyen, E (pb) | +1,0 | −1,1 | −3,0 | −3,0 | −1,6 | −0,4 |
| Fade brut moyen, C (pb) | −1,2 | −2,1 | −2,3 | −3,6 | −3,8 | −4,0 |
| Fade net C1, E (pb) | −13,0 | −15,1 | −17,0 | −17,0 | −15,6 | −14,4 |
| P(gain), E | 53 % | 52 % | 53 % | 53 % | 54 % | 53 % |
| 1er centile, E (pb) | −165 | −211 | −299 | −356 | −442 | −478 |
| MFE / MAE médianes, E (pb) | 18 / 19 | 23 / 26 | 29 / 35 | 37 / 45 | 49 / 58 | 64 / 73 |
| P(saut de continuation), réalisé E | 18 % | 23 % | 28 % | 33 % | 38 % | 44 % |

- 6 357 chocs |Z| ≥ 4 sur E (≈ 2 par jour et par actif ; mouvement médian 67 pb BTC, 84 pb ETH), dont 77 %
  contiennent un saut identifié et 4 % seulement sont des failed breakouts.
- Taux de gain > 50 %, médiane positive, moyenne négative : l'asymétrie typique d'un Fade structurellement
  perdant. L'excursion adverse médiane dépasse l'excursion favorable à tous les horizons.
- Asymétrie de sens, sur E comme sur C : les chocs haussiers se prolongent (Fade short jusqu'à −11 pb sur E, jusqu'à −8 pb sur C), les
  baissiers sont neutres. Aucun sens n'offre d'avantage au Fade.
- Régimes de volatilité, sessions, années, chocs avec ou sans saut identifié : aucun groupe n'a de moyenne
  nette positive ; seuls quelques groupes ont un brut faiblement positif (soir UTC, chocs baissiers à h = 16),
  sans significativité.

## 6. Résultats prédictifs des modèles individuels et hybrides

[06-walkforward.md](06-walkforward.md) (V : 2021-07 → 2024-12), [07-holdout.md](07-holdout.md) (b).

- Fade naïf (M1) : l'espérance estimée est toujours sous le coût ; il ne prend aucun trade.
- R²_OOS contre M1 à 5 min : de −2,1 % à −0,06 % pour M2…M7 ; meilleure p de Clark–West brute 0,031 (M6, h = 16),
  1,0 après Holm. Aucune couche n'ajoute de P&L (différences hebdomadaires M7−M2, M6−M5, M5−M3, M5−M4 :
  tous les IC à 95 % contiennent 0). Aucun candidat, aucun score de recherche.
- Hawkes seul est le seul composant au pouvoir prédictif démontré, mais **sur les événements** : P(nouveau saut
  dans le sens du choc) mieux prévue que Poisson (gain de Brier +0,02 à +0,05, Holm p < 10⁻¹⁹), AUC 0,56–0,60 ;
  il fait moins bien que la simple fréquence passée parce qu'il sous-estime le niveau (20 % prévu contre 28 %
  réalisé à 20 min). Cette information ne se traduit pas en rendement de Fade.
- Holdout C : mêmes conclusions (R²_OOS ≈ 0, aucun candidat, les rares trades des modèles sont du bruit).

## 7. Backtest après coûts

**Non produit**, comme le prévoit le protocole : il est réservé à un signal qui passe les critères de
validation, et aucun n'y parvient. Sensibilité aux coûts au niveau des événements : le Fade inconditionnel
a un brut ≤ 0, donc **aucun niveau de frais**, même maker (4 pb aller-retour), ne le rend positif. Les groupes
conditionnels les plus favorables ont un brut de +1 à +17 pb (H4a, H2b, H1b) : sous les 14 pb taker, au-dessus
des 4 pb maker, mais avec des remplissages limites non garantis et probablement adversement sélectionnés
(non mesurable avec des bougies). Une entrée sans latence n'ajoute que ≈ 1,5 pb.

## 8. Robustesse et résultats négatifs (conservés)

- Seuil du choc k = 3 / 4 / 5, fréquence 15 min, entrée sans latence : aucun cas d'espérance nette positive.
- H1 (failed breakout) : différence brute −4 à +11 pb, jamais significative ; H1b (cassure puis retour) :
  brut +2 à +12 pb, net négatif. H2a (déséquilibre agresseur) : aucun effet. H3b (épuisement Hawkes) : +2 à
  +5 pb bruts, non significatif — une intensité qui retombe ne prédit pas de réversion utile.
- H2b (choc sans volume) : +14 pb bruts à h = 4 sur E (p brut 0,010, Holm 0,31) ; +5,7 pb sur C (exploratoire).
  H4a (le perpétuel dépasse le comptant) : +4 à +10 pb sur E, +5 à +24 pb sur C (h = 32 : p brut 0,006,
  groupe favorable +17 pb bruts, net +3 pb [−11 ; +18]). Même signe deux fois, aucun test confirmatoire.
- Contrôles simulés : négatif muet (Holm min 0,81), positif détecté (ψ_J estimé 0,65 pour 0,40 vrai, demi-vie
  15 min pour 10 : biaisé mais détecté). Le contrôle naïf a « réussi » sur une graine sur trois d'une marche
  aléatoire : un test isolé non corrigé n'est pas une preuve.
- Essais réalisés : 2 fréquences × 7 modèles × 6 horizons + contrôle (96 couples), 5 hypothèses × 6 horizons ×
  2 statistiques, H3a sur 12 comparaisons ; tout est au [journal des essais](trial-log.md).

## 9. Recommandation

1. **Ne pas intégrer** le Shock Fade Engine à ShadowMarketPro, ni en live, ni en shadow, ni sur le site. Les
   chiffres de ce dossier ne doivent pas être présentés comme une stratégie.
2. **Ne pas réactiver le Fade de V1** (`directionalOnly = false`) : son équivalent propre (Fade naïf, failed
   breakout, entrée réaliste) est perdant après coûts sur 2020–2026 et sur le holdout.
3. **Garder les outils**, pas la stratégie : les données 1 min vérifiées, le test de sauts, le Hawkes et
   l'état-espace sont réutilisables. Le Hawkes mesure bien le **risque de cascade** (à recalibrer en niveau) ;
   il pourrait servir d'indicateur descriptif de risque, à valider séparément.
4. **Une seule piste mérite éventuellement une suite**, et seulement comme nouvelle étude pré-enregistrée sur
   une fenêtre forward : H4a (dislocation perp–comptant), avec exécution maker et données de trades et de
   carnet (aggTrades, bookDepth) pour mesurer les remplissages. Sans ces données, on ne peut pas savoir si les
   +10–17 pb bruts survivent à l'exécution. Une composante transitoire lente demanderait un modèle à deux
   transitoires, non testé ici.
5. Pour V1 (aucun changement) : la persistance des chocs haussiers est cohérente avec sa logique de
   continuation, mais c'est une observation descriptive, pas une validation supplémentaire.

## Méthode et traçabilité

- Protocole figé et commité avant tout calcul de résultat (`3de57f1`), avenant 1 commité avec le verdict de V
  avant l'ouverture de C (`d323780`).
- Walk-forward trimestriel purgé, paramètres structurels estimés sur les 180 jours précédant chaque trimestre,
  terciles calculés sur les chocs passés, filtrage de Kalman sans lissage, tests de non-fuite par troncature.
- Erreurs groupées par jour, bootstrap par blocs de 4 semaines, Holm (et BH) par famille, Clark–West.
- Limites : flux agrégé à la minute (pas le carnet) ; une seule place (Binance) alors que le bot exécute sur
  Hyperliquid (écart de prix médian de 1,5 à 3 pb, `research/reports/execution/binance-l2-vs-hl.md`) ; coûts de 7 pb par exécution fixes ; latence d'une minute ;
  Hawkes à taux de base constant ; filtre de Kalman gaussien ; calibrations linéaires.

## Fichiers

| Fichier | Contenu |
|---|---|
| [00-audit.md](00-audit.md) | audit du dépôt, logique Pine du Fade, architecture |
| [01-data-quality.md](01-data-quality.md) · [data-manifest.json](data-manifest.json) | qualité et provenance des données |
| [02-synthetic-controls.md](02-synthetic-controls.md) | contrôles négatif et positif du pipeline |
| [03-event-study.md](03-event-study.md) | étude d'événements (E) |
| [04-hypotheses.md](04-hypotheses.md) | H1–H4 testées séparément |
| [05-identifiability.md](05-identifiability.md) | Hawkes, état-espace, profil de vraisemblance, ratios de variance |
| [06-walkforward.md](06-walkforward.md) | modèles M1–M7 sur V, critères, sélection |
| [07-holdout.md](07-holdout.md) | holdout C |
| [trial-log.md](trial-log.md) | journal des essais |
| [`research/fade/`](../../fade/README.md) | code, tests, commandes pour tout reproduire |
