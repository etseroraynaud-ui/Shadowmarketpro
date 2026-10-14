"""Volatilité prévisible à 1 min (protocole § 3.1), sans lecture du futur.

- saisonnalité intrajournalière par créneau de 30 min, estimée sur les 60 jours UTC complets précédents ;
- variation bipuissance locale strictement passée (K = 360 minutes) sur les rendements désaisonnalisés ;
- v_i = (π/2)·σ̂²_i·s_i² : variance diffusive prévue de la minute i ;
- L_i = r̃_i / σ̂_i : statistique de Lee–Mykland.
"""
from __future__ import annotations

from dataclasses import dataclass

import numba as nb
import numpy as np

MIN_PER_DAY = 1440
BUCKET = 30
NB_BUCKETS = MIN_PER_DAY // BUCKET
SEASON_DAYS = 60
SEASON_MIN_DAYS = 30
K_BV = 360
BV_MIN_VALID = 0.8


def log_returns(c: np.ndarray, ok: np.ndarray) -> np.ndarray:
    r = np.full(len(c), np.nan)
    with np.errstate(invalid='ignore', divide='ignore'):
        r[1:] = np.log(c[1:]) - np.log(c[:-1])
    valid = np.zeros(len(c), dtype=bool)
    valid[1:] = ok[1:] & ok[:-1]
    r[~valid] = np.nan
    return r


def seasonality(r: np.ndarray, days: int = SEASON_DAYS, min_days: int = SEASON_MIN_DAYS) -> np.ndarray:
    """Facteur s(i) de chaque minute ; la grille doit commencer à 00:00 UTC. NaN pendant le préchauffage.

    s_d(τ) = médiane(|r| du créneau τ, jours d−days … d−1) / médiane(|r|, mêmes jours, tous créneaux).
    """
    n = len(r)
    nd = n // MIN_PER_DAY
    a = np.abs(r[: nd * MIN_PER_DAY]).reshape(nd, NB_BUCKETS, BUCKET)
    out = np.full(n, np.nan)
    for d in range(min_days, nd + (1 if n > nd * MIN_PER_DAY else 0)):
        lo = max(0, d - days)
        block = a[lo:d]
        per = np.nanmedian(block.transpose(1, 0, 2).reshape(NB_BUCKETS, -1), axis=1)
        tot = np.nanmedian(block)
        if not np.isfinite(tot) or tot <= 0:
            continue
        f = per / tot
        f[~np.isfinite(f) | (f <= 0)] = np.nan
        s = np.repeat(f, BUCKET)
        i0 = d * MIN_PER_DAY
        i1 = min(n, i0 + MIN_PER_DAY)
        out[i0:i1] = s[: i1 - i0]
    return out


@nb.njit(cache=True)
def bipower_local(rt: np.ndarray, K: int, min_valid: float) -> np.ndarray:
    """σ̂²_i = moyenne de |r̃_j||r̃_{j−1}| pour j = i−K+2 … i−1 (paires valides ≥ min_valid·(K−2))."""
    n = len(rt)
    out = np.full(n, np.nan)
    prod = np.full(n, np.nan)
    for j in range(1, n):
        a = rt[j]
        b = rt[j - 1]
        if a == a and b == b:
            prod[j] = abs(a) * abs(b)
    m = K - 2
    s = 0.0
    c = 0
    need = min_valid * m
    for i in range(n):
        # fenêtre des produits j ∈ [i−m, i−1]
        jn = i - 1
        if jn >= 0:
            p = prod[jn]
            if p == p:
                s += p
                c += 1
        jo = i - 1 - m
        if jo >= 0:
            p = prod[jo]
            if p == p:
                s -= p
                c -= 1
        if c >= need and c > 0:
            out[i] = max(s / c, 0.0)
    return out


@dataclass
class Vol:
    r: np.ndarray        # rendement log 1 min (NaN si non valide)
    s: np.ndarray        # facteur saisonnier
    rt: np.ndarray       # rendement désaisonnalisé
    bv: np.ndarray       # σ̂² (sans π/2), connue avant la minute
    v: np.ndarray        # variance diffusive prévue (π/2·σ̂²·s²)
    L: np.ndarray        # statistique de Lee–Mykland


def compute(c: np.ndarray, ok: np.ndarray, K: int = K_BV) -> Vol:
    r = log_returns(c, ok)
    s = seasonality(r)
    rt = r / s
    bv = bipower_local(rt, K, BV_MIN_VALID)
    v = 0.5 * np.pi * bv * s * s
    with np.errstate(invalid='ignore', divide='ignore'):
        L = rt / np.sqrt(bv)
    return Vol(r=r, s=s, rt=rt, bv=bv, v=v, L=L)
