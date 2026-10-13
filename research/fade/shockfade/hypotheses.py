"""Tests séparés des hypothèses H1–H4 sur la période E (protocole § 5, familles F1 et F2).

    cd research/fade && python3 -m shockfade.hypotheses
Sortie : research/reports/shock-fade/04-hypotheses.{md,json}.
"""
from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from . import config as C
from . import stats as st
from .eventstudy import load_events
from .trial_log import log
from .walkforward import week_boot_mean

H = C.HORIZONS
RT1 = 2 * C.COSTS['C1']


def past_tercile_flag(e: pd.DataFrame, col: str, upper: bool, min_past: int = C.TERCILE_MIN_PAST) -> np.ndarray:
    """1 si la valeur est dans le tercile supérieur (ou inférieur) des chocs passés du même actif, NaN sinon."""
    out = np.full(len(e), np.nan)
    for asset, idx in e.groupby('asset').groups.items():
        sub = e.loc[idx].sort_values('T')
        vals = sub[col].to_numpy()
        T = sub['T'].to_numpy()
        pos = sub.index.to_numpy()
        for k in range(len(sub)):
            past = vals[(T < T[k]) & np.isfinite(vals)]
            if len(past) < min_past or not np.isfinite(vals[k]):
                continue
            thr = np.quantile(past, 2 / 3 if upper else 1 / 3)
            out[e.index.get_loc(pos[k])] = float(vals[k] > thr) if upper else float(vals[k] < thr)
    return out


def boot_diff(g: np.ndarray, flag: np.ndarray, weeks: np.ndarray, B: int = 5000, seed: int = 0) -> dict:
    uw, inv = np.unique(weeks, return_inverse=True)
    W = len(uw)
    s1 = np.bincount(inv, weights=np.where(flag == 1, g, 0.0), minlength=W)
    c1 = np.bincount(inv, weights=(flag == 1).astype(float), minlength=W)
    s0 = np.bincount(inv, weights=np.where(flag == 0, g, 0.0), minlength=W)
    c0 = np.bincount(inv, weights=(flag == 0).astype(float), minlength=W)
    rng = np.random.default_rng(seed)
    nbk = math.ceil(W / 4)
    idx = ((rng.integers(0, W, (B, nbk))[:, :, None] + np.arange(4)) % W).reshape(B, -1)[:, :W]
    with np.errstate(invalid='ignore', divide='ignore'):
        dist = s1[idx].sum(1) / c1[idx].sum(1) - s0[idx].sum(1) / c0[idx].sum(1)
    est = g[flag == 1].mean() - g[flag == 0].mean()
    return st.boot_summary(est, dist)


def test_one(e: pd.DataFrame, flag: np.ndarray, gcol: str) -> dict:
    g = e[gcol].to_numpy()
    ok = np.isfinite(g) & np.isfinite(flag)
    g, f, T = g[ok], flag[ok], e['T'].to_numpy()[ok]
    days, weeks = st.day_of(T), st.week_of(T)
    d = st.diff_test(g, f, days)
    net = st.cluster_mean(g[f == 1] - RT1, days[f == 1])
    est, dist = week_boot_mean(g[f == 1] - RT1, weeks[f == 1], 5000)
    return {'diff': d, 'diff_boot': boot_diff(g, f, weeks), 'net_fav': net, 'net_fav_boot': st.boot_summary(est, dist)}


def auc(p: np.ndarray, y: np.ndarray) -> float:
    r = pd.Series(p).rank().to_numpy()
    n1, n0 = y.sum(), (1 - y).sum()
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)) if n1 and n0 else float('nan')


def h3a(e: pd.DataFrame, delta: int) -> dict:
    out = {}
    for h in H:
        Hm = 1 + h * delta
        y = (e[f'nj_same{h}'] >= 1).astype(float).to_numpy()
        ph = e[f'p_same{h}'].to_numpy()
        pp = 1 - np.exp(-e['mu_pois_same'].to_numpy() * Hm)
        pe = np.full(len(e), np.nan)
        for asset, idx in e.groupby('asset').groups.items():
            sub = e.loc[idx].sort_values('T')
            T = sub['T'].to_numpy()
            yy = (sub[f'nj_same{h}'] >= 1).astype(float).to_numpy()
            end = T + Hm * 60_000
            for k in range(len(sub)):
                past = end < T[k]
                if past.sum() >= C.TERCILE_MIN_PAST:
                    pe[e.index.get_loc(sub.index[k])] = yy[past].mean()
        ok = np.isfinite(pe) & np.isfinite(ph)
        days = st.day_of(e['T'].to_numpy()[ok])
        bh_, bp, be = (ph[ok] - y[ok]) ** 2, (pp[ok] - y[ok]) ** 2, (pe[ok] - y[ok]) ** 2
        eps = 1e-6
        ll = lambda p: -(y[ok] * np.log(np.clip(p, eps, 1)) + (1 - y[ok]) * np.log(np.clip(1 - p, eps, 1)))
        out[h] = {'n': int(ok.sum()), 'rate': float(y[ok].mean()), 'mean_hawkes': float(ph[ok].mean()), 'mean_poisson': float(pp[ok].mean()),
                  'brier_hawkes': float(bh_.mean()), 'brier_poisson': float(bp.mean()), 'brier_empirical': float(be.mean()),
                  'vs_poisson': st.cluster_mean(bp - bh_, days), 'vs_empirical': st.cluster_mean(be - bh_, days),
                  'logscore_hawkes': float(ll(ph[ok]).mean()), 'logscore_empirical': float(ll(pe[ok]).mean()),
                  'auc_hawkes': auc(ph[ok], y[ok]),
                  'calibration': pd.DataFrame({'p': ph[ok], 'y': y[ok]}).assign(b=lambda z: pd.qcut(z['p'].rank(method='first'), 5, labels=False))
                  .groupby('b').agg(pred=('p', 'mean'), real=('y', 'mean')).reset_index().to_dict('records')}
    return out


def run(delta: int) -> dict:
    ev = load_events(delta)
    e = ev[ev['absZ'] >= C.K_SHOCK].reset_index(drop=True)
    flags = {
        'H1': e['FB'].to_numpy().astype(float),
        'H2a': past_tercile_flag(e, 'imbalance', upper=True),
        'H2b': past_tercile_flag(e, 'amihud', upper=True),
        'H4a': past_tercile_flag(e, 'basis_dev', upper=True),
    }
    res = {'n': int(len(e)), 'tests': {}, 'shares': {k: float(np.nanmean(v)) for k, v in flags.items()}}
    for name, f in flags.items():
        for h in H:
            res['tests'][f'{name}@{h}'] = test_one(e, f, f'g{h}')
    d2 = e[e['D2_eligible'] == 1].reset_index(drop=True)
    res['n_D2'] = int(len(d2))
    for h in H:
        f = past_tercile_flag(d2, f'D2_p_same{h}', upper=False)
        res['shares'][f'H3b@{h}'] = float(np.nanmean(f))
        res['tests'][f'H3b@{h}'] = test_one(d2, f, f'D2_g{h}')
    # H1b (secondaire) : cassure en T, retour dans le range en t+1 ou t+2
    b = e[(e['BO'] == 1)]
    res['H1b'] = {}
    for h in H:
        sub = b[b['H1b_j'] > 0]
        g = sub[f'H1b_g{h}'].to_numpy() if f'H1b_g{h}' in sub else np.array([])
        ok = np.isfinite(g)
        g, T = g[ok], sub['T'].to_numpy()[ok] if len(g) else np.array([], dtype=np.int64)
        res['H1b'][h] = st.cluster_mean(g - RT1, st.day_of(T)) if len(g) > 1 else {'n': int(len(g))}
        res['H1b'][h]['gross_mean'] = float(g.mean()) if len(g) else float('nan')
    res['H3a'] = h3a(e, delta)
    keys = list(res['tests'])
    for kind in ('diff', 'net_fav'):
        p = np.array([res['tests'][k][kind]['p'] for k in keys])
        for k, a, q in zip(keys, st.holm(p), st.bh(p)):
            res['tests'][k][kind]['p_holm'] = float(a)
            res['tests'][k][kind]['q_bh'] = float(q)
    k3 = [(h, ref) for h in H for ref in ('vs_poisson', 'vs_empirical')]
    adj = st.holm(np.array([res['H3a'][h][ref]['p'] for h, ref in k3]))
    for (h, ref), a in zip(k3, adj):
        res['H3a'][h][ref]['p_holm'] = float(a)
    return res


def bps(x):
    return '—' if not np.isfinite(x) else f'{1e4 * x:.1f}'


def main():
    out = {5: run(5), 15: run(15)}
    L = ['# Shock Fade Engine — hypothèses H1–H4 testées séparément (période E)', '',
         'Généré par `research/fade/shockfade/hypotheses.py`. Chocs |Z| ≥ 4. Groupe « favorable » : H1 failed breakout ; '
         'H2a tercile supérieur du déséquilibre agresseur dans le sens du choc ; H2b tercile supérieur du ratio d\'Amihud ; '
         'H3b (décision en D2, chocs sans continuation pendant deux barres) tercile inférieur de p_same Hawkes ; H4a tercile '
         'supérieur de l\'écart de base perp − comptant créé par le choc. Terciles calculés sur les chocs **passés** du même actif.', '',
         '(i) différence de rendement **brut** du Fade, groupe favorable − reste ; (ii) moyenne **nette C1** du groupe favorable. '
         'p unilatéraux, erreurs groupées par jour ; Holm sur les 30 tests de chaque famille à 5 min ; IC bootstrap par blocs '
         'de 4 semaines.', '']
    for delta in (5, 15):
        r = out[delta]
        L += [f'## {"Fréquence principale" if delta == 5 else "Fréquence secondaire (non corrigée pour la sélection)"} : {delta} min '
              f'({r["n"]} chocs ; {r["n_D2"]} sans continuation en D2)', '',
              '| hypothèse | h | n favorable | (i) diff. brute (pb) | IC 95 % | p | p Holm | (ii) net C1 favorable (pb) | IC 95 % | p | p Holm |',
              '|---|---:|---:|---:|---|---:|---:|---:|---|---:|---:|']
        for k, t in r['tests'].items():
            name, h = k.split('@')
            d, db, n, nb = t['diff'], t['diff_boot'], t['net_fav'], t['net_fav_boot']
            L.append(f"| {name} | {h} | {d['n1']} | {bps(d['diff'])} | [{bps(db['lo95'])} ; {bps(db['hi95'])}] | {d['p']:.3f} | "
                     f"{d['p_holm']:.3f} | {bps(n['mean'])} | [{bps(nb['lo95'])} ; {bps(nb['hi95'])}] | {n['p']:.3f} | {n['p_holm']:.3f} |")
        L += ['', 'H1b (secondaire) — cassure confirmée en T puis retour dans le range en t+1 ou t+2, entrée une minute après le retour :', '',
              '| h | n | brut (pb) | net C1 (pb) | t |', '|---:|---:|---:|---:|---:|']
        for h, z in r['H1b'].items():
            L.append(f"| {h} | {z.get('n', 0)} | {bps(z.get('gross_mean', np.nan))} | {bps(z.get('mean', np.nan))} | {z.get('t', float('nan')):.2f} |")
        L += ['', 'H3a — la probabilité Hawkes d\'un nouveau saut dans le sens du choc est-elle mieux calibrée que Poisson et que la '
              'fréquence passée ? (score de Brier, différence > 0 = Hawkes meilleur ; AUC = pouvoir de discrimination)', '',
              '| h | n | taux réalisé | Hawkes moyen | Brier Hawkes | Brier Poisson | Brier fréquence passée | gain vs Poisson (p Holm) | gain vs fréquence (p Holm) | AUC Hawkes |',
              '|---:|---:|---:|---:|---:|---:|---:|---|---|---:|']
        for h, z in r['H3a'].items():
            vp, ve = z['vs_poisson'], z['vs_empirical']
            L.append(f"| {h} | {z['n']} | {100 * z['rate']:.1f} % | {100 * z['mean_hawkes']:.1f} % | {z['brier_hawkes']:.4f} | "
                     f"{z['brier_poisson']:.4f} | {z['brier_empirical']:.4f} | {vp['mean']:+.4f} ({vp.get('p_holm', vp['p']):.3g}) | "
                     f"{ve['mean']:+.4f} ({ve.get('p_holm', ve['p']):.3g}) | {z['auc_hawkes']:.3f} |")
        L.append('')
    from .paths import REPORTS
    (REPORTS / '04-hypotheses.md').write_text('\n'.join(L) + '\n')
    (REPORTS / '04-hypotheses.json').write_text(json.dumps({str(k): v for k, v in out.items()}, indent=1, default=float))
    log('shockfade/hypotheses.py', 'H1, H1b, H2a, H2b, H3a, H3b, H4a × 6 horizons, Δ ∈ {5, 15}', f'E = {C.E_START} → {C.E_END}')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
