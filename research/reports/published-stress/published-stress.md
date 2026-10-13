# Funding et glissement : stress du portefeuille publié

Méthode de `research/shock/e2-diagnostics.ts` § 3, validée en redonnant à l'identique les valeurs publiées pour E2 (contrôles ci-dessous). Commit `059234c`, sources modifiées.

| Scénario | Sharpe | CAGR | Drawdown max. | Sharpe E2 (benchmark) |
| --- | ---: | ---: | ---: | ---: |
| sans funding | 2,02 | 67,7 % | −17,8 % | 1,88 |
| funding historique Binance (+0,01 % / 8 h avant 2020) | 1,97 | 64,7 % | −17,9 % | 1,81 |
| idem, Hyperliquid depuis mai 2023 | 1,95 | 64,0 % | −17,9 % | 1,80 |
| stress : les shorts paient 0,01 % / 8 h | 2,00 | 66,7 % | −18,1 % | 1,86 |

| Glissement par ordre | Sharpe | Sharpe E2 (benchmark) |
| --- | ---: | ---: |
| 0,00 % | 2,02 | 1,88 |
| 0,01 % | 1,99 | 1,82 |
| 0,02 % | 1,96 | 1,76 |
| 0,05 % | 1,86 | 1,58 |

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| E2, funding binance = e2-diagnostics | OK | Sharpe 1.813446195 / 1.813446195 |
| E2, funding hyperliquid = e2-diagnostics | OK | Sharpe 1.797277246 / 1.797277246 |
| E2, funding shortsPay = e2-diagnostics | OK | Sharpe 1.855952240 / 1.85595224 |
| E2, glissement 0 % = e2-diagnostics | OK | 1.877566513 / 1.877566513 |
| E2, glissement 0.01 % = e2-diagnostics | OK | 1.819588965 / 1.819588965 |
| E2, glissement 0.02 % = e2-diagnostics | OK | 1.761575202 / 1.761575202 |
| E2, glissement 0.05 % = e2-diagnostics | OK | 1.581793727 / 1.581793727 |
| portefeuille publié sans stress = fiche de référence | OK | 2.024207889 / 2.024207889 |

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/published-stress.ts
```
