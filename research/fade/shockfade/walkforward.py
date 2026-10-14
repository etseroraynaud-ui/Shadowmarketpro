"""Walk-forward des modèles M1–M7 et du contrôle OU naïf (protocole § 6–7).

Pour chaque actif, horizon et trimestre q de la période évaluée : estimation sur les événements du
même actif décidés avant q **et dont la sortie précède q** (purge), prévision des événements de q.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import config as C
from . import stats as st

MODELS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'CTRL']
COMPLEXITY = ['M1', 'M2', 'M4', 'M3', 'M5', 'M6', 'M7']
LABEL = {'M1': 'Fade naïf', 'M2': 'Failed breakout', 'M3': 'Hawkes seul', 'M4': 'OU seul', 'M5': 'Hawkes + OU',
         'M6': 'Hybride avec sauts', 'M7': 'Hybride + FB', 'CTRL': 'contrôle : OU naïf sur prix brut'}
MIN_SPLIT = 50


def _design(df: pd.DataFrame, model: str, h: int) -> np.ndarray:
    one = np.ones(len(df))
    if model == 'M1':
        return one[:, None]
    if model == 'M2':
        return np.column_stack([one, df['FB']])
    if model == 'M3':
        return np.column_stack([one, df[f'p_same{h}'], df[f'p_opp{h}']])
    if model == 'M4':
        return np.column_stack([one, df[f'rho{h}']])
    if model == 'M5':
        return np.column_stack([one, df[f'p_same{h}'], df[f'p_opp{h}'], df[f'rho{h}']])
    if model == 'M6':
        return np.column_stack([one, df[f'rho{h}'], df['J'], df['js']])
    if model == 'M7':
        return np.column_stack([one, df[f'rho{h}'], df['J'], df['js'], df['FB']])
    if model == 'CTRL':
        return np.column_stack([one, df[f'naive_rho{h}']])
    raise ValueError(model)


def _ols(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return beta


def feature_cols(h: int) -> list[str]:
    return ['FB', 'J', 'js', f'p_same{h}', f'p_opp{h}', f'rho{h}', f'naive_rho{h}', f'g{h}', f'nj_same{h}']


def predict(ev: pd.DataFrame, delta: int, h: int, eval_start: str, eval_end: str) -> pd.DataFrame:
    """Prévisions brutes Ê[g_h] hors entraînement pour chaque modèle (colonnes pred_<M>)."""
    out = []
    lo, hi = C.ms(eval_start), C.ms(eval_end)
    H_ms = (C.LATENCY_MIN + h * delta) * 60_000
    for asset, d in ev.groupby('asset'):
        d = d.dropna(subset=feature_cols(h)).sort_values('T')
        exit_t = d['T'].to_numpy() + H_ms
        for q in sorted(d['quarter'].unique()):
            if q < lo or q >= hi:
                continue
            tr = d[(exit_t < q) & (d['T'].to_numpy() >= C.ms(C.E_START))]
            te = d[d['quarter'] == q]
            if len(tr) < C.MIN_TRAIN or len(te) == 0:
                continue
            y = tr[f'g{h}'].to_numpy()
            res = te[['asset', 'T', 'quarter', 'd', f'g{h}']].copy().rename(columns={f'g{h}': 'g'})
            for mdl in MODELS:
                if mdl in ('M6', 'M7'):
                    jumped = tr[f'nj_same{h}'].to_numpy() >= 1
                    X = _design(tr, mdl, h)
                    Xt = _design(te, mdl, h)
                    if jumped.sum() >= MIN_SPLIT and (~jumped).sum() >= MIN_SPLIT:
                        b0, b1 = _ols(X[~jumped], y[~jumped]), _ols(X[jumped], y[jumped])
                    else:
                        b0 = b1 = _ols(X, y)
                    p = te[f'p_same{h}'].to_numpy()
                    res[f'pred_{mdl}'] = (1 - p) * (Xt @ b0) + p * (Xt @ b1)
                else:
                    b = _ols(_design(tr, mdl, h), y)
                    res[f'pred_{mdl}'] = _design(te, mdl, h) @ b
            res['n_train'] = len(tr)
            out.append(res)
    if not out:
        return pd.DataFrame()
    r = pd.concat(out, ignore_index=True)
    r['h'] = h
    r['delta'] = delta
    return r


def econ(x: np.ndarray, T: np.ndarray, assets: np.ndarray, quarters: np.ndarray, boot: int = 5000, seed: int = 0) -> dict:
    """Statistiques économiques d'un ensemble d'événements pris (rendements nets)."""
    n = len(x)
    if n == 0:
        return {'n': 0}
    days, weeks = st.day_of(T), st.week_of(T)
    cm = st.cluster_mean(x, days)
    gains, losses = x[x > 0], x[x <= 0]
    srt = np.sort(x)
    k5 = max(1, int(math.ceil(0.05 * n)))
    top1 = max(1, int(math.ceil(0.01 * n)))
    tot = x.sum()
    est, dist = week_boot_mean(x, weeks, boot, seed=seed)
    qmeans = pd.Series(x).groupby(quarters).agg(['mean', 'size'])
    qq = qmeans[qmeans['size'] >= 10]
    per_asset = {a: float(x[assets == a].mean()) for a in np.unique(assets)}
    z = (x - x.mean()) / x.std() if x.std() > 0 else x * 0
    return {
        'n': int(n), 'mean': float(x.mean()), 'median': float(np.median(x)), 'se_day': cm['se'], 't_day': cm['t'], 'p_day': cm['p'],
        'boot': st.boot_summary(est, dist), 'win': float(np.mean(x > 0)),
        'payoff': float(gains.mean() / -losses.mean()) if len(gains) and len(losses) and losses.mean() < 0 else float('nan'),
        'pf': float(gains.sum() / -losses.sum()) if losses.sum() < 0 else float('inf'),
        'cvar5': float(srt[:k5].mean()), 'worst': float(srt[0]), 'best': float(srt[-1]), 'skew': float(np.mean(z ** 3)),
        'share_top1': float(srt[-top1:].sum() / tot) if tot != 0 else float('nan'),
        'share_top5': float(srt[-k5:].sum() / tot) if tot != 0 else float('nan'),
        'mean_ex_top1': float(srt[:-top1].mean()) if n > top1 else float('nan'),
        'quarters_pos_share': float(np.mean(qq['mean'] > 0)) if len(qq) else float('nan'), 'quarters_n': int(len(qq)),
        'per_asset': per_asset,
    }


def week_boot_mean(x: np.ndarray, weeks: np.ndarray, B: int = 5000, block: int = 4, seed: int = 0):
    """Bootstrap par blocs mobiles circulaires de semaines pour une moyenne par événement (vectorisé)."""
    uw, inv = np.unique(weeks, return_inverse=True)
    W = len(uw)
    s = np.bincount(inv, weights=x, minlength=W)
    c = np.bincount(inv, minlength=W).astype(float)
    rng = np.random.default_rng(seed)
    nbk = int(math.ceil(W / block))
    starts = rng.integers(0, W, (B, nbk))
    idx = ((starts[:, :, None] + np.arange(block)[None, None, :]) % W).reshape(B, -1)[:, :W]
    S, Cn = s[idx].sum(axis=1), c[idx].sum(axis=1)
    with np.errstate(invalid='ignore', divide='ignore'):
        dist = S / Cn
    return float(x.mean()), dist


def week_boot_diff(a_week: np.ndarray, b_week: np.ndarray, B: int = 5000, block: int = 4, seed: int = 0):
    """Bootstrap de la moyenne d'une différence de P&L hebdomadaires alignés."""
    dlt = a_week - b_week
    W = len(dlt)
    rng = np.random.default_rng(seed)
    nbk = int(math.ceil(W / block))
    starts = rng.integers(0, W, (B, nbk))
    idx = ((starts[:, :, None] + np.arange(block)[None, None, :]) % W).reshape(B, -1)[:, :W]
    return float(dlt.mean()), dlt[idx].mean(axis=1)


def evaluate(preds: pd.DataFrame, cost_c1: float = C.COSTS['C1'], cost_c2: float = C.COSTS['C2'], boot: int = 5000) -> dict:
    """Prévision (Clark–West, R²_OOS, Spearman) et économie des événements pris (Ê_net > 0)."""
    out = {}
    for (delta, h), P in preds.groupby(['delta', 'h']):
        days = st.day_of(P['T'].to_numpy())
        y = P['g'].to_numpy()
        res = {}
        for mdl in MODELS:
            f = P[f'pred_{mdl}'].to_numpy()
            r: dict = {}
            if mdl != 'M1':
                r['cw'] = st.clark_west(y, P['pred_M1'].to_numpy(), f, days)
            r['spearman'] = float(pd.Series(f).corr(pd.Series(y), method='spearman')) if np.std(f) > 0 else float('nan')
            take = f - 2 * cost_c1 > 0
            sel = P[take]
            r['econ_c1'] = econ(sel['g'].to_numpy() - 2 * cost_c1, sel['T'].to_numpy(), sel['asset'].to_numpy(),
                                sel['quarter'].to_numpy(), boot=boot)
            r['econ_c2_mean'] = float((sel['g'] - 2 * cost_c2).mean()) if len(sel) else float('nan')
            r['econ_c0_mean'] = float(sel['g'].mean()) if len(sel) else float('nan')
            r['take_share'] = float(take.mean())
            # calibration par déciles de la prévision
            if np.std(f) > 0:
                dec = pd.qcut(pd.Series(f).rank(method='first'), 10, labels=False)
                cal = pd.DataFrame({'f': f, 'y': y, 'dec': dec}).groupby('dec').agg(pred=('f', 'mean'), real=('y', 'mean'), n=('y', 'size'))
                r['calibration'] = cal.reset_index().to_dict('records')
            res[mdl] = r
        res['n_events'] = int(len(P))
        res['all_gross_mean'] = float(y.mean())
        out[(int(delta), int(h))] = res
    return out


def weekly_pnl(P: pd.DataFrame, mdl: str, cost: float, weeks_all: np.ndarray) -> np.ndarray:
    take = P[f'pred_{mdl}'] - 2 * cost > 0
    x = np.where(take, P['g'] - 2 * cost, 0.0)
    wk = st.week_of(P['T'].to_numpy())
    s = pd.Series(x).groupby(wk).sum()
    return s.reindex(weeks_all, fill_value=0.0).to_numpy()


def compare_pairs(preds: pd.DataFrame, pairs=(('M7', 'M2'), ('M6', 'M5'), ('M5', 'M3'), ('M5', 'M4')),
                  cost: float = C.COSTS['C1'], boot: int = 5000) -> dict:
    out = {}
    for (delta, h), P in preds.groupby(['delta', 'h']):
        wk = st.week_of(P['T'].to_numpy())
        weeks_all = np.arange(wk.min(), wk.max() + 1)
        res = {}
        for a, b in pairs:
            est, dist = week_boot_diff(weekly_pnl(P, a, cost, weeks_all), weekly_pnl(P, b, cost, weeks_all), boot)
            res[f'{a}-{b}'] = st.boot_summary(est, dist)
        out[(int(delta), int(h))] = res
    return out


def candidates(ev: dict, delta: int = C.PRIMARY_DELTA) -> dict:
    """Critères 1–5 du protocole § 7, Holm sur F4 (M1…M7 × 6 horizons) et sur F3 (Clark–West)."""
    keys, p4, p3, k3 = [], [], [], []
    for (dl, h), res in ev.items():
        if dl != delta:
            continue
        for mdl in COMPLEXITY:
            e = res[mdl]['econ_c1']
            keys.append((mdl, h))
            p4.append(e['p_day'] if e.get('n', 0) > 1 else 1.0)
            if mdl != 'M1':
                k3.append((mdl, h))
                p3.append(res[mdl]['cw']['p'])
    adj4 = dict(zip(keys, st.holm(np.array(p4))))
    adj3 = dict(zip(k3, st.holm(np.array(p3))))
    table = []
    for (mdl, h), padj in adj4.items():
        res = ev[(delta, h)][mdl]
        e = res['econ_c1']
        crit = {
            '1_holm': bool(padj < 0.05 and e.get('boot', {}).get('lo95', -1) > 0),
            '2_c2': bool(res['econ_c2_mean'] > 0),
            '3_assets': bool(e.get('n', 0) > 0 and all(v > 0 for v in e['per_asset'].values()) and len(e['per_asset']) == 2),
            '4_count_quarters': bool(e.get('n', 0) >= 200 and e.get('quarters_pos_share', 0) >= 0.6),
            '5_tails': bool(e.get('n', 0) > 0 and e['pf'] >= 1.1 and e['mean_ex_top1'] > 0),
        }
        table.append({'model': mdl, 'h': h, 'p_holm_F4': float(padj), 'p_holm_F3': float(adj3.get((mdl, h), float('nan'))),
                      'mean': e.get('mean', float('nan')), 'n': e.get('n', 0), **crit, 'candidate': all(crit.values())})
    cands = [r for r in table if r['candidate']]
    selection = None
    if cands:
        best = max(cands, key=lambda r: r['mean'])
        for mdl in COMPLEXITY:
            mine = [r for r in cands if r['model'] == mdl]
            if mine:
                top = max(mine, key=lambda r: r['mean'])
                if top['mean'] >= 0.75 * best['mean']:
                    selection = {'model': mdl, 'h': top['h'], 'mean': top['mean'], 'best': {'model': best['model'], 'h': best['h'], 'mean': best['mean']}}
                    break
    research_score = None
    if selection is None:
        sig = [(r['p_holm_F3'], r['model'], r['h']) for r in table if r['model'] != 'M1' and r['p_holm_F3'] < 0.05]
        if sig:
            p, mdl, h = min(sig)
            research_score = {'model': mdl, 'h': h, 'p_holm_F3': p}
    return {'table': table, 'selection': selection, 'research_score': research_score}
