"""Estimations structurelles trimestrielles (Hawkes, état-espace) sur la période de conception.

    cd research/fade && python3 -m shockfade.run_structural BTCUSDT
Aucun rendement postérieur à un choc n'est calculé ici.
"""
import sys
import time

from . import config as C
from .pipeline import load_asset, structural_fits
from .trial_log import log


def main():
    sym = sys.argv[1]
    t = time.time()
    a = load_asset(sym)
    q = C.quarter_starts(C.E_START, C.E_END)
    structural_fits(a, q)
    log('shockfade/run_structural.py', f'{sym}, Hawkes + état-espace, {len(q)} trimestres', '2020-01 → 2024-12 (fenêtres de 180 j)')
    print(sym, 'ok', round(time.time() - t), 's')


if __name__ == '__main__':
    main()
