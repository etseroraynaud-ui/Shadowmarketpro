"""Ornstein-Uhlenbeck sur la composante transitoire latente (protocole § 3.4).

    x_i = F_i + Q_i + e_i
    F_i = F_{i−1} + λ_F·√v_i·u_i + η^F_i
    Q_i = φ·Q_{i−1} + λ_Q·√v_i·u_i + η^Q_i          φ = e^{−κ} par minute, t½ = ln 2 / κ

Var(η^F) = σ_F²·v, Var(η^Q) = σ_Q²·v, Var(e) = σ_e²·v ; aux minutes de saut identifié (L² > 0),
Var(η^F) = σ_FJ²·v·L², Var(η^Q) = σ_QJ²·v·L². Filtre de Kalman (filtrage seulement), MLE.

Contrôle négatif : AR(1) du log-prix brut sur une fenêtre glissante (« OU appliqué aveuglément »).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numba as nb
import numpy as np
from scipy.optimize import minimize

PHI_MAX = 0.99995
NAMES = ['phi', 'lam_F', 'lam_Q', 'sig_F', 'sig_Q', 'sig_e', 'sig_FJ', 'sig_QJ']


@nb.njit(cache=True)
def kalman(x, u, v, jl2, phi, lF, lQ, sF2, sQ2, se2, sFJ2, sQJ2, burn, store, F0, Q0, P0):
    """Renvoie (loglik, nobs, Qf, Ff, état final). x NaN = pas d'observation ; v NaN = variance précédente."""
    n = len(x)
    Qf = np.full(n if store else 1, np.nan)
    Ff = np.full(n if store else 1, np.nan)
    F = F0
    Q = Q0
    P11 = P0[0]
    P12 = P0[1]
    P22 = P0[2]
    ll = 0.0
    nobs = 0
    vv = np.nan
    started = F == F
    k = 0
    for i in range(n):
        if v[i] == v[i] and v[i] > 0:
            vv = v[i]
        if not (vv == vv):
            continue
        if not started:
            if x[i] == x[i]:
                F = x[i]
                Q = 0.0
                P11 = vv
                P12 = 0.0
                P22 = sQ2 * vv / max(1.0 - phi * phi, 1e-6) + 1e-30
                started = True
            continue
        s = math.sqrt(vv)
        ui = u[i]
        if not (ui == ui):
            ui = 0.0
        if jl2[i] > 0:
            qF = sFJ2 * vv * jl2[i]
            qQ = sQJ2 * vv * jl2[i]
        else:
            qF = sF2 * vv
            qQ = sQ2 * vv
        F = F + lF * s * ui
        Q = phi * Q + lQ * s * ui
        P11 = P11 + qF
        P12 = phi * P12
        P22 = phi * phi * P22 + qQ
        if x[i] == x[i]:
            y = x[i] - F - Q
            S = P11 + 2.0 * P12 + P22 + se2 * vv
            k1 = (P11 + P12) / S
            k2 = (P12 + P22) / S
            F += k1 * y
            Q += k2 * y
            P11 -= k1 * k1 * S
            P12 -= k1 * k2 * S
            P22 -= k2 * k2 * S
            k += 1
            if k > burn:
                ll += -0.5 * (math.log(2.0 * math.pi * S) + y * y / S)
                nobs += 1
        if store:
            Qf[i] = Q
            Ff[i] = F
    st = np.array([F, Q, P11, P12, P22])
    return ll, nobs, Qf, Ff, st


def _params(theta, restricted=False):
    if restricted:
        lF, lsF, lse, lsFJ = theta
        return 0.0, lF, 0.0, math.exp(lsF), 0.0, math.exp(lse), math.exp(lsFJ), 0.0
    t0, lF, lQ, lsF, lsQ, lse, lsFJ, lsQJ = theta
    phi = PHI_MAX / (1.0 + math.exp(-t0))
    return phi, lF, lQ, math.exp(lsF), math.exp(lsQ), math.exp(lse), math.exp(lsFJ), math.exp(lsQJ)


@dataclass
class SSFit:
    params: dict
    loglik: float
    nobs: int
    se: dict | None
    converged: bool
    restricted: bool = False

    @property
    def phi(self) -> float:
        return self.params['phi']

    def half_life(self) -> float:
        p = self.phi
        return math.log(2) / -math.log(p) if 0 < p < 1 else float('nan')

    def psi_jump(self) -> float:
        a, b = self.params['sig_FJ'] ** 2, self.params['sig_QJ'] ** 2
        return b / (a + b) if a + b > 0 else float('nan')

    def psi_flow(self) -> float:
        a, b = self.params['lam_F'], self.params['lam_Q']
        return b / (a + b) if a + b != 0 else float('nan')

    def as_dict(self) -> dict:
        return {'params': self.params, 'loglik': self.loglik, 'nobs': self.nobs, 'se': self.se, 'converged': self.converged,
                'restricted': self.restricted, 'half_life_min': self.half_life(), 'psi_jump': self.psi_jump(),
                'psi_flow': self.psi_flow()}


def _nll(theta, data, restricted, burn):
    x, u, v, jl2 = data
    phi, lF, lQ, sF, sQ, se, sFJ, sQJ = _params(theta, restricted)
    ll, nobs, _, _, _ = kalman(x, u, v, jl2, phi, lF, lQ, sF * sF, sQ * sQ, se * se, sFJ * sFJ, sQJ * sQJ, burn, False,
                               np.nan, 0.0, np.zeros(3))
    if not np.isfinite(ll):
        return 1e18
    return -ll


def _theta_from(p: dict, restricted: bool):
    if restricted:
        return np.array([p['lam_F'], math.log(p['sig_F']), math.log(p['sig_e']), math.log(p['sig_FJ'])])
    q = min(max(p['phi'] / PHI_MAX, 1e-9), 1 - 1e-9)
    return np.array([math.log(q / (1 - q)), p['lam_F'], p['lam_Q'], math.log(p['sig_F']), math.log(p['sig_Q']),
                     math.log(p['sig_e']), math.log(p['sig_FJ']), math.log(p['sig_QJ'])])


DEFAULT_START = {'phi': 0.9, 'lam_F': 0.2, 'lam_Q': 0.1, 'sig_F': 0.8, 'sig_Q': 0.3, 'sig_e': 0.1, 'sig_FJ': 0.6, 'sig_QJ': 0.4}


def fit(x, u, v, jl2, start: dict | None = None, restricted: bool = False, burn: int = 60, hessian: bool = True,
        fixed_phi: float | None = None) -> SSFit:
    data = (np.ascontiguousarray(x, float), np.ascontiguousarray(u, float), np.ascontiguousarray(v, float),
            np.ascontiguousarray(jl2, float))
    p0 = dict(DEFAULT_START if start is None else start)
    th0 = _theta_from(p0, restricted)
    if fixed_phi is not None:
        q = fixed_phi / PHI_MAX
        tphi = math.log(q / (1 - q))
        f = lambda th: _nll(np.concatenate([[tphi], th]), data, False, burn)
        res = minimize(f, th0[1:], method='L-BFGS-B', options={'maxiter': 500, 'eps': 1e-6})
        theta = np.concatenate([[tphi], res.x])
    else:
        f = lambda th: _nll(th, data, restricted, burn)
        res = minimize(f, th0, method='L-BFGS-B', options={'maxiter': 1000, 'eps': 1e-6})
        theta = res.x
    vals = _params(theta, restricted)
    params = dict(zip(NAMES, [float(z) for z in vals]))
    se = None
    if hessian and fixed_phi is None:
        se = _delta_se(theta, data, restricted, burn)
    ll, nobs, _, _, _ = kalman(*data, *[vals[0], vals[1], vals[2], vals[3] ** 2, vals[4] ** 2, vals[5] ** 2, vals[6] ** 2,
                                        vals[7] ** 2], burn, False, np.nan, 0.0, np.zeros(3))
    return SSFit(params, float(ll), int(nobs), se, bool(res.success), restricted)


def _delta_se(theta, data, restricted, burn, h=1e-4):
    k = len(theta)
    H = np.zeros((k, k))
    f0 = _nll(theta, data, restricted, burn)
    for a in range(k):
        for b in range(a, k):
            ea = np.zeros(k); ea[a] = h
            eb = np.zeros(k); eb[b] = h
            fpp = _nll(theta + ea + eb, data, restricted, burn)
            fpm = _nll(theta + ea - eb, data, restricted, burn)
            fmp = _nll(theta - ea + eb, data, restricted, burn)
            fmm = _nll(theta - ea - eb, data, restricted, burn)
            H[a, b] = H[b, a] = (fpp - fpm - fmp + fmm) / (4 * h * h)
    try:
        cov = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        return {'singular': True}
    eig = np.linalg.eigvalsh(H)
    names = ['lam_F', 'sig_F', 'sig_e', 'sig_FJ'] if restricted else NAMES

    def g(th):
        vals = _params(th, restricted)
        if restricted:
            return np.array([vals[1], vals[3], vals[5], vals[6]])
        p = dict(zip(NAMES, vals))
        return np.array(list(vals) + [math.log(2) / -math.log(p['phi']) if 0 < p['phi'] < 1 else np.nan,
                                      p['sig_QJ'] ** 2 / (p['sig_FJ'] ** 2 + p['sig_QJ'] ** 2)])
    g0 = g(theta)
    J = np.zeros((len(g0), k))
    for a in range(k):
        e = np.zeros(k); e[a] = 1e-6
        J[:, a] = (g(theta + e) - g0) / 1e-6
    V = J @ cov @ J.T
    out_names = names if restricted else names + ['half_life_min', 'psi_jump']
    se = {n: float(math.sqrt(V[i, i])) if V[i, i] >= 0 else float('nan') for i, n in enumerate(out_names)}
    se['hessian_min_eig'] = float(eig.min())
    se['hessian_cond'] = float(eig.max() / eig.min()) if eig.min() > 0 else float('inf')
    return se


def filter_states(x, u, v, jl2, fit_: SSFit, state: np.ndarray | None = None):
    """Filtrage (store=True). `state` = (F, Q, P11, P12, P22) pour reprendre un filtre en cours."""
    p = fit_.params
    F0, Q0, P0 = (np.nan, 0.0, np.zeros(3)) if state is None else (state[0], state[1], state[2:5].copy())
    ll, nobs, Qf, Ff, st = kalman(np.ascontiguousarray(x, float), np.ascontiguousarray(u, float), np.ascontiguousarray(v, float),
                                  np.ascontiguousarray(jl2, float), p['phi'], p['lam_F'], p['lam_Q'], p['sig_F'] ** 2,
                                  p['sig_Q'] ** 2, p['sig_e'] ** 2, p['sig_FJ'] ** 2, p['sig_QJ'] ** 2, 0, True, F0, Q0, P0)
    return Qf, Ff, st


def flow_input(flow: np.ndarray, ok: np.ndarray, window: int = 1440) -> np.ndarray:
    """u_i = signe(X_i)·(|X_i|/X̄_i)^½, X̄_i = moyenne de |X| sur les `window` minutes précédentes (strictement)."""
    a = np.where(ok, np.abs(flow), np.nan)
    c = np.where(np.isfinite(a), a, 0.0)
    cnt = np.isfinite(a).astype(float)
    cs = np.concatenate([[0.0], np.cumsum(c)])
    cc = np.concatenate([[0.0], np.cumsum(cnt)])
    n = len(flow)
    idx = np.arange(n)
    lo = np.maximum(idx - window, 0)
    s = cs[idx] - cs[lo]
    k = cc[idx] - cc[lo]
    with np.errstate(invalid='ignore', divide='ignore'):
        mean = s / k
        u = np.sign(flow) * np.sqrt(np.abs(flow) / mean)
    u[(k < 0.8 * window) | ~ok | ~np.isfinite(u)] = np.nan
    return u


def naive_ar1(x: np.ndarray, T: int, window: int = 1440):
    """AR(1) du log-prix brut sur les paires (x_{j−1}, x_j), j ∈ [T−window+1, T] : (b, moyenne de long terme)."""
    y = x[T - window + 1: T + 1]
    z = x[T - window: T]
    ok = np.isfinite(y) & np.isfinite(z)
    if ok.sum() < 0.8 * window:
        return np.nan, np.nan
    y, z = y[ok], z[ok]
    zm, ym = z.mean(), y.mean()
    sxx = np.sum((z - zm) ** 2)
    if sxx <= 0:
        return np.nan, np.nan
    b = np.sum((z - zm) * (y - ym)) / sxx
    a = ym - b * zm
    m = a / (1 - b) if b < 1 else np.nan
    return b, m


def simulate(n: int, params: dict, seed: int = 0, v: np.ndarray | None = None, jump_prob: float = 0.0,
             jump_scale: float = 6.0):
    """Simulation du modèle (v = 1 par défaut, flux u ~ N(0,1) iid, sauts : L² = jump_scale²)."""
    rng = np.random.default_rng(seed)
    v = np.ones(n) if v is None else v
    u = rng.standard_normal(n)
    jl2 = np.where(rng.random(n) < jump_prob, jump_scale ** 2, 0.0)
    sv = np.sqrt(v)
    F = np.zeros(n)
    Q = np.zeros(n)
    phi = params['phi']
    for i in range(1, n):
        qF = params['sig_FJ'] ** 2 * jl2[i] if jl2[i] > 0 else params['sig_F'] ** 2
        qQ = params['sig_QJ'] ** 2 * jl2[i] if jl2[i] > 0 else params['sig_Q'] ** 2
        F[i] = F[i - 1] + params['lam_F'] * sv[i] * u[i] + math.sqrt(qF * v[i]) * rng.standard_normal()
        Q[i] = phi * Q[i - 1] + params['lam_Q'] * sv[i] * u[i] + math.sqrt(qQ * v[i]) * rng.standard_normal()
    x = F + Q + params['sig_e'] * sv * rng.standard_normal(n)
    return x, u, v, jl2, F, Q
