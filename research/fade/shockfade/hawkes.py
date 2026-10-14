"""Hawkes exponentiel bivarié à marques ± (protocole § 3.3).

    λ_k(t) = μ_k + Σ_{τ_j < t} α[k, m_j] · exp(−β[k, m_j] (t − τ_j)),   k, m ∈ {0 = hausse, 1 = baisse}

Le temps est en minutes. Vraisemblance exacte par récursion (Ozaki 1979), gradient analytique,
L-BFGS-B sur paramètres logarithmiques bornés, stabilité par le rayon spectral de G = α/β.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numba as nb
import numpy as np
from scipy.optimize import minimize
from scipy.stats import chi2, kstest

BETA_MIN = 1.0 / 10080.0
BETA_MAX = 2.0
RHO_MAX = 0.99


@nb.njit(cache=True)
def _loglik(times, marks, T0, T1, mu, alpha, beta, use_alpha):
    n = len(times)
    R = np.zeros((2, 2))
    A = np.zeros((2, 2))
    ll = 0.0
    gmu = np.zeros(2)
    ga = np.zeros((2, 2))
    gb = np.zeros((2, 2))
    tprev = T0
    for i in range(n):
        t = times[i]
        m = marks[i]
        dt = t - tprev
        for k in range(2):
            for j in range(2):
                e = math.exp(-beta[k, j] * dt)
                A[k, j] = e * (A[k, j] + dt * R[k, j])
                R[k, j] = e * R[k, j]
        lam = mu[m]
        for j in range(2):
            if use_alpha[m, j]:
                lam += alpha[m, j] * R[m, j]
        ll += math.log(lam)
        gmu[m] += 1.0 / lam
        for j in range(2):
            if use_alpha[m, j]:
                ga[m, j] += R[m, j] / lam
                gb[m, j] += -alpha[m, j] * A[m, j] / lam
        for k in range(2):
            R[k, m] += 1.0
        tprev = t
    span = T1 - T0
    ll -= (mu[0] + mu[1]) * span
    gmu[0] -= span
    gmu[1] -= span
    for i in range(n):
        tau = T1 - times[i]
        m = marks[i]
        for k in range(2):
            if not use_alpha[k, m]:
                continue
            b = beta[k, m]
            e = math.exp(-b * tau)
            ll -= alpha[k, m] * (1.0 - e) / b
            ga[k, m] -= (1.0 - e) / b
            gb[k, m] -= alpha[k, m] * (tau * e / b - (1.0 - e) / (b * b))
    return ll, gmu, ga, gb


def spectral_radius(alpha: np.ndarray, beta: np.ndarray) -> float:
    G = alpha / beta
    a, b, c, d = G[0, 0], G[0, 1], G[1, 0], G[1, 1]
    return float((a + d) / 2 + math.sqrt(((a - d) / 2) ** 2 + b * c))


def _rho_grad(alpha, beta):
    G = alpha / beta
    a, b, c, d = G[0, 0], G[0, 1], G[1, 0], G[1, 1]
    s = math.sqrt(((a - d) / 2) ** 2 + b * c) + 1e-300
    rho = (a + d) / 2 + s
    dG = np.array([[0.5 + (a - d) / (4 * s), c / (2 * s)], [b / (2 * s), 0.5 - (a - d) / (4 * s)]])
    return rho, dG


@dataclass
class HawkesFit:
    mu: np.ndarray
    alpha: np.ndarray
    beta: np.ndarray
    loglik: float
    n_events: int
    span: float
    rho: float
    converged: bool
    use_alpha: np.ndarray = field(default_factory=lambda: np.ones((2, 2), dtype=np.bool_))

    @property
    def branching(self) -> np.ndarray:
        return self.alpha / self.beta

    @property
    def n_params(self) -> int:
        return 2 + 2 * int(self.use_alpha.sum())

    def as_dict(self) -> dict:
        return {'mu': self.mu.tolist(), 'alpha': self.alpha.tolist(), 'beta': self.beta.tolist(),
                'branching': self.branching.tolist(), 'half_life_min': (math.log(2) / self.beta).tolist(),
                'loglik': self.loglik, 'n_events': self.n_events, 'span_min': self.span, 'rho': self.rho,
                'converged': self.converged, 'use_alpha': self.use_alpha.tolist()}


def _unpack(theta, use_alpha):
    mu = np.exp(theta[:2])
    alpha = np.zeros((2, 2))
    beta = np.ones((2, 2))
    p = 2
    for k in range(2):
        for j in range(2):
            if use_alpha[k, j]:
                alpha[k, j] = math.exp(theta[p])
                beta[k, j] = math.exp(theta[p + 1])
                p += 2
    return mu, alpha, beta


def fit(times: np.ndarray, marks: np.ndarray, T0: float, T1: float, use_alpha: np.ndarray | None = None,
        starts: list[tuple[float, float]] | None = None) -> HawkesFit:
    """MLE. `use_alpha[k, m]` = False fixe α[k, m] = 0 (modèle restreint). Départs (n = α/β, β) fixés."""
    times = np.ascontiguousarray(times, dtype=np.float64)
    marks = np.ascontiguousarray(marks, dtype=np.int64)
    use_alpha = np.ones((2, 2), dtype=np.bool_) if use_alpha is None else np.asarray(use_alpha, dtype=np.bool_)
    span = T1 - T0
    cnt = np.array([np.sum(marks == 0), np.sum(marks == 1)], dtype=float)
    starts = starts or [(0.3, 0.1), (0.15, 0.02), (0.5, 0.5)]
    best = None
    na = int(use_alpha.sum())
    bounds = [(-30.0, 5.0)] * 2 + [(-30.0, 3.0), (math.log(BETA_MIN), math.log(BETA_MAX))] * na

    def obj(theta, penal):
        mu, alpha, beta = _unpack(theta, use_alpha)
        ll, gmu, ga, gb = _loglik(times, marks, T0, T1, mu, alpha, beta, use_alpha)
        g = np.empty_like(theta)
        g[:2] = gmu * mu
        p = 2
        for k in range(2):
            for j in range(2):
                if use_alpha[k, j]:
                    g[p] = ga[k, j] * alpha[k, j]
                    g[p + 1] = gb[k, j] * beta[k, j]
                    p += 2
        f, grad = -ll, -g
        if penal and na > 0:
            rho, dG = _rho_grad(alpha, beta)
            ex = rho - (RHO_MAX - 0.01)
            if ex > 0:
                w = 1e4 * cnt.sum()
                f += w * ex * ex
                G = alpha / beta
                p = 2
                for k in range(2):
                    for j in range(2):
                        if use_alpha[k, j]:
                            d = 2 * w * ex * dG[k, j] * G[k, j]
                            grad[p] += d
                            grad[p + 1] -= d
                            p += 2
        return f, grad

    for penal in (False, True):
        for (n0, b0) in starts:
            theta0 = [math.log(max(c, 1.0) / span * (1 - n0)) for c in cnt]
            for k in range(2):
                for j in range(2):
                    if use_alpha[k, j]:
                        nkj = n0 * (0.8 if k == j else 0.2)
                        theta0 += [math.log(nkj * b0), math.log(b0)]
            res = minimize(obj, np.array(theta0), args=(penal,), jac=True, method='L-BFGS-B', bounds=bounds,
                           options={'maxiter': 2000, 'ftol': 1e-12, 'gtol': 1e-7})
            mu, alpha, beta = _unpack(res.x, use_alpha)
            rho = spectral_radius(alpha, beta) if na else 0.0
            cand = HawkesFit(mu, alpha, beta, -float(res.fun) if not penal else float(_loglik(times, marks, T0, T1, mu, alpha, beta, use_alpha)[0]),
                             len(times), span, rho, bool(res.success), use_alpha.copy())
            if rho >= RHO_MAX:
                continue
            if best is None or cand.loglik > best.loglik:
                best = cand
        if best is not None:
            break
    if best is None:
        raise RuntimeError('aucune estimation stable')
    return best


def fit_poisson(marks: np.ndarray, T0: float, T1: float) -> HawkesFit:
    span = T1 - T0
    cnt = np.array([np.sum(marks == 0), np.sum(marks == 1)], dtype=float)
    mu = np.maximum(cnt, 1e-12) / span
    ll = float(np.sum(cnt * np.log(mu)) - mu.sum() * span)
    return HawkesFit(mu, np.zeros((2, 2)), np.ones((2, 2)), ll, int(cnt.sum()), span, 0.0, True,
                     np.zeros((2, 2), dtype=np.bool_))


def lr_test(full: HawkesFit, restricted: HawkesFit) -> dict:
    stat = 2 * (full.loglik - restricted.loglik)
    df = full.n_params - restricted.n_params
    return {'stat': stat, 'df': df, 'p_chi2': float(chi2.sf(max(stat, 0.0), df))}


@nb.njit(cache=True)
def states_at(times, marks, queries, beta):
    """R[q, k, m] = Σ_{τ_j ≤ q, m_j = m} exp(−β[k, m](q − τ_j)) ; queries triées."""
    nq = len(queries)
    out = np.zeros((nq, 2, 2))
    R = np.zeros((2, 2))
    t = -1e300
    i = 0
    n = len(times)
    for q in range(nq):
        tq = queries[q]
        while i < n and times[i] <= tq:
            dt = times[i] - t if t > -1e299 else 0.0
            for k in range(2):
                for j in range(2):
                    R[k, j] *= math.exp(-beta[k, j] * dt)
            for k in range(2):
                R[k, marks[i]] += 1.0
            t = times[i]
            i += 1
        dt = tq - t if t > -1e299 else 0.0
        for k in range(2):
            for j in range(2):
                out[q, k, j] = R[k, j] * math.exp(-beta[k, j] * dt)
    return out


def intensity(R: np.ndarray, f: HawkesFit) -> np.ndarray:
    """λ[q, k] à partir des états R[q, k, m]."""
    return f.mu[None, :] + np.einsum('km,qkm->qk', f.alpha, R)


@nb.njit(cache=True)
def _simulate_from(R0, mu, alpha, beta, horizons, same, npaths, seed):
    """Ogata depuis l'état R0 ; renvoie par horizon : P(N_same ≥ 1), P(N_opp ≥ 1), P(N_same ≥ 2), E[N_same]."""
    np.random.seed(seed)
    nh = len(horizons)
    Hmax = horizons[nh - 1]
    out = np.zeros((nh, 4))
    opp = 1 - same
    for p in range(npaths):
        R = R0.copy()
        t = 0.0
        ns = np.zeros(nh)
        no = np.zeros(nh)
        while True:
            lam0 = mu[0] + alpha[0, 0] * R[0, 0] + alpha[0, 1] * R[0, 1]
            lam1 = mu[1] + alpha[1, 0] * R[1, 0] + alpha[1, 1] * R[1, 1]
            lbar = lam0 + lam1
            w = -math.log(np.random.random()) / lbar
            t += w
            if t > Hmax:
                break
            for k in range(2):
                for j in range(2):
                    R[k, j] *= math.exp(-beta[k, j] * w)
            l0 = mu[0] + alpha[0, 0] * R[0, 0] + alpha[0, 1] * R[0, 1]
            l1 = mu[1] + alpha[1, 0] * R[1, 0] + alpha[1, 1] * R[1, 1]
            u = np.random.random() * lbar
            if u <= l0 + l1:
                k = 0 if u <= l0 else 1
                for kk in range(2):
                    R[kk, k] += 1.0
                for h in range(nh):
                    if t <= horizons[h]:
                        if k == same:
                            ns[h] += 1
                        else:
                            no[h] += 1
        for h in range(nh):
            if ns[h] >= 1:
                out[h, 0] += 1
            if no[h] >= 1:
                out[h, 1] += 1
            if ns[h] >= 2:
                out[h, 2] += 1
            out[h, 3] += ns[h]
    for h in range(nh):
        for c in range(4):
            out[h, c] /= npaths
    return out


def forecast(R0: np.ndarray, f: HawkesFit, horizons: np.ndarray, same: int, npaths: int = 2000, seed: int = 0) -> np.ndarray:
    """Colonnes : p_same, p_opp, p_casc, E[N_same] pour chaque horizon (minutes)."""
    return _simulate_from(np.ascontiguousarray(R0, dtype=np.float64), f.mu, f.alpha, f.beta,
                          np.ascontiguousarray(horizons, dtype=np.float64), int(same), int(npaths), int(seed))


@nb.njit(cache=True)
def _simulate(T, mu, alpha, beta, seed, nmax):
    np.random.seed(seed)
    times = np.empty(nmax)
    marks = np.empty(nmax, dtype=np.int64)
    R = np.zeros((2, 2))
    t = 0.0
    n = 0
    while n < nmax:
        lbar = mu[0] + mu[1] + alpha[0, 0] * R[0, 0] + alpha[0, 1] * R[0, 1] + alpha[1, 0] * R[1, 0] + alpha[1, 1] * R[1, 1]
        w = -math.log(np.random.random()) / lbar
        t += w
        if t > T:
            break
        for k in range(2):
            for j in range(2):
                R[k, j] *= math.exp(-beta[k, j] * w)
        l0 = mu[0] + alpha[0, 0] * R[0, 0] + alpha[0, 1] * R[0, 1]
        l1 = mu[1] + alpha[1, 0] * R[1, 0] + alpha[1, 1] * R[1, 1]
        u = np.random.random() * lbar
        if u <= l0 + l1:
            k = 0 if u <= l0 else 1
            times[n] = t
            marks[n] = k
            n += 1
            for kk in range(2):
                R[kk, k] += 1.0
    return times[:n], marks[:n]


def simulate(T: float, mu, alpha, beta, seed: int = 0, nmax: int = 10_000_000):
    return _simulate(float(T), np.asarray(mu, float), np.asarray(alpha, float), np.asarray(beta, float), seed, nmax)


@nb.njit(cache=True)
def _compensator_increments(times, marks, T0, mu, alpha, beta, R0):
    """Incréments du compensateur entre événements consécutifs de chaque type (≈ Exp(1) si le modèle est juste)."""
    n = len(times)
    R = R0.copy()
    acc = np.zeros(2)
    out = np.full(n, np.nan)
    seen = np.zeros(2, dtype=np.bool_)
    tprev = T0
    for i in range(n):
        dt = times[i] - tprev
        for k in range(2):
            inc = mu[k] * dt
            for j in range(2):
                b = beta[k, j]
                inc += alpha[k, j] / b * R[k, j] * (1.0 - math.exp(-b * dt))
            acc[k] += inc
        for k in range(2):
            for j in range(2):
                R[k, j] *= math.exp(-beta[k, j] * dt)
        m = marks[i]
        if seen[m]:
            out[i] = acc[m]
        seen[m] = True
        acc[m] = 0.0
        for k in range(2):
            R[k, m] += 1.0
        tprev = times[i]
    return out


def time_rescaling(times, marks, T0: float, f: HawkesFit, R0: np.ndarray | None = None) -> dict:
    R0 = np.zeros((2, 2)) if R0 is None else R0
    inc = _compensator_increments(np.ascontiguousarray(times, float), np.ascontiguousarray(marks, np.int64), float(T0),
                                  f.mu, f.alpha, f.beta, np.ascontiguousarray(R0, float))
    out = {}
    for k, name in ((0, 'up'), (1, 'down')):
        x = inc[(marks == k) & np.isfinite(inc)]
        if len(x) < 20:
            out[name] = {'n': int(len(x)), 'ks': None, 'p': None}
            continue
        ks = kstest(x, 'expon')
        out[name] = {'n': int(len(x)), 'ks': float(ks.statistic), 'p': float(ks.pvalue), 'mean': float(x.mean())}
    return out
