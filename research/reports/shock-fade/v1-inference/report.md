# Shock Engine V1 — inférence statistique : IC, IR, appraisal ratio, intervalle du Sharpe

Protocole : `research/preregistration/v1-inference.md` (commité avant tout calcul). Généré par `research/fade/v1/v1-inference.ts`. V1 figée, lecture seule, aucune optimisation. Portefeuille BTC/ETH 50/50, 2952 jours (2018-09-01 → 2026-09-30), commissions de la fiche. **Tout est mesuré sur l'historique qui a servi à concevoir V1 : précision et significativité du résultat historique, pas validation prospective.**

Contrôles : V1 : 716 trades, Sharpe 2.0242 ; buy & hold 50/50 : Sharpe 0.7775 (fiche) ; M2 : α 44.8 %, t 4.94, ratio résiduel 1.89 (étude d'alpha résiduel).

## Résumé

| mesure | estimation | intervalle à 95 % (blocs de 21 jours) | lecture |
|---|---:|---:|---:|
| Sharpe de V1 (annualisé) | 2,02 | [1,42 ; 2,59] | PSR(0) > 99,99 % ; PSR(SR* = buy & hold 0,78) > 99,99 % (erreur type non iid) |
| IR contre le buy & hold 50/50 | 0,02 | [−0,71 ; +0,69] | t de Newey–West 0,07 |
| Appraisal ratio (M2) | 1,89 | [1,26 ; 2,56] | α 44,8 % par an, t 4,94 |
| IC du score |z|, horizon 64 bougies (tous signaux) | +0,018 | [−0,034 ; +0,075] | p 0,492 (Holm sur 4 horizons : 0,786) |

DSR (scénario prudent, `dsr-reeval`) : 98,9 %, non recalculé ici.

## 1. Coefficient d'information du score du signal

1269 signaux d'entrée de V1 (803 longs, 466 shorts ; BTC 606, ETH 663), exécutés ou non ; 8 fenêtres traversant un trou exclues. Score S = |z| du choc ; R_h = rendement log dans le sens du trade sur h bougies de 15 min, en ATR. IC = corrélation de Spearman ; intervalle à 95 % et p bilatéral par bootstrap des mois d'événements (5 000 tirages).

| événements | n | IC à 1 bougie [IC 95 %] · p | IC à 4 bougies [IC 95 %] · p | IC à 16 bougies [IC 95 %] · p | IC à 64 bougies [IC 95 %] · p |
|---|---:|---:|---:|---:|---:|
| tous | 1269 | −0,029 [−0,089 ; +0,034] · 0,393 | +0,042 [−0,011 ; +0,097] · 0,117 | +0,044 [−0,010 ; +0,095] · 0,102 | +0,018 [−0,034 ; +0,075] · 0,492 |
| longs | 803 | −0,029 [−0,113 ; +0,053] · 0,498 | +0,019 [−0,061 ; +0,097] · 0,608 | +0,022 [−0,055 ; +0,098] · 0,586 | +0,005 [−0,062 ; +0,072] · 0,872 |
| shorts | 466 | −0,023 [−0,117 ; +0,079] · 0,637 | +0,091 [−0,004 ; +0,187] · 0,060 | +0,083 [−0,002 ; +0,164] · 0,056 | +0,053 [−0,056 ; +0,163] · 0,330 |
| BTC | 606 | −0,027 [−0,120 ; +0,067] · 0,577 | +0,033 [−0,037 ; +0,108] · 0,371 | +0,006 [−0,069 ; +0,085] · 0,861 | −0,039 [−0,115 ; +0,041] · 0,328 |
| ETH | 663 | −0,030 [−0,098 ; +0,046] · 0,443 | +0,048 [−0,027 ; +0,129] · 0,212 | +0,080 [+0,004 ; +0,153] · 0,041 | +0,074 [−0,003 ; +0,152] · 0,064 |

Holm sur les 4 horizons (tous événements) : 1 : 0,786 ; 4 : 0,410 ; 16 : 0,410 ; 64 : 0,786.

**Rendement moyen dans le sens du trade (en ATR) et par quintile du score** : un IC nul n'exclut pas une continuation moyenne positive.

| événements | R moyen à 1 bougie [IC 95 %] | R moyen à 4 bougies [IC 95 %] | R moyen à 16 bougies [IC 95 %] | R moyen à 64 bougies [IC 95 %] |
|---|---:|---:|---:|---:|
| tous | +0,203 [+0,077 ; +0,326] | +0,349 [+0,145 ; +0,547] | +0,550 [+0,258 ; +0,848] | +1,499 [+0,758 ; +2,229] |
| longs | +0,213 [+0,036 ; +0,386] | +0,421 [+0,149 ; +0,709] | +0,597 [+0,209 ; +0,987] | +1,758 [+0,781 ; +2,652] |
| shorts | +0,186 [+0,003 ; +0,385] | +0,225 [−0,061 ; +0,532] | +0,470 [−0,045 ; +0,999] | +1,048 [−0,075 ; +2,167] |
| BTC | +0,187 [+0,015 ; +0,368] | +0,366 [+0,103 ; +0,653] | +0,480 [+0,066 ; +0,876] | +1,520 [+0,494 ; +2,588] |
| ETH | +0,219 [+0,078 ; +0,370] | +0,334 [+0,105 ; +0,571] | +0,614 [+0,277 ; +0,977] | +1,479 [+0,743 ; +2,207] |

| quintile de |z| | n | |z| médian | R moyen à 1 bougie | R moyen à 4 bougies | R moyen à 16 bougies | R moyen à 64 bougies |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 254 | 3,11 | +0,116 | +0,175 | +0,407 | +1,369 |
| 2 | 254 | 3,55 | +0,142 | +0,294 | +0,614 | +1,827 |
| 3 | 253 | 4,14 | +0,346 | +0,409 | +0,270 | +1,309 |
| 4 | 254 | 5,06 | +0,156 | +0,210 | +0,571 | +1,231 |
| 5 | 254 | 6,90 | +0,258 | +0,658 | +0,885 | +1,761 |

Secondaire — 716 trades exécutés, |z| à l'entrée contre R final du trade : IC −0,004 [−0,073 ; +0,066], p 0,966.

## 2. Ratio d'information contre le buy & hold BTC/ETH 50/50

Rendement actif a = r_V1 − r_BH (mêmes jours ; BH sans rebalancement, Sharpe 0,78). IR 0,02, t de Newey–West 0,07 (retard 8). Tracking error 72,2 % par an ; bêta de V1 sur le BH 0,032.

| blocs | IC à 95 % de l'IR |
|---|---:|
| 5 jours | [−0,66 ; +0,70] |
| 21 jours | [−0,71 ; +0,69] |
| 63 jours | [−0,77 ; +0,78] |
| 126 jours | [−0,82 ; +0,83] |
| mois calendaires | [−0,66 ; +0,71] |

## 3. Appraisal ratio (alpha par unité de risque résiduel)

| modèle | α par an | t (Newey–West) | appraisal ratio |
|---|---:|---:|---:|
| M0 : buy & hold BTC, ETH | 53,8 % | 4,85 | 1,98 |
| M1 : + 5 tendances journalières | 44,2 % | 4,60 | 1,75 |
| **M2 : + Donchian 15 min (principal)** | 44,8 % | 4,94 | **1,89** |

| blocs (régression réestimée à chaque tirage, 2 000 tirages) | IC à 95 % de l'appraisal ratio M2 |
|---|---:|
| 5 jours | [1,26 ; 2,54] |
| 21 jours | [1,26 ; 2,56] |
| 63 jours | [1,27 ; 2,57] |
| 126 jours | [1,28 ; 2,54] |
| mois calendaires | [1,20 ; 2,56] |

## 4. Intervalle de confiance et significativité du Sharpe de V1

Rendements journaliers : asymétrie 3,65, kurtosis 28,8 ; autocorrélations des retards 1 à 5 : +0,049, +0,086, +0,023, +0,051, +0,032 ; Q de Ljung–Box (10) = 42,9, p = 0,000.

| estimation du Sharpe annualisé | valeur |
|---|---:|
| journalier × √365,25 | 2,02 |
| hebdomadaire × √52,18 | 1,77 |
| mensuel × √12 | 1,73 |
| journalier, annualisation corrigée de Lo (2002), retards 1 à 10 (η = 16,22 contre √365 = 19,10) | 1,72 |

| méthode | erreur type | intervalle à 95 % |
|---|---:|---:|
| iid normale | 0,353 | [1,33 ; 2,72] |
| iid non normale (Mertens) | 0,292 | [1,45 ; 2,60] |
| non iid, Newey–West retard 8 (principal) | 0,308 | [1,42 ; 2,63] |
| non iid, Newey–West retard 21 | 0,302 | [1,43 ; 2,62] |
| non iid, Newey–West retard 63 | 0,291 | [1,45 ; 2,59] |
| bootstrap par blocs, 5 jours | 0,300 | [1,41 ; 2,59] |
| bootstrap par blocs, 21 jours (principal) | 0,300 | [1,42 ; 2,59] |
| bootstrap par blocs, 63 jours | 0,294 | [1,41 ; 2,59] |
| bootstrap par blocs, 126 jours | 0,271 | [1,47 ; 2,55] |
| bootstrap par blocs, mois calendaires | 0,304 | [1,41 ; 2,61] |

| PSR : P(vrai Sharpe > SR*) | erreur type de Mertens (PSR standard) | erreur type non iid (Newey–West) |
|---|---:|---:|
| SR* = 0 | > 99,99 % | > 99,99 % |
| SR* = 0,78 (buy & hold 50/50, même période) | > 99,99 % | > 99,99 % |

DSR : 98,9 % dans le scénario prudent (essais réellement en concurrence, corrélations mesurées, sélection supposée sur le portefeuille, 7 fois plus de procédures) ; 87,6 % avec le décompte pré-enregistré initial (222 essais, σ 0,602). Voir `research/reports/shock-fade/dsr-reeval/`.

## 5. Croissance composée contre le buy & hold (addendum)

Δg = écart des rendements logarithmiques annualisés = ln((1 + CAGR V1) / (1 + CAGR BH)). CAGR V1 67,7 %, BH 34,1 % : Δg = 22,4 % par an, soit une croissance relative de 25,1 % par an. t de Newey–West 0,86.

| blocs | IC à 95 % de Δg | P(Δg ≤ 0) | IC à 95 % de l'écart de Sharpe V1 − BH | P(écart ≤ 0) |
|---|---:|---:|---:|---:|
| 5 jours | [−27,4 % ; 71,4 %] | 0,197 | [+0,36 ; +2,13] | 0,0030 |
| 21 jours | [−27,1 % ; 75,6 %] | 0,196 | [+0,36 ; +2,09] | 0,0018 |
| 63 jours | [−32,0 % ; 80,5 %] | 0,211 | [+0,30 ; +2,20] | 0,0042 |
| 126 jours | [−37,2 % ; 81,3 %] | 0,228 | [+0,31 ; +2,19] | 0,0054 |
| mois calendaires | [−25,9 % ; 74,2 %] | 0,199 | [+0,39 ; +2,11] | 0,0018 |

Écart de Sharpe V1 − BH : +1,25.

| décomposition (annualisée) | V1 | buy & hold | écart |
|---|---:|---:|---:|
| rendement arithmétique moyen | 55,4 % | 53,6 % | 1,7 % |
| volatilité | 27,4 % | 69,0 % | −41,6 % |
| frein de volatilité (½ variance) | 3,7 % | 23,8 % | −20,1 % |
| croissance logarithmique | 51,7 % | 29,4 % | 22,4 % |

L'écart de croissance vient surtout de la moindre volatilité (moindre frein de volatilité), pas d'un rendement moyen plus élevé ; son incertitude est dominée par la volatilité du buy & hold.

## Lecture

- **Sharpe.** 2,02 sur les rendements journaliers, intervalle à 95 % [1,42 ; 2,59] ; toutes les méthodes (analytiques non iid, bootstrap de 5 à 126 jours, mois) donnent entre 1,41 et 2,63. Les rendements journaliers sont positivement autocorrélés (Ljung–Box p 0,000) : l'annualisation par √365 surestime le Sharpe annuel. Corrigé (Lo) ou mesuré sur semaines ou mois, il vaut 1,72 à 1,77, toujours nettement au-dessus de 0 et du buy & hold (0,78).
- **Alpha.** Après neutralisation du buy & hold et des six facteurs de tendance, l'appraisal ratio vaut 1,89 [1,26 ; 2,56], stable quelle que soit la longueur des blocs : l'alpha par unité de risque résiduel est la mesure la plus solide de l'étude.
- **IR contre le buy & hold : ≈ 0** (0,02 [−0,71 ; +0,69]). V1 obtient un rendement moyen comparable à celui du buy & hold avec un bêta de 0,03 et beaucoup moins de risque ; la différence de rendements est dominée par la volatilité du buy & hold (tracking error 72 %). Ce n'est pas la bonne mesure pour une stratégie peu exposée, mais le résultat est conservé tel quel.
- **Croissance composée contre le buy & hold : grande mais incertaine.** CAGR 67,7 % contre 34,1 %, soit 22,4 % par an d'écart logarithmique ; intervalle à 95 % [−27,1 % ; 75,6 %], P(écart ≤ 0) = 0,20. Le rendement moyen est le même (55,4 % contre 53,6 %) : tout l'écart vient du moindre frein de volatilité, et la volatilité du buy & hold rend l'écart de croissance statistiquement non significatif sur 8 ans. Ce qui est significatif, c'est l'écart de rendement ajusté du risque : Sharpe +1,25 [+0,36 ; +2,09], P(≤ 0) = 0,002.
- **IC du score : ≈ 0** à tous les horizons (de −0,029 à +0,044, aucun significatif après Holm). Un choc plus fort que le seuil n'annonce pas une meilleure continuation. En revanche, la continuation moyenne après un signal est nettement positive à tous les horizons (+0,20 ATR à 1 bougie, +1,50 ATR à 64 bougies, intervalles hors de zéro) : la valeur vient de l'occurrence du signal, pas de l'intensité du score. Il n'y a donc pas lieu de moduler la taille des positions selon |z|.

## Limites

- Historique unique, déjà utilisé pour concevoir V1 : ces intervalles mesurent l'incertitude d'échantillonnage du résultat historique, pas le biais de sélection (traité par le DSR) ni la persistance.
- L'IC porte sur le score de déclenchement (|z|) parmi des signaux déjà filtrés par ce score : il mesure si un choc plus fort annonce une meilleure continuation, pas si le signal a de la valeur (mesuré par les rendements moyens et l'alpha).
- L'IR contre le buy & hold compare une stratégie exposée environ 16 % du temps à un actif très volatil ; l'appraisal ratio, qui retire l'exposition au marché et aux tendances, est la mesure pertinente de l'alpha.
