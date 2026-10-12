#!/usr/bin/env python3
"""Mesures de latence sur le serveur du bot, en lecture seule (étude d'exécution, phase 1).

1. Allers-retours vers l'API Hyperliquid depuis cette machine : connexion neuve (TCP, TLS) et
   requêtes sur une connexion gardée ouverte ; écart d'horloge apparent avec l'exchange.
2. Résumé des journaux du bot (events-*.jsonl, shadow et réel) : délais depuis la clôture de chaque
   bougie jusqu'à sa lecture, au signal, à l'entrée, aux sorties et à la pose du stop ; écarts de
   prix ; compteurs (entrées abandonnées, reprises, révisions de bougies, arrêts).

N'envoie aucun ordre, ne lit aucune clé, ne modifie aucun fichier, n'arrête rien. N'affiche que des
agrégats : aucune variable interne de la stratégie (le champ `sets` des signaux n'est jamais lu).

    curl -fsSL https://raw.githubusercontent.com/etseroraynaud-ui/shadowmarketpro/claude/shock-engine-portfolio-g79j1v/research/execution/vps_probe.py | sudo python3 -

Arguments facultatifs : dossiers de journaux (par défaut, ceux des volumes Docker du bot).
"""

import glob
import http.client
import json
import os
import socket
import ssl
import sys
import time
from datetime import datetime, timezone

HOST = "api.hyperliquid.xyz"
STEP = 15 * 60000
AT_CLOSE_MS = 60000


def pct(xs, p):
    a = sorted(x for x in xs if x is not None)
    if not a:
        return None
    h = (len(a) - 1) * p
    lo = int(h)
    hi = min(lo + 1, len(a) - 1)
    return a[lo] + (a[hi] - a[lo]) * (h - lo)


def dist(xs):
    a = [x for x in xs if x is not None]
    if not a:
        return {"n": 0}
    r = lambda v: round(v, 2)
    return {"n": len(a), "p50": r(pct(a, 0.5)), "p90": r(pct(a, 0.9)), "p95": r(pct(a, 0.95)), "p99": r(pct(a, 0.99)), "max": r(max(a))}


# ---------------------------------------------------------------- réseau

def network(n=20):
    out = {}
    body = json.dumps({"type": "l2Book", "coin": "BTC"})
    ctx = ssl.create_default_context()
    # Connexion neuve : TCP puis TLS, mesurés séparément.
    tcp, tls, first = [], [], []
    for _ in range(5):
        t0 = time.perf_counter()
        raw = socket.create_connection((HOST, 443), timeout=10)
        t1 = time.perf_counter()
        s = ctx.wrap_socket(raw, server_hostname=HOST)
        t2 = time.perf_counter()
        c = http.client.HTTPSConnection(HOST, timeout=10)
        c.sock = s
        c.request("POST", "/info", body, {"Content-Type": "application/json"})
        c.getresponse().read()
        t3 = time.perf_counter()
        c.close()
        tcp.append((t1 - t0) * 1000)
        tls.append((t2 - t1) * 1000)
        first.append((t3 - t2) * 1000)
    out["new_connection_ms"] = {"tcp": dist(tcp), "tls": dist(tls), "first_request": dist(first), "total": dist([a + b + c for a, b, c in zip(tcp, tls, first)])}
    # Connexion gardée ouverte : un aller-retour par requête ; heure de l'exchange pour l'horloge.
    c = http.client.HTTPSConnection(HOST, timeout=10)
    warm, skew = [], []
    for k in range(n + 1):
        t0 = time.time()
        p0 = time.perf_counter()
        c.request("POST", "/info", body, {"Content-Type": "application/json"})
        data = json.loads(c.getresponse().read())
        p1 = time.perf_counter()
        if k == 0:
            continue
        warm.append((p1 - p0) * 1000)
        # Heure locale au milieu de la requête moins heure du carnet (≈ décalage d'horloge ± délai serveur).
        skew.append((t0 + (p1 - p0) / 2) * 1000 - data["time"])
        time.sleep(0.2)
    c.close()
    out["kept_open_request_ms"] = dist(warm)
    out["local_minus_exchange_ms"] = dist(skew)
    try:
        out["resolved"] = sorted({a[4][0] for a in socket.getaddrinfo(HOST, 443)})
    except OSError:
        pass
    return out


# ---------------------------------------------------------------- journaux

def iso_ms(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000


def journals(dirs):
    evs = []
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, "events-*.jsonl"))):
            with open(f, encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        e = json.loads(line)
                    except ValueError:
                        continue
                    e["_src"] = d
                    evs.append(e)
    evs.sort(key=lambda e: e["time"])
    seg, cost, counts = {}, {}, {}
    bars, eng = {}, {}

    def add(o, name, key, v):
        if v is not None:
            o.setdefault(name, {}).setdefault(key, []).append(v)

    def count(k):
        counts[k] = counts.get(k, 0) + 1

    for e in evs:
        pid = (e["_src"], e.get("mode"))
        s = bars.setdefault(pid, {"coin": "?", "T": None, "at": None})
        p = eng.setdefault(pid + (e.get("engine") or "",), {"regime": "?", "signal": None, "dir": 0, "rev": None, "T": None})
        if p["T"] != s["T"]:
            p.update(T=s["T"], signal=None, rev=None)
        src = e.get("mode", "?") + ("/" + e["engine"] if e.get("engine") else "")
        k = lambda what: f"{src}|{s['coin']}|{what}"
        t = iso_ms(e["time"])
        typ = e.get("type")
        if typ == "start":
            s["coin"] = str(e.get("coin", "?"))
        elif typ == "market_bar":
            s["T"], s["at"] = iso_ms(e["bar"]), t
            add(seg, "close_to_bar_read_s", k(e.get("reason")), (t - s["T"]) / 1000)
            ws = e.get("ws")
            count("ws_not_seen" if ws is None else "ws_equals_rest" if ws.get("same") else "ws_differs_from_rest")
            sp = e.get("spread") or {}
            if sp.get("maxBps") is not None:
                add(cost, "bar_max_spread_bps", k("all"), sp["maxBps"])
        elif typ == "signal" and s["T"] is not None and iso_ms(e["bar"]) == s["T"]:
            p["regime"] = str(e.get("regime", "?"))
            if e.get("engine") is None and e.get("mode") == "shadow":
                continue
            p["signal"] = t
            add(seg, "close_to_decision_s", k(p["regime"]), (t - s["T"]) / 1000)
            add(seg, "bar_read_to_decision_s", k(p["regime"]), (t - s["at"]) / 1000)
        elif typ == "entry" and s["T"] is not None:
            d = 1 if e.get("side") == "buy" else -1
            kind = "reversal_entry" if p["rev"] is not None else "entry"
            add(seg, "close_to_entry_logged_s", k(kind), (t - s["T"]) / 1000)
            if p["rev"] is not None:
                add(seg, "reversal_exit_to_entry_s", k("reversal"), (t - p["rev"]) / 1000)
            ref, avg = e.get("ref"), e.get("avg")
            if ref and avg:
                add(cost, "entry_vs_close_bps", k(p["regime"]), d * (avg - ref) / ref * 1e4)
                if e.get("bid") and e.get("ask"):
                    add(cost, "entry_mid_drift_at_quote_bps", k(p["regime"]), d * ((e["bid"] + e["ask"]) / 2 - ref) / ref * 1e4)
            if e.get("spreadBps") is not None:
                add(cost, "entry_half_spread_bps", k(p["regime"]), e["spreadBps"] / 2)
            p["dir"] = d
            count(kind)
        elif typ == "exit" and s["T"] is not None:
            d = 1 if e.get("side") == "sell" else -1
            add(seg, "close_to_exit_logged_s", k(e.get("tag")), (t - s["T"]) / 1000)
            if e.get("ref") and e.get("avg"):
                add(cost, "market_exit_vs_close_bps", k(e.get("tag")), d * (e["ref"] - e["avg"]) / e["ref"] * 1e4)
            if e.get("tag") == "REV":
                p["rev"] = t
            count("exit_" + str(e.get("tag")))
        elif typ == "exit_fill":
            if p["dir"] and e.get("ref") and e.get("px"):
                add(cost, "resting_exit_vs_level_bps", k(e.get("tag")), p["dir"] * (e["ref"] - e["px"]) / e["ref"] * 1e4)
            count("exit_fill_" + str(e.get("tag")))
        elif typ == "stop_placed":
            if s["T"] is not None and t - s["T"] < AT_CLOSE_MS:
                add(seg, "close_to_stop_placed_s", k("at_close"), (t - s["T"]) / 1000)
            count("stop_placed")
        elif typ == "stop_moved":
            count("stop_moved_at_close" if s["T"] is not None and t - s["T"] < AT_CLOSE_MS else "stop_moved_intrabar")
        elif typ == "trade":
            p["dir"] = 0
        elif typ == "retry":
            count("retry")
            if "429" in str(e.get("error", "")):
                count("retry_http_429")
        elif typ in ("entry_skipped", "entry_failed", "entry_blocked", "HALT", "order_resolved", "candle_revised",
                     "stop_rejected", "stop_move_failed", "cancel_failed", "ws_reconnected", "ws_stale", "error"):
            count(typ)
    span = [evs[0]["time"], evs[-1]["time"]] if evs else None
    flat = lambda o: {n: {key: dist(v) for key, v in sorted(g.items())} for n, g in o.items()}
    return {"events": len(evs), "span": span, "segments": flat(seg), "costs": flat(cost), "counts": counts}


def main():
    dirs = sys.argv[1:] or sorted(glob.glob("/var/lib/docker/volumes/*shadow-data/_data/logs") + glob.glob("/var/lib/docker/volumes/*live-data/_data/logs"))
    report = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "host": socket.gethostname()}
    try:
        report["network"] = network()
    except Exception as e:  # noqa: BLE001 — un échec réseau n'empêche pas le résumé des journaux
        report["network_error"] = str(e)
    report["log_dirs"] = dirs
    report["journals"] = journals(dirs) if dirs else "aucun dossier de journaux trouvé (passer le chemin en argument)"
    print(json.dumps(report, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
