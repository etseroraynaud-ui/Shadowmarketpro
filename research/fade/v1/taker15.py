"""Volume agresseur Binance comptant (BTCUSDT, ETHUSDT) agrégé en tranches de 15 min UTC, pour l'étude
break-even / volume directionnel de V1 (research/preregistration/v1-be-volume.md).

    python3 research/fade/v1/taker15.py

Lit les bougies 1 min déjà téléchargées (research/data/binance/fade/derived/spot-{SYM}-1m[-pre2020].parquet,
aucun téléchargement). Sortie hors git : taker15-{SYM}.f64, tableau float64 petit-boutiste de lignes
[ouverture de la tranche (ms UTC), volume, volume acheteur agresseur, minutes présentes, minutes à volume nul,
clôture de la dernière minute]. Une minute absente n'est pas remplacée : elle manque au décompte.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
DERIVED = ROOT / 'research' / 'data' / 'binance' / 'fade' / 'derived'
Q = 15 * 60_000
START = int(pd.Timestamp('2018-08-01', tz='UTC').timestamp() * 1000)


def aggregate(sym: str) -> np.ndarray:
    parts = [pd.read_parquet(DERIVED / f'spot-{sym}-1m{s}.parquet', columns=['t', 'c', 'v', 'tbv']) for s in ('-pre2020', '')]
    df = pd.concat(parts, ignore_index=True).drop_duplicates('t').sort_values('t')
    # Fenêtre V1 (2018-09 →) plus un mois ; l'archive 2017-12 → 2018-02 a des horodatages décalés, hors fenêtre.
    df = df[df['t'] >= START]
    if (df['t'] % 60_000 != 0).any():
        sys.exit(f'{sym} : horodatage hors minute')
    df['q'] = df['t'] // Q * Q
    df['zero'] = (df['v'] <= 0).astype(np.int64)
    g = df.groupby('q', sort=True)
    out = pd.DataFrame({'v': g['v'].sum(), 'tbv': g['tbv'].sum(), 'n': g['t'].size(), 'zero': g['zero'].sum(), 'c': g['c'].last()}).reset_index()
    return out[['q', 'v', 'tbv', 'n', 'zero', 'c']].to_numpy(dtype='<f8')


def main() -> None:
    for sym in ('BTCUSDT', 'ETHUSDT'):
        a = aggregate(sym)
        path = DERIVED / f'taker15-{sym}.f64'
        path.write_bytes(a.tobytes())
        meta = {'rows': int(a.shape[0]), 'cols': ['t', 'v', 'tbv', 'n', 'zero', 'c'], 'first': int(a[0, 0]), 'last': int(a[-1, 0]),
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        (DERIVED / f'taker15-{sym}.json').write_text(json.dumps(meta, indent=1))
        print(f'{sym} : {meta["rows"]} tranches, {pd.Timestamp(meta["first"], unit="ms")} → {pd.Timestamp(meta["last"], unit="ms")}')


if __name__ == '__main__':
    main()
