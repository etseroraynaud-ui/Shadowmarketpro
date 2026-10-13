"""Constantes du protocole (research/preregistration/shock-fade.md). Ne pas modifier sans avenant."""
import pandas as pd

GRID_START = '2020-01-01'
GRID_END = '2026-09-30 23:59'
WARMUP_END = '2020-07-01'
E_START, E_END = '2020-07-01', '2025-01-01'        # étude d'événements et hypothèses : [E_START, E_END)
V_START, V_END = '2021-07-01', '2025-01-01'        # validation walk-forward
C_START, C_END = '2025-01-01', '2026-10-01'        # holdout final
DESIGN_GRID_END = '2025-01-01 12:00'               # données lues pendant la phase de conception (sorties des derniers horizons)

DELTAS = (5, 15)            # 5 = principal, 15 = secondaire
PRIMARY_DELTA = 5
HORIZONS = (1, 2, 4, 8, 16, 32)
K_SHOCK = 4.0
K_SENS = (3.0, 5.0)
RANGE_BARS = {5: 48, 15: 16}
FIT_DAYS = 180
HAWKES_PATHS = 2000
TERCILE_MIN_PAST = 100
MIN_TRAIN = 300
LATENCY_MIN = 1

COSTS = {  # par exécution, en fraction
    'C0': 0.0,
    'C1': 0.0007,   # frais 5 pb + glissement 2 pb
    'C2': 0.0010,   # frais 5 pb + glissement 5 pb
    'Cm': 0.0002,   # maker, sensibilité seulement
}


def ms(s: str) -> int:
    return int(pd.Timestamp(s, tz='UTC').value // 1_000_000)


def quarter_starts(start: str, end: str) -> list[int]:
    """Débuts de trimestre (ms) dans [start, end)."""
    q = pd.date_range(pd.Timestamp(start, tz='UTC'), pd.Timestamp(end, tz='UTC'), freq='QS', inclusive='left')
    return [int(x.value // 1_000_000) for x in q]
