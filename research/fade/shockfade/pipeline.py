"""Données par actif, estimations structurelles trimestrielles et table d'événements (protocole § 3–5).

Tout est causal : une caractéristique d'un événement décidé en T n'utilise que des minutes ≤ T et des
paramètres estimés sur les 180 jours qui précèdent le début de son trimestre.
"""
from __future__ import annotations

import json
import math
import zlib
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config as C
from . import hawkes as hk
from . import jumps as jp
from . import ou
from . import vol as vl
from .data import MIN_MS, Minute, aggregate, load_1m, to_grid
from .paths import DERIVED

DAY_MIN = 1440


@dataclass
class Asset:
    sym: str
    t0: int
    m: Minute
    vol: vl.Vol
    jump: np.ndarray       # +1 / −1 / 0 par minute
    u: np.ndarray          # flux transformé (entrée de l'état-espace)
    x: np.ndarray          # log-clôture perp (NaN si minute inutilisable)
    basis: np.ndarray      # ln c_perp − ln c_comptant (NaN si l'un manque)
    rv_pct: np.ndarray     # percentile du RV 30 j (jour UTC) parmi les 365 précédents, par jour

    def minute_of(self, t_ms: int) -> int:
        return int((t_ms - self.t0) // MIN_MS)


def load_asset(sym: str, end: str = C.DESIGN_GRID_END) -> Asset:
    t0 = C.ms(C.GRID_START)
    t1 = C.ms(end) - MIN_MS
    m = to_grid(load_1m('um', sym), t0, t1)
    sp = to_grid(load_1m('spot', sym), t0, t1)
    v = vl.compute(m.c, m.ok)
    jump = jp.detect(v.L)
    u = ou.flow_input(m.flow, m.ok)
    with np.errstate(invalid='ignore', divide='ignore'):
        x = np.where(m.ok, np.log(m.c), np.nan)
        basis = np.where(m.ok & sp.ok, np.log(m.c) - np.log(sp.c), np.nan)
    rv_pct = _rv_percentile(m)
    return Asset(sym, t0, m, v, jump, u, x, basis, rv_pct)


def _rv_percentile(m: Minute) -> np.ndarray:
    """Pour chaque jour d : RV30 = Σ des rendements² 5 min des jours d−30…d−1 ; rang centile parmi les
    RV30 des 365 jours précédents (au moins 90). Causal (jours complets uniquement)."""
    b = aggregate(m, 5)
    with np.errstate(invalid='ignore', divide='ignore'):
        r = np.diff(np.log(b.c), prepend=np.nan)
    r[~(b.complete & np.roll(b.complete, 1))] = np.nan
    nd = len(r) // 288
    daily = np.nansum((r[: nd * 288] ** 2).reshape(nd, 288), axis=1)
    cs = np.concatenate([[0.0], np.cumsum(daily)])
    rv30 = np.full(nd, np.nan)
    for d in range(30, nd):
        rv30[d] = cs[d] - cs[d - 30]          # jours d−30 … d−1
    out = np.full(nd + 1, np.nan)
    for d in range(nd):
        lo = max(30, d - 365)
        hist = rv30[lo:d]
        hist = hist[np.isfinite(hist)]
        if len(hist) >= 90 and np.isfinite(rv30[d]):
            out[d] = np.mean(hist <= rv30[d])
    return out


# ---------------------------------------------------------------- estimations structurelles

def jump_events(a: Asset, i0: int, i1: int):
    """Sauts des minutes [i0, i1) : instants = fin de minute (minutes depuis t0), marque 0 = hausse, 1 = baisse."""
    idx = np.nonzero(a.jump[i0:i1])[0] + i0
    return (idx + 1).astype(np.float64), np.where(a.jump[idx] > 0, 0, 1).astype(np.int64)


def all_jump_events(a: Asset):
    return jump_events(a, 0, a.m.size)


def fit_quarter(a: Asset, qs: int, prev_ss: dict | None = None) -> dict:
    i1 = a.minute_of(qs)
    i0 = i1 - C.FIT_DAYS * DAY_MIN
    # début effectif : première minute où la statistique de saut existe (préchauffage de la volatilité)
    i0 = max(i0, int(np.argmax(np.isfinite(a.vol.L))))
    nxt = int((pd.Timestamp(qs, unit='ms', tz='UTC') + pd.offsets.QuarterBegin(startingMonth=1)).value // 1_000_000)
    j1 = min(a.minute_of(nxt), a.m.size)
    out: dict = {'quarter_start': pd.Timestamp(qs, unit='ms', tz='UTC').strftime('%Y-%m-%d'), 'fit_from_min': i0, 'fit_to_min': i1}
    # Hawkes
    t, mk = jump_events(a, i0, i1)
    full = hk.fit(t, mk, float(i0), float(i1))
    pois = hk.fit_poisson(mk, float(i0), float(i1))
    univ = hk.fit(t, mk, float(i0), float(i1), use_alpha=np.eye(2, dtype=bool))
    ta, ma = all_jump_events(a)
    R0 = hk.states_at(ta, ma, np.array([float(i1)]), full.beta)[0]
    tn, mn = jump_events(a, i1, j1)
    out['hawkes'] = full.as_dict()
    out['hawkes_tests'] = {'lr_vs_poisson': hk.lr_test(full, pois), 'lr_vs_univariate': hk.lr_test(full, univ),
                           'gof_in': hk.time_rescaling(t, mk, float(i0), full),
                           'gof_out': hk.time_rescaling(tn, mn, float(i1), full, R0) if j1 > i1 else None,
                           'gof_out_poisson': hk.time_rescaling(tn, mn, float(i1), pois) if j1 > i1 else None,
                           'poisson_mu': pois.mu.tolist(), 'n_out': int(len(tn))}
    # état-espace
    sl = slice(i0, i1)
    jl2 = np.where(a.jump[sl] != 0, a.vol.L[sl] ** 2, 0.0)
    ss = ou.fit(a.x[sl], a.u[sl], a.vol.v[sl], jl2, start=prev_ss)
    rs = ou.fit(a.x[sl], a.u[sl], a.vol.v[sl], jl2, restricted=True, hessian=False,
                start={'lam_F': ss.params['lam_F'] + ss.params['lam_Q'], 'sig_F': max(ss.params['sig_F'], 0.5),
                       'sig_e': max(ss.params['sig_e'], 0.05), 'sig_FJ': max(ss.params['sig_FJ'], 0.3)})
    out['ss'] = ss.as_dict()
    out['ss_restricted'] = rs.as_dict()
    out['ss_lr_no_transient'] = 2 * (ss.loglik - rs.loglik)
    return out


def structural_fits(a: Asset, quarters: list[int], cache: bool = True) -> dict:
    path = DERIVED / f'fits-{a.sym}.json'
    store = json.loads(path.read_text()) if (cache and path.exists()) else {}
    prev = None
    for qs in quarters:
        key = str(qs)
        if key not in store:
            store[key] = fit_quarter(a, qs, prev)
            path.write_text(json.dumps(store))
        prev = store[key]['ss']['params']
    return {int(k): v for k, v in store.items() if int(k) in quarters}


def hawkes_of(f: dict) -> hk.HawkesFit:
    h = f['hawkes']
    return hk.HawkesFit(np.array(h['mu']), np.array(h['alpha']), np.array(h['beta']), h['loglik'], h['n_events'],
                        h['span_min'], h['rho'], h['converged'], np.array(h['use_alpha'], dtype=bool))


def ss_of(f: dict) -> ou.SSFit:
    s = f['ss']
    return ou.SSFit(s['params'], s['loglik'], s['nobs'], s['se'], s['converged'])


def filtered_transient(a: Asset, fits: dict) -> np.ndarray:
    """Q̂ filtré sur toute la grille ; paramètres du trimestre en cours, état reporté d'un trimestre à l'autre."""
    qs = sorted(fits)
    Qf = np.full(a.m.size, np.nan)
    state = None
    start = a.minute_of(qs[0]) - DAY_MIN
    bounds = [start] + [a.minute_of(q) for q in qs[1:]] + [a.m.size]
    for k, q in enumerate(qs):
        lo, hi = bounds[k], bounds[k + 1]
        if lo >= hi:
            continue
        sl = slice(lo, hi)
        jl2 = np.where(a.jump[sl] != 0, a.vol.L[sl] ** 2, 0.0)
        Q, _, state = ou.filter_states(a.x[sl], a.u[sl], a.vol.v[sl], jl2, ss_of(fits[q]), state)
        Qf[sl] = Q
    return Qf


# ---------------------------------------------------------------- événements

def quarter_of(t_ms: np.ndarray, quarters: list[int]) -> np.ndarray:
    q = np.asarray(quarters)
    k = np.searchsorted(q, t_ms, side='right') - 1
    return np.where(k >= 0, q[np.maximum(k, 0)], -1)


def bar_shocks(a: Asset, delta: int):
    """Z_t de chaque barre : rendement de clôture à clôture / volatilité prévue avant la barre."""
    b = aggregate(a.m, delta)
    nb = len(b.c)
    first = b.first
    s2 = (a.vol.s[: nb * delta] ** 2).reshape(nb, delta).sum(axis=1)
    bv0 = a.vol.bv[first]
    vbar = 0.5 * math.pi * bv0 * s2
    with np.errstate(invalid='ignore', divide='ignore'):
        R = np.log(b.c) - np.log(np.roll(b.c, 1))
        Z = R / np.sqrt(vbar)
    valid = b.complete & np.roll(b.complete, 1) & np.isfinite(Z)
    valid[0] = False
    Z[~valid] = np.nan
    R[~valid] = np.nan
    return b, R, Z, vbar


def _ok_window(ok_cs: np.ndarray, i: int, j: int) -> bool:
    """Toutes les minutes [i, j] utilisables."""
    return j < len(ok_cs) - 1 and ok_cs[j + 1] - ok_cs[i] == j - i + 1


def build_events(a: Asset, delta: int, fits: dict, Qf: np.ndarray, t_start: str, t_end: str,
                 k_min: float = min(C.K_SENS), simulate_k: float = C.K_SHOCK, npaths: int = C.HAWKES_PATHS) -> pd.DataFrame:
    b, R, Z, vbar = bar_shocks(a, delta)
    quarters = sorted(fits)
    t_close = b.t + delta * MIN_MS
    lo, hi = C.ms(t_start), C.ms(t_end)
    cand = np.nonzero((np.abs(np.nan_to_num(Z)) >= k_min) & (t_close >= lo) & (t_close < hi))[0]
    H = np.array(C.HORIZONS)
    Hmin = 1 + H * delta
    Hmax = int(Hmin[-1])
    m, x = a.m, a.x
    ok_cs = np.concatenate([[0], np.cumsum(m.ok.astype(np.int64))])
    nbars = C.RANGE_BARS[delta]
    ta, ma = all_jump_events(a)
    rows = []
    for t in cand:
        if t < nbars + 1:
            continue
        d = 1 if R[t] > 0 else -1
        first = int(b.first[t])
        iT = first + delta - 1
        T = int(t_close[t])
        q = int(quarter_of(np.array([T]), quarters)[0])
        if q < 0:
            continue
        if iT + 2 * delta + 1 + Hmax >= m.size:
            continue
        absR = abs(R[t])
        row = {'asset': a.sym, 'delta': delta, 'bar': int(t), 'T': T, 'quarter': q, 'iT': iT, 'd': d, 'R': R[t], 'Z': Z[t],
               'absZ': abs(Z[t]), 'sigma_bar': math.sqrt(vbar[t])}
        # H1 : failed breakout
        hh = np.nanmax(b.h[t - nbars:t])
        ll = np.nanmin(b.l[t - nbars:t])
        if d > 0:
            row['FB'] = float(b.h[t] > hh and b.c[t] < hh)
            row['BO'] = float(b.c[t] > hh)
            level = hh
        else:
            row['FB'] = float(b.l[t] < ll and b.c[t] > ll)
            row['BO'] = float(b.c[t] < ll)
            level = ll
        row['range_ext_dist'] = d * (math.log(b.c[t]) - math.log(level))
        # H2 : flux de la barre
        qv = m.qv[first:iT + 1].sum()
        fl = m.flow[first:iT + 1].sum()
        row['imbalance'] = d * fl / qv if qv > 0 else np.nan
        row['amihud'] = absR / qv * 1e6 if qv > 0 else np.nan
        row['qv_bar'] = qv
        # sauts de la barre (Merton)
        jb = a.jump[first:iT + 1]
        rb = a.vol.r[first:iT + 1]
        same_j = jb == d
        row['J'] = float(same_j.any())
        row['js'] = float(np.clip(d * np.nansum(rb[same_j]) / absR, 0.0, 1.5)) if absR > 0 else 0.0
        row['maxL'] = float(np.nanmax(d * a.vol.L[first:iT + 1])) if np.isfinite(a.vol.L[first:iT + 1]).any() else np.nan
        # H4a : base perp − comptant
        pre = a.basis[max(first - 60, 0):first]
        bT = a.basis[iT]
        row['basis_dev'] = d * (bT - np.nanmedian(pre)) * 1e4 if (np.isfinite(bT) and np.isfinite(pre).sum() >= 30) else np.nan
        # régime, heure
        day = (T - 1 - a.t0) // 86_400_000
        row['rv_pct'] = a.rv_pct[day] if day < len(a.rv_pct) else np.nan
        ts = pd.Timestamp(T - 1, unit='ms', tz='UTC')
        row['hour'] = ts.hour
        row['weekday'] = ts.weekday()
        # Hawkes : états avant le choc, à la décision, et en D2
        fH = hawkes_of(fits[q])
        same = 0 if d > 0 else 1
        Rst = hk.states_at(ta, ma, np.array([float(first), float(iT + 1), float(iT + 2 * delta + 1)]), fH.beta)
        lam = hk.intensity(Rst, fH)
        row['lam_same_pre'], row['lam_same'], row['lam_same_D2'] = lam[0, same], lam[1, same], lam[2, same]
        row['lam_opp'] = lam[1, 1 - same]
        row['mu_same'] = fH.mu[same]
        row['mu_pois_same'] = fits[q]['hawkes_tests']['poisson_mu'][same]
        # OU : composante transitoire filtrée
        fS = ss_of(fits[q])
        phi = fS.phi
        QT, Qpre = Qf[iT], Qf[first - 1]
        row['phi'] = phi
        row['Q_T'] = d * QT
        row['psi_T'] = d * (QT - Qpre) / absR if absR > 0 else np.nan
        # contrôle : OU naïf sur prix brut
        bn, mn = ou.naive_ar1(x, iT)
        row['naive_b'] = bn
        row['naive_dev'] = d * (x[iT] - mn) if np.isfinite(mn) else np.nan
        # D2 (H3b) : pas de nouveau choc ni saut dans le sens d
        z1, z2 = Z[t + 1], Z[t + 2]
        cont = any(np.isfinite(z) and abs(z) >= simulate_k and np.sign(z) == d for z in (z1, z2))
        cont = cont or bool(np.any(a.jump[iT + 1:iT + 2 * delta + 1] == d))
        row['D2_eligible'] = float(not cont)
        # H1b : cassure en T puis retour dans le range en t+1 ou t+2
        row['H1b_j'] = 0
        if row['BO'] == 1.0:
            for j in (1, 2):
                cj = b.c[t + j]
                if np.isfinite(cj) and ((d > 0 and cj < hh) or (d < 0 and cj > ll)):
                    row['H1b_j'] = j
                    break
        # résultats (horizons) : entrée T+1 min, sortie T+1+hΔ
        x_T = x[iT]
        for name, i_dec in (('', iT), ('D2_', iT + 2 * delta), ('H1b_', iT + row['H1b_j'] * delta if row['H1b_j'] else -1)):
            if i_dec < 0:
                continue
            iE = i_dec + C.LATENCY_MIN
            pE = m.c[iE]
            for h, hm in zip(H, Hmin):
                iX = iE + h * delta
                if np.isfinite(pE) and _ok_window(ok_cs, i_dec + 1, iX):
                    row[f'{name}g{h}'] = -d * (math.log(m.c[iX]) - math.log(pE))
                    if name == '':
                        row[f'g0lat{h}'] = -d * (math.log(m.c[iX]) - math.log(m.o[i_dec + 1]))
                        hi_ = np.max(m.h[iE + 1:iX + 1])
                        lo_ = np.min(m.l[iE + 1:iX + 1])
                        if d > 0:
                            row[f'mfe{h}'], row[f'mae{h}'] = math.log(pE) - math.log(lo_), math.log(hi_) - math.log(pE)
                        else:
                            row[f'mfe{h}'], row[f'mae{h}'] = math.log(hi_) - math.log(pE), math.log(pE) - math.log(lo_)
                else:
                    row[f'{name}g{h}'] = np.nan
                if name == '':
                    win = a.jump[iT + 1:iT + hm + 1]
                    row[f'nj_same{h}'] = int(np.sum(win == d))
                    row[f'nj_opp{h}'] = int(np.sum(win == -d))
        # retracement (clôtures 1 min), censuré à 32 barres
        path = x[iT + 1:iT + 1 + Hmax]
        f = d * (x_T - path) / absR
        for qq in (25, 50, 75, 100):
            hit = np.nonzero(f >= qq / 100)[0]
            row[f'ret{qq}_min'] = float(hit[0] + 1) if len(hit) else np.nan
        for qq in (25, 50, 75, 100):
            hit = np.nonzero(f <= -qq / 100)[0]
            row[f'ext{qq}_min'] = float(hit[0] + 1) if len(hit) else np.nan
        row['ret_max'] = float(np.nanmax(f)) if np.isfinite(f).any() else np.nan
        for h, hm in zip(H, Hmin):
            row[f'retfrac{h}'] = float(f[hm - 1]) if np.isfinite(f[hm - 1]) else np.nan
        # Hawkes : prévisions par simulation (chocs |Z| ≥ k principal)
        if abs(Z[t]) >= simulate_k:
            seed = zlib.crc32(f'{a.sym}-{delta}-{iT}'.encode()) & 0x7FFFFFFF
            fc = hk.forecast(Rst[1], fH, Hmin.astype(float), same, npaths, seed)
            fc2 = hk.forecast(Rst[2], fH, Hmin.astype(float), same, npaths, seed + 1)
            for k_, h in enumerate(H):
                row[f'p_same{h}'], row[f'p_opp{h}'], row[f'p_casc{h}'], row[f'EN_same{h}'] = fc[k_]
                row[f'D2_p_same{h}'] = fc2[k_, 0]
                row[f'rho{h}'] = d * (phi - phi ** (1 + h * delta)) * QT if np.isfinite(QT) else np.nan
                row[f'naive_rho{h}'] = (1 - bn ** (1 + h * delta)) * row['naive_dev'] if np.isfinite(bn) else np.nan
        rows.append(row)
    return pd.DataFrame(rows)
