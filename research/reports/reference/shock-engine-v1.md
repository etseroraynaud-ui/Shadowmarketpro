# Shock Engine V1 — fiche de référence

**Retenue le 2026-10-13** comme version de référence de Shock Engine ; E2 (deux régimes) devient son benchmark historique. Générée par `research/shock/reference.ts` (commit `15cace1`) : chaque chiffre est recalculé depuis le moteur figé et contrôlé contre les rapports publiés. **Simulation historique après coûts modélisés, pas une performance live.**

## Définition

- **E2 inchangée** : mêmes deux jeux de réglages (préréglage adaptatif 15 min choisi sur BTC, appliqué tel quel à ETH), même filtre de tendance journalière baissière sur les shorts, mêmes sorties, même taille.
- **Une seule différence** : aucune nouvelle entrée quand la bougie de signal est en régime agité. Le jeu agité n'autorisant que des longs, seules des entrées longues disparaissent ; une position ouverte en régime calme garde ses sorties si le régime change.
- Portefeuille BTC/ETH 50/50 sans rebalancement, commission 0,045 % par ordre, fenêtre 2018-09-01 → 2026-09-30.
- Code : `calmOnly()` dans `research/lib/calm-only.ts`. Nom à ne pas confondre avec la **v1 historique** du dépôt (miroir short sans condition, `research/reports/btc-eth-portfolio/`).

## Indicateurs

| Indicateur | Shock Engine V1 | E2 (benchmark) |
| --- | ---: | ---: |
| Sharpe | **2,02** | 1,88 |
| CAGR | **67,7 %** | 61,6 % |
| Drawdown maximal | **−17,8 %** | −19,1 % |
| Profit factor (rendements des trades) | **2,46** | 1,96 |
| Trades (BTC + ETH) | **716** (358 + 358) | 1 311 (644 + 667) |
| Taux de réussite | 31 % | 31 % |
| Sharpe avec commissions doublées | **1,88** | 1,61 |
| CAGR avec commissions doublées | 61,2 % | 50,2 % |
| Rendement total | 6436 % | 4748 % |
| Volatilité annuelle | 27,4 % | 27,6 % |
| Sortino · Calmar | 4,73 · 3,79 | 4,25 · 3,22 |
| Pire mois | −13,9 % (2022-02) | −15,2 % (2022-02) |
| Temps en position (moyenne des deux sleeves) | 16 % | 17 % |
| Sharpe BTC · ETH | 1,46 · 1,93 | 1,46 · 1,75 |
| CSCV-PBO (16 configurations) | **19,2 %** | — |

## Statut de validation

- **Historique, dans l'échantillon.** Les réglages ont été choisis sur BTC 2017–2026 et V1 a été construite après avoir vu BTC/ETH ; aucun de ces chiffres n'est un résultat hors échantillon.
- **Surajustement de sélection** (`research/reports/calm-only/`) : PBO 19,2 % ; V1 fait mieux que E2 8 années sur 9 ; walk-forward 2020–2026, Δ Sharpe +0,157 (IC 95 % −0,029 à +0,328) ; DSR du gain sur E2 18 % (48 % avec commissions doublées). Verdict de la règle pré-enregistrée : **candidate fragile** — l'avantage sur E2 est régulier mais pas démontré au-delà du hasard de sélection.
- **Sharpe absolu** : compte tenu de toute la recherche des réglages, le Sharpe dégonflé passe sous 95 % au-delà d'environ 109 essais pour V1 (53 pour E2) ; la lignée en compte au moins 222. Le niveau historique ne doit pas être pris comme une prévision.
- **Études de capacité, d'exécution et de risque** (`research/capacity/`, `research/execution/`, dossier) : réalisées sur E2. V1 passe environ deux fois moins d'ordres, tous issus du régime calme ; ces études n'ont pas été recalculées pour V1.
- **Live** : ni le bot ni le site ne sont modifiés par cette fiche ; le passage de V1 en shadow ou en live est une décision et un changement séparés.

## Fichiers

- `reference.json` : fiche lisible par machine (indicateurs, contrôles, statut).
- `reference_daily_returns.csv` : rendements journaliers BTC, ETH et portefeuille de V1 et de E2 (commissions × 1).

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | lib/strategies/shock/market.ts |
| empreinte lib/strategies/shock/strategy.ts | OK | lib/strategies/shock/strategy.ts |
| empreinte lib/strategies/shock/broker.ts | OK | lib/strategies/shock/broker.ts |
| empreinte lib/strategies/shock/engine.ts | OK | lib/strategies/shock/engine.ts |
| empreinte lib/strategies/shock/params.ts | OK | lib/strategies/shock/params.ts |
| empreinte lib/strategies/shock/presets.ts | OK | lib/strategies/shock/presets.ts |
| empreinte lib/strategies/shock/regimes.ts | OK | lib/strategies/shock/regimes.ts |
| empreinte research/lib/frozen-shock.ts | OK | research/lib/frozen-shock.ts |
| empreinte research/lib/e2.ts | OK | research/lib/e2.ts |
| fenêtre commune 2018-09-01 → 2026-09-30 | OK | 2952 jours |
| E2 : Sharpe, CAGR et drawdown du portefeuille publié | OK | 1.877566513 · 0.6164062401 · -0.1912434817 |
| E2 : trades publiés (644 + 667) | OK | 644 + 667 |
| V1 : valeurs figées (CALM_ONLY_REFERENCE) | OK | 2.0242078888605257 · 1.878228130093312 · 716 |
| V1 : CAGR, drawdown et profit factor publiés (étude du régime agité) | OK | 0.6772734 · -0.17849879 · 2.4569619 |

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/reference.ts
```
