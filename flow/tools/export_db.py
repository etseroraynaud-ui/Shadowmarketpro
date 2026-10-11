#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Exporte une base whale_<COIN>.db (dashboard local ou collecteur) au format publié par le collecteur.

  python flow/tools/export_db.py whale_BTC.db --out btc.json     fichier JSON (tests de la page)
  python flow/tools/export_db.py whale_BTC.db --post             envoie l'historique au site (rattrapage)

--post lit FLOW_INGEST_URL et FLOW_INGEST_TOKEN dans l'environnement et envoie par paquets de 500 lignes,
sans état courant (celui du collecteur en service n'est pas écrasé). Les envois sont des upserts :
relancer la commande ne crée pas de doublons.
"""

import argparse
import json
import math
import os
import re
import sqlite3
import sys
import time
import urllib.request

CHUNK = 500


def clean(o):
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    return o


def r2(x, nd=2):
    return None if x is None else round(x, nd)


def read(path):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    # Spot (colonnes sdelta/svol) : seulement dans les bases du collecteur depuis octobre 2026.
    spot = {"sdelta", "svol"} <= {r[1] for r in con.execute("PRAGMA table_info(bars)")}
    cols = "minute, px, delta, vol, liq_long, liq_short" + (", sdelta, svol" if spot else ", NULL, NULL")
    bars = [{"minute": int(m), "px": r2(px), "delta": [r2(x) for x in json.loads(d)], "vol": [r2(x) for x in json.loads(v)],
             "liq_long": r2(ll or 0.0), "liq_short": r2(ls or 0.0),
             "spot_delta": [r2(x) for x in json.loads(sd)] if sd else None, "spot_vol": [r2(x) for x in json.loads(sv)] if sv else None}
            for m, px, d, v, ll, ls, sd, sv in con.execute(f"SELECT {cols} FROM bars ORDER BY minute")]
    bars = [b for b in bars if len(b["delta"]) == 4 and len(b["vol"]) == 4]
    giants = {round(r[0], 3): r for r in con.execute(
        "SELECT ts, giant_long, giant_short, n_giant_long, n_giant_short, giant_net_change, giant_long_change, giant_short_change FROM hl_giant_hist")}
    whales = []
    for h in con.execute("SELECT ts, price, whale_long, whale_short, position_change, change_long, change_short, n_whales_long, "
                         "n_whales_short, coverage_long, coverage_short, open_interest FROM hl_hist ORDER BY ts"):
        g = giants.get(round(h[0], 3))
        whales.append({
            "ts": round(h[0], 3), "px": r2(h[1]), "whale_long": r2(h[2], 0), "whale_short": r2(h[3], 0),
            "chg_net": r2(h[4], 0), "chg_long": r2(h[5], 0), "chg_short": r2(h[6], 0), "n_long": h[7], "n_short": h[8],
            "cov_long": r2(h[9], 5), "cov_short": r2(h[10], 5), "oi": r2(h[11], 0),
            "giant_long": r2(g[1], 0) if g else None, "giant_short": r2(g[2], 0) if g else None,
            "giant_n_long": g[3] if g else None, "giant_n_short": g[4] if g else None,
            "giant_chg_net": r2(g[5], 0) if g else None, "giant_chg_long": r2(g[6], 0) if g else None,
            "giant_chg_short": r2(g[7], 0) if g else None,
        })
    last = whales[-1] if whales else None
    px = last["px"] if last else None
    top = []
    if px:
        for addr, szi, entry, liq, lev, upnl, checked in con.execute(
                "SELECT address, btc_szi, entry_px, liq_px, leverage, upnl, last_checked FROM hl_accounts "
                "WHERE has_btc_position = 1 ORDER BY ABS(btc_szi) DESC LIMIT 15"):
            top.append({"address": addr, "szi": szi, "value": abs(szi) * px, "entry": entry, "liq": liq, "lev": lev,
                        "upnl": upnl, "age_s": round(last["ts"] - checked) if checked else None})
    status = None
    if last:
        oi = last["oi"]
        cov = {"long_all": last["cov_long"], "short_all": last["cov_short"],
               "gross_all": ((last["cov_long"] or 0) + (last["cov_short"] or 0)) / 2 if last["cov_long"] is not None else None}
        status = {"price": px, "price_src": "Binance", "feeds": {}, "hl_rest": "export", "uptime_s": None,
                  "first_bar": bars[0]["minute"] if bars else None,
                  "hl": {"px": px, "oi": oi, "coverage": cov,
                         "whales": {"long": last["whale_long"], "short": last["whale_short"], "n_long": last["n_long"], "n_short": last["n_short"]},
                         "giants": {"long": last["giant_long"], "short": last["giant_short"], "n_long": last["giant_n_long"], "n_short": last["giant_n_short"]},
                         "known": con.execute("SELECT COUNT(*) FROM hl_accounts").fetchone()[0],
                         "inspected": con.execute("SELECT COUNT(*) FROM hl_accounts WHERE last_checked IS NOT NULL").fetchone()[0],
                         "ws_connected": True, "top": top}}
    return bars, whales, status


def post(url, token, payload):
    req = urllib.request.Request(url, data=json.dumps(clean(payload), allow_nan=False).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("db")
    ap.add_argument("--coin", help="BTC ou ETH (par défaut : d'après le nom du fichier)")
    ap.add_argument("--out")
    ap.add_argument("--post", action="store_true")
    a = ap.parse_args()
    coin = (a.coin or (re.search(r"whale_([A-Za-z]+)\.db", os.path.basename(a.db)) or [None, ""])[1]).upper()
    if coin not in ("BTC", "ETH"):
        sys.exit("actif inconnu : --coin BTC ou ETH")
    bars, whales, status = read(a.db)
    print(f"{coin} : {len(bars)} minutes, {len(whales)} échantillons whales")
    if a.out:
        with open(a.out, "w") as f:
            json.dump(clean({"coin": coin, "bars": bars, "whales": whales, "status": status}), f, allow_nan=False)
        print(f"écrit {a.out}")
    if a.post:
        url, token = os.environ.get("FLOW_INGEST_URL", "https://www.shadowmarketpro.com/api/market-flow/ingest"), os.environ.get("FLOW_INGEST_TOKEN")
        if not token:
            sys.exit("FLOW_INGEST_TOKEN absent de l'environnement")
        n = max(len(bars), len(whales))
        for i in range(0, n, CHUNK):
            st = post(url, token, {"coin": coin, "sent_at": time.time(), "bars": bars[i:i + CHUNK], "whales": whales[i:i + CHUNK], "status": None})
            print(f"  {min(i + CHUNK, n)}/{n} : HTTP {st}")


if __name__ == "__main__":
    main()
