# Diagnostics historiques de E2 · BTC/ETH

Pré-spécification : `research/preregistration/e2-diagnostics.md` (commitée avant tout calcul). Produit par `node research/shock/e2-diagnostics.ts` au commit `315a3c8`.

**Données déjà vues** : E2 a été choisie sur ces données. Ces diagnostics peuvent l'éliminer, pas la valider. La validation forward (`research/preregistration/e2-forward.md`) n'est pas modifiée. Simulation historique après coûts modélisés ; pas une performance live.

## Conclusion

**E2 NON ÉLIMINÉE** : elle résiste aux trois tentatives de réfutation. Ce n'est pas une validation ; seul le forward peut l'apporter.

| Critère d'élimination | Valeur | Seuil d'élimination | Éliminée ? |
|---|---|---|---|
| 1 · Placebo aléatoire, niveau trade : p1 | 0,0016 | ≥ 0,05 | non |
| 2 · Placebo par décalage, niveau trade : p2 | 0,0054 | ≥ 0,10 | non |
| 3 · D avec funding historique | +0,421 | ≤ 0 | non |
| 4 · Stabilité (sans élimination) : fenêtres de 24 mois où E2 bat la v1 | 72 % | « fragile » si < 50 % | — |

Échantillon : 794 shorts v1 fermés avant le 2026-10-01 (BTC depuis 2017, ETH depuis 2018-09), dont 251 en régime E2 baissier (BTC 143, ETH 108). **D(E2) = +0,423 σ** par short. Portefeuille 50/50 (2018-09-01 → 2026-09-30) : v1 1,73 ; sélection E2 des shorts v1 1,89 ; challenger E2 (entrées masquées hors régime) 1,88.

## 1. Placebo par sous-échantillonnage aléatoire

On garde au hasard exactement autant de shorts v1 que E2, par actif (BTC 143, ETH 108).

| Test | E2 | Placebo : moyenne | P95 | Max | p (placebo ≥ E2) | Tirages |
|---|---|---|---|---|---|---|
| D, même nombre par actif | +0,423 | +0,003 | +0,246 | +0,495 | 0,0016 | 10000 |
| D, même nombre par actif et par année | +0,423 | +0,181 | +0,397 | +0,682 | 0,0316 | 10000 |
| Sharpe du portefeuille 50/50 | 1,89 | 1,62 | 1,79 | 2,02 | 0,012 | 1000 |

Shorts réellement exécutés dans l'échantillon : sélection E2 251, placebos 251,0 en moyenne (251 à 251), pour 251 sélectionnés. Le placebo par année retire la part de E2 qui vient du choix des années : il mesure la sélection à l'intérieur d'une année.

## 2. Placebo par décalage temporel du régime

La série E2 de chaque actif est décalée circulairement de k jours (même k pour BTC et ETH), k de 180 à 2772 jours : 2593 décalages. Persistance et part de temps en régime baissier conservées.

| Test | E2 | Placebo : moyenne | P95 | Max | p (placebo ≥ E2) | Décalages |
|---|---|---|---|---|---|---|
| D | +0,423 | −0,011 | +0,266 | +0,530 | 0,0054 | 2593 |
| Sharpe du portefeuille 50/50 | 1,89 | 1,60 | 1,80 | 1,99 | 0,013 | 400 |

Shorts gardés selon le décalage : 202 à 339 (médiane 269), contre 251 pour E2. Décalages qui font le mieux : 2266 j (D +0,530, 249 shorts) ; 885 j (D +0,528, 239 shorts) ; 2263 j (D +0,496, 245 shorts) ; 891 j (D +0,486, 236 shorts) ; 888 j (D +0,470, 234 shorts).

## 3. Funding des perpétuels et glissement

Signe : un short reçoit le funding quand le taux est positif (les longs paient) et le paie quand il est négatif. Funding total en somme des versements rapportés à l'equity à l'entrée de chaque trade. Portefeuille : funding de toutes les positions (longs et shorts) ajouté aux rendements journaliers ; scénario de stress : shorts seulement.

| Scénario | D | Funding des shorts E2 (Σ, % de l'equity) | Funding des autres shorts | Sharpe v1 | Sharpe E2 | CAGR v1 · E2 | Drawdown v1 · E2 |
|---|---|---|---|---|---|---|---|
| Sans funding | +0,423 | — | — | 1,73 | 1,88 | 64,5 % · 61,6 % | −23,5 % · −19,1 % |
| Funding historique Binance (avant 2020 : +0,01 % / 8 h) | +0,421 | 5,6 % | 14,6 % | 1,70 | 1,81 | 62,6 % · 58,4 % | −23,5 % · −19,2 % |
| Idem, Hyperliquid depuis mai 2023 | +0,419 | 6,1 % | 17,5 % | 1,69 | 1,80 | 62,1 % · 57,6 % | −23,4 % · −19,2 % |
| Stress : les shorts paient 0,01 % / 8 h en permanence | +0,421 | −10,6 % | −19,0 % | 1,67 | 1,86 | 61,8 % · 60,7 % | −24,1 % · −19,2 % |

D par année avec le funding historique Binance : 2017 — · 2018 +1,34 · 2019 −0,37 · 2020 −0,32 · 2021 +0,12 · 2022 +0,17 · 2023 +0,25 · 2024 +0,54 · 2025 −0,07 · 2026 +1,99.

| Glissement par ordre | D | Sharpe v1 | Sharpe E2 | CAGR v1 · E2 |
|---|---|---|---|---|
| 0,00 % | +0,423 | 1,73 | 1,88 | 64,5 % · 61,6 % |
| 0,01 % | +0,423 | 1,66 | 1,82 | 60,9 % · 59,1 % |
| 0,02 % | +0,424 | 1,59 | 1,76 | 57,4 % · 56,6 % |
| 0,05 % | +0,426 | 1,37 | 1,58 | 47,2 % · 49,0 % |

Hypothèses : quantité d'entrée gardée jusqu'à la sortie (les shorts n'ont pas de TP1 ; pour les longs du régime agité, le funding après TP1 est légèrement surestimé, à l'identique pour v1 et E2). Avant 2020, pas de données Binance : taux constant de +0,01 % par 8 h.

## 4. Stabilité

| Année | Shorts E2 · autres | D | Sharpe 50/50 v1 | Sharpe 50/50 E2 |
|---|---|---|---|---|
| 2017 (partielle) | 0 · 7 | — | — | — |
| 2018 (partielle) | 40 · 35 | +1,33 | 4,81 | 4,97 |
| 2019 | 37 · 35 | −0,37 | 1,16 | 0,43 |
| 2020 | 8 · 58 | −0,30 | 1,42 | 1,66 |
| 2021 | 9 · 47 | +0,14 | 1,79 | 1,84 |
| 2022 | 71 · 60 | +0,16 | 1,97 | 1,75 |
| 2023 | 34 · 115 | +0,25 | 0,19 | 1,09 |
| 2024 | 6 · 62 | +0,54 | 2,66 | 3,07 |
| 2025 | 34 · 62 | −0,07 | 1,78 | 1,91 |
| 2026 (partielle) | 12 · 62 | +2,00 | 1,17 | 1,78 |

| Fenêtre glissante | Fenêtres | E2 bat la v1 (Sharpe) | Écart de Sharpe : médiane | P10 | P90 | Min | D > 0 | D : médiane | D : min |
|---|---|---|---|---|---|---|---|---|---|
| 12 mois | 86 | 60 % | +0,18 | −0,48 | +0,76 | −1,00 | 77 % (86) | +0,22 | −1,40 |
| 24 mois | 74 | 72 % | +0,16 | −0,17 | +0,45 | −0,31 | 81 % (74) | +0,24 | −0,29 |

Fenêtres de 24 mois les plus défavorables à E2 (fin) : 2021-06-30 (−0,31) ; 2021-07-31 (−0,29) ; 2021-05-31 (−0,27). Séries complètes : `rolling.csv`.

## Contrôles (20/22)

- ✔ empreinte lib/strategies/shock/market.ts · b69ad8f8f89a4ded
- ✔ empreinte lib/strategies/shock/strategy.ts · fafb22d6373b19bf
- ✔ empreinte lib/strategies/shock/broker.ts · bad42836b9d61569
- ✔ empreinte lib/strategies/shock/engine.ts · 15211a3e185b1214
- ✔ empreinte lib/strategies/shock/params.ts · 5f7cd0c941d70273
- ✔ empreinte lib/strategies/shock/presets.ts · f97449733ec945bb
- ✔ empreinte lib/strategies/shock/regimes.ts · d72f79d1d97c214d
- ✔ empreinte lib/strategies/shock/live.ts · 05caf82ece9ad7f8
- ✔ empreinte research/lib/frozen-shock.ts · be445aa726433c3e
- ✔ BTC : régime recalculé = régime du moteur · 0 écart(s)
- ✔ ETH : régime recalculé = régime du moteur · 0 écart(s)
- ✔ BTC : v1 = rapport validé · écart relatif 0.0e+0
- ✔ BTC : chaque short v1 entre sur une barre de signal short · entryIdx = barre du signal
- ✔ ETH : v1 = rapport validé · écart relatif 0.0e+0
- ✔ ETH : chaque short v1 entre sur une barre de signal short · entryIdx = barre du signal
- ✔ portefeuille 50/50 v1 = Sharpe publié · 1.726052721 vs 1.726052721
- ✔ échantillon = référence historique du forward · 794 shorts, 251 en régime E2 (BTC 143, ETH 108), D = 0.4228
- ✔ sélection de tous les shorts v1 = v1 exactement · equity identique barre par barre sur les deux sleeves
- ✔ décalage nul = E2 · mêmes drapeaux pour les 794 shorts
- ✘ BTC : funding croissant, sans trou de plus de 8 h (Binance) ni 1 h (Hyperliquid, après 2023-06) · Binance 7395 versements du 2020-01-01 au 2026-09-30, Hyperliquid 29142 depuis le 2023-05-12
- ✘ ETH : funding croissant, sans trou de plus de 8 h (Binance) ni 1 h (Hyperliquid, après 2023-06) · Binance 7395 versements du 2020-01-01 au 2026-09-30, Hyperliquid 29142 depuis le 2023-05-12
- ✔ glissement nul = runs de référence · mêmes Sharpe et D
