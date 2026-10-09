# Falsification Monte-Carlo de E2 · test C : marchés synthétiques

Pré-spécification : `research/preregistration/e2-falsification.md`. Produit par `node research/shock/e2-synthetic.ts` (commit `3f785da`). Blocs calendaires communs à BTC et ETH, tirés avec remise sur 2017-08-18 → 2026-09-30 ; moteur, régime et E2 recalculés sur chaque trajectoire ; simulation dès le 2018-09-01 synthétique. Chaque longueur de bloc est rapportée séparément.

« Historique » : la même construction appliquée à la source dans l'ordre (trajectoire identité, volume normalisé, mintick de la règle), pour comparer à armes égales.

## Blocs de 1 jour · 1000 trajectoires

| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l'historique |
|---|---|---|---|---|---|---|---|---|---|
| Portefeuille 50/50 | ΔEV short (σ) | 47 % | −0,121 | −0,094 | −0,005 | +0,093 | +0,119 | +0,261 | 99,7 |
| Portefeuille 50/50 | ΔSharpe | 77 % | −0,26 | −0,14 | +0,21 | +0,52 | +0,62 | +0,15 | 42,6 |
| Portefeuille 50/50 | ΔCAGR | 89 % | −0,042 | −0,005 | +0,081 | +0,158 | +0,180 | −0,029 | 6,4 |
| Portefeuille 50/50 | ΔDD (> 0 : E2 baisse moins) | 97 % | +0,019 | +0,061 | +0,185 | +0,333 | +0,383 | +0,043 | 7,5 |
| Portefeuille 50/50 | D (V0 : E2 − hors E2, σ) | 47 % | −0,188 | −0,144 | −0,010 | +0,134 | +0,169 | +0,411 | 99,9 |
| Portefeuille 50/50 | Part des shorts V0 gardée par E2 | — | +0,24 | +0,25 | +0,32 | +0,38 | +0,40 | +0,31 | 47,5 |
| BTC | ΔEV short (σ) | 46 % | −0,160 | −0,128 | −0,009 | +0,124 | +0,160 | +0,129 | 91,0 |
| BTC | ΔSharpe | 80 % | −0,20 | −0,10 | +0,23 | +0,55 | +0,62 | −0,07 | 12,3 |
| BTC | ΔCAGR | 91 % | −0,022 | +0,006 | +0,090 | +0,169 | +0,191 | −0,154 | 0,0 |
| BTC | ΔPF | 77 % | −0,08 | −0,04 | +0,07 | +0,18 | +0,23 | +0,21 | 93,1 |
| BTC | ΔDD (> 0 : E2 baisse moins) | 96 % | +0,010 | +0,053 | +0,184 | +0,344 | +0,384 | +0,062 | 12,1 |
| BTC | D (V0 : E2 − hors E2, σ) | 46 % | −0,238 | −0,192 | −0,018 | +0,178 | +0,225 | +0,258 | 96,6 |
| BTC | Part des shorts V0 gardée par E2 | — | +0,21 | +0,23 | +0,30 | +0,38 | +0,40 | +0,33 | 67,8 |
| ETH | ΔEV short (σ) | 48 % | −0,138 | −0,113 | −0,003 | +0,116 | +0,152 | +0,394 | 100,0 |
| ETH | ΔSharpe | 70 % | −0,30 | −0,19 | +0,13 | +0,43 | +0,53 | +0,25 | 67,8 |
| ETH | ΔCAGR | 82 % | −0,071 | −0,035 | +0,078 | +0,177 | +0,205 | +0,017 | 24,1 |
| ETH | ΔPF | 70 % | −0,10 | −0,07 | +0,04 | +0,16 | +0,20 | +0,51 | 100,0 |
| ETH | ΔDD (> 0 : E2 baisse moins) | 93 % | −0,015 | +0,020 | +0,133 | +0,293 | +0,331 | +0,060 | 21,6 |
| ETH | D (V0 : E2 − hors E2, σ) | 47 % | −0,227 | −0,179 | −0,011 | +0,169 | +0,218 | +0,565 | 100,0 |
| ETH | Part des shorts V0 gardée par E2 | — | +0,23 | +0,25 | +0,32 | +0,41 | +0,43 | +0,30 | 30,3 |

P(DD_E2 < DD_V0), portefeuille 50/50 : 97 % (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane 813 ; E2 : 268.

## Blocs de 3 jours · 1000 trajectoires

| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l'historique |
|---|---|---|---|---|---|---|---|---|---|
| Portefeuille 50/50 | ΔEV short (σ) | 50 % | −0,128 | −0,105 | −0,000 | +0,107 | +0,140 | +0,261 | 99,6 |
| Portefeuille 50/50 | ΔSharpe | 69 % | −0,29 | −0,18 | +0,14 | +0,42 | +0,50 | +0,15 | 52,6 |
| Portefeuille 50/50 | ΔCAGR | 69 % | −0,096 | −0,065 | +0,034 | +0,114 | +0,139 | −0,029 | 19,6 |
| Portefeuille 50/50 | ΔDD (> 0 : E2 baisse moins) | 94 % | −0,012 | +0,028 | +0,157 | +0,302 | +0,347 | +0,043 | 13,3 |
| Portefeuille 50/50 | D (V0 : E2 − hors E2, σ) | 49 % | −0,192 | −0,156 | −0,004 | +0,159 | +0,204 | +0,411 | 99,9 |
| Portefeuille 50/50 | Part des shorts V0 gardée par E2 | — | +0,22 | +0,24 | +0,30 | +0,38 | +0,40 | +0,31 | 56,8 |
| BTC | ΔEV short (σ) | 50 % | −0,167 | −0,133 | +0,000 | +0,138 | +0,185 | +0,129 | 88,0 |
| BTC | ΔSharpe | 72 % | −0,32 | −0,19 | +0,14 | +0,43 | +0,52 | −0,07 | 19,3 |
| BTC | ΔCAGR | 73 % | −0,089 | −0,060 | +0,046 | +0,125 | +0,157 | −0,154 | 1,3 |
| BTC | ΔPF | 77 % | −0,09 | −0,06 | +0,07 | +0,22 | +0,27 | +0,21 | 89,1 |
| BTC | ΔDD (> 0 : E2 baisse moins) | 92 % | −0,036 | +0,012 | +0,154 | +0,304 | +0,354 | +0,062 | 19,3 |
| BTC | D (V0 : E2 − hors E2, σ) | 47 % | −0,259 | −0,203 | −0,010 | +0,210 | +0,264 | +0,258 | 94,2 |
| BTC | Part des shorts V0 gardée par E2 | — | +0,20 | +0,22 | +0,29 | +0,37 | +0,39 | +0,33 | 72,3 |
| ETH | ΔEV short (σ) | 51 % | −0,165 | −0,124 | +0,001 | +0,132 | +0,180 | +0,394 | 99,8 |
| ETH | ΔSharpe | 59 % | −0,35 | −0,25 | +0,06 | +0,35 | +0,44 | +0,25 | 79,0 |
| ETH | ΔCAGR | 65 % | −0,130 | −0,090 | +0,038 | +0,140 | +0,170 | +0,017 | 42,6 |
| ETH | ΔPF | 68 % | −0,11 | −0,08 | +0,04 | +0,17 | +0,20 | +0,51 | 99,9 |
| ETH | ΔDD (> 0 : E2 baisse moins) | 88 % | −0,065 | −0,009 | +0,133 | +0,283 | +0,336 | +0,060 | 27,2 |
| ETH | D (V0 : E2 − hors E2, σ) | 51 % | −0,248 | −0,188 | +0,002 | +0,196 | +0,261 | +0,565 | 99,9 |
| ETH | Part des shorts V0 gardée par E2 | — | +0,22 | +0,24 | +0,32 | +0,40 | +0,42 | +0,30 | 36,8 |

P(DD_E2 < DD_V0), portefeuille 50/50 : 94 % (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane 775 ; E2 : 248.

## Blocs de 7 jours · 1000 trajectoires

| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l'historique |
|---|---|---|---|---|---|---|---|---|---|
| Portefeuille 50/50 | ΔEV short (σ) | 51 % | −0,144 | −0,114 | +0,004 | +0,122 | +0,166 | +0,261 | 99,2 |
| Portefeuille 50/50 | ΔSharpe | 58 % | −0,31 | −0,23 | +0,05 | +0,34 | +0,41 | +0,15 | 68,6 |
| Portefeuille 50/50 | ΔCAGR | 36 % | −0,178 | −0,141 | −0,031 | +0,068 | +0,089 | −0,029 | 50,9 |
| Portefeuille 50/50 | ΔDD (> 0 : E2 baisse moins) | 89 % | −0,041 | −0,004 | +0,103 | +0,233 | +0,270 | +0,043 | 22,7 |
| Portefeuille 50/50 | D (V0 : E2 − hors E2, σ) | 49 % | −0,222 | −0,174 | −0,003 | +0,175 | +0,227 | +0,411 | 99,5 |
| Portefeuille 50/50 | Part des shorts V0 gardée par E2 | — | +0,22 | +0,24 | +0,30 | +0,37 | +0,39 | +0,31 | 57,5 |
| BTC | ΔEV short (σ) | 50 % | −0,192 | −0,146 | −0,001 | +0,165 | +0,211 | +0,129 | 85,4 |
| BTC | ΔSharpe | 57 % | −0,33 | −0,25 | +0,04 | +0,32 | +0,42 | −0,07 | 30,7 |
| BTC | ΔCAGR | 38 % | −0,163 | −0,124 | −0,021 | +0,072 | +0,103 | −0,154 | 6,2 |
| BTC | ΔPF | 75 % | −0,11 | −0,06 | +0,08 | +0,25 | +0,31 | +0,21 | 84,6 |
| BTC | ΔDD (> 0 : E2 baisse moins) | 88 % | −0,049 | −0,013 | +0,101 | +0,236 | +0,282 | +0,062 | 33,3 |
| BTC | D (V0 : E2 − hors E2, σ) | 49 % | −0,286 | −0,219 | −0,007 | +0,232 | +0,297 | +0,258 | 92,2 |
| BTC | Part des shorts V0 gardée par E2 | — | +0,20 | +0,22 | +0,29 | +0,37 | +0,39 | +0,33 | 74,9 |
| ETH | ΔEV short (σ) | 50 % | −0,172 | −0,138 | +0,001 | +0,147 | +0,194 | +0,394 | 99,8 |
| ETH | ΔSharpe | 49 % | −0,40 | −0,31 | −0,00 | +0,30 | +0,38 | +0,25 | 85,4 |
| ETH | ΔCAGR | 43 % | −0,210 | −0,176 | −0,025 | +0,107 | +0,136 | +0,017 | 64,4 |
| ETH | ΔPF | 66 % | −0,15 | −0,10 | +0,05 | +0,21 | +0,27 | +0,51 | 99,7 |
| ETH | ΔDD (> 0 : E2 baisse moins) | 84 % | −0,084 | −0,032 | +0,113 | +0,249 | +0,295 | +0,060 | 30,9 |
| ETH | D (V0 : E2 − hors E2, σ) | 49 % | −0,260 | −0,206 | −0,006 | +0,219 | +0,286 | +0,565 | 99,9 |
| ETH | Part des shorts V0 gardée par E2 | — | +0,22 | +0,24 | +0,32 | +0,39 | +0,42 | +0,30 | 37,0 |

P(DD_E2 < DD_V0), portefeuille 50/50 : 89 % (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane 748 ; E2 : 239.

## Blocs de 14 jours · 1000 trajectoires

| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l'historique |
|---|---|---|---|---|---|---|---|---|---|
| Portefeuille 50/50 | ΔEV short (σ) | 53 % | −0,149 | −0,112 | +0,008 | +0,132 | +0,174 | +0,261 | 99,4 |
| Portefeuille 50/50 | ΔSharpe | 54 % | −0,33 | −0,25 | +0,01 | +0,27 | +0,34 | +0,15 | 74,8 |
| Portefeuille 50/50 | ΔCAGR | 18 % | −0,232 | −0,196 | −0,070 | +0,029 | +0,053 | −0,029 | 70,7 |
| Portefeuille 50/50 | ΔDD (> 0 : E2 baisse moins) | 87 % | −0,044 | −0,016 | +0,081 | +0,184 | +0,214 | +0,043 | 31,5 |
| Portefeuille 50/50 | D (V0 : E2 − hors E2, σ) | 49 % | −0,227 | −0,182 | −0,004 | +0,188 | +0,244 | +0,411 | 99,6 |
| Portefeuille 50/50 | Part des shorts V0 gardée par E2 | — | +0,23 | +0,24 | +0,31 | +0,38 | +0,40 | +0,31 | 53,8 |
| BTC | ΔEV short (σ) | 52 % | −0,186 | −0,140 | +0,005 | +0,168 | +0,216 | +0,129 | 83,5 |
| BTC | ΔSharpe | 50 % | −0,36 | −0,26 | +0,00 | +0,27 | +0,33 | −0,07 | 36,6 |
| BTC | ΔCAGR | 23 % | −0,206 | −0,178 | −0,060 | +0,038 | +0,067 | −0,154 | 15,0 |
| BTC | ΔPF | 76 % | −0,13 | −0,08 | +0,09 | +0,28 | +0,35 | +0,21 | 81,5 |
| BTC | ΔDD (> 0 : E2 baisse moins) | 83 % | −0,055 | −0,025 | +0,077 | +0,185 | +0,223 | +0,062 | 40,7 |
| BTC | D (V0 : E2 − hors E2, σ) | 47 % | −0,323 | −0,239 | −0,015 | +0,234 | +0,313 | +0,258 | 92,1 |
| BTC | Part des shorts V0 gardée par E2 | — | +0,21 | +0,23 | +0,30 | +0,38 | +0,40 | +0,33 | 69,7 |
| ETH | ΔEV short (σ) | 50 % | −0,178 | −0,146 | −0,000 | +0,162 | +0,208 | +0,394 | 99,5 |
| ETH | ΔSharpe | 42 % | −0,43 | −0,34 | −0,04 | +0,22 | +0,30 | +0,25 | 91,6 |
| ETH | ΔCAGR | 24 % | −0,277 | −0,241 | −0,077 | +0,054 | +0,095 | +0,017 | 80,9 |
| ETH | ΔPF | 65 % | −0,15 | −0,11 | +0,05 | +0,22 | +0,28 | +0,51 | 99,6 |
| ETH | ΔDD (> 0 : E2 baisse moins) | 80 % | −0,089 | −0,045 | +0,080 | +0,206 | +0,254 | +0,060 | 43,1 |
| ETH | D (V0 : E2 − hors E2, σ) | 50 % | −0,270 | −0,227 | +0,001 | +0,245 | +0,322 | +0,565 | 99,5 |
| ETH | Part des shorts V0 gardée par E2 | — | +0,22 | +0,25 | +0,32 | +0,40 | +0,43 | +0,30 | 34,1 |

P(DD_E2 < DD_V0), portefeuille 50/50 : 87 % (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane 727 ; E2 : 240.

## Blocs de 30 jours · 1000 trajectoires

| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l'historique |
|---|---|---|---|---|---|---|---|---|---|
| Portefeuille 50/50 | ΔEV short (σ) | 66 % | −0,130 | −0,094 | +0,040 | +0,187 | +0,238 | +0,261 | 97,0 |
| Portefeuille 50/50 | ΔSharpe | 50 % | −0,34 | −0,28 | +0,00 | +0,24 | +0,31 | +0,15 | 78,4 |
| Portefeuille 50/50 | ΔCAGR | 10 % | −0,272 | −0,230 | −0,095 | +0,001 | +0,031 | −0,029 | 78,4 |
| Portefeuille 50/50 | ΔDD (> 0 : E2 baisse moins) | 83 % | −0,048 | −0,023 | +0,056 | +0,137 | +0,167 | +0,043 | 41,8 |
| Portefeuille 50/50 | D (V0 : E2 − hors E2, σ) | 62 % | −0,206 | −0,156 | +0,053 | +0,275 | +0,331 | +0,411 | 97,9 |
| Portefeuille 50/50 | Part des shorts V0 gardée par E2 | — | +0,23 | +0,25 | +0,32 | +0,40 | +0,42 | +0,31 | 44,6 |
| BTC | ΔEV short (σ) | 63 % | −0,164 | −0,122 | +0,048 | +0,236 | +0,297 | +0,129 | 72,2 |
| BTC | ΔSharpe | 43 % | −0,38 | −0,30 | −0,03 | +0,21 | +0,27 | −0,07 | 42,5 |
| BTC | ΔCAGR | 15 % | −0,232 | −0,196 | −0,081 | +0,015 | +0,038 | −0,154 | 20,9 |
| BTC | ΔPF | 74 % | −0,14 | −0,09 | +0,10 | +0,30 | +0,38 | +0,21 | 78,3 |
| BTC | ΔDD (> 0 : E2 baisse moins) | 80 % | −0,058 | −0,028 | +0,059 | +0,151 | +0,179 | +0,062 | 51,6 |
| BTC | D (V0 : E2 − hors E2, σ) | 60 % | −0,267 | −0,202 | +0,046 | +0,328 | +0,427 | +0,258 | 84,3 |
| BTC | Part des shorts V0 gardée par E2 | — | +0,20 | +0,22 | +0,30 | +0,39 | +0,41 | +0,33 | 65,5 |
| ETH | ΔEV short (σ) | 61 % | −0,166 | −0,124 | +0,036 | +0,190 | +0,247 | +0,394 | 99,0 |
| ETH | ΔSharpe | 41 % | −0,41 | −0,34 | −0,04 | +0,23 | +0,29 | +0,25 | 92,5 |
| ETH | ΔCAGR | 19 % | −0,329 | −0,268 | −0,097 | +0,038 | +0,068 | +0,017 | 85,8 |
| ETH | ΔPF | 67 % | −0,19 | −0,13 | +0,05 | +0,26 | +0,32 | +0,51 | 99,3 |
| ETH | ΔDD (> 0 : E2 baisse moins) | 73 % | −0,086 | −0,057 | +0,051 | +0,162 | +0,194 | +0,060 | 54,2 |
| ETH | D (V0 : E2 − hors E2, σ) | 60 % | −0,280 | −0,205 | +0,050 | +0,306 | +0,381 | +0,565 | 99,2 |
| ETH | Part des shorts V0 gardée par E2 | — | +0,24 | +0,26 | +0,34 | +0,42 | +0,45 | +0,30 | 26,7 |

P(DD_E2 < DD_V0), portefeuille 50/50 : 83 % (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane 709 ; E2 : 243.

## Contrôles

- ✔ BTC : trajectoire identité = barres source · 377044 barres
- ✔ BTC : moteur de la trajectoire identité = v1 exactement · régime identique : true ; equity barre par barre : true ; 1050 trades
- ✔ BTC : régime tiré des barres 15 min = régime tiré des barres 60 min, à historique égal · 0 barre(s) différente(s) sur 490948
- ✔ ETH : trajectoire identité = barres source · 319294 barres
- ✔ ETH : moteur de la trajectoire identité = v1 exactement · régime identique : true ; equity barre par barre : true ; 918 trades
- Trajectoire identité dans la construction du test (2017-08-18 → 2026-09-30, simulation dès le 2018-09-01, volume normalisé, mintick de la règle) : Sharpe 50/50 V0 1.731 et E2 1.882 ; EV short V0 BTC 0.241, ETH 0.185 ; E2 BTC 0.370, ETH 0.579. Référence v1 publiée : Sharpe 50/50 1,726 (V0) et 1,880 (E2).
- ✔ trajectoire déterministe (même graine → mêmes résultats) · L = 7, j = 0, calculée deux fois
