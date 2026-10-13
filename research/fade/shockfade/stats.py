"""Inférence : erreurs groupées par jour, Newey–West, bootstrap par blocs de semaines, Holm/BH,
Clark–West, Sharpe dégonflé."""
from __future__ import annotations

import math

import numpy as np
from scipy.stats import norm

DAY_MS = 86_400_000
WEEK_MS = 7 * DAY_MS


def cluster_mean(x: np.ndarray, groups: np.ndarray) -> dict:
    """Moyenne et erreur type groupée (CR1). t et p unilatéral (H1 : moyenne > 0)."""
    ok = np.isfinite(x)
    x, g = x[ok], groups[ok]
    n = len(x)
    if n < 2:
        return {'n': n, 'mean': float('nan'), 'se': float('nan'), 't': float('nan'), 'p': float('nan')}
    m = x.mean()
    _, inv = np.unique(g, return_inverse=True)
    G = inv.max() + 1
    s = np.bincount(inv, weights=x - m, minlength=G)
    se = math.sqrt(np.sum(s * s) * G / max(G - 1, 1)) / n
    t = m / se if se > 0 else float('nan')
    return {'n': int(n), 'clusters': int(G), 'mean': float(m), 'se': float(se), 't': float(t), 'p': float(norm.sf(t))}


def cluster_ols(y: np.ndarray, X: np.ndarray, groups: np.ndarray):
    """OLS avec covariance groupée (CR1). Renvoie (beta, se, t)."""
    ok = np.isfinite(y) & np.all(np.isfinite(X), axis=1)
    y, X, g = y[ok], X[ok], groups[ok]
    n, k = X.shape
    XtX = X.T @ X
    beta = np.linalg.solve(XtX, X.T @ y)
    e = y - X @ beta
    _, inv = np.unique(g, return_inverse=True)
    G = inv.max() + 1
    S = np.zeros((G, k))
    np.add.at(S, inv, X * e[:, None])
    meat = S.T @ S
    bread = np.linalg.inv(XtX)
    c = G / (G - 1) * (n - 1) / (n - k)
    V = c * bread @ meat @ bread
    se = np.sqrt(np.diag(V))
    return beta, se, beta / se, int(n), int(G)


def diff_test(x: np.ndarray, flag: np.ndarray, groups: np.ndarray) -> dict:
    """Différence de moyennes (flag = 1 moins flag = 0), erreur groupée ; p unilatéral (> 0)."""
    ok = np.isfinite(x) & np.isfinite(flag)
    X = np.column_stack([np.ones(ok.sum()), flag[ok].astype(float)])
    b, se, t, n, G = cluster_ols(x[ok], X, groups[ok])
    return {'n': n, 'n1': int(flag[ok].sum()), 'clusters': G, 'mean0': float(b[0]), 'mean1': float(b[0] + b[1]),
            'diff': float(b[1]), 'se': float(se[1]), 't': float(t[1]), 'p': float(norm.sf(t[1]))}


def newey_west_mean(x: np.ndarray, lag: int | None = None) -> dict:
    x = x[np.isfinite(x)]
    n = len(x)
    lag = int(math.floor(4 * (n / 100) ** (2 / 9))) if lag is None else lag
    m = x.mean()
    e = x - m
    g0 = np.dot(e, e) / n
    s = g0
    for L in range(1, lag + 1):
        w = 1 - L / (lag + 1)
        s += 2 * w * np.dot(e[L:], e[:-L]) / n
    se = math.sqrt(max(s, 0) / n)
    t = m / se if se > 0 else float('nan')
    return {'n': n, 'lag': lag, 'mean': float(m), 'se': float(se), 't': float(t), 'p': float(norm.sf(t))}


def block_bootstrap(values: list[np.ndarray], weeks: np.ndarray, stat, B: int = 5000, block: int = 4, seed: int = 0):
    """Bootstrap par blocs mobiles circulaires de `block` semaines consécutives.

    `values` : tableaux alignés sur les événements ; `weeks` : semaine de chaque événement ;
    `stat(list_of_arrays)` : statistique. Renvoie (estimation, distribution bootstrap).
    """
    uw, inv = np.unique(weeks, return_inverse=True)
    W = len(uw)
    order = np.argsort(inv, kind='stable')
    starts = np.searchsorted(inv[order], np.arange(W))
    ends = np.searchsorted(inv[order], np.arange(W), side='right')
    rng = np.random.default_rng(seed)
    nb_blocks = int(math.ceil(W / block))
    est = stat(values)
    dist = np.empty(B)
    for b in range(B):
        s = rng.integers(0, W, nb_blocks)
        wk = ((s[:, None] + np.arange(block)[None, :]) % W).ravel()[:W]
        idx = np.concatenate([order[starts[w]:ends[w]] for w in wk])
        dist[b] = stat([v[idx] for v in values])
    return est, dist


def boot_summary(est: float, dist: np.ndarray) -> dict:
    d = dist[np.isfinite(dist)]
    return {'est': float(est), 'lo95': float(np.percentile(d, 2.5)), 'hi95': float(np.percentile(d, 97.5)),
            'p_le0': float((np.sum(d <= 0) + 1) / (len(d) + 1))}


def holm(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    out = np.full_like(p, np.nan)
    ok = np.isfinite(p)
    q = p[ok]
    m = len(q)
    o = np.argsort(q)
    adj = np.empty(m)
    run = 0.0
    for r, i in enumerate(o):
        run = max(run, min(1.0, (m - r) * q[i]))
        adj[i] = run
    out[ok] = adj
    return out


def bh(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    out = np.full_like(p, np.nan)
    ok = np.isfinite(p)
    q = p[ok]
    m = len(q)
    o = np.argsort(q)[::-1]
    adj = np.empty(m)
    run = 1.0
    for r, i in enumerate(o):
        rank = m - r
        run = min(run, q[i] * m / rank)
        adj[i] = run
    out[ok] = adj
    return out


def clark_west(y: np.ndarray, f_small: np.ndarray, f_big: np.ndarray, groups: np.ndarray) -> dict:
    """Clark & West (2007) pour modèles emboîtés ; H1 : le grand modèle prévoit mieux. Erreurs groupées."""
    ok = np.isfinite(y) & np.isfinite(f_small) & np.isfinite(f_big)
    y, a, b, g = y[ok], f_small[ok], f_big[ok], groups[ok]
    f = (y - a) ** 2 - ((y - b) ** 2 - (a - b) ** 2)
    r = cluster_mean(f, g)
    mse_a, mse_b = np.mean((y - a) ** 2), np.mean((y - b) ** 2)
    r.update({'r2_oos': float(1 - mse_b / mse_a) if mse_a > 0 else float('nan')})
    return r


def sharpe_moments(x: np.ndarray):
    x = x[np.isfinite(x)]
    m, s = x.mean(), x.std()
    z = (x - m) / s if s > 0 else x * 0
    return m / s if s > 0 else 0.0, float(np.mean(z ** 3)), float(np.mean(z ** 4)), len(x)


def deflated_sharpe(x: np.ndarray, n_trials: int, trial_sr_sd: float) -> dict:
    """Bailey & López de Prado : PSR contre le maximum attendu de N Sharpe nuls (Sharpe par période)."""
    sr, sk, ku, n = sharpe_moments(x)
    em = 0.5772156649015329
    sr0 = trial_sr_sd * ((1 - em) * norm.ppf(1 - 1 / n_trials) + em * norm.ppf(1 - 1 / (n_trials * math.e))) if n_trials > 1 else 0.0
    den = math.sqrt(max(1 - sk * sr + (ku - 1) / 4 * sr * sr, 1e-12))
    z = (sr - sr0) * math.sqrt(n - 1) / den
    return {'sr': sr, 'sr0': sr0, 'dsr': float(norm.cdf(z)), 'n': n, 'n_trials': n_trials}


def day_of(ms: np.ndarray) -> np.ndarray:
    return (np.asarray(ms) // DAY_MS).astype(np.int64)


def week_of(ms: np.ndarray) -> np.ndarray:
    # semaines commençant le lundi (1970-01-01 était un jeudi)
    return ((np.asarray(ms) + 3 * DAY_MS) // WEEK_MS).astype(np.int64)
