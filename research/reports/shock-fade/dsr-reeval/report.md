# Réévaluation du Sharpe dégonflé de E2, V1 et B2

Généré par `research/fade/v1/dsr-reeval.ts` (populations : `audit-e2-population.ts`), en lecture seule et sans nouvel essai : seules des configurations déjà évaluées sont rejouées. Portefeuille BTC/ETH 50/50, 2952 jours (2018-09-01 → 2026-09-30), Sharpe annualisés.

Contrôles : les Sharpe publiés des 16 configurations de l'univers A et des 19 variantes de sortie sont retrouvés à 10⁻⁶ près. Chaque population de candidats, rejouée avec le préréglage, redonne E2 (rôles calme et agité) et V1 au bit près. Le jeu agité n'a aucun effet sur les trades de V1.

## Verdict

- **N = 222 et σ = 0,602 ne représentaient pas fidèlement la sélection.** σ venait d'une population qui n'était pas en concurrence avec V1 ; N mélangeait des étapes différentes, comptait des essais sans effet et en oubliait d'autres.
- **Sharpe absolu, hypothèses justifiées (R2) : E2 100,0 %, V1 100,0 %, B2 100,0 %** (initial : 73,8 %, 87,6 %, 92,1 %). Borne prudente : 70,2 %, 98,9 %, 96,9 %.
- **Gains : V1 sur E2 58,3 %, B2 sur V1 92,6 %** (initial : 18,0 %, 64,9 %).
- **Indice indépendant de la sélection :** le jeu calme de V1, choisi sur BTC seul, est aussi le 1ᵉʳ des 606 jeux possibles sur ETH (probabilité sous le bruit seul : 0,005).

## 1. Chronologie : qui a réellement participé à la sélection

| date (UTC) | commit | essais | fonction | E2 | V1 | B2 |
|---|---|---|---|---|---|---|
| 10-04 16:18 | 0c612af | premier passage, 54 configurations et test d'entrées aléatoires | diagnostic | non | non | non |
| 10-04 20:42 | 11e847f | `regime-wf` : 206 candidats × 3 graines (606 distincts), 15 et 30 min, plusieurs découpages en régimes ; retenu : 15 min, volatilité seule, graine 5, jeu calme n° 178, jeu agité n° 38 | **sélection des réglages**, sur BTC seul | oui (jeux calme et agité) | oui (jeu calme seul) | oui |
| 10-06 13:54 → 10-07 03:48 | 2112993, fda7113, 8141dee | walk-forward sur plateaux, robustesse locale (1 810), surface adaptative M0 → M4 (2 790) | validation et challengers : le préréglage n'est pas modifié | non | non | non |
| 10-08 → 10-09 | 767f71a … f8e6e93 | zéro-shot (or, ETH, SOL, TAO), robustesse ETH, falsification A/B/C, alpha résiduel | falsification et diagnostic | non | non | non |
| ≤ 10-09 00:14 | c6bb207 | univers A n° 1 à 7 : six traitements des shorts et E2 | **sélection de E2** | oui | oui | oui |
| 10-09 | c6bb207 | E2 figée (`e2-forward.md`) | — | figée |  |  |
| 10-12 → 10-13 01:43 | 8f22c03 … 5229830 | capacité, exécution, couche probabiliste, anatomie des pertes | diagnostic (aucune règle candidate) | non (après) | non | non |
| 10-13 01:28 → 02:24 | 56a7ac0, 4742db1, 60112a3 | univers A n° 8 à 16 : modifications de E2 (range, régime agité, invalidation précoce) | **sélection de V1** (n° 11 retenu) | non (après) | oui | oui |
| 10-13 02:42 | 40fae7f | V1 figée (`calm-only.ts`), avant tout calcul de surajustement | — |  | figée |  |
| 10-13 03:03 → 04:27 | c3fe6a8, 9ddcf35 | CSCV-PBO, walk-forward, DSR ; robustesse locale de V1 | diagnostic de la sélection | non | non (après) | non |
| 10-13 15:00 → 18:00 | 3de57f1 … 2f32b51 | Shock Fade, multi-horizons (autres stratégies) ; Hawkes / Merton × V1 (2 règles) | autres stratégies ; 2 règles candidates pour modifier V1 | non | non (après) | oui (2) |
| 10-13 19:23 | eb10895 | 11 trailings sur V1 | candidates pour modifier V1 | non | non (après) | oui |
| 10-13 20:39 | 713d08f | 8 variantes point mort / volume ; 6 contrôles de prix ; 2 rejeux de diagnostic | **sélection de B2** ; contrôles = falsification ; rejeux = diagnostic | non | non (après) | oui (8) ; non (8) |

**Ce que le décompte N = 222 (16 + 206) mélangeait.** Il comptait pour V1 les 6 alternatives à E2 antérieures à E2 (pertinentes pour V1 par héritage) et les 9 modifications de E2 (pertinentes), mais aussi le jeu agité, sans effet sur V1. Il omettait les graines 9 et 13 (400 candidats de plus), le choix de la procédure (horizon, découpage) et, pour B2, les 21 tentatives d'amélioration de V1. Il ne distinguait pas des choix successifs (paramètres, puis structure, puis sorties), qui ne se multiplient pas : chacun ajoute sa propre inflation.

## 2. Nombre effectif d'essais et dispersion σ

Pour chaque étape de sélection : N = alternatives réellement en concurrence ; σ = écart type de leurs Sharpe (portefeuille) ; ρ̄ = corrélation moyenne de leurs rendements quotidiens ; N spectral = N² / Σ corrélations². **Inflation attendue** = maximum attendu du bruit d'estimation parmi ces alternatives, mesuré par bootstrap joint par mois (2 000 tirages ; mêmes mois pour toutes les alternatives, donc corrélations et queues épaisses conservées). Si la sélection s'est faite sur BTC seul, on retient l'alternative au plus grand bruit sur BTC et on mesure son bruit sur le portefeuille. N équivalent = nombre d'essais indépendants qui donnerait la même inflation.

| étape | N | σ des Sharpe | ρ̄ | N spectral | erreur type d'un Sharpe | inflation attendue (bootstrap) | N équivalent | inflation, formule DSR (σ, N bruts) | biais propre du bootstrap |
|---|---|---|---|---|---|---|---|---|---|
| jeu calme de E2 (606 candidats, choisi sur BTC) | 606 | 0,391 | 0,57 | 2,9 | 0,324 | 0,432 | 6 | 1,217 | −0,003 |
| jeu agité de E2 (606 candidats, choisi sur BTC) | 606 | 0,243 | 0,88 | 1,3 | 0,321 | 0,173 | 2 | 0,754 | −0,001 |
| jeu calme de V1 (606 candidats, choisi sur BTC) | 606 | 0,451 | 0,17 | 15,8 | 0,322 | 0,540 | 12 | 1,403 | −0,013 |
| règle E2 parmi 7 traitements des shorts (n° 1 à 7) | 7 | 0,100 | 0,85 | 1,3 | 0,297 | 0,154 | 2 | 0,139 | 0,003 |
| V1 parmi E2 et 9 modifications de E2 (n° 7 à 16) | 10 | 0,084 | 0,94 | 1,1 | 0,312 | 0,117 | 2 | 0,132 | −0,000 |
| B2 parmi V1, 11 trailings, 8 point mort / volume (+ 2 règles Hawkes) | 22 | 0,125 | 0,88 | 1,3 | 0,298 | 0,203 | 2 | 0,243 | −0,001 |

- **σ = 0,602 ne représente pas les opportunités de V1.** Il venait des 206 candidats de la graine 5 rejoués « tels quels » (un seul jeu, tous régimes, sans E2) : Sharpe moyen −0,25, maximum 1,18. Rejoués comme V1 (même structure), les 606 jeux possibles ont σ = 0,451. Et une partie de cette dispersion est réelle, pas du bruit : l'erreur type d'un Sharpe vaut 0,322 et les jeux sont corrélés (ρ̄ 0,17).
- **Le jeu de V1 est hors norme, y compris là où il n'a pas été choisi.** Parmi les 606 jeux calmes possibles, le n° 178 est 1ᵉʳ sur le portefeuille (2,02), 1ᵉʳ sur BTC (données de la sélection) et 1ᵉʳ sur ETH, actif jamais utilisé pour le choisir. Sous le bruit seul, la probabilité que le jeu choisi sur BTC soit aussi le premier sur ETH vaut 0,0050 (bootstrap, corrélations BTC / ETH comprises). Corrélation de rang BTC / ETH entre jeux : 0,43. Cinq meilleurs (portefeuille, BTC, ETH) : 2,02 / 1,46 / 1,93 ; 1,47 / 1,13 / 1,44 ; 1,45 / 1,02 / 1,43 ; 1,44 / 0,95 / 1,43 ; 1,44 / 1,14 / 1,33.

## 3. Sharpe dégonflé

- **C (conservateur initial)** : un seul maximum sur N = 222 essais, σ = 0,602.
- **R1 (comptes fidèles, estimateur standard)** : somme, sur les étapes de la version, de σ × maximum attendu de N essais indépendants (σ et N bruts de chaque étape, sélection supposée faite sur le portefeuille).
- **R2 (hypothèses justifiées)** : somme des inflations attendues mesurées par bootstrap (hypothèse nulle du DSR : aucune différence réelle entre alternatives d'une même étape ; corrélations réelles ; paramètres choisis sur BTC). Sensibilités de R2 : jeux de paramètres choisis comme si la sélection portait sur le portefeuille (et non sur BTC seul) ; choix de la procédure (2 horizons × découpages, non rejouables ici) compté comme 7 fois plus d'essais indépendants pour les jeux de paramètres ; les deux à la fois.

| version | Sharpe | PSR(0) | C : N = 222, σ = 0,602 | R1 | **R2** | R2, sélection sur le portefeuille | R2, × 7 procédures | R2, les deux | C à N = 6 266 / 128 547 |
|---|---|---|---|---|---|---|---|---|---|
| E2 | 1,88 | 100,00 % | 73,8 % (seuil 1,69) | 21,9 % (seuil 2,11) | **100,0 %** (seuil 0,76) | 99,0 % (seuil 1,18) | 92,8 % (seuil 1,44) | 70,2 % (seuil 1,72) | 10,4 % / 0,4 % |
| V1 | 2,02 | 100,00 % | 87,6 % (seuil 1,69) | 88,4 % (seuil 1,67) | **100,0 %** (seuil 0,81) | 99,8 % (seuil 1,16) | 99,9 % (seuil 1,07) | 98,9 % (seuil 1,35) | 21,5 % / 1,3 % |
| B2 | 2,09 | 100,00 % | 92,1 % (seuil 1,69) | 72,9 % (seuil 1,92) | **100,0 %** (seuil 1,01) | 99,4 % (seuil 1,37) | 99,8 % (seuil 1,27) | 96,9 % (seuil 1,55) | 28,7 % / 2,2 % |

Décomposition du seuil R2 (inflation par étape) : E2 = Pc 0,43 + Pa 0,17 + S2 0,15 ; V1 = Pv 0,54 + S2 0,15 + S1 0,12 ; B2 = Pv 0,54 + S2 0,15 + S1 0,12 + SB 0,20. Étapes : Pc / Pa / Pv = jeux de paramètres, S2 = règle E2, S1 = V1, SB = B2.

**Gains d'une étape sur la précédente**

| gain | ratio d'information | PSR(0) | C (initial) | R1 (comptes fidèles) | R2 (bootstrap) | N équivalent (R2) |
|---|---|---|---|---|---|---|
| V1 − E2 | 0,558 | 93,7 % | 18,0 % (N 15, σ 0,503) | 27,4 % (N 9, σ 0,510) | **58,3 %** (seuil 0,481) | 7,3 |
| B2 − V1 | 0,936 | 99,8 % | 64,9 % (N 8, σ 0,557) | 40,8 % (N 21, σ 0,526) | **92,6 %** (seuil 0,469) | 7,1 |

Gain V1 − E2 : alternatives à E2 au moment du choix de V1 (n° 8 à 16) ; les n° 1 à 6, antérieures à E2, avaient perdu contre E2 et ne sont pas des alternatives au gain. Gain B2 − V1 : les 19 variantes de sortie et les 2 règles Hawkes.

## 4. Holm et DSR

- **Un seul test : même verdict.** Bootstrap par mois du ΔSharpe de B2 : p brut 0,0010 (plancher de résolution du bootstrap) ; PSR(0) de la série d'écart B2 − V1 : 99,8 %.
- **Deux corrections différentes.** Holm ou Bonferroni contrôlent la probabilité d'au moins un faux positif parmi N essais. Le DSR à 95 % exige de dépasser le maximum **attendu** de N essais nuls, puis encore 1,645 erreur type : il équivaut à un risque global bien inférieur à 5 %.

| N | z requis, Bonferroni 5 % | z requis, DSR 95 % | risque global équivalent au DSR 95 % |
|---|---|---|---|
| 1 | 1,64 | 1,64 | 5,00 % |
| 8 | 2,50 | 3,10 | 0,76 % |
| 21 | 2,82 | 3,57 | 0,38 % |
| 222 | 3,51 | 4,44 | 0,10 % |
| 606 | 3,77 | 4,75 | 0,06 % |

- **Pour B2, une fois les hypothèses corrigées, les deux convergent.** Holm sur les 8 variantes : p 0,008 ; Bonferroni sur les 21 tentatives réelles : 0,021 ; DSR du gain (R2, N équivalent 7,1) : 92,6 %. L'écart entre 99 % et 64,9 % venait surtout de σ (dispersion de règles réellement différentes, prise pour du bruit) et du critère plus strict du DSR, pas d'une sélection massive.

## 5. Réponse : N = 222 et σ = 0,602 représentent-ils les opportunités de sélection ?

- **Non, pour σ.** 0,602 mesure la dispersion d'une population qui n'était pas en concurrence avec V1 : des jeux rejoués seuls, sans structure de régime ni filtre E2 (Sharpe moyen −0,25). Parmi les jeux réellement substituables au jeu de V1, σ = 0,451. Sous l'hypothèse nulle du DSR, la dispersion pertinente est celle du bruit, ≈ 0,32.
- **Non, pour N, et dans les deux sens.** Le décompte gonflait certaines étapes : le jeu agité est sans effet sur V1, les variantes de structure sont corrélées à 0,85 – 0,94 (≈ 2 essais indépendants chacune) et les paramètres ont été choisis sur BTC seul. Il en oubliait d'autres : les graines 9 et 13 (400 candidats), le choix de l'horizon et du découpage, les 21 tentatives d'amélioration de V1 pour B2. Compter fidèlement en supposant les essais indépendants (R1) ne rend pas le DSR plus favorable (E2 21,9 %, V1 88,4 %, B2 72,9 %) : c'est la mesure des corrélations, du niveau de bruit et du critère de sélection (BTC) qui change la conclusion.
- **Avec les hypothèses justifiées (R2)**, le seuil dû à la sélection vaut 0,76 pour E2, 0,81 pour V1 et 1,01 pour B2, contre 1,69 dans le scénario initial ; les trois DSR sont proches de 100 %. Borne prudente (sélection supposée faite sur le portefeuille et 7 fois plus de procédures) : E2 70,2 %, V1 98,9 %, B2 96,9 %.
- **Les gains restent la question ouverte.** V1 sur E2 : 58,3 % (initial 18,0 %). B2 sur V1 : 92,6 % (initial 64,9 %), sous 95 % : B2 reste une candidate exploratoire.

## 6. Limites

- Seuls les essais enregistrés dans le dépôt sont comptés ; des essais antérieurs non tracés (réglages essayés à la main sur TradingView) ne peuvent pas l'être. La sensibilité « × 7 procédures » en couvre une partie.
- Le critère réel de choix des jeux (t-stat des trades en régime calme ou agité sur BTC 2017 → 2026, minimum des deux moitiés) est approché par le Sharpe de la sleeve BTC sur la fenêtre 2018-09 → 2026-09. Une partie de la sélection portait sur 2017-2018, hors de la fenêtre mesurée : l'inflation transmise est plutôt surestimée.
- Les challengers de la surface adaptative (M1 à M4) et le walk-forward sur plateaux n'ont pas modifié le préréglage : ils sont classés validation. Les compter comme sélection ajouterait une petite étape, du même ordre que S2 (≈ 0,15).
- L'hypothèse nulle du DSR (aucune différence réelle entre essais d'une même étape) est elle-même prudente quand les essais diffèrent réellement, ce que montre σ > erreur type.
- Le N spectral (participation des valeurs propres) sous-estime le nombre d'essais indépendants pour un problème de maximum ; il est donné à titre indicatif. Le N équivalent vient du bootstrap.
- Tout repose sur le même historique, déjà utilisé pour développer E2, V1 et B2 : seule une validation prospective tranchera.
