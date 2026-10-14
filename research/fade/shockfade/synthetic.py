"""Données simulées à paramètres connus et contrôles du pipeline (protocole § 9).

- contrôle négatif : prix = marche aléatoire à volatilité stochastique + sauts Hawkes **symétriques**
  (un saut excite autant les hausses que les baisses : la direction suivante est imprévisible),
  aucune composante transitoire ⇒ E[Fade] = 0 avant coûts ;
- contrôle positif : même processus, 40 % de chaque saut transitoire (demi-vie 10 min).
"""
from __future__ import annotations

import math

import numba as nb
import numpy as np

from . import hawkes as hk
from . import jumps as jp
from . import ou
from . import vol as vl
from .data import MIN_MS, Minute
from .pipeline import Asset, _rv_percentile


@nb.njit(cache=True)
def _path(n, sig, jt, js, psi, phi, sub, seed):
    np.random.seed(seed)
    o = np.empty(n)
    h = np.empty(n)
    l = np.empty(n)
    c = np.empty(n)
    eps = np.empty(n)
    F = 0.0
    Q = 0.0
    x_prev = 0.0
    k = 0
    nj = len(jt)
    for i in range(n):
        lo = x_prev
        hi = x_prev
        x = x_prev
        jump_here = 0.0
        while k < nj and jt[k] < i + 1:
            jump_here += js[k]
            k += 1
        kstar = np.random.randint(0, sub) if jump_here != 0.0 else -1
        e_tot = 0.0
        Qd = Q * (phi - 1.0) / sub
        for s in range(sub):
            e = np.random.standard_normal() / math.sqrt(sub)
            e_tot += e
            dx = sig[i] * e + Qd
            if s == kstar:
                dx += jump_here
            x += dx
            if x > hi:
                hi = x
            if x < lo:
                lo = x
        F += sig[i] * e_tot + (1.0 - psi) * jump_here
        Q = phi * Q + psi * jump_here
        x = F + Q
        if x > hi:
            hi = x
        if x < lo:
            lo = x
        o[i] = x_prev
        h[i] = hi
        l[i] = lo
        c[i] = x
        eps[i] = e_tot
        x_prev = x
    return o, h, l, c, eps


def simulate_asset(sym: str, days: int = 1096, transient: float = 0.0, half_life: float = 10.0, seed: int = 0,
                   t0: int = 1577836800000) -> tuple[Asset, dict]:
    rng = np.random.default_rng(seed)
    n = days * 1440
    tod = (np.arange(n) % 1440) / 1440.0
    season = 0.75 + 0.5 * np.exp(-((tod - 0.6) ** 2) / 0.02)          # pic vers 14 h UTC
    hd = np.zeros(days)
    for d in range(1, days):
        hd[d] = 0.97 * hd[d - 1] + 0.1 * rng.standard_normal()
    sig = 4e-4 * season * np.exp(np.repeat(hd, 1440))
    mu = np.array([0.0012, 0.0012])
    alpha = np.full((2, 2), 0.02)
    beta = np.full((2, 2), 0.1)
    jt, jm = hk.simulate(float(n), mu, alpha, beta, seed=seed + 1)
    ji = np.minimum(jt.astype(np.int64), n - 1)
    size = sig[ji] * (6.0 + rng.exponential(4.0, len(jt)))
    js = np.where(jm == 0, size, -size)
    phi = 2.0 ** (-1.0 / half_life)
    o, h, l, c, eps = _path(n, sig, jt, js, transient, phi, 10, seed + 2)
    base = 60000.0
    P = lambda z: base * np.exp(z)
    # flux : corrélé à l'innovation diffusive et au saut de la minute
    jflow = np.zeros(n)
    np.add.at(jflow, ji, np.sign(js) * 3.0)
    vol_usd = 2e6 * season * np.exp(0.5 * np.repeat(hd, 1440))
    X = vol_usd * (0.3 * eps + 0.4 * rng.standard_normal(n) + jflow) * 0.5
    qv = vol_usd * (1.0 + 0.3 * np.abs(rng.standard_normal(n))) + np.abs(X)
    cc = P(c)
    m = Minute(t=t0 + np.arange(n, dtype=np.int64) * MIN_MS, o=P(o), h=P(h), l=P(l), c=cc, v=qv / cc, qv=qv,
               n=np.full(n, 1000.0), flow=X, ok=np.ones(n, dtype=bool))
    v = vl.compute(m.c, m.ok)
    jump = jp.detect(v.L)
    u = ou.flow_input(m.flow, m.ok)
    x = np.log(m.c)
    nu = np.zeros(n)
    z = rng.standard_normal(n) * 2e-4
    for i in range(1, n):
        nu[i] = 0.9 * nu[i - 1] + 0.1 * (-3e-4) + z[i] * math.sqrt(1 - 0.81)
    basis = nu
    a = Asset(sym, t0, m, v, jump, u, x, basis, _rv_percentile(m))
    truth = {'mu': mu.tolist(), 'alpha': alpha.tolist(), 'beta': beta.tolist(), 'transient': transient, 'half_life': half_life,
             'n_true_jumps': int(len(jt))}
    return a, truth
