# Pré-enregistrement — Shock Fade Engine (Merton × Hawkes × Ornstein-Uhlenbeck)

Rédigé le 2026-10-13 et commité **avant tout calcul d'un rendement postérieur à un choc** sur les
données de ce projet. Le commit qui ajoute ce fichier fait foi. Code : `research/fade/` ; sorties :
`research/reports/shock-fade/` ; audit préalable : `research/reports/shock-fade/00-audit.md`.

**Ce qui était connu au moment de la rédaction.**
- Le diagnostic BTC 15 min de V1 (`research/reports/shock-15m-diagnostic.md`) : le Fade du script
  perd (−94 % « Fade seulement », −0,028 % par position, coûts du script) tout en battant 95–97 % des
  tirages d'entrées au hasard ; trajectoire moyenne après les signaux de continuation de V1.
- Sur les nouvelles données (bougies 1 min Binance 2020-01 → 2026-09), **seul** le diagnostic de
  qualité a été calculé (`01-data-quality.md`) : couverture, trous, volumes, base perp–comptant,
  financement. Aucun rendement futur, aucun choc, aucun saut, aucun paramètre n'a été estimé.
- Connaissances générales : légère autocorrélation négative des rendements crypto à très court
  terme, mèches de liquidation qui se résorbent souvent (anecdotique), coûts taker 4,5–5 pb.
- A priori déclaré : une réversion brute après les chocs est plausible, mais petite devant des coûts
  aller-retour de ≈ 14 pb ; le résultat nul est un résultat attendu et sera publié comme tel.

## 0. Ce qui ne change pas

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/`, de `research/shock/`, du bot (`bot/`)
  ni du site (`app/`, `public/`, `lib/research/`) n'est modifié. Un test vérifie les empreintes
  SHA-256 de `research/preregistration/e2-forward.md` § 0 et de `research/lib/{frozen-shock,e2,calm-only}.ts`.
- Le Shock Fade Engine est un projet de recherche. Aucun signal n'est transmis au bot. Un passage en
  shadow ou en live demanderait un accord explicite et un plan séparé.

## 1. Question

Parmi les chocs de prix de BTC et ETH (perpétuels USDⓈ-M), peut-on distinguer, **avec l'information
disponible au moment où l'entrée devient exécutable**, ceux dont l'impact est principalement
transitoire, au point qu'un Fade ait une espérance positive **après coûts**, hors échantillon ? Et la
combinaison Merton (sauts) × Hawkes (intensité) × OU (transitoire) fait-elle mieux que des règles
simples (Fade naïf, Fade après failed breakout) ?

## 2. Données et grille de temps

- Bougies 1 min Binance USDⓈ-M BTCUSDT et ETHUSDT (prix, volume, volume acheteur agresseur, nombre
  de transactions) et bougies 1 min comptant BTCUSDT, ETHUSDT, 2020-01-01 → 2026-09-30, archives
  vérifiées SHA-256 (`shockfade/fetch.py`, manifeste `data-manifest.json`). Financement : fichiers
  `research/data/funding/binance-*.csv` du dépôt.
- Flux signé de la minute i (quote, USDT) : X_i = 2·tbqv_i − qv_i (acheteurs agresseurs − vendeurs).
- Minute utilisable : présente avec volume > 0. Barres de décision de Δ minutes alignées sur l'époque :
  **Δ = 5 min (fréquence principale)**, Δ = 15 min (fréquence secondaire, rapportée, jamais utilisée
  pour sélectionner). Une barre n'est connue qu'à sa clôture T = ouverture + Δ.
- Horizons : **h ∈ {1, 2, 4, 8, 16, 32} barres de Δ** (5 min → 2 h 40 ; 15 min → 8 h).

### Découpage chronologique (figé)

| Période | Dates | Rôle |
|---|---|---|
| Préchauffage | 2020-01-01 → 2020-06-30 | premières estimations (saisonnalité, Hawkes, état-espace), aucun événement |
| E (étude d'événements, hypothèses) | 2020-07-01 → 2024-12-31 | étude d'événements, tests H1–H4 |
| V (validation walk-forward) | 2021-07-01 → 2024-12-31 | prévisions hors entraînement, comparaison des modèles, sélection |
| C (holdout final) | 2025-01-01 → 2026-09-30 | ouvert **une seule fois**, après le commit de la sélection |

Les événements de C ne sont ni lus, ni décrits, ni utilisés avant ce commit, y compris dans l'étude
d'événements.

## 3. Équations implémentées

### 3.1 Volatilité prévisible (causale) à 1 min

- r_i = ln c_i − ln c_{i−1} (deux minutes utilisables, sinon manquant).
- Saisonnalité intrajournalière : pour le jour UTC d et le créneau de 30 min τ(i) ∈ {0,…,47},
  s_d(τ) = médiane(|r| du créneau τ sur les 60 jours complets d−60…d−1) / médiane(|r| de tous les
  créneaux sur les mêmes jours). Au moins 30 jours ; sinon minute non utilisable.
- r̃_i = r_i / s(τ(i)).
- Variation bipuissance locale, strictement passée (K = 360 minutes) :
  σ̂²_i = (1/(K−2)) Σ_{j=i−K+2}^{i−1} |r̃_j|·|r̃_{j−1}| (au moins 80 % de paires valides).
- Variance diffusive prévue de la minute i : v_i = (π/2)·σ̂²_i·s(τ(i))².

### 3.2 Merton : sauts (composante permanente F)

Modèle : dF_t = μ_t dt + σ_t dW_t + J_t^P dN_t. L'intensité de Poisson constante du modèle de Merton
original est **remplacée par l'intensité Hawkes** du § 3.3 ; N_t compte les sauts identifiés.

- Statistique de Lee–Mykland : L_i = r̃_i / σ̂_i. Saut identifié si |L_i| > θ = C_n + S_n·β*,
  c = √(2/π), C_n = (2 ln n)^{1/2}/c − (ln π + ln ln n)/(2c(2 ln n)^{1/2}), S_n = 1/(c(2 ln n)^{1/2}),
  n = 1 440, β* = −ln(−ln(1−α)), **α = 1 %** ⇒ θ = 5,777 (≈ 4,61 écarts types diffusifs).
- Signe du saut = signe de r_i ; amplitude = r_i. Un z-score élevé n'est **pas** un saut identifié ;
  les deux notions sont rapportées séparément.
- Diagnostics : test BNS journalier (rapport (RV − BV)/RV, quarticité tripuissance, rendements 5 min),
  part de la variation quadratique due aux sauts par année, distribution des amplitudes par sens.

### 3.3 Hawkes bivarié (intensité des sauts)

Événements : sauts identifiés à 1 min, marque s ∈ {+, −}, instant = fin de la minute (en minutes).

λ_k(t) = μ_k + Σ_{τ_j < t} α_{k,s_j} · exp(−β_{k,s_j}(t − τ_j)),  k ∈ {+, −}.

- Dix paramètres ; contraintes μ_k > 0, α_{k,m} ≥ 0, β_{k,m} ∈ [1/10 080, 2] min⁻¹ ; stabilité :
  rayon spectral de G (G_{k,m} = α_{k,m}/β_{k,m}) < 1 (refus de toute estimation ≥ 0,99).
- Estimation : maximum de vraisemblance exact (récursion exponentielle), L-BFGS-B sur paramètres
  transformés, trois points de départ fixés. Fenêtre glissante des **180 jours** précédant chaque
  début de trimestre ; paramètres utilisés pour tout le trimestre suivant (aucune donnée du trimestre).
- Diagnostics : test du rapport de vraisemblance contre Poisson (2 paramètres) et contre deux Hawkes
  univariés (sans excitation croisée) ; changement de temps (incréments du compensateur ~ Exp(1),
  statistique KS) dans l'échantillon **et sur le trimestre suivant**.
- Prévision à l'instant de décision : simulation de Ogata (2 000 trajectoires, graine fixée par
  événement) depuis l'état courant, avec H = 1 + h·Δ minutes : p_same(H) = P(≥ 1 saut dans le sens
  du choc), p_opp(H), p_casc(H) = P(≥ 2 sauts dans le sens du choc), E[N_same(H)].
  **Ces probabilités portent sur des événements, pas sur le signe du rendement.**

### 3.4 Ornstein-Uhlenbeck : composante transitoire Q (état-espace avec flux)

x_i = ln c_i = F_i + Q_i + e_i
F_i = F_{i−1} + λ_F·√v_i·u_i + η^F_i
Q_i = φ·Q_{i−1} + λ_Q·√v_i·u_i + η^Q_i          (OU discrétisé : φ = e^{−κ}, t½ = ln 2/κ minutes)

- u_i = signe(X_i)·(|X_i|/X̄_i)^{1/2}, X̄_i = moyenne de |X| sur les 1 440 minutes précédentes.
- Var(η^F_i) = σ_F²·v_i, Var(η^Q_i) = σ_Q²·v_i, Var(e_i) = σ_e²·v_i ; aux minutes de saut identifié,
  Var(η^F_i) = σ_FJ²·v_i·L_i² et Var(η^Q_i) = σ_QJ²·v_i·L_i² : part transitoire des sauts
  ψ_J = σ_QJ²/(σ_FJ² + σ_QJ²) (le J^T de l'équation dQ_t = −κQ_t dt + η dW_t^Q + J_t^T dN_t).
- Huit paramètres (φ, λ_F, λ_Q, σ_F, σ_Q, σ_e, σ_FJ, σ_QJ) estimés par maximum de vraisemblance
  (filtre de Kalman, initialisation diffuse de F) sur les 180 jours précédant chaque trimestre.
- **Identification.** La part transitoire **pilotée par le flux** est identifiée par le profil de
  la réponse du prix au flux (réponse instantanée λ_F + λ_Q, réponse à k minutes λ_F + λ_Q·φ^k) ;
  la part non expliquée par le flux (σ_Q) ne l'est que par l'autocorrélation des rendements et peut
  être faiblement identifiée ; σ_Q et σ_e ne sont pas séparables si φ → 0, F et Q ne le sont pas si
  φ → 1. Rapportés : erreurs types (hessienne numérique), profil de vraisemblance en φ, test
  λ_Q = σ_Q = σ_QJ = 0, récupération sur données simulées. Si l'identification échoue, les
  caractéristiques OU sont présentées comme des **proxies**, sans interprétation structurelle.
- Filtrage seulement (jamais de lissage) : Q̂_T = E[Q_T | x_{≤T}, u_{≤T}].
- Réversion prévue du Fade (entrée à T+1, sortie à T+1+hΔ) : ρ_h = d·(φ − φ^{1+hΔ})·Q̂_T.
- Part transitoire estimée du choc : ψ_T = d·(Q̂_T − Q̂_{T−Δ})/|R_t|.
- **Contrôle négatif** (« OU appliqué aveuglément au prix brut ») : AR(1) du log-prix sur les 1 440
  minutes précédentes, x_i = a + b·x_{i−1} + ε, ρ^naïf_h = d·(1 − b^{1+hΔ})·(x_T − a/(1−b)).
  Le biais de Dickey–Fuller (réversion apparente sur une marche aléatoire) est démontré sur données
  simulées ; ce contrôle n'est jamais candidat.

## 4. Choc, décision, exécution

- Rendement de barre R_t = ln C_t − ln C_{t−1} (deux barres complètes). Volatilité prévue avant la
  barre : σ_t^(Δ) = (Σ_{i ∈ barre t} s(τ(i))²·(π/2)·σ̂²_{début(t)})^{1/2}, σ̂² connue à l'ouverture.
- **Condition 1 (choc)** : |Z_t| ≥ k avec Z_t = R_t/σ_t^(Δ), **k = 4** ; sensibilité k ∈ {3, 5}
  (étude d'événements seulement). Sens d = signe(R_t) ; Fade = position −d.
- Exclusions : barre incomplète, moins de 80 % de minutes valides sur les 360 précédentes,
  saisonnalité indisponible, trou de données dans la fenêtre d'un horizon (exclu pour cet horizon).
- **Instant de décision** D0 = T (clôture de la barre du choc). Toutes les caractéristiques n'utilisent
  que les minutes ≤ T et des paramètres estimés avant le trimestre.
- **Entrée** : clôture de la minute [T, T+1) (une minute de latence). Sortie à l'horizon h : clôture
  de la minute qui finit à T + 1 + h·Δ. Sensibilité : entrée à l'ouverture de la minute T (sans latence).
- Rendement du Fade : R^fade_h = −d·(ln P_sortie − ln P_entrée) − coût.

| Coûts | Par exécution | Aller-retour | Usage |
|---|---:|---:|---|
| C0 brut | 0 | 0 | information statistique |
| **C1 base** | frais 5 pb + glissement 2 pb | **14 pb** | cible des modèles, critères |
| C2 stress | 5 + 5 pb | 20 pb | critère de robustesse |
| Cm maker | 2 pb, sans glissement | 4 pb | sensibilité seulement (remplissage non garanti) |

Financement Binance réel (00, 08, 16 h UTC) dans le backtest. Aucun levier.

## 5. Hypothèses (définitions figées, caractéristiques causales)

Les seuils « tercile supérieur » sont calculés sur les **chocs passés** du même actif et de la même
fréquence (fenêtre croissante, ≥ 100 chocs passés, sinon exclu).

- **H1 — Failed breakout.** FB = 1 si l'extrême de la barre du choc dépasse l'extrême des 48 barres
  précédentes (4 h à 5 min ; 16 barres à 15 min) dans le sens d **et** si la clôture T est revenue à
  l'intérieur (C_T < HH pour d = +1, C_T > LL pour d = −1). Variante secondaire H1b : clôture au-delà
  en T puis retour à l'intérieur à la clôture de t+1 ou t+2, entrée une minute après ce retour.
- **H2 — Choc de liquidité transitoire** (proxies, aucune interprétation démontrée).
  H2a : déséquilibre agresseur dans le sens du choc, I_t = d·ΣX/Σqv sur la barre, tercile supérieur.
  H2b : ratio d'Amihud |R_t|/Σqv, tercile supérieur (mouvement sans volume, « vide de liquidité »).
- **H3 — Épuisement de l'auto-excitation.**
  H3a (événements) : p_same(H) de Hawkes est mieux calibrée (score de Brier) qu'un Poisson constant
  estimé sur les 180 jours précédents et que la fréquence empirique passée après les chocs.
  H3b (rendement) : décision en D2 = clôture de t+2, chocs sans nouveau choc |Z| ≥ k ni saut identifié
  dans le sens d en (T, D2] ; tercile **inférieur** de p_same(H) en D2 contre le reste ; entrée une
  minute après D2. Une intensité qui décroît n'est pas une preuve de réversion : H3b le teste à part.
- **H4 — Dislocation temporaire.** H4a : écart de base perp–comptant créé par le choc,
  B_t = d·[(b_T − médiane(b sur les 60 minutes avant la barre))], b = ln c^perp − ln c^comptant,
  tercile supérieur (le perpétuel a dépassé le comptant dans le sens du choc). H4b (écart au
  permanent estimé) est porté par ρ_h (modèles M4–M7).

Statistiques sur E, Δ = 5 min, pour chaque hypothèse et chaque horizon : (i) différence de moyenne
du rendement **brut** du Fade entre le groupe favorable et le reste ; (ii) moyenne **nette C1** du
groupe favorable > 0. Erreurs groupées par jour UTC ; IC par bootstrap par blocs de 4 semaines.

## 6. Modèles comparés (prévision de E[R^fade_h, net C1 | F_T])

Régressions linéaires par actif, fréquence et horizon, réestimées au début de chaque trimestre sur
tous les événements antérieurs **dont la sortie précède ce début** (purge), depuis 2020-07-01 ;
au moins 300 événements d'entraînement. Toutes les caractéristiques d'un événement sont calculées
avec les paramètres structurels de son propre trimestre (estimés avant lui).

| Modèle | Prévision | Paramètres |
|---|---|---:|
| M1 Fade naïf | a | 1 |
| M2 Failed breakout | a + b·FB | 2 |
| M3 Hawkes seul | a + b·p_same(H) + c·p_opp(H) | 3 |
| M4 OU seul | a + b·ρ_h | 2 |
| M5 Hawkes + OU | a + b·p_same + c·p_opp + e·ρ_h | 4 |
| M6 Hybride avec sauts | (1 − p_same)·g₀ + p_same·g₁, g_s = a_s + b_s·ρ_h + c_s·J + e_s·js | 8 |
| M7 Hybride + FB | M6 avec f_s·FB dans g_s | 10 |
| contrôle | a + b·ρ^naïf_h | 2 |

J = 1 si la barre du choc contient un saut identifié dans le sens d ; js = part du mouvement due aux
sauts identifiés (d·Σ r_saut/|R_t|, bornée à [0 ; 1,5]). Dans M6–M7, g₀ et g₁ sont estimées
séparément sur les événements d'entraînement **sans** et **avec** un saut réalisé dans le sens d en
(T, T+H] (loi des espérances totales) ; p_same vient de Hawkes. La réversion OU et le risque de saut
ne sont donc pas additionnés comme s'ils étaient indépendants : l'effet d'une cascade sur la
réversion est appris dans g₁.

Règle de trade d'un modèle : prendre l'événement si Ê_net(h) > 0. Ensemble d'évaluation commun : les
événements où toutes les caractéristiques existent.

## 7. Évaluation sur V (walk-forward) et critères

- **Prévision** : R²_OOS contre M1, statistique de Clark–West (modèles emboîtés), corrélation de
  Spearman entre Ê et le réalisé, calibration par déciles.
- **Économie (par événement, chevauchements permis)** : moyenne nette C1 des événements pris, t groupé
  par jour, IC bootstrap par blocs de 4 semaines (5 000 tirages), taux de gain, ratio gain moyen /
  perte moyenne, CVaR 5 %, pire perte, asymétrie, part du P&L due aux 1 % et 5 % meilleurs
  événements, résultats par trimestre et par actif.
- **Comparaisons de modèles** : Clark–West pour chaque modèle contre M1 ; différence de P&L net
  journalier (somme des événements pris par jour) pour M7 vs M2, M6 vs M5, M5 vs M3, M5 vs M4,
  bootstrap par blocs.

**Familles et corrections (Holm, 5 %, unilatéral)** : F1 = 5 hypothèses (H1, H2a, H2b, H3b, H4a) × 6
horizons pour (i), idem pour (ii) ; F2 = H3a, 6 horizons × 2 références ; F3 = M2…M7 contre M1
(Clark–West) × 6 horizons ; F4 = moyenne nette C1 > 0 pour M1…M7 × 6 horizons (42 tests). Les
q-valeurs de Benjamini–Hochberg sont rapportées en plus.

**Un couple (modèle, horizon) à 5 min est candidat exploitable** si, sur V :
1. sa moyenne nette C1 est > 0 avec p ajusté (Holm, F4) < 0,05, confirmé par l'IC bootstrap ;
2. sa moyenne nette C2 est > 0 ;
3. sa moyenne nette C1 est > 0 sur BTC et sur ETH séparément ;
4. au moins 200 événements pris, et moyenne > 0 dans au moins 60 % des trimestres à ≥ 10 trades ;
5. profit factor ≥ 1,1 et moyenne nette > 0 après retrait des 1 % meilleurs événements.

**Sélection (parcimonie)** : ordre de complexité M1 < M2 < M4 < M3 < M5 < M6 < M7. Parmi les
candidats, on retient le modèle le moins complexe dont la moyenne nette par événement atteint au
moins 75 % de celle du meilleur candidat (son meilleur horizon). Si M5–M7 ne battent pas M2, M2 est
retenu ; si une seule composante porte l'avantage, elle seule est retenue. Sans candidat : aucun
modèle tradable ; le meilleur modèle au sens de Clark–West (s'il est significatif) est conservé comme
**score de recherche non tradable**.

## 8. Holdout C, backtest

- Après le commit de la sélection : le modèle retenu (ou, sans candidat, le meilleur score de
  recherche, à titre descriptif) est évalué **une fois** sur C, recalibré trimestriellement comme sur
  V. Confirmation : moyenne nette C1 > 0, p unilatéral < 0,05 (bootstrap par blocs de 4 semaines).
- Backtest événementiel (seulement pour un candidat) : sleeves BTC et ETH 50/50, notionnel = capital
  de la sleeve, une position à la fois par actif, entrée et sortie comme au § 4 sur le chemin 1 min,
  stop de protection au-delà de l'extrême de la barre du choc de 50 % de son étendue (exécuté au pire
  de l'ouverture de la minute et du stop, plus glissement), financement réel. Rapports avec et sans
  stop ; grille de sensibilité frais {2 ; 4,5 ; 5 ; 7,5 pb} × glissement {0 ; 2 ; 5 pb}.
  Indicateurs : Sharpe, Sortino, Calmar, profit factor, CAGR, drawdown, volatilité, taux de gain,
  payoff, rendement net moyen par trade, trades par jour, exposition, rotation, distribution et
  concentration des gains, asymétrie des pertes, Sharpe dégonflé (N = 96 couples modèle × horizon
  × fréquence).

## 9. Contrôles du pipeline (avant les données réelles)

- Données simulées à paramètres connus : sauts de Merton (taille et puissance du test de
  Lee–Mykland), Hawkes bivarié (récupération des paramètres, stabilité, changement de temps), état-
  espace OU + flux (récupération de φ, λ_F, λ_Q, ψ_J ; cas non identifiés signalés).
- **Contrôle négatif** : marche aléatoire à sauts Hawkes sans composante transitoire ⇒ aucune
  réversion nette attendue, aucun modèle ne doit battre M1. **Contrôle positif** : même processus
  avec 40 % de chaque saut transitoire (demi-vie 10 min) ⇒ le pipeline doit détecter la réversion.
- Non-fuite : toute caractéristique en T calculée sur les données tronquées en T est identique à
  celle calculée sur l'échantillon complet (tests automatiques).

## 10. Traçabilité et écarts

- Chaque exécution des scripts d'évaluation ajoute une ligne au journal des essais
  (`research/reports/shock-fade/trial-log.md` : date, commit, script, configuration, périodes lues).
- Tout écart à ce protocole est consigné dans un avenant daté (§ 11) avec sa raison ; quand c'est
  possible, les résultats sont rapportés avec et sans l'écart. Les résultats négatifs sont conservés.

## 11. Avenants

(aucun)
