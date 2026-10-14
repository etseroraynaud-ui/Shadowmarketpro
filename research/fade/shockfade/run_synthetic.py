"""Contrôles négatif et positif du pipeline complet sur données simulées (protocole § 9).

    cd research/fade && python3 -m shockfade.run_synthetic
Sortie : research/reports/shock-fade/02-synthetic-controls.{md,json}.
"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

from . import config as C
from . import stats as st
from . import walkforward as wf
from .paths import REPORTS
from .pipeline import build_events, filtered_transient, structural_fits
from .synthetic import simulate_asset

E0, E1 = '2020-07-01', '2023-01-01'
V0 = '2021-07-01'


def run_one(sym: str, transient: float, seed: int) -> dict:
    t = time.time()
    a, truth = simulate_asset(sym, transient=transient, seed=seed)
    quarters = C.quarter_starts(E0, E1)
    fits = structural_fits(a, quarters, cache=False)
    Qf = filtered_transient(a, fits)
    ev = build_events(a, 5, fits, Qf, E0, E1)
    ev4 = ev[ev['absZ'] >= C.K_SHOCK].copy()
    preds = pd.concat([wf.predict(ev4, 5, h, V0, E1) for h in C.HORIZONS], ignore_index=True)
    evaluation = wf.evaluate(preds, boot=1000)
    cands = wf.candidates(evaluation)
    days = st.day_of(ev4['T'].to_numpy())
    gross = {h: st.cluster_mean(ev4[f'g{h}'].to_numpy(), days) for h in C.HORIZONS}
    first = fits[quarters[0]]
    ss = [fits[q]['ss'] for q in quarters]
    out = {
        'truth': truth, 'n_jumps_detected': int((a.jump != 0).sum()), 'n_events_k4': int(len(ev4)),
        'hawkes_first_quarter': first['hawkes'], 'hawkes_lr_univariate_p': [fits[q]['hawkes_tests']['lr_vs_univariate']['p_chi2'] for q in quarters],
        'ss_half_life_min': [s['half_life_min'] for s in ss], 'ss_psi_jump': [s['psi_jump'] for s in ss],
        'ss_lr_no_transient': [fits[q]['ss_lr_no_transient'] for q in quarters],
        'gross_fade_bps': {h: {'mean': 1e4 * g['mean'], 't': g['t'], 'n': g['n']} for h, g in gross.items()},
        'cw': {f'{m}@{h}': {'r2_oos': evaluation[(5, h)][m]['cw']['r2_oos'], 'p': evaluation[(5, h)][m]['cw']['p']}
               for h in C.HORIZONS for m in wf.MODELS if m != 'M1'},
        'cw_holm_min': None, 'selection': cands['selection'], 'research_score': cands['research_score'],
        'seconds': round(time.time() - t),
    }
    keys = list(out['cw'])
    adj = st.holm(np.array([out['cw'][k]['p'] for k in keys if not k.startswith('CTRL')]))
    out['cw_holm'] = dict(zip([k for k in keys if not k.startswith('CTRL')], adj.tolist()))
    out['cw_holm_min'] = float(np.nanmin(adj))
    return out


def ctrl_seeds(seeds=(11, 23, 37)) -> list[dict]:
    """Contrôle négatif rejoué avec d'autres graines : régression du Fade sur ρ^naïf (OU sur prix brut)."""
    out = []
    for seed in seeds:
        a, _ = simulate_asset('SYNNEG', transient=0.0, seed=seed)
        quarters = C.quarter_starts(E0, E1)
        fits = structural_fits(a, quarters, cache=False)
        ev = build_events(a, 5, fits, filtered_transient(a, fits), E0, E1)
        ev = ev[ev['absZ'] >= C.K_SHOCK]
        days = st.day_of(ev['T'].to_numpy())
        row = {'seed': seed, 'n': int(len(ev))}
        for h in (1, 4, 16):
            y = ev[f'g{h}'].to_numpy()
            X = np.column_stack([np.ones(len(y)), ev[f'naive_rho{h}'].to_numpy()])
            b, se, t, _, _ = st.cluster_ols(y, X, days)
            P = wf.predict(ev, 5, h, V0, E1)
            cw = st.clark_west(P['g'].to_numpy(), P['pred_M1'].to_numpy(), P['pred_CTRL'].to_numpy(), st.day_of(P['T'].to_numpy()))
            row[h] = {'slope': float(b[1]), 't': float(t[1]), 'r2_oos': cw['r2_oos'], 'p_cw': cw['p'],
                      'gross_mean_bps': float(1e4 * np.nanmean(y))}
        out.append(row)
    return out


def main():
    res = {'negative': run_one('SYNNEG', 0.0, 11), 'positive': run_one('SYNPOS', 0.4, 11), 'ctrl_seeds': ctrl_seeds()}
    (REPORTS / '02-synthetic-controls.json').write_text(json.dumps(res, indent=1, default=float))
    L = ['# Shock Fade Engine — contrôles du pipeline sur données simulées', '',
         'Généré par `research/fade/shockfade/run_synthetic.py`. Trois ans de minutes simulées (volatilité stochastique, '
         'saisonnalité, sauts Hawkes **symétriques** de 6 + Exp(4) écarts types, flux corrélé), pipeline complet identique '
         'aux données réelles : estimations trimestrielles, chocs |Z| ≥ 4 à 5 min, walk-forward 2021-07 → 2022-12.', '',
         '- **Contrôle négatif** : aucune composante transitoire ; la direction du saut suivant est imprévisible. Attendu : '
         'Fade brut ≈ 0, aucun modèle meilleur que M1, aucune sélection.',
         '- **Contrôle positif** : 40 % de chaque saut est transitoire (demi-vie 10 min). Attendu : Fade brut > 0 aux '
         'horizons courts, l\'état-espace retrouve une part transitoire des sauts, les modèles OU battent M1.', '']
    for name, r in res.items():
        if name == 'ctrl_seeds':
            continue
        L += [f'## Contrôle {"négatif" if name == "negative" else "positif"}', '',
              f"Sauts simulés {r['truth']['n_true_jumps']}, détectés (Lee–Mykland) {r['n_jumps_detected']} ; chocs |Z| ≥ 4 : {r['n_events_k4']} ; "
              f"durée {r['seconds']} s.", '',
              f"Hawkes (1er trimestre) : μ = {np.round(r['hawkes_first_quarter']['mu'], 5).tolist()}, "
              f"α/β = {np.round(r['hawkes_first_quarter']['branching'], 3).tolist()} (vrai : 0,2 partout).", '',
              f"État-espace : demi-vie médiane {np.median(r['ss_half_life_min']):.2f} min, part transitoire des sauts ψ_J médiane "
              f"{np.median(r['ss_psi_jump']):.3f}, LR « pas de transitoire » médian {np.median(r['ss_lr_no_transient']):.0f}.", '',
              '| horizon (barres 5 min) | Fade brut moyen (pb) | t (groupé par jour) | n |', '|---:|---:|---:|---:|']
        for h, g in r['gross_fade_bps'].items():
            L.append(f"| {h} | {g['mean']:.2f} | {g['t']:.2f} | {g['n']} |")
        L += ['', f"Clark–West contre M1 : plus petite p-valeur ajustée (Holm, M2…M7 × 6 horizons) = {r['cw_holm_min']:.3g}.", '',
              '| modèle | ' + ' | '.join(f'h={h}' for h in C.HORIZONS) + ' |', '|---|' + '---:|' * len(C.HORIZONS)]
        for mdl in wf.MODELS[1:]:
            L.append(f'| {mdl} R²_OOS (p) | ' + ' | '.join(
                f"{100 * r['cw'][f'{mdl}@{h}']['r2_oos']:.2f} % ({r['cw'][f'{mdl}@{h}']['p']:.3f})" for h in C.HORIZONS) + ' |')
        L += ['', f"Sélection (règle du protocole) : {r['selection']} ; score de recherche : {r['research_score']}.", '']
    L += ['## Contrôle négatif, trois graines : OU naïf sur prix brut', '',
          'Pente de la régression du Fade brut sur ρ^naïf (t groupé par jour, tout l\'échantillon) et Clark–West hors '
          'échantillon contre M1. Sous le contrôle négatif, le prix est une martingale : tout pouvoir prédictif est fortuit.', '',
          '| graine | n | h | Fade brut (pb) | pente | t | R²_OOS | p Clark–West |', '|---:|---:|---:|---:|---:|---:|---:|---:|']
    for r in res['ctrl_seeds']:
        for h in (1, 4, 16):
            z = r[h]
            L.append(f"| {r['seed']} | {r['n']} | {h} | {z['gross_mean_bps']:.2f} | {z['slope']:.3f} | {z['t']:.2f} | {100 * z['r2_oos']:.2f} % | {z['p_cw']:.3f} |")
    L += ['', 'Lecture : une graine sur trois donne une p-valeur < 0,01 au contrôle naïf, les deux autres rien ; le signe est '
          'celui de la continuation, pas de la réversion. Un test isolé non corrigé peut donc « valider » un modèle sur une '
          'marche aléatoire : d\'où les corrections de Holm et le holdout.', '']
    (REPORTS / '02-synthetic-controls.md').write_text('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
