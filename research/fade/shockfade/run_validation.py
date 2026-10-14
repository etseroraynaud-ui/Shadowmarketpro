"""Validation walk-forward sur V (2021-07 → 2024-12) et sélection pré-enregistrée (protocole § 6–7).

    cd research/fade && python3 -m shockfade.run_validation
Sorties : research/reports/shock-fade/06-walkforward.{md,json} ; prévisions (hors git) dans derived/.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import config as C
from . import walkforward as wf
from .eventstudy import load_events
from .paths import DERIVED, REPORTS
from .trial_log import log


def bps(x, d=1):
    return '—' if x is None or not np.isfinite(x) else f'{1e4 * x:.{d}f}'


def run_preds(start: str, end: str, tag: str, events_end: str = C.E_END) -> pd.DataFrame:
    parts = []
    for delta in C.DELTAS:
        ev = load_events(delta, C.E_START, events_end)
        ev = ev[ev['absZ'] >= C.K_SHOCK]
        for h in C.HORIZONS:
            parts.append(wf.predict(ev, delta, h, start, end))
    P = pd.concat(parts, ignore_index=True)
    P.to_parquet(DERIVED / f'preds-{tag}.parquet', index=False)
    return P


def share(e: dict) -> str:
    """Part du P&L total due aux 5 % meilleurs événements ; sans objet si le total n'est pas positif."""
    return f"{100 * e['share_top5']:.0f} %" if e['mean'] > 0 and np.isfinite(e['share_top5']) else '—'


def quarters(e: dict) -> str:
    return f"{100 * e['quarters_pos_share']:.0f} % ({e['quarters_n']})" if e['quarters_n'] else '—'


def model_table(L: list, ev: dict, delta: int, holm: dict | None) -> None:
    L += ['| modèle | h | R²_OOS | p Clark–West (Holm) | pris | n | net C1 moyen (pb) | IC 95 % | p (Holm F4) | net C2 (pb) | brut (pb) | gain | payoff | PF | CVaR 5 % (pb) | part top 5 % | trimestres > 0 | BTC / ETH (pb) |',
          '|---|---:|---:|---|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|']
    for mdl in wf.MODELS:
        for h in C.HORIZONS:
            r = ev[(delta, h)][mdl]
            e = r['econ_c1']
            cw = r.get('cw')
            hk = holm.get((mdl, h), {}) if holm else {}
            cw_s = '—' if cw is None else f"{cw['p']:.3f}" + (f" ({hk['p_holm_F3']:.3f})" if hk and np.isfinite(hk.get('p_holm_F3', np.nan)) else '')
            r2 = '—' if cw is None else f"{100 * cw['r2_oos']:.2f} %"
            if e.get('n', 0) == 0:
                L.append(f'| {mdl} | {h} | {r2} | {cw_s} | 0 % | 0 | — | — | — | — | — | — | — | — | — | — | — | — |')
                continue
            pa = e['per_asset']
            L.append(f"| {mdl} | {h} | {r2} | {cw_s} | {100 * r['take_share']:.0f} % | {e['n']} | {bps(e['mean'])} | "
                     f"[{bps(e['boot']['lo95'])} ; {bps(e['boot']['hi95'])}] | {e['p_day']:.3f}" + (f" ({hk['p_holm_F4']:.3f})" if hk else '') +
                     f" | {bps(r['econ_c2_mean'])} | {bps(r['econ_c0_mean'])} | {100 * e['win']:.0f} % | {e['payoff']:.2f} | {e['pf']:.2f} | "
                     f"{bps(e['cvar5'], 0)} | {share(e)} | {quarters(e)} | "
                     f"{bps(pa.get('BTCUSDT', np.nan))} / {bps(pa.get('ETHUSDT', np.nan))} |")
    L.append('')


def main():
    P = run_preds(C.V_START, C.V_END, 'V')
    ev = wf.evaluate(P)
    pairs = wf.compare_pairs(P)
    cand = wf.candidates(ev, C.PRIMARY_DELTA)
    holm = {(r['model'], r['h']): r for r in cand['table']}
    cand15 = wf.candidates(ev, 15)
    holm15 = {(r['model'], r['h']): r for r in cand15['table']}
    L = ['# Shock Fade Engine — validation walk-forward (V : 2021-07-01 → 2024-12-31)', '',
         'Généré par `research/fade/shockfade/run_validation.py`. Régressions par actif, horizon et trimestre, estimées sur les '
         'événements antérieurs dont la sortie précède le trimestre (purge), depuis 2020-07-01 ; prévision des événements du '
         'trimestre. Règle de trade : Ê_net(C1) > 0. Rendements par événement (chevauchements permis), coût aller-retour C1 = 14 pb. '
         'Le holdout C n\'est pas lu.', '',
         f'Événements évalués (ensemble commun, |Z| ≥ 4) : ' + ', '.join(f"{d} min h={h} : {ev[(d, h)]['n_events']}" for d, h in [(5, 1), (15, 1)]) + '.', '',
         'Fade inconditionnel sur V, moyenne brute (pb) : ' + ', '.join(f"h={h} : {bps(ev[(5, h)]['all_gross_mean'])}" for h in C.HORIZONS) + ' (5 min).', '',
         '## 1. Fréquence principale (5 min)', '',
         'R²_OOS contre M1 et p de Clark–West (unilatéral ; Holm sur F3 = M2…M7 × 6 horizons) ; économie des événements pris '
         '(p unilatéral groupé par jour ; Holm sur F4 = M1…M7 × 6 horizons). « Trimestres > 0 » : part des trimestres à ≥ 10 '
         'trades dont la moyenne nette est positive (nombre de trimestres).', '']
    model_table(L, ev, 5, holm)
    L += ['## 2. Critères du protocole et sélection (5 min)', '',
          '| modèle | h | n | net C1 (pb) | 1 Holm + IC | 2 C2 > 0 | 3 BTC et ETH > 0 | 4 ≥ 200 et trimestres | 5 queues | candidat |',
          '|---|---:|---:|---:|---|---|---|---|---|---|']
    yes = lambda b: 'oui' if b else 'non'
    for r in sorted(cand['table'], key=lambda r: (wf.COMPLEXITY.index(r['model']), r['h'])):
        L.append(f"| {r['model']} | {r['h']} | {r['n']} | {bps(r['mean'])} | {yes(r['1_holm'])} | {yes(r['2_c2'])} | {yes(r['3_assets'])} | "
                 f"{yes(r['4_count_quarters'])} | {yes(r['5_tails'])} | **{yes(r['candidate'])}** |")
    L += ['', f"**Sélection** : {cand['selection'] or 'aucun candidat'}.", '',
          f"**Score de recherche non tradable** (meilleur Clark–West significatif après Holm, s'il existe) : {cand['research_score'] or 'aucun'}.", '',
          '## 3. Les couches ajoutent-elles de l\'information ? (différence de P&L net hebdomadaire, bootstrap par blocs de 4 semaines)', '',
          '| h | ' + ' | '.join(f'{k} (pb/sem.) | IC 95 %' for k in pairs[(5, 1)]) + ' |', '|---:|' + '---:|---|' * len(pairs[(5, 1)])]
    for h in C.HORIZONS:
        cells = []
        for k, b in pairs[(5, h)].items():
            cells += [f"{1e4 * b['est']:.1f}", f"[{1e4 * b['lo95']:.1f} ; {1e4 * b['hi95']:.1f}]"]
        L.append(f'| {h} | ' + ' | '.join(cells) + ' |')
    L += ['', '## 4. Calibration des prévisions (5 min, h = 4) : moyenne prévue et réalisée par décile (pb bruts)', '',
          '| décile | ' + ' | '.join(wf.MODELS) + ' |', '|---:|' + '---|' * len(wf.MODELS)]
    for dcl in range(10):
        cells = []
        for mdl in wf.MODELS:
            cal = ev[(5, 4)][mdl].get('calibration')
            cells.append(f"{bps(cal[dcl]['pred'])} → {bps(cal[dcl]['real'])}" if cal else '—')
        L.append(f'| {dcl + 1} | ' + ' | '.join(cells) + ' |')
    L += ['', '## 5. Fréquence secondaire (15 min, rapportée, jamais utilisée pour la sélection)', '']
    model_table(L, ev, 15, holm15)
    L += [f"Candidats à 15 min selon les mêmes critères (à titre exploratoire) : {[(r['model'], r['h']) for r in cand15['table'] if r['candidate']] or 'aucun'}.", '']
    (REPORTS / '06-walkforward.md').write_text('\n'.join(L) + '\n')
    js = {'evaluation': {f'{d}-{h}': v for (d, h), v in ev.items()}, 'pairs': {f'{d}-{h}': v for (d, h), v in pairs.items()},
          'candidates_5': cand, 'candidates_15': cand15}
    (REPORTS / '06-walkforward.json').write_text(json.dumps(js, indent=1, default=float))
    log('shockfade/run_validation.py', 'M1–M7 + contrôle, h ∈ {1…32}, Δ ∈ {5, 15}, |Z| ≥ 4, règle Ê_net > 0', f'V = {C.V_START} → {C.V_END}')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
