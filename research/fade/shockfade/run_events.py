"""Table d'événements BTC/ETH sur la période de conception E (protocole § 4–5).

    cd research/fade && python3 -m shockfade.run_events BTCUSDT
La grille s'arrête au 2025-01-01 12:00 UTC : aucun événement de C n'est construit.
Sortie (hors git) : research/data/binance/fade/derived/events-{SYM}-{Δ}m.parquet.
"""
import sys
import time

import numpy as np

from . import config as C
from .paths import DERIVED
from .pipeline import build_events, filtered_transient, load_asset, structural_fits
from .trial_log import log


def main():
    sym = sys.argv[1]
    t = time.time()
    a = load_asset(sym, C.DESIGN_GRID_END)
    q = C.quarter_starts(C.E_START, C.E_END)
    fits = structural_fits(a, q)
    Qf = filtered_transient(a, fits)
    np.save(DERIVED / f'Qf-{sym}.npy', Qf.astype(np.float32))
    for delta in C.DELTAS:
        ev = build_events(a, delta, fits, Qf, C.E_START, C.E_END)
        ev.to_parquet(DERIVED / f'events-{sym}-{delta}m.parquet', index=False)
        print(sym, delta, len(ev), 'événements |Z| ≥ 3 ;', int((ev['absZ'] >= C.K_SHOCK).sum()), '|Z| ≥ 4', flush=True)
    log('shockfade/run_events.py', f'{sym}, Δ ∈ {C.DELTAS}, |Z| ≥ {min(C.K_SENS)}, rendements à h ∈ {C.HORIZONS}',
        f'E = {C.E_START} → {C.E_END}')
    print(sym, 'ok', round(time.time() - t), 's')


if __name__ == '__main__':
    main()
