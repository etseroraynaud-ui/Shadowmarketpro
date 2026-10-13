"""Étude multi-timeframe des chocs (M30, H1, H4 ; M5 et M15 en référence) — protocole
research/preregistration/shock-fade-mtf.md.

Deux étapes séparées : `detect` (chocs et caractéristiques connues à la clôture T, sans aucun prix
postérieur à T) et `outcomes` (rendements après T). Les comptages préalables n'utilisent que `detect`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config as C
from . import hawkes as hk
from . import jumps as jp
from . import ou
from . import vol as vl
from .data import MIN_MS, aggregate, load_funding, to_grid
from .paths import DERIVED
from .pipeline import Asset, _rv_percentile, all_jump_events, hawkes_of, quarter_of

DELTAS = (30, 60, 240)
REF_DELTAS = (5, 15)
K_LEVELS = (3.0, 4.0)
RANGE_BARS = 20
GRID_H = (1, 2, 4, 8, 16, 32)
EXTRA_H = {240: (6, 12)}
PRIMARY_H = {30: (2, 4, 8), 60: (1, 4, 16), 240: (2, 6, 12), 5: (2, 4, 8), 15: (1, 2, 4)}
CLOCK_H = (60, 240, 960, 2880)            # 1 h, 4 h, 16 h, 48 h : structure par terme
N2_BARS = 100

P_START, P_END = '2020-07-01', '2026-10-01'
R_START, R_END = '2018-01-01', '2020-01-01'


def horizons(delta: int) -> tuple[int, ...]:
    """Grille commune, horizons primaires et horizons d'horloge (1 h, 4 h, 16 h, 48 h) exprimés en barres."""
    clock = {c // delta for c in CLOCK_H if c % delta == 0}
    return tuple(sorted(set(GRID_H) | set(EXTRA_H.get(delta, ())) | set(PRIMARY_H[delta]) | clock))


def bv_window(delta: int) -> int:
    """Fenêtre de la variation bipuissance (minutes, strictement avant la barre) : 20 barres, bornée à [6 h, 7 j]."""
    return int(min(max(20 * delta, 360), 7 * 1440))


# ---------------------------------------------------------------- données

def load_series(sym: str, market: str, start: str, end: str, tag: str = '') -> Asset:
    """Grille 1 min [start 00:00, end) d'un marché ; base perp − comptant seulement pour le perpétuel 2020+."""
    t0 = C.ms(start)
    t1 = C.ms(end) - MIN_MS
    df = pd.read_parquet(DERIVED / f'{market}-{sym}-1m{tag}.parquet')
    m = to_grid(df, t0, t1)
    v = vl.compute(m.c, m.ok)
    jump = jp.detect(v.L)
    u = ou.flow_input(m.flow, m.ok)
    with np.errstate(invalid='ignore', divide='ignore'):
        x = np.where(m.ok, np.log(m.c), np.nan)
    basis = np.full(m.size, np.nan)
    return Asset(f'{sym}{"-" + market if market != "um" else ""}{tag}', t0, m, v, jump, u, x, basis, _rv_percentile(m))


def regime_v1(a: Asset) -> tuple[np.ndarray, np.ndarray]:
    """Régime de volatilité et tendance du dernier jour UTC clos, règle de V1 (lib/strategies/shock/regimes.ts),
    réimplémentée : écart type des rendements journaliers sur 20 jours, rang parmi les 365 jours précédents
    (au moins 60), agité au-dessus de la médiane ; tendance : clôture vs moyenne 50 jours et pente sur 10 jours.

    Renvoie, par jour d (indice depuis t0), agitated[d] ∈ {0, 1, NaN} et trend[d] ∈ {+1, 0, −1, NaN}, valeurs du
    jour d lui-même (à appliquer aux barres dont la clôture est postérieure à la fin du jour d)."""
    nd = a.m.size // 1440
    close = a.m.c[1439: nd * 1440: 1440]                  # clôture de chaque jour UTC
    ok = a.m.ok[1439: nd * 1440: 1440]
    c = pd.Series(np.where(ok, close, np.nan)).ffill().to_numpy()
    r = np.full(nd, np.nan)
    r[1:] = np.log(c[1:] / c[:-1])
    vol = pd.Series(r).rolling(20).std(ddof=0).to_numpy()
    sma = pd.Series(c).rolling(50).mean().to_numpy()
    agit = np.full(nd, np.nan)
    trend = np.full(nd, np.nan)
    for i in range(nd):
        if i < 10 or not (np.isfinite(sma[i]) and np.isfinite(sma[i - 10]) and np.isfinite(vol[i])):
            continue
        past = vol[max(0, i - 365):i]
        past = past[np.isfinite(past)]
        if len(past) < 60:
            continue
        agit[i] = float(np.mean(past <= vol[i]) > 0.5)
        up = c[i] > sma[i] and sma[i] > sma[i - 10]
        dn = c[i] < sma[i] and sma[i] < sma[i - 10]
        trend[i] = 1.0 if up else (-1.0 if dn else 0.0)
    return agit, trend


# ---------------------------------------------------------------- détection (rien après T)

@dataclass
class Shocks:
    delta: int
    bars: object
    R: np.ndarray
    Z: np.ndarray
    Z2: np.ndarray       # normalisation N2 (écart type des 100 barres précédentes), comptages seulement
    sig: np.ndarray


def bar_z(a: Asset, delta: int) -> Shocks:
    b = aggregate(a.m, delta)
    nb = len(b.c)
    W = bv_window(delta)
    bvW = vl.bipower_local(a.vol.rt, W, vl.BV_MIN_VALID) if W != vl.K_BV else a.vol.bv
    s2 = (a.vol.s[: nb * delta] ** 2).reshape(nb, delta).sum(axis=1)
    var = 0.5 * math.pi * bvW[b.first] * s2
    with np.errstate(invalid='ignore', divide='ignore'):
        R = np.log(b.c) - np.log(np.roll(b.c, 1))
        Z = R / np.sqrt(var)
    valid = b.complete & np.roll(b.complete, 1) & np.isfinite(Z)
    valid[0] = False
    R[~valid] = np.nan
    Z[~valid] = np.nan
    sd = pd.Series(R).rolling(N2_BARS, min_periods=int(0.8 * N2_BARS)).std(ddof=0).shift(1).to_numpy()
    with np.errstate(invalid='ignore', divide='ignore'):
        Z2 = R / sd
    return Shocks(delta, b, R, Z, Z2, np.sqrt(var))


def detect(a: Asset, sh: Shocks, start: str, end: str, regime: tuple, fits: dict | None,
           k_min: float = min(K_LEVELS)) -> pd.DataFrame:
    """Chocs |Z| ≥ k_min dont la clôture T ∈ [start, end) ; caractéristiques connues en T uniquement."""
    b, R, Z, delta = sh.bars, sh.R, sh.Z, sh.delta
    t_close = b.t + delta * MIN_MS
    lo, hi = C.ms(start), C.ms(end)
    idx = np.nonzero((np.abs(np.nan_to_num(Z)) >= k_min) & (t_close >= lo) & (t_close < hi))[0]
    agit, trend = regime
    quarters = sorted(fits) if fits else []
    ta, ma = all_jump_events(a) if fits else (None, None)
    rows = []
    for t in idx:
        if t < RANGE_BARS + 21:
            continue
        d = 1 if R[t] > 0 else -1
        first = int(b.first[t])
        iT = first + delta - 1
        T = int(t_close[t])
        absR = abs(R[t])
        row = {'asset': a.sym, 'delta': delta, 'bar': int(t), 'T': T, 'iT': iT, 'd': d, 'R': R[t], 'Z': Z[t], 'absZ': abs(Z[t]),
               'Z2': sh.Z2[t], 'sigma_bar': sh.sig[t]}
        # cassure : extrêmes des 20 barres précédentes
        hh = np.nanmax(b.h[t - RANGE_BARS:t])
        ll = np.nanmin(b.l[t - RANGE_BARS:t])
        if d > 0:
            brk = 'propre' if b.c[t] > hh else ('rejetée' if b.h[t] > hh else 'sans')
        else:
            brk = 'propre' if b.c[t] < ll else ('rejetée' if b.l[t] < ll else 'sans')
        row['breakout'] = brk
        row['level'] = hh if d > 0 else ll
        # régime (dernier jour UTC clos avant T)
        day = (T - a.t0) // 86_400_000 - 1
        row['agitated'] = agit[day] if 0 <= day < len(agit) else np.nan
        row['trend'] = trend[day] if 0 <= day < len(trend) else np.nan
        row['trend_aligned'] = d * row['trend'] if np.isfinite(row['trend']) else np.nan
        # composition du choc (1 min)
        rb = a.vol.r[first:iT + 1]
        jb = a.jump[first:iT + 1]
        same = jb == d
        row['n_jump_same'] = int(same.sum())
        row['n_jump_opp'] = int((jb == -d).sum())
        row['js'] = float(np.clip(d * np.nansum(rb[same]) / absR, 0, 1.5)) if absR > 0 else np.nan
        row['abrupt'] = float(row['js'] >= 0.5)
        tot = np.nansum(np.abs(rb))
        row['efficiency'] = absR / tot if tot > 0 else np.nan
        if delta >= 30:
            r5 = np.nansum(rb.reshape(-1, 5), axis=1)
            row['concentration'] = float(np.max(d * r5) / absR) if absR > 0 else np.nan
        else:
            row['concentration'] = np.nan
        c_prev = b.c[t - 1]
        c_back = b.c[t - 21]
        row['prior_trend_z'] = d * (math.log(c_prev) - math.log(c_back)) / (sh.sig[t] * math.sqrt(20)) if np.isfinite(c_back) and sh.sig[t] > 0 else np.nan
        qv = a.m.qv[first:iT + 1].sum()
        row['imbalance'] = d * a.m.flow[first:iT + 1].sum() / qv if qv > 0 else np.nan
        # intensité Hawkes (paramètres du trimestre, estimés avant lui)
        if fits:
            q = int(quarter_of(np.array([T]), quarters)[0])
            if q >= 0:
                f = hawkes_of(fits[q])
                sm = 0 if d > 0 else 1
                Rst = hk.states_at(ta, ma, np.array([float(first), float(iT + 1)]), f.beta)
                lam = hk.intensity(Rst, f)
                row['lam_ratio_pre'] = lam[0, sm] / f.mu[sm]
                row['lam_ratio_T'] = lam[1, sm] / f.mu[sm]
        rows.append(row)
    return pd.DataFrame(rows)


def decluster(ev: pd.DataFrame, run_bars: int) -> pd.DataFrame:
    """Groupes par série : un choc à moins de `run_bars` barres du précédent (même actif) rejoint son groupe.
    Groupes croisés : groupes BTC et ETH qui se chevauchent fusionnés (dépendance entre actifs)."""
    ev = ev.sort_values(['asset', 'T']).copy()
    span = run_bars * ev['delta'].iloc[0] * MIN_MS if len(ev) else 0
    gid = np.zeros(len(ev), dtype=np.int64)
    g = -1
    prev_asset, prev_T = None, None
    for k, (asset, T) in enumerate(zip(ev['asset'], ev['T'])):
        if asset != prev_asset or T - prev_T > span:
            g += 1
        gid[k] = g
        prev_asset, prev_T = asset, T
    ev['cluster'] = gid
    ev['first_in_cluster'] = ~ev['cluster'].duplicated()
    # groupes croisés : intervalles [début, fin + span] des groupes, fusion par chevauchement
    gr = ev.groupby('cluster')['T'].agg(['min', 'max']).sort_values('min')
    xid = {}
    cur, end = -1, -np.inf
    for cl, (mn, mx) in gr.iterrows():
        if mn > end:
            cur += 1
            end = mx + span
        else:
            end = max(end, mx + span)
        xid[cl] = cur
    ev['xcluster'] = ev['cluster'].map(xid)
    return ev.sort_values('T').reset_index(drop=True)


# ---------------------------------------------------------------- résultats (après T)

def funding_times(sym: str) -> tuple[np.ndarray, np.ndarray]:
    f = load_funding(sym)
    return f['time_ms'].to_numpy(), f['rate'].to_numpy()


def outcomes(a: Asset, ev: pd.DataFrame, delta: int, funding: tuple | None) -> pd.DataFrame:
    """Rendement du Fade (−d) de la clôture de T+1 min à T+1+hΔ, MFE/MAE, course 25 % / 50 %, financement."""
    m, x = a.m, a.x
    ok_cs = np.concatenate([[0], np.cumsum(m.ok.astype(np.int64))])
    H = horizons(delta)
    race_win = max(PRIMARY_H[delta]) * delta + 1
    out = []
    for row in ev.to_dict('records'):
        iT, d, absR = row['iT'], row['d'], abs(row['R'])
        iE = iT + C.LATENCY_MIN
        pE = m.c[iE] if iE < m.size else np.nan
        for h in H:
            iX = iE + h * delta
            key = f'g{h}'
            if iX < m.size and np.isfinite(pE) and ok_cs[iX + 1] - ok_cs[iT + 1] >= 0.98 * (iX - iT) and np.isfinite(m.c[iX]):
                row[key] = -d * (math.log(m.c[iX]) - math.log(pE))
                hi_ = np.nanmax(m.h[iE + 1:iX + 1])
                lo_ = np.nanmin(m.l[iE + 1:iX + 1])
                if d > 0:
                    row[f'mfe{h}'], row[f'mae{h}'] = math.log(pE) - math.log(lo_), math.log(hi_) - math.log(pE)
                else:
                    row[f'mfe{h}'], row[f'mae{h}'] = math.log(hi_) - math.log(pE), math.log(pE) - math.log(lo_)
                if funding is not None:
                    ft, fr = funding
                    t_in, t_out = a.t0 + (iE + 1) * MIN_MS, a.t0 + (iX + 1) * MIN_MS
                    sel = (ft > t_in) & (ft <= t_out)
                    row[f'fund{h}'] = d * float(fr[sel].sum())      # P&L du financement pour la position −d
                else:
                    row[f'fund{h}'] = 0.0
            else:
                row[key] = np.nan
        # B2 : cassure propre jugée à D2 = clôture de t+2 (tenue / réintégrée), rendements depuis D2 + 1 min
        row['b2'] = None
        if row['breakout'] == 'propre':
            i2 = iT + 2 * delta
            c2 = m.c[i2] if i2 < m.size else np.nan
            if np.isfinite(c2):
                inside = c2 < row['level'] if d > 0 else c2 > row['level']
                row['b2'] = 'réintégrée' if inside else 'tenue'
                iE2 = i2 + C.LATENCY_MIN
                p2 = m.c[iE2] if iE2 < m.size else np.nan
                for h in PRIMARY_H[delta]:
                    iX = iE2 + h * delta
                    ok = iX < m.size and np.isfinite(p2) and ok_cs[iX + 1] - ok_cs[i2 + 1] >= 0.98 * (iX - i2) and np.isfinite(m.c[iX])
                    row[f'gD2_{h}'] = -d * (math.log(m.c[iX]) - math.log(p2)) if ok else np.nan
        # course : 25 % / 50 % de reprise contre 25 % / 50 % d'extension, depuis la clôture du choc
        end = min(iT + race_win, m.size - 1)
        path = x[iT + 1:end + 1]
        f = d * (x[iT] - path) / absR
        for q in (25, 50):
            up = np.nonzero(f >= q / 100)[0]
            dn = np.nonzero(f <= -q / 100)[0]
            tu = up[0] if len(up) else np.inf
            tdn = dn[0] if len(dn) else np.inf
            row[f'race{q}'] = np.nan if (tu == np.inf and tdn == np.inf) else float(tu < tdn)
            row[f'retr{q}'] = float(len(up) > 0)
            row[f'ext{q}'] = float(len(dn) > 0)
        out.append(row)
    return pd.DataFrame(out)
