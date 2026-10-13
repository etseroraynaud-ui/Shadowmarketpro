"""Chargement des bougies 1 min (perpétuel et comptant) et agrégation causale en barres de décision.

Conventions :
- `t` = ouverture de la minute (ms UTC) ; une barre de Δ minutes est alignée sur l'époque Unix et
  n'est connue qu'à sa clôture (ouverture + Δ).
- Flux signé (quote, USDT) : x = acheteurs agresseurs − vendeurs agresseurs = 2·tbqv − qv.
- Une barre agrégée est « complète » si ses Δ minutes existent et ont du volume.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .paths import DERIVED, FUNDING

MIN_MS = 60_000


def load_1m(market: str, sym: str) -> pd.DataFrame:
    df = pd.read_parquet(DERIVED / f'{market}-{sym}-1m.parquet')
    return df


@dataclass
class Minute:
    """Grille complète de minutes [t0, t1] ; les minutes absentes valent NaN (prix) et 0 (volumes)."""
    t: np.ndarray       # ms, ouverture
    o: np.ndarray
    h: np.ndarray
    l: np.ndarray
    c: np.ndarray
    v: np.ndarray       # volume (actif)
    qv: np.ndarray      # volume (quote)
    n: np.ndarray       # nombre de transactions
    flow: np.ndarray    # flux signé (quote)
    ok: np.ndarray      # minute présente avec volume > 0

    @property
    def size(self) -> int:
        return len(self.t)


def to_grid(df: pd.DataFrame, t0: int | None = None, t1: int | None = None) -> Minute:
    t0 = int(df['t'].iloc[0]) if t0 is None else t0
    t1 = int(df['t'].iloc[-1]) if t1 is None else t1
    n = (t1 - t0) // MIN_MS + 1
    idx = ((df['t'].to_numpy() - t0) // MIN_MS).astype(np.int64)
    sel = (idx >= 0) & (idx < n)
    idx = idx[sel]
    d = df[sel]

    def put(col, fill):
        out = np.full(n, fill, dtype=np.float64)
        out[idx] = d[col].to_numpy(dtype=np.float64)
        return out

    o, h, l, c = put('o', np.nan), put('h', np.nan), put('l', np.nan), put('c', np.nan)
    v, qv, cnt = put('v', 0.0), put('qv', 0.0), put('n', 0.0)
    tbqv = put('tbqv', 0.0)
    ok = np.zeros(n, dtype=bool)
    ok[idx] = d['v'].to_numpy() > 0
    return Minute(t=t0 + np.arange(n, dtype=np.int64) * MIN_MS, o=o, h=h, l=l, c=c, v=v, qv=qv, n=cnt,
                  flow=2.0 * tbqv - qv, ok=ok)


@dataclass
class Bars:
    """Barres de Δ minutes construites depuis la grille 1 min (index de minutes inclusifs)."""
    delta: int
    t: np.ndarray        # ouverture (ms)
    first: np.ndarray    # index de la première minute
    o: np.ndarray
    h: np.ndarray
    l: np.ndarray
    c: np.ndarray
    qv: np.ndarray
    flow: np.ndarray
    complete: np.ndarray


def aggregate(m: Minute, delta: int) -> Bars:
    """Barres alignées sur l'époque ; la grille doit commencer sur un multiple de Δ minutes."""
    assert (m.t[0] // MIN_MS) % delta == 0, 'la grille doit commencer sur une frontière de barre'
    nb = m.size // delta
    sl = slice(0, nb * delta)
    sh = (nb, delta)
    o = m.o[sl].reshape(sh)
    h = m.h[sl].reshape(sh)
    l = m.l[sl].reshape(sh)
    c = m.c[sl].reshape(sh)
    ok = m.ok[sl].reshape(sh)
    complete = ok.all(axis=1)
    with np.errstate(invalid='ignore'):
        bo = o[:, 0]
        bh = np.nanmax(np.where(np.isnan(h), -np.inf, h), axis=1)
        bl = np.nanmin(np.where(np.isnan(l), np.inf, l), axis=1)
    bc = c[:, -1]
    bh[~np.isfinite(bh)] = np.nan
    bl[~np.isfinite(bl)] = np.nan
    return Bars(delta=delta, t=m.t[sl][::delta], first=np.arange(nb, dtype=np.int64) * delta, o=bo, h=bh, l=bl, c=bc,
                qv=m.qv[sl].reshape(sh).sum(axis=1), flow=m.flow[sl].reshape(sh).sum(axis=1), complete=complete)


def load_funding(sym: str) -> pd.DataFrame:
    """Taux de financement Binance (time_ms, rate), un versement toutes les 8 h ; positif : les longs paient."""
    return pd.read_csv(FUNDING / f'binance-{sym}.csv')
