"""Historique du funding des perpétuels BTC et ETH, pour research/shock/e2-diagnostics.ts.

    python3 research/data/fetch-funding.py [--end 2026-09]

- Binance USDⓈ-M (BTCUSDT, ETHUSDT) : archives mensuelles de data.binance.vision, depuis janvier 2020
  (premier mois publié), un taux toutes les 8 h.
- Hyperliquid (BTC, ETH) : API publique `fundingHistory`, depuis mai 2023, un taux par versement.

Sortie : research/data/funding/{binance-BTCUSDT,binance-ETHUSDT,hyperliquid-BTC,hyperliquid-ETH}.csv,
colonnes time_ms,rate (taux par versement ; positif : les longs paient les shorts). Horodatages
ramenés à la minute UTC.
"""
import argparse, csv, io, json, os, ssl, sys, time, urllib.request, zipfile

ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None))
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.ProxyHandler())
OUT = os.path.join(os.path.dirname(__file__), 'funding')

def get(url, body=None):
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, data=body, headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'})
            with opener.open(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(2 + 2 * attempt)
    raise RuntimeError(f'échec : {url}')

def months(a, b):
    y, m = map(int, a.split('-')); y1, m1 = map(int, b.split('-'))
    while (y, m) <= (y1, m1):
        yield y, m
        m += 1
        if m == 13: y, m = y + 1, 1

def minute(t):
    return (int(t) // 60000) * 60000

def write(name, rows):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w') as f:
        f.write('time_ms,rate\n')
        for t in sorted(rows):
            f.write(f'{t},{rows[t]}\n')
    print(f'  {name} : {len(rows)} versements', file=sys.stderr)

def binance(sym, end):
    rows = {}
    for y, m in months('2020-01', end):
        data = get(f'https://data.binance.vision/data/futures/um/monthly/fundingRate/{sym}/{sym}-fundingRate-{y}-{m:02d}.zip')
        if data is None:
            raise RuntimeError(f'{sym} {y}-{m:02d} absent')
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            text = z.read(z.namelist()[0]).decode()
        for r in csv.DictReader(io.StringIO(text)):
            rows[minute(r['calc_time'])] = r['last_funding_rate']
    write(f'binance-{sym}.csv', rows)

def hyperliquid(coin, end_ms):
    rows, start = {}, 1680307200000  # 2023-04-01
    while start < end_ms:
        page = json.loads(get('https://api.hyperliquid.xyz/info', json.dumps({'type': 'fundingHistory', 'coin': coin, 'startTime': start, 'endTime': end_ms}).encode()))
        if not page:
            break
        for r in page:
            rows[minute(r['time'])] = r['fundingRate']
        nxt = max(int(r['time']) for r in page) + 1
        if nxt <= start:
            break
        start = nxt
        time.sleep(0.3)
    write(f'hyperliquid-{coin}.csv', {t: v for t, v in rows.items() if t < end_ms})

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--end', default='2026-09')
    a = ap.parse_args()
    y, m = map(int, a.end.split('-'))
    end_ms = int(time.mktime((y + (m == 12), m % 12 + 1, 1, 0, 0, 0, 0, 0, 0)) - time.timezone) * 1000
    for sym in ('BTCUSDT', 'ETHUSDT'):
        binance(sym, a.end)
    for coin in ('BTC', 'ETH'):
        hyperliquid(coin, end_ms)

if __name__ == '__main__':
    main()
