"""Holdout C (2025-01-01 → 2026-09-30), ouvert une seule fois après le commit de la sélection sur V
(protocole § 8 et avenant 1).

    cd research/fade && python3 -m shockfade.run_holdout
Sortie : research/reports/shock-fade/07-holdout.{md,json}.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import config as C
from . import stats as st
from . import walkforward as wf
from .eventstudy import excursion_section, gross_row, load_events
from .hypotheses import past_tercile_flag, test_one
from .paths import DERIVED, REPORTS
from .pipeline import build_events, filtered_transient, load_asset, structural_fits
from .run_validation import bps, model_table
from .trial_log import log

SYMS = ['BTCUSDT', 'ETHUSDT']
FULL_END = '2026-10-01'


def build_c() -> None:
    for sym in SYMS:
        a = load_asset(sym, FULL_END)
        q = C.quarter_starts(C.E_START, C.C_END)
        fits = structural_fits(a, q)
        Qf = filtered_transient(a, fits)
        for delta in C.DELTAS:
            ev = build_events(a, delta, fits, Qf, C.C_START, C.C_END)
            ev.to_parquet(DERIVED / f'events-{sym}-{delta}m-C.parquet', index=False)
            print(sym, delta, len(ev), flush=True)


def load_all(delta: int) -> pd.DataFrame:
    e = load_events(delta, C.E_START, C.E_END)
    c = pd.concat([pd.read_parquet(DERIVED / f'events-{s}-{delta}m-C.parquet') for s in SYMS], ignore_index=True)
    return pd.concat([e, c], ignore_index=True)


def main():
    build_c()
    res: dict = {}
    L = ['# Shock Fade Engine — holdout C (2025-01-01 → 2026-09-30), ouvert une fois', '',
         'Généré par `research/fade/shockfade/run_holdout.py`, après le commit de la sélection sur V (aucun candidat, aucun score '
         'de recherche) et de l\'avenant 1 du protocole. Mêmes définitions, mêmes recalibrages trimestriels ; aucun paramètre '
         'n\'a été choisi après lecture de C.', '']
    # (a) étude d'événements inconditionnelle
    for delta in C.DELTAS:
        allev = load_all(delta)
        c4 = allev[(allev['T'] >= C.ms(C.C_START)) & (allev['absZ'] >= C.K_SHOCK)]
        rows = {h: gross_row(c4, h) for h in C.HORIZONS}
        res[f'unconditional_{delta}'] = rows
        L += [f'## (a) Fade inconditionnel, {delta} min (|Z| ≥ 4, {len(c4)} chocs : BTC {int((c4.asset == "BTCUSDT").sum())}, ETH {int((c4.asset == "ETHUSDT").sum())})', '',
              '| h | moyenne brute (pb) | t | médiane | P(> 0) | net C1 (pb) | 1 % | 99 % |', '|---:|---:|---:|---:|---:|---:|---:|---:|']
        for h, r in rows.items():
            L.append(f"| {h} | {bps(r['mean'])} | {r['t']:.2f} | {bps(r['median'])} | {100 * r['pos']:.1f} % | {bps(r['net_c1'])} | {bps(r['q01'], 0)} | {bps(r['q99'], 0)} |")
        L.append('')
        if delta == 5:
            excursion_section(L, res, c4)
    # (b) walk-forward M1–M7 sur C
    parts = []
    for delta in C.DELTAS:
        allev = load_all(delta)
        allev = allev[allev['absZ'] >= C.K_SHOCK]
        for h in C.HORIZONS:
            parts.append(wf.predict(allev, delta, h, C.C_START, C.C_END))
    P = pd.concat(parts, ignore_index=True)
    P.to_parquet(DERIVED / 'preds-C.parquet', index=False)
    ev = wf.evaluate(P)
    cand = wf.candidates(ev, C.PRIMARY_DELTA)
    holm = {(r['model'], r['h']): r for r in cand['table']}
    L += ['## (b) Modèles M1–M7 et contrôle, walk-forward sur C (5 min)', '']
    model_table(L, ev, 5, holm)
    L += [f"Candidats selon les critères du protocole appliqués à C (pour mémoire, aucune sélection n'en découle) : "
          f"{[(r['model'], r['h']) for r in cand['table'] if r['candidate']] or 'aucun'}.", '',
          '15 min (secondaire) :', '']
    model_table(L, ev, 15, None)
    # (c) H2b et H4a, exploratoire
    e5 = load_all(5)
    e5 = e5[e5['absZ'] >= C.K_SHOCK].reset_index(drop=True)
    inC = (e5['T'] >= C.ms(C.C_START)).to_numpy()
    L += ['## (c) Exploratoire : H2b et H4a sur C (signaux bruts les plus forts de E, non significatifs après Holm)', '',
          'Terciles calculés sur les chocs passés (E inclus). Différence brute favorable − reste et moyenne nette C1 du groupe favorable.', '',
          '| hypothèse | h | n favorable | diff. brute (pb) | IC 95 % | p | net C1 favorable (pb) | IC 95 % |', '|---|---:|---:|---:|---|---:|---:|---|']
    res['exploratory'] = {}
    for name, col in (('H2b', 'amihud'), ('H4a', 'basis_dev')):
        flag = past_tercile_flag(e5, col, upper=True)
        sub = e5[inC].reset_index(drop=True)
        f = flag[inC]
        for h in C.HORIZONS:
            t = test_one(sub, f, f'g{h}')
            res['exploratory'][f'{name}@{h}'] = t
            d, db, n, nb = t['diff'], t['diff_boot'], t['net_fav'], t['net_fav_boot']
            L.append(f"| {name} | {h} | {d['n1']} | {bps(d['diff'])} | [{bps(db['lo95'])} ; {bps(db['hi95'])}] | {d['p']:.3f} | "
                     f"{bps(n['mean'])} | [{bps(nb['lo95'])} ; {bps(nb['hi95'])}] |")
    # (d) coût d'équilibre
    L += ['', '## (d) Coût aller-retour d\'équilibre (moyenne brute des événements pris par chaque modèle, 5 min, C)', '',
          'Coût aller-retour au-delà duquel le modèle perd ; « — » : le modèle ne prend aucun événement.', '',
          '| modèle | ' + ' | '.join(f'h={h}' for h in C.HORIZONS) + ' |', '|---|' + '---:|' * len(C.HORIZONS)]
    for mdl in wf.MODELS:
        cells = []
        for h in C.HORIZONS:
            g = ev[(5, h)][mdl]['econ_c0_mean']
            cells.append(bps(g))
        L.append(f'| {mdl} | ' + ' | '.join(cells) + ' |')
    L.append('')
    (REPORTS / '07-holdout.md').write_text('\n'.join(L) + '\n')
    (REPORTS / '07-holdout.json').write_text(json.dumps({'res': res, 'evaluation': {f'{d}-{h}': v for (d, h), v in ev.items()},
                                                          'candidates': cand}, indent=1, default=float))
    log('shockfade/run_holdout.py', 'holdout C : événements, M1–M7 + contrôle, H2b/H4a exploratoires', f'C = {C.C_START} → {C.C_END}')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
