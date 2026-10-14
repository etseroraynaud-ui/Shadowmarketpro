"""Contrôles a posteriori (non pré-enregistrés) de la course 50 % : par sens du choc (effet de la tendance de fond ?),
par régime et par type de cassure. Descriptif.

    cd research/fade && python3 -m shockfade.run_mtf_race_checks
Sortie : research/reports/shock-fade/mtf/03-race-checks.{md,json}.
"""
import json

import numpy as np
import pandas as pd

from . import mtf
from . import stats as st
from .paths import DERIVED, REPORTS
from .trial_log import log

TF = {5: 'M5', 15: 'M15', 30: 'M30', 60: 'H1', 240: 'H4'}


def race(sub: pd.DataFrame) -> str:
    x = sub['race50'].to_numpy()
    ok = np.isfinite(x)
    if ok.sum() < 10:
        return f'— ({int(ok.sum())})'
    r = st.cluster_mean(x[ok] - 0.5, sub['xcluster'].to_numpy()[ok])
    return f"{r['mean'] + 0.5:.3f} ({r['t']:.1f}) [{r['n']}]"


def main():
    res = {}
    L = ['# Shock Fade multi-timeframe — contrôles a posteriori de la course 50 %', '',
         'Généré par `research/fade/shockfade/run_mtf_race_checks.py`. **Non pré-enregistré**, descriptif : P(reprise de 50 % '
         'avant une extension de 50 %) sur les chocs indépendants, t contre 0,5 (erreurs groupées) et effectif entre crochets. '
         'Si la continuation venait de la tendance haussière de fond, elle apparaîtrait sur les chocs haussiers et s\'inverserait '
         'sur les baissiers.', '']
    for sample, label in (('P', 'P 2020-07 → 2026-09'), ('R', 'R 2018-01 → 2019-12')):
        L += [f'## {label}', '', '| TF | k | chocs haussiers | chocs baissiers | calme | agité | B1 propre | B1 rejetée ou sans | BTC | ETH |',
              '|---|---:|---|---|---|---|---|---|---|---|']
        for delta in (5, 15, 30, 60, 240):
            ev = pd.read_parquet(DERIVED / f'mtf-{sample}-{delta}m.parquet')
            for k in mtf.K_LEVELS:
                e = ev[ev['absZ'] >= k]
                dc = mtf.decluster(e, max(mtf.PRIMARY_H[delta]))
                ind = dc[dc['first_in_cluster']]
                cells = [race(ind[ind['d'] > 0]), race(ind[ind['d'] < 0]), race(ind[ind['agitated'] == 0]), race(ind[ind['agitated'] == 1]),
                         race(ind[ind['breakout'] == 'propre']), race(ind[ind['breakout'] != 'propre']),
                         race(ind[ind['asset'].str.startswith('BTC')]), race(ind[ind['asset'].str.startswith('ETH')])]
                res[f'{sample}-{delta}-{k:g}'] = cells
                L.append(f'| {TF[delta]} | {k:g} | ' + ' | '.join(cells) + ' |')
        L.append('')
    (REPORTS / 'mtf' / '03-race-checks.md').write_text('\n'.join(L) + '\n')
    (REPORTS / 'mtf' / '03-race-checks.json').write_text(json.dumps(res, indent=1))
    log('shockfade/run_mtf_race_checks.py', 'course 50 % par sens, régime, cassure, actif (a posteriori)', 'P et R')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
