"""Bougies 1 min Binance (perpétuel USDⓈ-M et comptant) BTCUSDT et ETHUSDT, depuis data.binance.vision.

    cd research/fade && python3 -m shockfade.fetch [--start 2020-01] [--end 2026-09] [--jobs 6]
    cd research/fade && python3 -m shockfade.fetch --start 2017-08 --end 2019-12 --markets spot --tag pre2020

Chaque archive mensuelle est vérifiée contre la somme SHA-256 publiée par Binance (.CHECKSUM) ; une
archive dont la somme diffère est rejetée. Les colonnes conservées : ouverture (ms UTC), OHLC, volume
(actif), volume en quote, nombre de transactions, volume acheteur agresseur (actif et quote). Depuis
2025, l'archive comptant horodate en microsecondes : ramené en millisecondes.

Sorties (hors git) : research/data/binance/fade/derived/{um,spot}-{SYMBOL}-1m.parquet.
Manifeste (commité) : research/reports/shock-fade/data-manifest.json (somme de chaque archive et
empreinte du tableau dérivé).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd

from .paths import DERIVED, RAW, REPORTS

BASE = 'https://data.binance.vision/data'
MARKETS = {'um': 'futures/um', 'spot': 'spot'}
SYMBOLS = ['BTCUSDT', 'ETHUSDT']
COLS = ['t', 'o', 'h', 'l', 'c', 'v', 'close_time', 'qv', 'n', 'tbv', 'tbqv', 'ignore']
KEEP = ['t', 'o', 'h', 'l', 'c', 'v', 'qv', 'n', 'tbv', 'tbqv']

_cafile = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
_ctx = ssl.create_default_context(cafile=_cafile)
_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=_ctx), urllib.request.ProxyHandler())


def months(a: str, b: str):
    y, m = map(int, a.split('-'))
    y1, m1 = map(int, b.split('-'))
    while (y, m) <= (y1, m1):
        yield f'{y}-{m:02d}'
        m += 1
        if m == 13:
            y, m = y + 1, 1


def _get(url: str) -> bytes | None:
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with _opener.open(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(2 + 2 * attempt)
    raise RuntimeError(f'échec : {url}')


def fetch_month(market: str, sym: str, ym: str) -> dict:
    rel = f'{MARKETS[market]}/monthly/klines/{sym}/1m/{sym}-1m-{ym}.zip'
    dest = RAW / rel
    ok = dest.with_suffix('.zip.sha256')
    if dest.exists() and ok.exists():
        return {'rel': rel, 'sha256': ok.read_text().strip(), 'status': 'cached'}
    data = _get(f'{BASE}/{rel}')
    if data is None:
        return {'rel': rel, 'sha256': None, 'status': 'missing'}
    ck = _get(f'{BASE}/{rel}.CHECKSUM')
    if ck is None:
        raise RuntimeError(f'somme absente : {rel}')
    expected = ck.decode().split()[0]
    got = hashlib.sha256(data).hexdigest()
    if got != expected:
        raise RuntimeError(f'somme différente : {rel} ({got} ≠ {expected})')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    ok.write_text(got)
    return {'rel': rel, 'sha256': got, 'status': 'downloaded'}


def parse_zip(path) -> pd.DataFrame:
    with zipfile.ZipFile(path) as z:
        raw = z.read(z.namelist()[0])
    df = pd.read_csv(io.BytesIO(raw), header=None, names=COLS, dtype=str)
    df = df[df['t'].str.isdigit()]
    out = pd.DataFrame({'t': df['t'].astype(np.int64)})
    for k in ['o', 'h', 'l', 'c', 'v', 'qv', 'tbv', 'tbqv']:
        out[k] = df[k].astype(np.float64).to_numpy()
    out['n'] = df['n'].astype(np.int64).to_numpy()
    big = out['t'] > 10 ** 14
    out.loc[big, 't'] = out.loc[big, 't'] // 1000
    return out[KEEP]


def array_digest(df: pd.DataFrame) -> str:
    h = hashlib.sha256()
    for k in KEEP:
        h.update(np.ascontiguousarray(df[k].to_numpy()).tobytes())
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', default='2020-01')
    ap.add_argument('--end', default='2026-09')
    ap.add_argument('--jobs', type=int, default=6)
    ap.add_argument('--markets', default='um,spot', help='marchés à télécharger (um, spot)')
    ap.add_argument('--tag', default='', help='suffixe des sorties (ex. pre2020) : ne remplace pas la série principale')
    a = ap.parse_args()
    sfx = f'-{a.tag}' if a.tag else ''
    DERIVED.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    manifest: dict = {'source': BASE, 'start': a.start, 'end': a.end, 'series': {}}
    for market in a.markets.split(','):
        for sym in SYMBOLS:
            jobs = [(market, sym, ym) for ym in months(a.start, a.end)]
            with ThreadPoolExecutor(a.jobs) as ex:
                res = list(ex.map(lambda j: fetch_month(*j), jobs))
            frames = []
            for r in res:
                if r['sha256'] is None:
                    print(f'  {r["rel"]} : absent', file=sys.stderr)
                    continue
                frames.append(parse_zip(RAW / r['rel']))
            df = pd.concat(frames, ignore_index=True).drop_duplicates('t').sort_values('t').reset_index(drop=True)
            out = DERIVED / f'{market}-{sym}-1m{sfx}.parquet'
            df.to_parquet(out, index=False)
            key = f'{market}-{sym}'
            manifest['series'][key] = {
                'rows': int(len(df)),
                'first_open_ms': int(df['t'].iloc[0]),
                'last_open_ms': int(df['t'].iloc[-1]),
                'array_sha256': array_digest(df),
                'archives': [{'rel': r['rel'], 'sha256': r['sha256']} for r in res],
            }
            print(f'{key} : {len(df)} minutes, {pd.to_datetime(df["t"].iloc[0], unit="ms")} → {pd.to_datetime(df["t"].iloc[-1], unit="ms")}', file=sys.stderr)
    (REPORTS / f'data-manifest{sfx}.json').write_text(json.dumps(manifest, indent=1))


if __name__ == '__main__':
    main()
