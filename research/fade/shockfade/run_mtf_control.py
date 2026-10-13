"""Contrôle négatif de l'étude multi-timeframe : sur une martingale simulée (volatilité stochastique, saisonnalité,
sauts Hawkes symétriques, aucun transitoire), la course 50 % doit valoir 0,5 et le Fade moyen 0.

    cd research/fade && python3 -m shockfade.run_mtf_control
Sortie : research/reports/shock-fade/mtf/02-negative-control.{md,json}.
"""
import json

import numpy as np
import pandas as pd

from . import mtf
from . import stats as st
from .paths import REPORTS
from .synthetic import simulate_asset


def main():
    rows = []
    for seed in (21, 22, 23):
        a, _ = simulate_asset('MTFNEG', days=1096, transient=0.0, seed=seed)
        reg = mtf.regime_v1(a)
        for delta in (5, 15, 30, 60, 240):
            ev = mtf.detect(a, mtf.bar_z(a, delta), '2020-04-01', '2022-12-25', reg, None, k_min=3.0)
            ev = mtf.outcomes(a, ev, delta, None)
            for k in mtf.K_LEVELS:
                e = ev[ev['absZ'] >= k]
                if len(e) < 10:
                    continue
                dc = mtf.decluster(e, max(mtf.PRIMARY_H[delta]))
                ind = dc[dc['first_in_cluster']]
                rc = st.cluster_mean(ind['race50'].to_numpy() - 0.5, ind['xcluster'].to_numpy())
                hm = max(mtf.PRIMARY_H[delta])
                g = st.cluster_mean(ind[f'g{hm}'].to_numpy(), ind['xcluster'].to_numpy())
                rows.append({'seed': seed, 'delta': delta, 'k': k, 'n': rc['n'], 'race50': rc['mean'] + 0.5, 't_race': rc['t'],
                             'h': hm, 'g_bps': 1e4 * g['mean'], 't_g': g['t']})
    df = pd.DataFrame(rows)
    pooled = df.groupby(['delta', 'k']).apply(lambda z: pd.Series({'n': z['n'].sum(), 'race50': np.average(z['race50'], weights=z['n'])}), include_groups=False)
    L = ['# Shock Fade multi-timeframe — contrôle négatif (martingale simulée)', '',
         'Généré par `research/fade/shockfade/run_mtf_control.py`. Trois trajectoires de trois ans (graines 21, 22, 23), même '
         'détection, même regroupement et même course que sur les données réelles. Attendu : course 50 % ≈ 0,5, Fade ≈ 0.', '',
         '| TF | k | graine | n indép. | P(reprise d\'abord) | t | Fade moyen à l\'horizon primaire max. (pb) | t |', '|---|---:|---:|---:|---:|---:|---:|---:|']
    tf = {5: 'M5', 15: 'M15', 30: 'M30', 60: 'H1', 240: 'H4'}
    for r in rows:
        L.append(f"| {tf[r['delta']]} | {r['k']:g} | {r['seed']} | {r['n']} | {r['race50']:.3f} | {r['t_race']:.2f} | {r['g_bps']:.1f} | {r['t_g']:.2f} |")
    L += ['', 'Moyennes regroupées (pondérées par n) : ' + '; '.join(f"{tf[d]} k={k:g} : {v['race50']:.3f} (n = {int(v['n'])})" for (d, k), v in pooled.iterrows()), '']
    (REPORTS / 'mtf' / '02-negative-control.md').write_text('\n'.join(L) + '\n')
    (REPORTS / 'mtf' / '02-negative-control.json').write_text(json.dumps(rows, indent=1))
    print('\n'.join(L))


if __name__ == '__main__':
    main()
