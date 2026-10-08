"""Bougies 15 min Dukascopy (prix acheteur), construites à partir des fichiers minute quotidiens.

    python3 research/data/fetch-dukascopy.py XAUUSD 2012-01-01 2026-10-01 [--workers 16] [--out research/data/xauusd_15m.csv.gz]

Même résultat que `npx dukascopy-node -i xauusd -t m15 -f csv` (minutes sans transaction ignorées),
mais avec des reprises sur erreur et plusieurs requêtes en parallèle : le serveur refuse (429) les
clients sans user-agent de navigateur. Sortie : timestamp ms UTC, open, high, low, close, volume.
Les fichiers minute bruts sont gardés dans un cache (option --cache) pour reprendre un téléchargement.
"""
import argparse, datetime as dt, gzip, http.client, lzma, os, ssl, struct, sys, threading, time
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

HOST = 'datafeed.dukascopy.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
POINT = {'XAUUSD': 1000, 'LIGHTCMDUSD': 1000, 'BRENTCMDUSD': 1000, 'EURUSD': 100000, 'ETHUSD': 10}

ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None))
PROXY = urlparse(os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or '')
local = threading.local()

def connection():
    """Connexion persistante par fil d'exécution : ouvrir une connexion (proxy, TLS) coûte plusieurs secondes."""
    c = getattr(local, 'conn', None)
    if c is None:
        if PROXY.hostname:
            c = http.client.HTTPSConnection(PROXY.hostname, PROXY.port, context=ctx, timeout=120)
            c.set_tunnel(HOST, 443)
        else:
            c = http.client.HTTPSConnection(HOST, 443, context=ctx, timeout=120)
        local.conn = c
    return c

def drop():
    c = getattr(local, 'conn', None)
    if c is not None:
        try:
            c.close()
        except Exception:
            pass
    local.conn = None

def fetch(inst, day, cache):
    path = os.path.join(cache, inst, f'{day:%Y-%m-%d}.bi5')
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return day, f.read()
    url = f'/datafeed/{inst}/{day.year}/{day.month - 1:02d}/{day.day:02d}/BID_candles_min_1.bi5'
    for attempt in range(60):
        try:
            c = connection()
            c.request('GET', url, headers={'User-Agent': UA, 'Connection': 'keep-alive'})
            r = c.getresponse()
            data = r.read()
            if r.status == 200:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path + '.part', 'wb') as f:
                    f.write(data)
                os.replace(path + '.part', path)
                return day, data
            if r.status == 404:
                return day, b''
            drop()
        except Exception:
            drop()
        # Le serveur limite le débit (429, 503, coupures) : on attend et on recommence.
        time.sleep(min(20, 1 + attempt))
    raise RuntimeError(f'échec : {url}')

def minutes(inst, day, data):
    if not data:
        return []
    raw = lzma.decompress(data, format=lzma.FORMAT_ALONE)
    p = POINT[inst]
    base = int(dt.datetime(day.year, day.month, day.day, tzinfo=dt.timezone.utc).timestamp())
    out = []
    for k in range(0, len(raw) - 23, 24):
        t, o, c, lo, hi, v = struct.unpack('>5if', raw[k:k + 24])
        if v <= 0 and o == c == lo == hi:
            continue  # minute sans transaction
        out.append(((base + t) * 1000, o / p, hi / p, lo / p, c / p, v))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inst'); ap.add_argument('start'); ap.add_argument('end')
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--out'); ap.add_argument('--cache', default=os.path.join(os.path.dirname(__file__), '.dukascopy-cache'))
    a = ap.parse_args()
    inst = a.inst.upper()
    d0, d1 = dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)
    days = [d0 + dt.timedelta(k) for k in range((d1 - d0).days) if (d0 + dt.timedelta(k)).weekday() != 5]
    got = {}
    t0 = time.time()
    with ThreadPoolExecutor(a.workers) as ex:
        futs = [ex.submit(fetch, inst, d, a.cache) for d in days]
        for k, f in enumerate(as_completed(futs), 1):
            day, data = f.result()
            got[day] = data
            if k % 200 == 0 or k == len(days):
                el = time.time() - t0
                print(f'  {inst} : {k}/{len(days)} jours · {el:.0f} s · reste ≈ {el / k * (len(days) - k):.0f} s', file=sys.stderr, flush=True)
    bars = {}
    for day in sorted(got):
        for t, o, h, l, c, v in minutes(inst, day, got[day]):
            k = t - t % 900000
            b = bars.get(k)
            if b is None:
                bars[k] = [o, h, l, c, v]
            else:
                b[1] = max(b[1], h); b[2] = min(b[2], l); b[3] = c; b[4] += v
    out = a.out or os.path.join(os.path.dirname(__file__), f'{inst.lower()}_15m.csv.gz')
    with gzip.open(out, 'wt') as f:
        f.write('timestamp,open,high,low,close,volume\n')
        for k in sorted(bars):
            o, h, l, c, v = bars[k]
            f.write(f'{k},{o:.3f},{h:.3f},{l:.3f},{c:.3f},{v:.4f}\n')
    print(f'écrit {out} : {len(bars)} bougies de 15 min', file=sys.stderr)

if __name__ == '__main__':
    main()
