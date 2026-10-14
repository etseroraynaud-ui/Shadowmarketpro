"""Diagnostic de qualité et de disponibilité des données (aucun rendement futur, aucun signal).

    cd research/fade && python3 -m shockfade.quality

Sortie : research/reports/shock-fade/01-data-quality.{md,json}.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from .data import MIN_MS, load_1m, load_funding, to_grid
from .paths import REPORTS

SYMS = ['BTCUSDT', 'ETHUSDT']


def iso(ms: int) -> str:
    return pd.to_datetime(ms, unit='ms').strftime('%Y-%m-%d %H:%M')


def gaps(ok: np.ndarray, t: np.ndarray, min_len: int = 5):
    """Plages de minutes consécutives absentes ou sans volume, de longueur ≥ min_len."""
    bad = ~ok
    out = []
    i, n = 0, len(bad)
    while i < n:
        if bad[i]:
            j = i
            while j < n and bad[j]:
                j += 1
            if j - i >= min_len:
                out.append((int(t[i]), j - i))
            i = j
        else:
            i += 1
    return out


def series_stats(market: str, sym: str) -> dict:
    df = load_1m(market, sym)
    t0, t1 = int(df['t'].iloc[0]), int(df['t'].iloc[-1])
    m = to_grid(df, t0, t1)
    present = np.zeros(m.size, dtype=bool)
    present[((df['t'].to_numpy() - t0) // MIN_MS)] = True
    zero_vol = present & ~m.ok
    r = np.diff(np.log(m.c))
    big = np.abs(r) > 0.05
    hl_bad = np.nansum((m.h < np.maximum(m.o, m.c) - 1e-9) | (m.l > np.minimum(m.o, m.c) + 1e-9))
    g = gaps(m.ok, m.t)
    month = pd.to_datetime(m.t, unit='ms').to_period('M')
    cov = pd.Series(m.ok).groupby(month).mean()
    tb_share = np.where(m.qv > 0, (m.flow + m.qv) / (2 * np.maximum(m.qv, 1e-12)), np.nan)
    return {
        'market': market, 'symbol': sym,
        'first': iso(t0), 'last': iso(t1), 'grid_minutes': int(m.size),
        'present': int(present.sum()), 'missing': int((~present).sum()), 'zero_volume': int(zero_vol.sum()),
        'usable_share': float(m.ok.mean()),
        'abs_1m_return_gt_5pct': int(np.nansum(big)),
        'ohlc_inconsistent': int(hl_bad),
        'gaps_ge_5min': [{'start': iso(s), 'minutes': L} for s, L in g],
        'worst_month_coverage': {str(k): float(v) for k, v in cov.nsmallest(3).items()},
        'median_trades_per_min': float(np.median(m.n[m.ok])),
        'median_quote_vol_per_min_usd': float(np.median(m.qv[m.ok])),
        'taker_buy_share_mean': float(np.nanmean(tb_share)),
        'by_year_median_quote_vol_per_min_usd': {str(y): float(np.median(m.qv[m.ok & (pd.to_datetime(m.t, unit='ms').year == y)]))
                                                 for y in range(2020, 2027)},
    }


def basis_stats(sym: str) -> dict:
    um, sp = load_1m('um', sym), load_1m('spot', sym)
    t0, t1 = int(um['t'].iloc[0]), int(um['t'].iloc[-1])
    a, b = to_grid(um, t0, t1), to_grid(sp, t0, t1)
    both = a.ok & b.ok
    basis = np.where(both, np.log(a.c) - np.log(b.c), np.nan) * 1e4
    yr = pd.to_datetime(a.t, unit='ms').year
    out = {'both_present_share': float(both.mean()), 'basis_bps_by_year': {}}
    for y in range(2020, 2027):
        x = basis[(yr == y) & both]
        out['basis_bps_by_year'][str(y)] = {'median': float(np.median(x)), 'p01': float(np.percentile(x, 1)),
                                            'p99': float(np.percentile(x, 99)), 'abs_gt_50bps_share': float(np.mean(np.abs(x) > 50))}
    ra = np.diff(np.log(a.c))
    rb = np.diff(np.log(b.c))
    ok = both[1:] & both[:-1]
    out['corr_1m_returns'] = float(np.corrcoef(ra[ok], rb[ok])[0, 1])
    return out


def funding_stats(sym: str) -> dict:
    f = load_funding(sym)
    return {'rows': int(len(f)), 'first': iso(int(f['time_ms'].iloc[0])), 'last': iso(int(f['time_ms'].iloc[-1])),
            'mean_rate_bps': float(f['rate'].mean() * 1e4), 'p99_abs_rate_bps': float(np.percentile(np.abs(f['rate']), 99) * 1e4)}


def main() -> None:
    res = {'series': [series_stats(mk, s) for mk in ['um', 'spot'] for s in SYMS],
           'basis': {s: basis_stats(s) for s in SYMS},
           'funding': {s: funding_stats(s) for s in SYMS}}
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / '01-data-quality.json').write_text(json.dumps(res, indent=1))
    L = ['# Shock Fade Engine — qualité et disponibilité des données', '',
         'Généré par `research/fade/shockfade/quality.py`. Aucun rendement futur ni signal n\'est calculé ici.', '',
         '## Séries 1 min (Binance, data.binance.vision, sommes SHA-256 vérifiées)', '',
         '| série | début | fin | minutes de la grille | absentes | sans volume | utilisables | \\|r 1 min\\| > 5 % | OHLC incohérents | trous ≥ 5 min | transactions / min (médiane) | volume / min (médiane, $) |',
         '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for s in res['series']:
        L.append(f"| {s['market']}-{s['symbol']} | {s['first']} | {s['last']} | {s['grid_minutes']:,} | {s['missing']:,} | {s['zero_volume']:,} | "
                 f"{100 * s['usable_share']:.3f} % | {s['abs_1m_return_gt_5pct']} | {s['ohlc_inconsistent']} | {len(s['gaps_ge_5min'])} | "
                 f"{s['median_trades_per_min']:.0f} | {s['median_quote_vol_per_min_usd']:,.0f} |")
    L += ['', 'Trous de 5 minutes ou plus (absence ou volume nul), les 12 plus longs :', '']
    for s in res['series']:
        top = sorted(s['gaps_ge_5min'], key=lambda g: -g['minutes'])[:12]
        L.append(f"- {s['market']}-{s['symbol']} : " + (', '.join(f"{g['start']} ({g['minutes']} min)" for g in top) or 'aucun'))
    L += ['', 'Volume médian par minute (quote, $), par année :', '', '| série | ' + ' | '.join(str(y) for y in range(2020, 2027)) + ' |',
          '|---|' + '---:|' * 7]
    for s in res['series']:
        L.append(f"| {s['market']}-{s['symbol']} | " + ' | '.join(f"{s['by_year_median_quote_vol_per_min_usd'][str(y)]:,.0f}" for y in range(2020, 2027)) + ' |')
    L += ['', '## Base perpétuel − comptant (clôtures 1 min, pb)', '']
    for sym, b in res['basis'].items():
        L.append(f"**{sym}** — minutes présentes sur les deux marchés : {100 * b['both_present_share']:.3f} % ; corrélation des rendements 1 min : {b['corr_1m_returns']:.3f}")
        L += ['', '| année | médiane | 1er centile | 99e centile | part \\|base\\| > 50 pb |', '|---|---:|---:|---:|---:|']
        for y, v in b['basis_bps_by_year'].items():
            L.append(f"| {y} | {v['median']:.1f} | {v['p01']:.1f} | {v['p99']:.1f} | {100 * v['abs_gt_50bps_share']:.2f} % |")
        L.append('')
    L += ['## Financement (Binance USDⓈ-M, déjà dans le dépôt)', '', '| symbole | versements | début | fin | taux moyen (pb / 8 h) | 99e centile \\|taux\\| (pb) |', '|---|---:|---|---|---:|---:|']
    for sym, f in res['funding'].items():
        L.append(f"| {sym} | {f['rows']} | {f['first']} | {f['last']} | {f['mean_rate_bps']:.2f} | {f['p99_abs_rate_bps']:.2f} |")
    (REPORTS / '01-data-quality.md').write_text('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
