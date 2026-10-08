"""Bougies 15 min Binance (comptant), depuis l'archive publique data.binance.vision.

    python3 research/data/fetch-binance.py SOLUSDT 2020-08 2026-09 [--out research/data/solusdt_15m.csv.gz]

Un fichier zip par mois. Sortie : timestamp ms UTC (ouverture), open, high, low, close, volume
(en unités de l'actif). Depuis 2025, l'archive donne les horodatages en microsecondes : ils sont
ramenés en millisecondes. Les mois absents (avant la cotation) sont ignorés.
"""
import argparse, gzip, io, os, ssl, sys, time, urllib.request, zipfile

ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None))
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.ProxyHandler())

def month_range(a, b):
    y, m = map(int, a.split('-')); y1, m1 = map(int, b.split('-'))
    while (y, m) <= (y1, m1):
        yield y, m
        m += 1
        if m == 13: y, m = y + 1, 1

def get(url):
    for attempt in range(8):
        try:
            with opener.open(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(2 + 2 * attempt)
    raise RuntimeError(f'échec : {url}')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('symbol'); ap.add_argument('start'); ap.add_argument('end'); ap.add_argument('--out')
    a = ap.parse_args()
    sym = a.symbol.upper()
    rows = {}
    for y, m in month_range(a.start, a.end):
        data = get(f'https://data.binance.vision/data/spot/monthly/klines/{sym}/15m/{sym}-15m-{y}-{m:02d}.zip')
        if data is None:
            print(f'  {sym} {y}-{m:02d} : absent', file=sys.stderr); continue
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            text = z.read(z.namelist()[0]).decode()
        k = 0
        for line in text.splitlines():
            p = line.split(',')
            if not p[0].isdigit():
                continue
            t = int(p[0])
            if t > 10 ** 14:
                t //= 1000
            rows[t] = (p[1], p[2], p[3], p[4], p[5]); k += 1
        print(f'  {sym} {y}-{m:02d} : {k} bougies', file=sys.stderr)
    out = a.out or os.path.join(os.path.dirname(__file__), f'{sym.lower()}_15m.csv.gz')
    with gzip.open(out, 'wt') as f:
        f.write('timestamp,open,high,low,close,volume\n')
        for t in sorted(rows):
            f.write(f'{t},' + ','.join(rows[t]) + '\n')
    print(f'écrit {out} : {len(rows)} bougies', file=sys.stderr)

if __name__ == '__main__':
    main()
