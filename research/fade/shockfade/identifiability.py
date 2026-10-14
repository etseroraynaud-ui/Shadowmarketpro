"""Identifiabilité des composantes latentes (livrable 4) : Hawkes, état-espace permanent/transitoire,
profil de vraisemblance en φ, ratios de variance, OU naïf. Période de conception seulement.

    cd research/fade && python3 -m shockfade.identifiability
Sortie : research/reports/shock-fade/05-identifiability.{md,json}.
"""
from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from . import config as C
from . import ou
from .eventstudy import load_events
from .paths import DERIVED, REPORTS
from .pipeline import DAY_MIN, load_asset
from .trial_log import log

SYMS = ['BTCUSDT', 'ETHUSDT']
PROFILE_QUARTERS = ['2021-01-01', '2022-07-01', '2024-07-01']
HALF_LIVES = [0.5, 1, 3, 7, 15, 30, 60, 120, 480]


def fits_of(sym: str) -> dict:
    return {int(k): v for k, v in json.loads((DERIVED / f'fits-{sym}.json').read_text()).items()}


def profile(a, qs: int, base: dict) -> list[dict]:
    i1 = a.minute_of(qs)
    i0 = max(i1 - C.FIT_DAYS * DAY_MIN, int(np.argmax(np.isfinite(a.vol.L))))
    sl = slice(i0, i1)
    jl2 = np.where(a.jump[sl] != 0, a.vol.L[sl] ** 2, 0.0)
    args = (a.x[sl], a.u[sl], a.vol.v[sl], jl2)
    out = []
    start = dict(base['ss']['params'])
    for hl in HALF_LIVES:
        phi = 2 ** (-1 / hl)
        start['phi'] = phi
        f = ou.fit(*args, start=start, fixed_phi=phi, hessian=False)
        out.append({'half_life': hl, 'phi': phi, 'loglik': f.loglik, 'lam_Q': f.params['lam_Q'], 'sig_Q': f.params['sig_Q'],
                    'psi_jump': f.psi_jump(), 'psi_flow': f.psi_flow()})
    return out


def variance_ratios(a, start: str, end: str) -> dict:
    """VR(q) des rendements standardisés par la volatilité prévue, z_i = r_i/√v_i bornés à ±6 (sauts compris).

    Numérateur et dénominateur portent sur les mêmes minutes (blocs complets) : exclure les blocs contenant un
    saut abaisserait artificiellement VR (sélection des blocs calmes).
    """
    i0, i1 = a.minute_of(C.ms(start)), a.minute_of(C.ms(end))
    z = np.clip(a.vol.r[i0:i1] / np.sqrt(a.vol.v[i0:i1]), -6, 6)
    out = {}
    for q in (2, 5, 15, 60, 240):
        n = len(z) // q
        blk = z[: n * q].reshape(n, q)
        ok = np.isfinite(blk).all(axis=1)
        b = blk[ok]
        out[q] = float(np.mean(b.sum(axis=1) ** 2) / (q * np.mean(b ** 2)))
    a1 = np.isfinite(z[1:]) & np.isfinite(z[:-1])
    out['ac1'] = float(np.corrcoef(z[1:][a1], z[:-1][a1])[0, 1])
    return out


def main():
    res = {'hawkes': {}, 'ss': {}, 'profile': {}, 'vr': {}, 'events': {}}
    L = ['# Shock Fade Engine — identifiabilité des composantes latentes', '',
         'Généré par `research/fade/shockfade/identifiability.py`. Estimations trimestrielles sur les 180 jours précédant chaque '
         'trimestre (2020-07 → 2024-10), données 1 min des perpétuels. Aucune donnée de C.', '']
    # ---------------------------------------------------------------- Hawkes
    L += ['## 1. Hawkes bivarié (sauts identifiés ±)', '',
          '| actif | trimestre | sauts | μ₊ ; μ₋ (/jour) | n₊₊ | n₊₋ | n₋₊ | n₋₋ | t½ ₊₊ ; ₋₋ (min) | ρ(G) | LR vs Poisson | LR vs univarié (p) | GOF hors éch. p (₊ ; ₋) |',
          '|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|---|']
    for sym in SYMS:
        F = fits_of(sym)
        rows = []
        for q in sorted(F):
            f = F[q]
            h, t = f['hawkes'], f['hawkes_tests']
            G = np.array(h['branching'])
            hl = np.array(h['half_life_min'])
            go = t['gof_out'] or {}
            gp = [go.get(k, {}).get('p') for k in ('up', 'down')]
            rows.append({'q': f['quarter_start'], 'n': h['n_events'], 'mu': (np.array(h['mu']) * 1440).tolist(), 'G': G.tolist(),
                         'hl': [hl[0, 0], hl[1, 1]], 'rho': h['rho'], 'lr_pois': t['lr_vs_poisson']['stat'],
                         'lr_univ': t['lr_vs_univariate']['stat'], 'p_univ': t['lr_vs_univariate']['p_chi2'], 'gof_out_p': gp})
            L.append(f"| {sym} | {f['quarter_start']} | {h['n_events']} | {1440 * h['mu'][0]:.2f} ; {1440 * h['mu'][1]:.2f} | "
                     f"{G[0, 0]:.2f} | {G[0, 1]:.2f} | {G[1, 0]:.2f} | {G[1, 1]:.2f} | {hl[0, 0]:.1f} ; {hl[1, 1]:.1f} | {h['rho']:.2f} | "
                     f"{t['lr_vs_poisson']['stat']:.0f} | {t['lr_vs_univariate']['stat']:.0f} ({t['lr_vs_univariate']['p_chi2']:.1e}) | "
                     + ' ; '.join('—' if p is None else f'{p:.3f}' for p in gp) + ' |')
        res['hawkes'][sym] = rows
    allp = [p for s in SYMS for r in res['hawkes'][s] for p in r['gof_out_p'] if p is not None]
    L += ['', f"n_km = α_km/β_km : nombre moyen de sauts de type k déclenchés par un saut de type m (k, m ∈ {{₊, ₋}}). "
          f"Tests de changement de temps hors échantillon rejetés à 5 % : {np.mean(np.array(allp) < 0.05) * 100:.0f} % des "
          f"{len(allp)} cas (Poisson : rejet dans tous les cas). L'excitation est nette et l'excitation croisée significative, "
          'mais le modèle à intensité de base constante n\'est pas stable d\'un trimestre à l\'autre : ses prévisions de niveau '
          'sont biaisées (voir H3a).', '']
    # ---------------------------------------------------------------- état-espace
    L += ['## 2. État-espace prix = permanent + transitoire (OU) piloté par le flux', '',
          '| actif | trimestre | φ | t½ (min) ± e.t. | λ_F | λ_Q | ψ_flux | ψ_saut ± e.t. | σ_F | σ_Q | σ_e | valeur propre min. de la hessienne | LR « sans transitoire » |',
          '|---|---|---:|---|---:|---:|---:|---|---:|---:|---:|---:|---:|']
    for sym in SYMS:
        F = fits_of(sym)
        rows = []
        for q in sorted(F):
            s = F[q]['ss']
            p, se = s['params'], s['se'] or {}
            rows.append({'q': F[q]['quarter_start'], **p, 'half_life': s['half_life_min'], 'psi_flow': s['psi_flow'], 'psi_jump': s['psi_jump'],
                         'se': se, 'lr': F[q]['ss_lr_no_transient']})
            fmt = lambda k: '—' if not np.isfinite(se.get(k, np.nan)) else f"{se[k]:.3f}"
            L.append(f"| {sym} | {F[q]['quarter_start']} | {p['phi']:.3f} | {s['half_life_min']:.2f} ± {fmt('half_life_min')} | {p['lam_F']:.3f} | "
                     f"{p['lam_Q']:.3f} | {s['psi_flow']:.2f} | {s['psi_jump']:.2f} ± {fmt('psi_jump')} | {p['sig_F']:.3f} | {p['sig_Q']:.3f} | "
                     f"{p['sig_e']:.3f} | {se.get('hessian_min_eig', float('nan')):.2g} | {F[q]['ss_lr_no_transient']:.0f} |")
        res['ss'][sym] = rows
    L += ['', 'Lecture : la composante transitoire **identifiée** a une demi-vie de 0,25 à 0,8 minute ; elle reprend 14–28 % de '
          'l\'impact instantané du flux (ψ_flux) et 10–21 % de l\'amplitude des sauts (ψ_saut). Le test « sans transitoire » est '
          'massivement rejeté, mais ce transitoire disparaît **avant** qu\'une entrée à une minute de latence soit possible. '
          'Une valeur propre négative de la hessienne signale que σ_Q et σ_e (deux bruits presque blancs quand φ est petit) ne '
          'sont pas séparément identifiés ; φ, λ_F, λ_Q et ψ_saut le sont (erreurs types faibles).', '']
    # ---------------------------------------------------------------- profil de vraisemblance
    L += ['## 3. Profil de vraisemblance en φ (demi-vie imposée)', '',
          'Pour chaque demi-vie imposée, les sept autres paramètres sont réestimés. ΔLL = log-vraisemblance − celle du modèle sans '
          'transitoire : une composante lente (10 min à 8 h) n\'est soutenue par les données que si ΔLL reste grand quand on '
          'impose une demi-vie longue.', '']
    for sym in SYMS:
        a = load_asset(sym, C.DESIGN_GRID_END)
        F = fits_of(sym)
        res['profile'][sym] = {}
        res['vr'][sym] = {}
        L += [f'**{sym}**', '', '| trimestre | ' + ' | '.join(f't½ = {h} min' for h in HALF_LIVES) + ' | sans transitoire |',
              '|---|' + '---:|' * (len(HALF_LIVES) + 1)]
        for qd in PROFILE_QUARTERS:
            qs = C.ms(qd)
            prof = profile(a, qs, F[qs])
            lr0 = F[qs]['ss_restricted']['loglik']
            res['profile'][sym][qd] = {'rows': prof, 'restricted_loglik': lr0}
            L.append(f'| {qd} | ' + ' | '.join(f"{r['loglik'] - lr0:+.0f} (ψ_J {r['psi_jump']:.2f})" for r in prof) + ' | 0 |')
        L.append('')
        for y0, y1 in (('2020-07-01', '2022-07-01'), ('2022-07-01', '2025-01-01')):
            res['vr'][sym][f'{y0}→{y1}'] = variance_ratios(a, y0, y1)
    slow = [r['loglik'] - v['restricted_loglik'] for sym in SYMS for v in res['profile'][sym].values() for r in v['rows'] if r['half_life'] >= 60]
    best = [max(r['loglik'] for r in v['rows']) - v['restricted_loglik'] for sym in SYMS for v in res['profile'][sym].values()]
    res['profile_summary'] = {'slow_dll_min': float(min(slow)), 'slow_dll_max': float(max(slow)), 'best_dll_min': float(min(best)), 'best_dll_max': float(max(best))}
    L += [f"Lecture : dans les six fenêtres, la vraisemblance est maximale pour une demi-vie inférieure ou égale à une minute "
          f"(ΔLL {min(best):+.0f} à {max(best):+.0f}). Avec une demi-vie imposée de 1 à 8 heures, le modèle reste meilleur que « sans "
          f"transitoire » (ΔLL {min(slow):+.0f} à {max(slow):+.0f}) : une réversion lente n'est **pas exclue**. Mais le gain est de 5 à "
          "200 fois plus faible, varie fortement d'une fenêtre à l'autre, et un modèle à une seule composante ne peut pas dire si "
          "cette réversion lente suit les chocs ou vient d'une hétéroscédasticité mal modélisée. La séparation d'une composante "
          "lente et d'une composante rapide demanderait un modèle à deux transitoires (non pré-enregistré).", '']
    L += ['Ratios de variance des rendements standardisés par la volatilité prévue (bornés à ±6, sauts compris) ; VR(q) < 1 = '
          'réversion moyenne à l\'échelle de q minutes, VR = 1 marche aléatoire :', '',
          '| actif | période | autocorr. 1 min | VR(2) | VR(5) | VR(15) | VR(60) | VR(240) |', '|---|---|---:|---:|---:|---:|---:|---:|']
    for sym in SYMS:
        for per, v in res['vr'][sym].items():
            L.append(f"| {sym} | {per} | {v['ac1']:+.3f} | {v[2]:.3f} | {v[5]:.3f} | {v[15]:.3f} | {v[60]:.3f} | {v[240]:.3f} |")
    # ---------------------------------------------------------------- caractéristiques OU des événements
    ev = load_events(5)
    e4 = ev[ev['absZ'] >= C.K_SHOCK]
    cost = 2 * C.COSTS['C1']
    res['events'] = {'Q_T_bps_median': float(1e4 * e4['Q_T'].median()), 'psi_T_median': float(e4['psi_T'].median()),
                     'rho_gt_cost': {h: float(np.mean(e4[f'rho{h}'] > cost)) for h in C.HORIZONS},
                     'rho_median_bps': {h: float(1e4 * e4[f'rho{h}'].median()) for h in C.HORIZONS},
                     'naive_b_mean': float(e4['naive_b'].mean()), 'naive_hl_median_min': float(np.median(math.log(2) / -np.log(e4['naive_b'].clip(1e-9, 1 - 1e-12)))),
                     'naive_b_lt1_share': float(np.mean(e4['naive_b'] < 1))}
    r = res['events']
    L += ['', '## 4. Ce que l\'OU donne au moment de la décision (chocs 5 min, |Z| ≥ 4, période E)', '',
          f"- Déviation transitoire filtrée en T, dans le sens du choc : médiane {r['Q_T_bps_median']:.2f} pb ; part transitoire "
          f"estimée du mouvement de la barre ψ_T médiane {r['psi_T_median']:.3f}.",
          '- Réversion OU prévue entre l\'entrée (T+1) et la sortie, médiane (pb) : ' + ', '.join(f'h={h} : {v:.2f}' for h, v in r['rho_median_bps'].items()) +
          ' ; part des chocs où elle dépasse le coût aller-retour (14 pb) : ' + ', '.join(f'h={h} : {100 * v:.1f} %' for h, v in r['rho_gt_cost'].items()) + '.',
          f"- OU naïf sur le prix brut (AR(1) sur 1 440 minutes) : b moyen {r['naive_b_mean']:.5f}, b < 1 dans {100 * r['naive_b_lt1_share']:.0f} % "
          f"des cas, « demi-vie » médiane {r['naive_hl_median_min']:.0f} min. Sur une marche aléatoire simulée, le même estimateur "
          'donne b < 1 dans plus de 90 % des fenêtres (biais de Dickey–Fuller, test `test_naive_ou_on_random_walk_shows_spurious_reversion`) : '
          'cette « réversion » n\'est pas une propriété du marché. En walk-forward, ce contrôle n\'a aucun pouvoir prédictif (06-walkforward.md).', '',
          '## 5. Conclusion d\'identifiabilité', '',
          '- **Identifiable** : sauts au sens statistique (rejet de la diffusion locale, 1 min) ; excitation propre et croisée des '
          'sauts (Hawkes, LR massifs) ; composante transitoire **ultra-rapide** (demi-vie < 1 min) et sa part dans l\'impact du flux '
          'et des sauts.',
          '- **Faiblement identifiable avec ces données** : une composante transitoire lente (10 min à quelques heures). Le '
          'profil de vraisemblance la soutient face à « aucun transitoire » et les ratios de variance des rendements standardisés '
          '(VR(15) ≈ 0,89–0,93, VR(60) ≈ 0,87–0,93) indiquent une réversion **inconditionnelle** modeste à 15–60 min, '
          'mais le modèle à une composante ne la sépare pas de la composante rapide, et sa part dans un choc donné n\'est pas '
          'estimable. **Non identifiés** : la séparation σ_Q / σ_e ; la stabilité des paramètres Hawkes d\'un trimestre à l\'autre.',
          '- **Non démontrable** : qu\'un choc donné soit « principalement transitoire ». Les caractéristiques OU des modèles M4–M7 '
          'sont donc des proxies (déviation filtrée d\'un modèle à une composante), pas une mesure démontrée de l\'impact temporaire.', '']
    (REPORTS / '05-identifiability.md').write_text('\n'.join(L) + '\n')
    (REPORTS / '05-identifiability.json').write_text(json.dumps(res, indent=1, default=float))
    log('shockfade/identifiability.py', 'paramètres trimestriels, profil en φ (9 demi-vies × 3 trimestres), VR', '2020-01 → 2024-12')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
