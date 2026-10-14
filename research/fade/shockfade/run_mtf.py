"""Étude multi-timeframe (protocole research/preregistration/shock-fade-mtf.md).

    cd research/fade && python3 -m shockfade.run_mtf counts     # comptages, sans aucun prix postérieur au choc
    cd research/fade && python3 -m shockfade.run_mtf events     # tables d'événements avec résultats (après commit du protocole)
Sorties : research/reports/shock-fade/mtf/.
"""
from __future__ import annotations

import json
import sys

import numpy as np
import pandas as pd

from . import config as C
from . import mtf
from .paths import DERIVED, REPORTS
from .pipeline import structural_fits
from .trial_log import log

SYMS = ['BTCUSDT', 'ETHUSDT']
OUT = REPORTS / 'mtf'
ALL_DELTAS = mtf.REF_DELTAS + mtf.DELTAS
TF = {5: 'M5', 15: 'M15', 30: 'M30', 60: 'H1', 240: 'H4'}
SAMPLES = {
    'P': {'market': 'um', 'tag': '', 'grid': ('2020-01-01', '2026-10-01'), 'events': (mtf.P_START, mtf.P_END), 'label': 'principal (perpétuels 2020-07 → 2026-09)'},
    'R': {'market': 'spot', 'tag': '-pre2020', 'grid': ('2017-08-17', '2020-01-01'), 'events': (mtf.R_START, mtf.R_END), 'label': 'réplication (comptant 2018-01 → 2019-12)'},
}


def assets(sample: str):
    s = SAMPLES[sample]
    for sym in SYMS:
        yield sym, mtf.load_series(sym, s['market'], s['grid'][0], s['grid'][1], s['tag'])


def detect_all(sample: str, with_fits: bool) -> dict[int, pd.DataFrame]:
    s = SAMPLES[sample]
    out: dict[int, list] = {d: [] for d in ALL_DELTAS}
    for sym, a in assets(sample):
        reg = mtf.regime_v1(a)
        fits = None
        if with_fits:
            q = C.quarter_starts('2018-01-01' if sample == 'R' else C.E_START, s['events'][1])
            fits = structural_fits(a, q)
        for delta in ALL_DELTAS:
            sh = mtf.bar_z(a, delta)
            ev = mtf.detect(a, sh, s['events'][0], s['events'][1], reg, fits)
            ev['n2_k3'] = (np.abs(sh.Z2) >= 3)[ev['bar']] if len(ev) else []
            out[delta].append((ev, a, sh))
    return out


def counts() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    res = {}
    L = ['# Shock Fade multi-timeframe — comptages préalables (aucun prix postérieur aux chocs)', '',
         'Généré par `research/fade/shockfade/run_mtf.py counts`. N1 = volatilité bipuissance des 20 barres précédentes '
         '(bornée à 6 h – 7 j) × saisonnalité ; N2 = écart type des 100 rendements de barre précédents (comptage seulement). '
         'Indépendants = premiers chocs de chaque groupe (chocs séparés de moins de l\'horizon primaire maximal) ; '
         'groupes croisés = groupes BTC et ETH qui se chevauchent, fusionnés.', '']
    for sample in SAMPLES:
        det = detect_all(sample, with_fits=False)
        L += [f'## Échantillon {sample} : {SAMPLES[sample]["label"]}', '',
              '| TF | k | chocs BTC | chocs ETH | indépendants BTC | indépendants ETH | groupes croisés | calme / agité (indép.) | propre / rejetée / sans (indép.) | N2 ≥ k (BTC+ETH) |',
              '|---|---:|---:|---:|---:|---:|---:|---|---|---:|']
        for delta in ALL_DELTAS:
            ev_all = pd.concat([e for e, _, _ in det[delta]], ignore_index=True)
            for k in mtf.K_LEVELS:
                e = ev_all[ev_all['absZ'] >= k]
                if len(e) == 0:
                    continue
                dc = mtf.decluster(e, max(mtf.PRIMARY_H[delta]))
                ind = dc[dc['first_in_cluster']]
                n2 = int(sum(int((np.abs(sh.Z2[(sh.bars.t + delta * 60000 >= C.ms(SAMPLES[sample]['events'][0])) &
                                                (sh.bars.t + delta * 60000 < C.ms(SAMPLES[sample]['events'][1]))]) >= k).sum())
                             for _, _, sh in det[delta]))
                row = {
                    'raw': {s: int((e['asset'].str.startswith(s)).sum()) for s in SYMS},
                    'independent': {s: int((ind['asset'].str.startswith(s)).sum()) for s in SYMS},
                    'xclusters': int(dc['xcluster'].nunique()),
                    'regime': {'calme': int((ind['agitated'] == 0).sum()), 'agité': int((ind['agitated'] == 1).sum()), 'inconnu': int(ind['agitated'].isna().sum())},
                    'breakout': {b: int((ind['breakout'] == b).sum()) for b in ('propre', 'rejetée', 'sans')},
                    'n2': n2,
                    'by_year': ind.assign(y=pd.to_datetime(ind['T'], unit='ms').dt.year).groupby('y').size().to_dict(),
                }
                res[f'{sample}-{delta}-{k:g}'] = row
                L.append(f"| {TF[delta]}{' (réf.)' if delta in mtf.REF_DELTAS else ''} | {k:g} | {row['raw']['BTCUSDT']} | {row['raw']['ETHUSDT']} | "
                         f"{row['independent']['BTCUSDT']} | {row['independent']['ETHUSDT']} | {row['xclusters']} | "
                         f"{row['regime']['calme']} / {row['regime']['agité']} | {row['breakout']['propre']} / {row['breakout']['rejetée']} / {row['breakout']['sans']} | {n2} |")
        L.append('')
    (OUT / '00-counts.md').write_text('\n'.join(L) + '\n')
    (OUT / '00-counts.json').write_text(json.dumps(res, indent=1, default=str))
    log('shockfade/run_mtf.py counts', 'comptages M5…H4, k ∈ {3, 4}, sans résultat', 'P 2020-07 → 2026-09, R 2018-01 → 2019-12')
    print('\n'.join(L))


def events() -> None:
    for sample in SAMPLES:
        det = detect_all(sample, with_fits=True)
        for delta in ALL_DELTAS:
            parts = []
            for (ev, a, sh), sym in zip(det[delta], SYMS):
                fund = mtf.funding_times(sym) if sample == 'P' else None
                parts.append(mtf.outcomes(a, ev, delta, fund))
            ev = pd.concat(parts, ignore_index=True)
            ev.to_parquet(DERIVED / f'mtf-{sample}-{delta}m.parquet', index=False)
            print(sample, TF[delta], len(ev), flush=True)
    log('shockfade/run_mtf.py events', 'événements M5…H4, k ≥ 3, rendements aux horizons du protocole MTF', 'P 2020-07 → 2026-09, R 2018-01 → 2019-12')


if __name__ == '__main__':
    {'counts': counts, 'events': events}[sys.argv[1]]()
