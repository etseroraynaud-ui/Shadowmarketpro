# Shock Engine BTC/ETH · attribution de la baisse du Sharpe entre les deux moitiés

Portefeuille officiel (50/50 au départ de chaque moitié, sans rééquilibrage), stratégies figées, coûts du rapport (0,045 % par ordre). Moitiés : **2018-09-01 → 2022-09-15** (1476 jours) et **2022-09-16 → 2026-09-30** (1476 jours). Sharpe journalier 2.13 puis 1.29, identiques au rapport du portefeuille (vérifié). Aucun paramètre modifié. Produit par `node research/shock/sharpe-attribution.ts`.

## En bref

1. **La baisse (−0.84) vient presque entièrement des shorts.** Attribution exacte par sens : gain moyen par trade des shorts −1.82, des longs +0.12 ; la baisse de volatilité des sleeves la compense en partie (+0.60). Contribution annuelle des shorts au portefeuille : +46.8 % puis +2.8 % ; des longs : +31.8 % puis +33.9 %.
2. **Les tendances n'ont pas raccourci.** En unités de volatilité journalière du sous-jacent, le gagnant moyen grandit (BTC 1.59 → 1.86 σ, ETH 1.33 → 1.72 σ) et les 5 % meilleurs trades restent de même taille (BTC 7.1 → 7.0 σ, ETH 5.1 → 5.5 σ). En %, ils baissent (BTC 4.02 % → 3.35 %) parce que la volatilité du marché a baissé d'environ un tiers.
3. **Ce qui a changé, c'est le taux de gain** (BTC 35 % → 26 %, ETH 33 % → 26 %), surtout sur les shorts (BTC 32 % → 21 %, ETH 33 % → 24 %). Effet de Shapley du taux de gain : −1.39, compensé en partie par des gagnants plus grands (+0.42), plus de trades en régime calme (+0.31) et plus de trades (+0.21).
4. **E[R | choc] ne tend pas vers 0.** Chocs bruts dans la tendance 60 min, excès à 1 h en ATR : BTC +0.16 → +0.12, ETH +0.12 → +0.06 ; les intervalles à 90 % de la 2e moitié sont au-dessus de 0 ou le touchent. Signaux longs : excès à 16 h BTC +1.36 → +1.31, ETH +1.10 → +0.82. **Exception : les signaux shorts d'ETH**, dont l'excès à 1–4 h tombe à environ 0 (+0.42 → −0.14 à 1 h ; différence significative au seuil de 90 %).
5. **Les shorts gagnent surtout dans les années baissières.** Par année, la contribution des shorts est forte en 2018 et 2022 (marchés en forte baisse, tous deux dans la 1re moitié), positive en 2025–2026, négative en 2023 (forte hausse). En 1re moitié les shorts BTC gagnaient aussi en années haussières (2019–2021) ; ce n'est plus le cas en 2023–2024.
6. **La corrélation BTC/ETH (0.34 → 0.45) ne pèse presque rien** : −0.07 de Sharpe. Les frais par trade n'ont pas changé (effet −0.00), mais ils prennent 23 % de l'alpha brut contre 11 %, parce que l'alpha brut des shorts a disparu.
7. **Prudence statistique** : bootstrap des mois, intervalle à 90 % de la baisse −1.78 à +0.04, P(baisse) 94 %. Chaque moitié ne contient que quelques phases baissières.

## 1. Tableau comparatif

Rendements de trade en % du capital de la sleeve à l'entrée (nets de frais). « σ jour » : mêmes rendements divisés par la volatilité journalière du sous-jacent connue à l'entrée (écart type des 30 jours précédents) ; « ATR » : divisés par l'ATR 15 min à l'entrée. Ces deux unités rendent les tailles comparables d'une période de volatilité à l'autre. Contributions : somme des rendements de trade par an (portefeuille : demi-poids). Une position est rattachée à la moitié où elle est ouverte.

| variable | BTC 2018–22 | BTC 2022–26 | ETH 2018–22 | ETH 2022–26 | portefeuille 2018–22 | portefeuille 2022–26 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Trades / an | 99 | 120 | 111 | 117 | 210 | 236 |
| Taux de gain | 35 % | 26 % | 33 % | 26 % | 34 % | 26 % |
| Gagnant moyen | 4.02 % | 3.35 % | 5.15 % | 4.17 % |  |  |
| Gagnant moyen (σ jour) | 1.59 | 1.86 | 1.33 | 1.72 |  |  |
| Gagnant moyen (ATR) | 10.75 | 14.42 | 10.20 | 12.21 |  |  |
| Perdant moyen | −1.07 % | −0.78 % | −1.32 % | −0.99 % |  |  |
| Perdant moyen (σ jour) | −0.36 | −0.39 | −0.34 | −0.36 |  |  |
| Payoff | 3.76 | 4.26 | 3.92 | 4.23 |  |  |
| Part des 5 % meilleurs trades (croissance log) | 111 % | 229 % | 126 % | 222 % | 118 % | 213 % |
| Gain moyen des 5 % meilleurs trades | 15.0 % | 11.7 % | 19.3 % | 13.1 % |  |  |
| Gain moyen des 5 % meilleurs (σ jour) | 7.1 | 7.0 | 5.1 | 5.5 |  |  |
| MFE moyen des gagnants (ATR) | 19.49 | 23.58 | 18.08 | 22.27 |  |  |
| MAE moyen, tous trades (ATR) | −1.98 | −2.33 | −1.99 | −2.20 |  |  |
| Durée médiane des gagnants | 24.5 h | 26.0 h | 25.3 h | 35.3 h |  |  |
| Volatilité journalière à l'entrée | 3.45 % | 2.16 % | 4.51 % | 2.95 % |  |  |
| Contribution des longs / an | +24.8 % | +31.5 % | +38.7 % | +36.3 % | +31.8 % | +33.9 % |
| Contribution des shorts / an | +44.0 % | +2.3 % | +49.6 % | +3.2 % | +46.8 % | +2.8 % |
| Contribution régime calme / an | +66.3 % | +33.8 % | +89.7 % | +45.8 % | +78.0 % | +39.8 % |
| Contribution régime agité / an | +2.5 % | −0.0 % | −1.5 % | −6.3 % | +0.5 % | −3.1 % |
| Trades longs / shorts | 245 / 157 | 263 / 221 | 294 / 153 | 259 / 212 |  |  |
| Trades calmes / agités | 245 / 157 | 355 / 129 | 276 / 171 | 331 / 140 |  |  |
| Sharpe (journalier) | 1.79 | 1.22 | 1.85 | 1.08 | 2.13 | 1.29 |
| Volatilité annualisée | 38 % | 26 % | 46 % | 35 % |  |  |
| Frais / alpha brut | 12 % | 24 % | 10 % | 21 % | 11 % | 23 % |
| Frais / an · alpha brut / an | 9 % · 78 % | 11 % · 45 % | 10 % · 98 % | 11 % · 50 % | 9 % · 88 % | 11 % · 47 % |
| Corrélation BTC/ETH |  |  |  |  | 0.34 | 0.45 |

## 2. Attribution exacte par sens : longs et shorts

μ_s = f_long · m_long + f_short · m_short + c_s (f : trades par jour, m : gain moyen net par trade, c : conversion trades → jours) ; Sharpe du 50/50 rééquilibré reconstruit exactement. Valeurs de Shapley ; la somme plus la dérive des poids redonne la baisse publiée.

| effet | Sharpe |
| --- | ---: |
| Longs : fréquence | −0.05 |
| Longs : gain moyen par trade | +0.12 |
| Shorts : fréquence | +0.31 |
| Shorts : gain moyen par trade | −1.82 |
| Volatilité des sleeves | +0.60 |
| Corrélation BTC/ETH | −0.07 |
| Conversion trades → jours | +0.02 |
| Dérive des poids (portefeuille officiel) | +0.05 |
| **Total** | **−0.84** |

| sleeve · sens | trades / an 2018–22 | trades / an 2022–26 | taux de gain | gagnant moyen | gagnant (σ jour) | perdant moyen | gain moyen par trade | contribution / an |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BTC · long | 61 | 65 | 36 % → 30 % | 2.83 % → 3.16 % | 1.09 → 1.73 | −0.95 % → −0.67 % | 0.41 % → 0.48 % | +24.8 % → +31.5 % |
| BTC · short | 39 | 55 | 32 % → 21 % | 6.07 % → 3.66 % | 2.46 → 2.09 | −1.25 % → −0.91 % | 1.13 % → 0.04 % | +44.0 % → +2.3 % |
| ETH · long | 73 | 64 | 33 % → 27 % | 4.05 % → 4.27 % | 0.97 → 1.72 | −1.17 % → −0.83 % | 0.53 % → 0.57 % | +38.7 % → +36.3 % |
| ETH · short | 38 | 52 | 33 % → 24 % | 7.28 % → 4.03 % | 2.02 → 1.72 | −1.59 % → −1.16 % | 1.31 % → 0.06 % | +49.6 % → +3.2 % |

Par année civile (somme des rendements de trade de la sleeve ; * : année partielle) :

| année | BTC spot | BTC longs | BTC shorts | taux de gain shorts BTC | ETH spot | ETH longs | ETH shorts | taux de gain shorts ETH |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2018* | −47 % | −0 % | +27 % | 18 % | −53 % | +51 % | +84 % | 38 % |
| 2019 | +94 % | +48 % | +32 % | 40 % | −2 % | −26 % | +40 % | 30 % |
| 2020 | +304 % | +21 % | +32 % | 24 % | +470 % | +64 % | −22 % | 21 % |
| 2021 | +59 % | +29 % | +27 % | 42 % | +399 % | +43 % | +13 % | 33 % |
| 2022 (à cheval sur les deux moitiés) | −64 % | +7 % | +50 % | 28 % | −67 % | +20 % | +79 % | 39 % |
| 2023 | +156 % | +47 % | −17 % | 19 % | +91 % | +14 % | −25 % | 19 % |
| 2024 | +121 % | +70 % | +2 % | 18 % | +46 % | +62 % | +4 % | 25 % |
| 2025 | −6 % | +0 % | +12 % | 24 % | −11 % | +54 % | +26 % | 35 % |
| 2026* | −4 % | +5 % | +20 % | 26 % | −10 % | +21 % | +15 % | 19 % |

## 3. Attribution exacte par facteurs

Le Sharpe du portefeuille 50/50 rééquilibré chaque jour s'écrit exactement (moments de population) :

```
Sharpe = √365,25 · ½(μ_BTC + μ_ETH) / √(¼σ_BTC² + ¼σ_ETH² + ½ρ σ_BTC σ_ETH)
μ_s = f_s · Σ_régime π_s,k · [ p (a_W · W − φ_W) + (1 − p)(a_L · L − φ_L) ]_s,k + c_s
```

f : trades par jour ; π : part des trades par régime ; p : taux de gain ; W, L : gain et perte bruts moyens en unités de volatilité journalière du sous-jacent à l'entrée ; a : conversion de ces unités en % ; φ : frais en % ; σ : volatilité journalière des sleeves ; ρ : corrélation ; c : écart entre la moyenne journalière et les trades rapportés au jour. L'identité redonne le Sharpe observé de chaque moitié à 1e-10 près (vérifié). Chaque effet est la valeur de Shapley de son groupe : l'écart moyen de Sharpe quand on remplace ses paramètres 2018–22 par ceux de 2022–26, sur tous les ordres possibles. La colonne « variante ATR » mesure les tailles en ATR 15 min au lieu de la volatilité journalière.

| effet | portefeuille | variante ATR | BTC seul | ETH seul | paramètres remplacés |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fréquence | +0.21 | +0.22 | +0.31 | +0.08 | trades par jour de chaque sleeve |
| Mix de régimes | +0.31 | +0.31 | +0.29 | +0.24 | part des trades ouverts en régime agité |
| Taux de gain | −1.39 | −1.39 | −1.57 | −0.86 | part des trades gagnants, par sleeve et régime |
| Taille des gagnants | +0.42 | +0.47 | +0.29 | +0.39 | gain brut moyen des gagnants, en volatilité journalière du sous-jacent à l'entrée |
| Taille des perdants | +0.06 | −0.02 | +0.14 | −0.02 | perte brute moyenne des perdants, en volatilité journalière à l'entrée |
| Environnement de volatilité | −0.45 | −0.43 | +0.00 | −0.67 | niveau de volatilité à l'entrée (conversion en %) et volatilité journalière des sleeves |
| Frais par trade | −0.00 | −0.00 | −0.00 | −0.00 | commission en % du capital de la sleeve, gagnants et perdants |
| Corrélation BTC/ETH | −0.07 | −0.07 | — | — | corrélation des rendements journaliers des sleeves |
| Conversion trades → jours | +0.02 | +0.02 | −0.04 | +0.06 | écart entre la moyenne journalière et la somme des trades par jour (positions à cheval, composition) |
| **Total, 50/50 rééquilibré** | **−0.89** | **−0.89** | **−0.57** | **−0.78** | 2.22 → 1.33 |
| Dérive des poids (portefeuille officiel) | +0.05 | +0.05 |  |  | A (sans rééquilibrage) moins 50/50 rééquilibré, 2e moitié moins 1re |
| **Total, portefeuille officiel** | **−0.84** | **−0.84** |  |  | 2.13 → 1.29 |

Paramètres par moitié :

| paramètre | 2018–22 | 2022–26 |
| --- | ---: | ---: |
| BTC calme · trades / an | 60.6 | 87.8 |
| BTC calme · taux de gain | 33.9 % | 23.7 % |
| BTC calme · gagnant brut (σ jour) | 2.47 | 2.65 |
| BTC calme · perdant brut (σ jour) | −0.44 | −0.41 |
| BTC calme · moyenne nette par trade | 1.093 % | 0.385 % |
| BTC agité · trades / an | 38.9 | 31.9 |
| BTC agité · taux de gain | 35.7 % | 31.8 % |
| BTC agité · gagnant brut (σ jour) | 0.36 | 0.40 |
| BTC agité · perdant brut (σ jour) | −0.16 | −0.14 |
| BTC agité · moyenne nette par trade | 0.065 % | −0.000 % |
| BTC · volatilité journalière annualisée de la sleeve | 37.8 % | 25.9 % |
| BTC · rendement moyen par jour (conversion c) | 0.186 % (−0.0026 %) | 0.087 % (−0.0059 %) |
| ETH calme · trades / an | 68.3 | 81.9 |
| ETH calme · taux de gain | 31.9 % | 27.8 % |
| ETH calme · gagnant brut (σ jour) | 2.04 | 2.15 |
| ETH calme · perdant brut (σ jour) | −0.42 | −0.41 |
| ETH calme · moyenne nette par trade | 1.314 % | 0.559 % |
| ETH agité · trades / an | 42.3 | 34.6 |
| ETH agité · taux de gain | 33.9 % | 20.7 % |
| ETH agité · gagnant brut (σ jour) | 0.30 | 0.48 |
| ETH agité · perdant brut (σ jour) | −0.14 | −0.15 |
| ETH agité · moyenne nette par trade | −0.035 % | −0.181 % |
| ETH · volatilité journalière annualisée de la sleeve | 45.6 % | 35.4 % |
| ETH · rendement moyen par jour (conversion c) | 0.232 % (−0.0099 %) | 0.105 % (−0.0035 %) |
| Corrélation BTC/ETH | 0.34 | 0.45 |

Contexte de marché :

|  | BTC 2018–22 | BTC 2022–26 | ETH 2018–22 | ETH 2022–26 |
| --- | ---: | ---: | ---: | ---: |
| Rendement du sous-jacent sur la moitié | +181 % | +324 % | +423 % | +82 % |
| Volatilité journalière annualisée du sous-jacent | 76 % | 47 % | 99 % | 64 % |
| ATR 15 min moyen (% du prix) | 0.51 % | 0.29 % | 0.67 % | 0.42 % |
| ATR 15 min / écart type journalier | 0.128 | 0.120 | 0.129 | 0.125 |

## 4. Le signal prédit-il encore la suite du choc ?

Mouvement après l'événement, dans son sens, en ATR, moins le mouvement moyen d'une bougie quelconque à la même heure de la même année. Intervalles à 90 % par bootstrap des mois ; différence : mois rééchantillonnés indépendamment dans chaque moitié.

### BTC · signaux d'entrée du préréglage

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 652 | +0.169 | +0.051 à +0.296 | 822 | +0.113 | +0.014 à +0.208 | 96 % | −0.056 | −0.220 à +0.094 |
| 4 bougies (1 h) | 652 | +0.314 | +0.116 à +0.533 | 822 | +0.183 | −0.005 à +0.372 | 95 % | −0.130 | −0.420 à +0.144 |
| 16 bougies (4 h) | 652 | +0.418 | +0.170 à +0.692 | 822 | +0.306 | −0.031 à +0.614 | 93 % | −0.112 | −0.542 à +0.257 |
| 64 bougies (16 h) | 652 | +1.230 | +0.681 à +1.832 | 822 | +0.939 | +0.310 à +1.531 | 99 % | −0.291 | −1.158 à +0.509 |

### BTC · chocs bruts dans le sens de la tendance 60 min

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 2771 | +0.112 | +0.069 à +0.151 | 3184 | +0.086 | +0.051 à +0.122 | 100 % | −0.026 | −0.079 à +0.031 |
| 4 bougies (1 h) | 2771 | +0.156 | +0.075 à +0.243 | 3184 | +0.117 | +0.039 à +0.197 | 99 % | −0.039 | −0.162 à +0.080 |
| 16 bougies (4 h) | 2771 | +0.160 | +0.028 à +0.304 | 3184 | +0.271 | +0.116 à +0.425 | 100 % | +0.111 | −0.106 à +0.313 |
| 64 bougies (16 h) | 2771 | +0.559 | +0.290 à +0.819 | 3182 | +0.579 | +0.267 à +0.915 | 100 % | +0.019 | −0.374 à +0.447 |

### BTC · signaux longs

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 357 | +0.162 | +0.015 à +0.322 | 430 | +0.103 | −0.059 à +0.250 | 85 % | −0.059 | −0.285 à +0.147 |
| 4 bougies (1 h) | 357 | +0.438 | +0.166 à +0.711 | 430 | +0.220 | −0.030 à +0.451 | 93 % | −0.218 | −0.594 à +0.129 |
| 16 bougies (4 h) | 357 | +0.557 | +0.192 à +0.924 | 430 | +0.407 | +0.032 à +0.763 | 96 % | −0.150 | −0.679 à +0.343 |
| 64 bougies (16 h) | 357 | +1.359 | +0.638 à +2.073 | 430 | +1.306 | +0.283 à +2.313 | 98 % | −0.053 | −1.305 à +1.223 |

### BTC · signaux shorts

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 295 | +0.177 | +0.021 à +0.364 | 392 | +0.124 | +0.003 à +0.255 | 96 % | −0.053 | −0.279 à +0.149 |
| 4 bougies (1 h) | 295 | +0.163 | −0.137 à +0.493 | 392 | +0.143 | −0.159 à +0.498 | 76 % | −0.020 | −0.464 à +0.429 |
| 16 bougies (4 h) | 295 | +0.251 | −0.144 à +0.676 | 392 | +0.195 | −0.315 à +0.701 | 71 % | −0.055 | −0.757 à +0.564 |
| 64 bougies (16 h) | 295 | +1.073 | +0.283 à +1.931 | 392 | +0.537 | −0.288 à +1.397 | 86 % | −0.537 | −1.728 à +0.618 |

### ETH · signaux d'entrée du préréglage

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 757 | +0.180 | +0.079 à +0.289 | 782 | +0.105 | +0.010 à +0.199 | 96 % | −0.076 | −0.217 à +0.068 |
| 4 bougies (1 h) | 757 | +0.300 | +0.151 à +0.462 | 782 | +0.030 | −0.119 à +0.177 | 61 % | −0.269 | −0.489 à −0.054 |
| 16 bougies (4 h) | 757 | +0.552 | +0.273 à +0.829 | 782 | +0.171 | −0.050 à +0.397 | 89 % | −0.380 | −0.735 à −0.014 |
| 64 bougies (16 h) | 757 | +1.401 | +0.852 à +1.972 | 781 | +0.841 | +0.332 à +1.340 | 100 % | −0.560 | −1.326 à +0.214 |

### ETH · chocs bruts dans le sens de la tendance 60 min

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 2850 | +0.106 | +0.067 à +0.147 | 3124 | +0.056 | +0.025 à +0.089 | 100 % | −0.050 | −0.098 à +0.001 |
| 4 bougies (1 h) | 2850 | +0.121 | +0.058 à +0.184 | 3124 | +0.065 | −0.001 à +0.129 | 95 % | −0.057 | −0.143 à +0.033 |
| 16 bougies (4 h) | 2850 | +0.149 | +0.039 à +0.265 | 3124 | +0.114 | −0.015 à +0.253 | 92 % | −0.035 | −0.210 à +0.137 |
| 64 bougies (16 h) | 2850 | +0.661 | +0.392 à +0.908 | 3122 | +0.321 | +0.048 à +0.586 | 98 % | −0.340 | −0.703 à +0.047 |

### ETH · signaux longs

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 457 | +0.052 | −0.041 à +0.140 | 410 | +0.200 | +0.059 à +0.355 | 99 % | +0.149 | −0.018 à +0.325 |
| 4 bougies (1 h) | 457 | +0.222 | +0.036 à +0.390 | 410 | +0.183 | −0.056 à +0.444 | 89 % | −0.039 | −0.336 à +0.277 |
| 16 bougies (4 h) | 457 | +0.163 | −0.134 à +0.427 | 410 | +0.295 | −0.097 à +0.691 | 89 % | +0.132 | −0.347 à +0.649 |
| 64 bougies (16 h) | 457 | +1.104 | +0.416 à +1.760 | 410 | +0.821 | −0.095 à +1.696 | 93 % | −0.283 | −1.432 à +0.851 |

### ETH · signaux shorts

| horizon | événements 2018–22 | excès 2018–22 | intervalle 90 % | événements 2022–26 | excès 2022–26 | intervalle 90 % | P(excès > 0) 2022–26 | différence | intervalle 90 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 bougie (15 min) | 300 | +0.376 | +0.173 à +0.583 | 372 | −0.001 | −0.135 à +0.126 | 50 % | −0.377 | −0.620 à −0.133 |
| 4 bougies (1 h) | 300 | +0.419 | +0.129 à +0.729 | 372 | −0.138 | −0.317 à +0.038 | 10 % | −0.557 | −0.917 à −0.214 |
| 16 bougies (4 h) | 300 | +1.144 | +0.679 à +1.662 | 372 | +0.035 | −0.320 à +0.394 | 56 % | −1.109 | −1.751 à −0.501 |
| 64 bougies (16 h) | 300 | +1.854 | +0.921 à +2.839 | 371 | +0.863 | +0.028 à +1.711 | 95 % | −0.990 | −2.272 à +0.252 |

## 5. Incertitude

Bootstrap des mois (5 000 tirages par moitié, BTC et ETH tirés ensemble) : Sharpe 2018–22 entre 1.58 et 2.75, 2022–26 entre 0.60 et 1.97 (90 %). Baisse observée −0.84, intervalle à 90 % −1.78 à +0.04, P(baisse) 94 %.

## 6. Contrôles

| contrôle | résultat | détail |
| --- | ---: | ---: |
| Sharpe H1 = rapport publié | ok | 2.1259146979 vs 2.125914698 |
| Sharpe H2 = rapport publié | ok | 1.2859198654 vs 1.285919865 |
| BTC H1 : ATR et volatilité journalière à l'entrée définis pour chaque trade | ok | 402 trades |
| BTC H2 : ATR et volatilité journalière à l'entrée définis pour chaque trade | ok | 484 trades |
| ETH H1 : ATR et volatilité journalière à l'entrée définis pour chaque trade | ok | 447 trades |
| ETH H2 : ATR et volatilité journalière à l'entrée définis pour chaque trade | ok | 471 trades |
| Identité de cellule BTC H1 calme | ok | 245 trades |
| Identité de cellule BTC H1 agité | ok | 157 trades |
| Identité de cellule BTC H2 calme | ok | 355 trades |
| Identité de cellule BTC H2 agité | ok | 129 trades |
| Identité de cellule ETH H1 calme | ok | 276 trades |
| Identité de cellule ETH H1 agité | ok | 171 trades |
| Identité de cellule ETH H2 calme | ok | 331 trades |
| Identité de cellule ETH H2 agité | ok | 140 trades |
| Identité exacte, portefeuille 50/50 rééquilibré H1 | ok | 2.2247767320 vs 2.2247767320 |
| Identité exacte, BTC H1 | ok |  |
| Identité exacte, ETH H1 | ok |  |
| Identité exacte, portefeuille 50/50 rééquilibré H2 | ok | 1.3310480488 vs 1.3310480488 |
| Identité exacte, BTC H2 | ok |  |
| Identité exacte, ETH H2 | ok |  |
| Variante ATR : même total | ok |  |
| Identité par sens H1 | ok |  |
| Identité par sens H2 | ok |  |
| Somme des effets + dérive = baisse publiée du Sharpe | ok | -0.8399948325 vs -0.8399948325 |

## Limites

- L'attribution est exacte pour chaque identité utilisée ; un autre découpage des facteurs donnerait d'autres parts. Les valeurs de Shapley répartissent les interactions à parts égales entre les groupes concernés. Les deux découpages (par sens, par facteurs) sont deux lectures du même total, à ne pas additionner.
- Taille des trades et environnement de volatilité sont liés : en unités de volatilité, la taille mesure la longueur des mouvements indépendamment du niveau de volatilité ; l'effet « environnement de volatilité » regroupe la conversion en % et la volatilité des sleeves, qui se compensent en partie.
- Chaque moitié dure quatre ans et ne contient que quelques phases baissières, celles qui portent les shorts. Le résultat dépend de la séquence des marchés autant que du signal.
- Diagnostic seulement : rien ici ne justifie de modifier la stratégie figée. Toute idée (par exemple traiter les shorts autrement) serait une nouvelle hypothèse, à figer avant de la tester sur des données non vues.
