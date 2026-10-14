"""Merton : détection des sauts (protocole § 3.2).

- Lee & Mykland (2008) : L_i = r̃_i/σ̂_i, seuil de Gumbel θ(n, α) qui contrôle la probabilité de détecter
  à tort au moins un saut parmi n statistiques sans saut ;
- Barndorff-Nielsen & Shephard (2006) : test journalier du rapport (RV − BV)/RV avec quarticité tripuissance ;
- tailles des sauts identifiés (amplitude, sens, fréquence).
"""
from __future__ import annotations

import math

import numpy as np
from scipy.special import gamma as G
from scipy.stats import norm

C_LM = math.sqrt(2.0 / math.pi)


def lm_threshold(n: int = 1440, alpha: float = 0.01) -> float:
    ln = math.log(n)
    cn = math.sqrt(2 * ln) / C_LM - (math.log(math.pi) + math.log(ln)) / (2 * C_LM * math.sqrt(2 * ln))
    sn = 1.0 / (C_LM * math.sqrt(2 * ln))
    beta = -math.log(-math.log(1 - alpha))
    return cn + sn * beta


THETA = lm_threshold()


def detect(L: np.ndarray, theta: float = THETA) -> np.ndarray:
    """+1 / −1 pour un saut identifié à la hausse / à la baisse, 0 sinon (NaN → 0)."""
    out = np.zeros(len(L), dtype=np.int8)
    f = np.isfinite(L)
    out[f & (L > theta)] = 1
    out[f & (L < -theta)] = -1
    return out


MU1 = math.sqrt(2.0 / math.pi)
MU43 = 2 ** (2 / 3) * G(7 / 6) / G(0.5)


def bns_daily(r5: np.ndarray, per_day: int = 288):
    """Test BNS par jour sur des rendements 5 min (lignes = jours). Renvoie RV, BV, z, part de sauts."""
    nd = len(r5) // per_day
    x = r5[: nd * per_day].reshape(nd, per_day)
    out = {k: np.full(nd, np.nan) for k in ['rv', 'bv', 'z', 'jshare']}
    for d in range(nd):
        y = x[d]
        if np.isnan(y).mean() > 0.05:
            continue
        y = np.nan_to_num(y)
        n = len(y)
        a = np.abs(y)
        rv = np.sum(y * y)
        bv = MU1 ** -2 * (n / (n - 1)) * np.sum(a[1:] * a[:-1])
        tq = n * MU43 ** -3 * (n / (n - 2)) * np.sum((a[2:] * a[1:-1] * a[:-2]) ** (4 / 3))
        if rv <= 0 or bv <= 0:
            continue
        z = ((rv - bv) / rv) / math.sqrt(((math.pi / 2) ** 2 + math.pi - 5) / n * max(1.0, tq / bv ** 2))
        out['rv'][d], out['bv'][d], out['z'][d] = rv, bv, z
        out['jshare'][d] = max(rv - bv, 0.0) / rv
    return out


def bns_reject(z: np.ndarray, alpha: float = 0.001) -> np.ndarray:
    return z > norm.ppf(1 - alpha)
