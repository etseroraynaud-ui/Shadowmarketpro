# Sharpe dégonflé (DSR) de E2, V1 et B2

Méthode et comptes d'essais pré-enregistrés dans `research/preregistration/calm-only.md` §5, appliqués à l'identique aux trois stratégies. Généré par `research/fade/v1/dsr-e2-v1-b2.ts`, en lecture seule. Portefeuille BTC/ETH 50/50, rendements journaliers du 2018-09-01 au 2026-09-30 (2952 jours), commissions de la fiche. B2 = V1 + point mort dès +3 R (`research/reports/shock-fade/v1-be-volume/`).

Contrôles : Sharpe de E2, V1 et B2 identiques aux références publiées ; DSR de E2 et de V1 et DSR du gain V1 − E2 identiques à `research/reports/calm-only/` (écart < 10⁻⁶).

## 1. Sharpe absolu

Écart type des Sharpe des essais (annualisé) : univers A (16 variantes proches de E2) 0,137 ; univers B (206 candidats de la recherche des réglages) 0,602. Le seuil SR₀ est le Sharpe maximal attendu de N essais sans talent ; DSR = P(vrai Sharpe > SR₀).

| stratégie | Sharpe | asymétrie / kurtosis | PSR(0) | DSR, N = 16 (A) | DSR, N = 16 (B) | DSR, N = 222 (B) | DSR, N = 6 266 (B) | DSR, N = 128 547 (B) | N* où DSR < 95 % (B) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| E2 | 1,88 | 3,37 / 25,7 | 100,00 % | 100,0 % (seuil 0,25) | 99,6 % (seuil 1,08) | 73,8 % (seuil 1,69) | 10,4 % (seuil 2,26) | 0,4 % (seuil 2,68) | 53 |
| V1 | 2,02 | 3,65 / 28,8 | 100,00 % | 100,0 % (seuil 0,25) | 99,9 % (seuil 1,08) | 87,6 % (seuil 1,69) | 21,5 % (seuil 2,26) | 1,3 % (seuil 2,68) | 109 |
| B2 | 2,09 | 3,76 / 29,4 | 100,00 % | 100,0 % (seuil 0,25) | 100,0 % (seuil 1,08) | 92,1 % (seuil 1,69) | 28,7 % (seuil 2,26) | 2,2 % (seuil 2,68) | 158 |
| B2, N à jour (+ 19 essais) | | | | | 100,0 % à N = 16 | 91,2 % à N = 241 | 28,7 % à N = 6 285 | 2,2 % à N = 128 566 | |

N = 16 : univers A ; 222 : A + les 206 candidats ; 6 266 : toutes les configurations distinctes évaluées dans la lignée ; 128 547 : borne extrême (3 graines × 207 × 207 paires de réglages). Pour B2, la ligne « à jour » ajoute les 11 trailings et les 8 variantes point mort / volume.

## 2. Gain d'une étape sur la précédente

Série d_t = r_t(stratégie) − r_t(précédente). N = nombre d'alternatives essayées contre la précédente ; écart type = dispersion des ratios d'information de ces alternatives.

| gain | ratio d'information | asymétrie / kurtosis | PSR(0) | N | écart type des essais | seuil | DSR |
|---|---:|---:|---:|---:|---:|---:|---:|
| V1 − E2 | 0,558 | −1,96 / 52,7 | 93,7 % | 15 | 0,503 | 0,891 | **18,0 %** |
| B2 − V1 | 0,936 | 5,66 / 204,4 | 99,8 % | 8 | 0,557 | 0,812 | **64,9 %** |

Ratios d'information des 8 variantes contre V1 : B1 −0,33, B2 0,94, V1 −1,01, V2 −0,68, V3 −0,77, V4 −0,34, C1 −0,54, C2 −0,08.

## 3. Calcul, exemple : V1, N = 222, univers B

1. Rendements journaliers du portefeuille : T = 2952 jours, moyenne 0,001516, écart type 0,01431. Sharpe journalier SR = 0,10592 (× √365,25 = 2,0242). Asymétrie γ₃ = 3,652, kurtosis γ₄ = 28,81 (3 pour une loi normale).
2. Écart type des Sharpe journaliers des essais : σ = 0,6023 / √365,25 = 0,03151.
3. Maximum attendu de N Sharpe nuls : SR₀ = σ · [(1 − γ) Φ⁻¹(1 − 1/N) + γ Φ⁻¹(1 − 1/(N e))], γ = 0,5772 (Euler-Mascheroni). Φ⁻¹(1 − 1/222) = 2,6117, Φ⁻¹(1 − 1/(222 e)) = 2,9370 → SR₀ = 0,08822 par jour (1,686 annualisé).
4. Statistique : z = (SR − SR₀) √(T − 1) / √(1 − γ₃ SR + (γ₄ − 1)/4 · SR²) = (0,10592 − 0,08822) × √2951 / 0,8314 = 1,156.
5. DSR = Φ(z) = **87,6 %**. PSR(0) est le même calcul avec SR₀ = 0.

## 4. Lecture

- **Sharpe absolu.** Les trois passent largement contre l'univers A et contre la dispersion B à N = 16. À N = 222 (la lignée connue), E2 73,8 %, V1 87,6 %, B2 92,1 % : aucune n'atteint 95 %. Le DSR passe sous 95 % au-delà de N* ≈ 53 essais pour E2, 109 pour V1, 158 pour B2. Avec 6 266 configurations, aucun Sharpe historique ne résiste.
- **Gains.** V1 sur E2 : DSR 18,0 % ; B2 sur V1 : DSR 64,9 %. Ni l'un ni l'autre n'atteint 95 % une fois compté le nombre d'alternatives essayées. Pris seul, le gain de B2 est net (PSR(0) 99,8 %, comme le bootstrap de l'étude : p Holm 0,008) ; c'est le seuil des 8 essais (0,81 de ratio d'information) qui le ramène à 64,9 %. Ce seuil est sévère : la dispersion des 8 variantes vient surtout de vraies différences (les règles de volume sont nettement perdantes), pas seulement du hasard. La série d'écart est concentrée sur quelques jours (kurtosis 204), ce qui élargit aussi l'incertitude.
- **Sévérité.** L'écart type B mêle bruit et vraies différences entre réglages (candidats en moyenne perdants) : il rend le DSR sévère. Les 16 variantes de l'univers A, très corrélées, donnent un N effectif plus faible que 16. Les réglages ont été choisis sur BTC seul. Seule une validation prospective tranchera.
