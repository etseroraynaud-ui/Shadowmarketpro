"""Analyse de l'étude multi-timeframe (protocole research/preregistration/shock-fade-mtf.md, § 4–6).

    cd research/fade && python3 -m shockfade.mtf_report
Sorties : research/reports/shock-fade/mtf/01-results.{md,json}.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.stats import norm

from . import mtf
from . import stats as st
from .paths import DERIVED, REPORTS
from .trial_log import log
from .walkforward import week_boot_mean

OUT = REPORTS / 'mtf'
TF = {5: 'M5', 15: 'M15', 30: 'M30', 60: 'H1', 240: 'H4'}
RT = 0.0014
MAIN = mtf.DELTAS
ALL = mtf.REF_DELTAS + mtf.DELTAS


def bps(x, d=1):
    return '—' if x is None or not np.isfinite(x) else f'{1e4 * x:.{d}f}'


def hz(h: int, delta: int) -> str:
    m = h * delta
    return f'{h} b ({m} min)' if m < 60 else f'{h} b ({m / 60:g} h)'


def p2(t):
    return float(2 * norm.sf(abs(t))) if np.isfinite(t) else float('nan')


def load(sample: str, delta: int) -> pd.DataFrame:
    return pd.read_parquet(DERIVED / f'mtf-{sample}-{delta}m.parquet')


def mean_test(x: np.ndarray, g: np.ndarray, T: np.ndarray, boot: bool = True) -> dict:
    ok = np.isfinite(x)
    x, g, T = x[ok], g[ok], T[ok]
    if len(x) < 5:
        return {'n': int(len(x))}
    r = st.cluster_mean(x, g)
    out = {'n': int(len(x)), 'mean': r['mean'], 'se': r['se'], 't': r['t'], 'p2': p2(r['t']), 'mde': 2.8 * r['se'],
           'median': float(np.median(x)), 'pos': float(np.mean(x > 0))}
    if boot:
        est, dist = week_boot_mean(x, st.week_of(T), 5000)
        out['boot'] = st.boot_summary(est, dist)
    return out


def diff_test(x: np.ndarray, flag: np.ndarray, g: np.ndarray) -> dict:
    ok = np.isfinite(x) & np.isfinite(flag)
    if ok.sum() < 10 or flag[ok].sum() < 3 or (1 - flag[ok]).sum() < 3:
        return {'n1': int(np.nansum(flag[ok])), 'n0': int(ok.sum() - np.nansum(flag[ok]))}
    d = st.diff_test(x[ok], flag[ok], g[ok])
    return {'n1': d['n1'], 'n0': d['n'] - d['n1'], 'mean1': d['mean1'], 'mean0': d['mean0'], 'diff': d['diff'], 'se': d['se'],
            't': d['t'], 'p2': p2(d['t']), 'mde': 2.8 * d['se']}


def analyse(sample: str) -> dict:
    res = {}
    for delta in ALL:
        ev = load(sample, delta)
        for k in mtf.K_LEVELS:
            e = ev[ev['absZ'] >= k]
            if len(e) < 10:
                continue
            dc_all = mtf.decluster(e, max(mtf.PRIMARY_H[delta]))
            ind = dc_all[dc_all['first_in_cluster']].reset_index(drop=True)
            g = ind['xcluster'].to_numpy()
            T = ind['T'].to_numpy()
            key = f'{delta}-{k:g}'
            r: dict = {'n_all': int(len(e)), 'n_ind': int(len(ind)), 'n_xclusters': int(ind['xcluster'].nunique())}
            r['primary'] = {h: mean_test(ind[f'g{h}'].to_numpy(), g, T) for h in mtf.PRIMARY_H[delta]}
            r['primary_all_events'] = {h: mean_test(dc_all[f'g{h}'].to_numpy(), dc_all['xcluster'].to_numpy(), dc_all['T'].to_numpy(), boot=False)
                                       for h in mtf.PRIMARY_H[delta]}
            r['net'] = {h: mean_test((ind[f'g{h}'] - RT + ind[f'fund{h}']).to_numpy(), g, T) for h in mtf.PRIMARY_H[delta]}
            r['grid'] = {h: mean_test(ind[f'g{h}'].to_numpy(), g, T, boot=False) for h in mtf.horizons(delta) if f'g{h}' in ind}
            r['mfe_mae'] = {h: (float(np.nanmedian(ind[f'mfe{h}'])), float(np.nanmedian(ind[f'mae{h}']))) for h in mtf.PRIMARY_H[delta]}
            for q in (25, 50):
                rc = ind[f'race{q}'].to_numpy()
                m = mean_test(rc - 0.5, g, T, boot=False)
                r[f'race{q}'] = {**m, 'p_retrace_first': m.get('mean', np.nan) + 0.5, 'reach_retr': float(ind[f'retr{q}'].mean()),
                                 'reach_ext': float(ind[f'ext{q}'].mean())}
            # structure par terme : fraction du choc reprise aux horizons d'horloge
            absR = np.abs(ind['R'].to_numpy())
            r['term'] = {}
            for c in mtf.CLOCK_H:
                if c % delta == 0 and f'g{c // delta}' in ind:
                    r['term'][c] = mean_test(ind[f'g{c // delta}'].to_numpy() / absR, g, T, boot=False)
            # découpages
            calm = (ind['agitated'] == 0).astype(float).where(ind['agitated'].notna()).to_numpy()
            abrupt = ind['abrupt'].astype(float).to_numpy()
            b2 = ind[ind['b2'].notna()]
            reint = (b2['b2'] == 'réintégrée').astype(float).to_numpy()
            r['regime'] = {h: diff_test(ind[f'g{h}'].to_numpy(), calm, g) for h in mtf.PRIMARY_H[delta]}
            r['structure'] = {h: diff_test(ind[f'g{h}'].to_numpy(), abrupt, g) for h in mtf.PRIMARY_H[delta]}
            r['b2'] = {h: diff_test(b2[f'gD2_{h}'].to_numpy(), reint, b2['xcluster'].to_numpy()) for h in mtf.PRIMARY_H[delta]}
            hm = mtf.PRIMARY_H[delta][1]
            cells = {}
            for reg_name, reg_val in (('calme', 0.0), ('agité', 1.0)):
                for brk in ('propre', 'rejetée', 'sans'):
                    sub = ind[(ind['agitated'] == reg_val) & (ind['breakout'] == brk)]
                    cells[f'{reg_name}|B1 {brk}'] = mean_test(sub[f'g{hm}'].to_numpy(), sub['xcluster'].to_numpy(), sub['T'].to_numpy(), boot=False)
                for b in ('tenue', 'réintégrée'):
                    sub = b2[(b2['agitated'] == reg_val) & (b2['b2'] == b)]
                    cells[f'{reg_name}|B2 {b}'] = mean_test(sub[f'gD2_{hm}'].to_numpy(), sub['xcluster'].to_numpy(), sub['T'].to_numpy(), boot=False)
            r['cells'] = {'h': hm, **cells}
            r['composition'] = {
                'n_jump_same_med': float(ind['n_jump_same'].median()), 'n_jump_same_mean': float(ind['n_jump_same'].mean()),
                'js_mean': float(ind['js'].mean()), 'abrupt_share': float(ind['abrupt'].mean()),
                'concentration_med': float(ind['concentration'].median()) if ind['concentration'].notna().any() else np.nan,
                'efficiency_med': float(ind['efficiency'].median()), 'absR_med_bps': float(1e4 * np.median(absR)),
                'lam_pre_med': float(ind['lam_ratio_pre'].median()) if 'lam_ratio_pre' in ind else np.nan,
                'lam_T_med': float(ind['lam_ratio_T'].median()) if 'lam_ratio_T' in ind else np.nan,
                'trend_aligned_share': float((ind['trend_aligned'] > 0).mean()), 'trend_against_share': float((ind['trend_aligned'] < 0).mean()),
                'prior_trend_z_med': float(ind['prior_trend_z'].median()), 'imbalance_mean': float(ind['imbalance'].mean()),
                'agitated_share': float(ind['agitated'].mean()), 'b1': ind['breakout'].value_counts().to_dict(),
                'b2': b2['b2'].value_counts().to_dict(), 'up_share': float((ind['d'] > 0).mean()),
            }
            res[key] = r
    return res


def holm_family(res: dict, kind: str) -> dict:
    keys, ps = [], []
    for delta in MAIN:
        for k in mtf.K_LEVELS:
            r = res.get(f'{delta}-{k:g}')
            if r is None:
                continue
            if kind == 'primary':
                for h, m in r['primary'].items():
                    keys.append((delta, k, f'g{h}')); ps.append(m.get('p2', 1.0))
                keys.append((delta, k, 'race50')); ps.append(r['race50'].get('p2', 1.0))
            else:
                for h, m in r[kind].items():
                    keys.append((delta, k, f'g{h}')); ps.append(m.get('p2', 1.0) if np.isfinite(m.get('p2', np.nan)) else 1.0)
    adj = st.holm(np.array(ps))
    return {kk: float(a) for kk, a in zip(keys, adj)}


def main():
    P, R = analyse('P'), analyse('R')
    fam = {f: holm_family(P, f) for f in ('primary', 'regime', 'b2', 'structure')}
    repl = {}
    for f, adj in fam.items():
        for (delta, k, what), pa in adj.items():
            if pa < 0.05:
                rP, rR = P[f'{delta}-{k:g}'], R.get(f'{delta}-{k:g}')
                if f == 'primary':
                    mP = rP['race50'] if what == 'race50' else rP['primary'][int(what[1:])]
                    mR = (rR['race50'] if what == 'race50' else rR['primary'][int(what[1:])]) if rR else {}
                    sP, tR = np.sign(mP['mean']), mR.get('t', np.nan)
                else:
                    h = int(what[1:])
                    mP, mR = rP[f][h], (rR[f][h] if rR else {})
                    sP, tR = np.sign(mP['diff']), mR.get('t', np.nan)
                p1 = float(norm.sf(sP * tR)) if np.isfinite(tR) else float('nan')
                repl[f'{f}|{TF[delta]}|k{k:g}|{what}'] = {'p_holm_P': pa, 'sign_P': float(sP), 't_R': tR, 'p1_R': p1, 'replicated': bool(p1 < 0.05)}
    L = ['# Shock Fade multi-timeframe — résultats (M30, H1, H4 ; M5 et M15 en référence)', '',
         'Généré par `research/fade/shockfade/mtf_report.py` selon `research/preregistration/shock-fade-mtf.md`. Chocs '
         'indépendants (premier choc de chaque groupe), BTC et ETH regroupés, erreurs groupées par groupe croisé, tests '
         'bilatéraux. g = rendement brut du Fade (position −d), entrée une minute après la clôture du choc. Net = g − 14 pb + '
         'financement. EMD = effet minimal détectable (2,8 erreurs types).', '']
    # ---- 1. primaire
    L += ['## 1. Tests primaires (échantillon P, 2020-07 → 2026-09)', '',
          '| TF | k | horizon | n indép. | g moyen (pb) | IC 95 % | t | p | p Holm | EMD (pb) | médiane | P(> 0) | net (pb) | IC 95 % net | réplication R : g (t) |',
          '|---|---:|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---|']
    for delta in MAIN:
        for k in mtf.K_LEVELS:
            r, rr = P.get(f'{delta}-{k:g}'), R.get(f'{delta}-{k:g}')
            if r is None:
                continue
            for h, m in r['primary'].items():
                n_ = r['net'][h]
                mr = rr['primary'][h] if rr else {}
                L.append(f"| {TF[delta]} | {k:g} | {hz(h, delta)} | {m['n']} | {bps(m['mean'])} | [{bps(m['boot']['lo95'])} ; {bps(m['boot']['hi95'])}] | "
                         f"{m['t']:.2f} | {m['p2']:.3f} | {fam['primary'][(delta, k, f'g{h}')]:.3f} | {bps(m['mde'], 0)} | {bps(m['median'])} | {100 * m['pos']:.0f} % | "
                         f"{bps(n_['mean'])} | [{bps(n_['boot']['lo95'])} ; {bps(n_['boot']['hi95'])}] | {bps(mr.get('mean'))} ({mr.get('t', float('nan')):.2f}) |")
            rc = r['race50']
            rcr = rr['race50'] if rr else {}
            L.append(f"| {TF[delta]} | {k:g} | course 50 % | {rc['n']} | P(reprise d'abord) = {rc['p_retrace_first']:.3f} | — | {rc['t']:.2f} | {rc['p2']:.3f} | "
                     f"{fam['primary'][(delta, k, 'race50')]:.3f} | {2.8 * rc['se']:.3f} | — | — | — | — | {rcr.get('p_retrace_first', float('nan')):.3f} ({rcr.get('t', float('nan')):.2f}) |")
    L += ['', 'Référence M5 / M15 (même code, déjà étudiés, hors famille) :', '',
          '| TF | k | horizon | n indép. | g moyen (pb) | t | course 50 % P(reprise d\'abord) |', '|---|---:|---|---:|---:|---:|---:|']
    for delta in mtf.REF_DELTAS:
        for k in mtf.K_LEVELS:
            r = P.get(f'{delta}-{k:g}')
            for h, m in r['primary'].items():
                L.append(f"| {TF[delta]} | {k:g} | {hz(h, delta)} | {m['n']} | {bps(m['mean'])} | {m['t']:.2f} | {r['race50']['p_retrace_first']:.3f} |")
    # ---- 2. structure par terme
    L += ['', '## 2. Structure par terme : fraction du choc reprise selon la durée du choc (P, chocs indépendants)', '',
          'Moyenne de g/|R| (positif = réversion, négatif = continuation), t entre parenthèses.', '',
          '| TF | k | |R| médian (pb) | 1 h | 4 h | 16 h | 48 h |', '|---|---:|---:|---:|---:|---:|---:|']
    for delta in ALL:
        for k in mtf.K_LEVELS:
            r = P.get(f'{delta}-{k:g}')
            cells = []
            for c in mtf.CLOCK_H:
                m = r['term'].get(c)
                cells.append(f"{m['mean']:+.3f} ({m['t']:.1f})" if m and m.get('n', 0) >= 5 else '—')
            L.append(f"| {TF[delta]} | {k:g} | {r['composition']['absR_med_bps']:.0f} | " + ' | '.join(cells) + ' |')
    # ---- 3. composition
    L += ['', '## 3. Un choc H4 n\'est pas un grand choc M5 : composition des chocs (P, k = 4, chocs indépendants)', '',
          '| TF | sauts 1 min dans le sens du choc (moy.) | part due aux sauts | abrupts | concentration (plus grande sous-barre 5 min) | efficacité du chemin | λ Hawkes / μ avant → à T | dans le sens de la tendance journalière | contre | agité | hausse |',
          '|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|']
    for delta in ALL:
        c = P[f'{delta}-4']['composition']
        L.append(f"| {TF[delta]} | {c['n_jump_same_mean']:.2f} | {c['js_mean']:.2f} | {100 * c['abrupt_share']:.0f} % | "
                 f"{'—' if not np.isfinite(c['concentration_med']) else f'{c['concentration_med']:.2f}'} | {c['efficiency_med']:.2f} | "
                 f"{c['lam_pre_med']:.1f} → {c['lam_T_med']:.1f} | {100 * c['trend_aligned_share']:.0f} % | {100 * c['trend_against_share']:.0f} % | "
                 f"{100 * c['agitated_share']:.0f} % | {100 * c['up_share']:.0f} % |")
    # ---- 4. découpages
    names = {'regime': ('calme − agité', 'calme', 'agité'), 'b2': ('réintégrée − tenue (depuis D2)', 'réintégrée', 'tenue'),
             'structure': ('abrupt − graduel', 'abrupt', 'graduel')}
    for f, (lab, a1, a0) in names.items():
        L += ['', f'## 4.{list(names).index(f) + 1} Découpage {lab} (P ; Holm sur 18 ; réplication R)', '',
              f'| TF | k | horizon | n {a1} / {a0} | {a1} (pb) | {a0} (pb) | différence (pb) | t | p | p Holm | EMD (pb) | R : différence (t) |',
              '|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|']
        for delta in MAIN:
            for k in mtf.K_LEVELS:
                r, rr = P.get(f'{delta}-{k:g}'), R.get(f'{delta}-{k:g}')
                for h, m in r[f].items():
                    mr = rr[f][h] if rr else {}
                    if 'diff' not in m:
                        L.append(f"| {TF[delta]} | {k:g} | {h} b | {m['n1']} / {m['n0']} | — | — | — | — | — | — | — | — |")
                        continue
                    L.append(f"| {TF[delta]} | {k:g} | {h} b | {m['n1']} / {m['n0']} | {bps(m['mean1'])} | {bps(m['mean0'])} | {bps(m['diff'])} | {m['t']:.2f} | "
                             f"{m['p2']:.3f} | {fam[f][(delta, k, f'g{h}')]:.3f} | {bps(m['mde'], 0)} | {bps(mr.get('diff'))} ({mr.get('t', float('nan')):.2f}) |")
    # ---- 5. cellules régime × cassure
    L += ['', '## 5. Régime × cassure (P, descriptif ; horizon primaire médian)', '',
          'B1 : en T (propre / rejetée / sans). B2 : cassures propres jugées en D2 (tenue / réintégrée), rendement depuis D2. '
          'Moyenne brute en pb (t) [n ; EMD].', '',
          '| TF | k | h | calme B1 propre | calme B1 rejetée | calme B1 sans | agité B1 propre | agité B1 rejetée | agité B1 sans | calme B2 tenue | calme B2 réintégrée | agité B2 tenue | agité B2 réintégrée |',
          '|---|---:|---:|---|---|---|---|---|---|---|---|---|---|']
    order = ['calme|B1 propre', 'calme|B1 rejetée', 'calme|B1 sans', 'agité|B1 propre', 'agité|B1 rejetée', 'agité|B1 sans',
             'calme|B2 tenue', 'calme|B2 réintégrée', 'agité|B2 tenue', 'agité|B2 réintégrée']
    for delta in MAIN:
        for k in mtf.K_LEVELS:
            c = P[f'{delta}-{k:g}']['cells']
            cells = []
            for o in order:
                m = c[o]
                cells.append(f"{bps(m['mean'])} ({m['t']:.1f}) [{m['n']} ; {bps(m['mde'], 0)}]" if m.get('n', 0) >= 5 else f"— [{m.get('n', 0)}]")
            L.append(f"| {TF[delta]} | {k:g} | {c['h']} | " + ' | '.join(cells) + ' |')
    # ---- 6. course et excursions
    L += ['', '## 6. Course reprise / extension et excursions (P, chocs indépendants)', '',
          '| TF | k | P(25 % repris d\'abord) | P(50 % repris d\'abord) | 50 % repris (atteint) | 50 % d\'extension (atteint) | MFE / MAE médianes à l\'horizon primaire maximal (pb) |',
          '|---|---:|---:|---:|---:|---:|---|']
    for delta in ALL:
        for k in mtf.K_LEVELS:
            r = P[f'{delta}-{k:g}']
            hmax = max(mtf.PRIMARY_H[delta])
            mf, ma = r['mfe_mae'][hmax]
            L.append(f"| {TF[delta]} | {k:g} | {r['race25']['p_retrace_first']:.3f} | {r['race50']['p_retrace_first']:.3f} | "
                     f"{100 * r['race50']['reach_retr']:.0f} % | {100 * r['race50']['reach_ext']:.0f} % | {bps(mf, 0)} / {bps(ma, 0)} |")
    # ---- 7. réplication
    L += ['', '## 7. Réplication des tests significatifs après Holm (R, 2018–2019)', '']
    if repl:
        L += ['| test | p Holm (P) | sens sur P | t sur R | p unilatéral R | répliqué |', '|---|---:|---:|---:|---:|---|']
        for kk, v in repl.items():
            L.append(f"| {kk} | {v['p_holm_P']:.4f} | {'+' if v['sign_P'] > 0 else '−'} | {v['t_R']:.2f} | {v['p1_R']:.3f} | {'oui' if v['replicated'] else 'non'} |")
    else:
        L.append('Aucun test n\'est significatif après Holm sur P : rien à répliquer.')
    L.append('')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / '01-results.md').write_text('\n'.join(L) + '\n')
    js = {'P': P, 'R': R, 'holm': {f: {f'{a}|{b}|{c}': v for (a, b, c), v in adj.items()} for f, adj in fam.items()}, 'replication': repl}
    (OUT / '01-results.json').write_text(json.dumps(js, indent=1, default=lambda o: o if not isinstance(o, (np.floating, np.integer)) else o.item()))
    log('shockfade/mtf_report.py', 'tests primaires et secondaires MTF, réplication', 'P 2020-07 → 2026-09, R 2018-01 → 2019-12')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
