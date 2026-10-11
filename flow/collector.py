#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MARKET FLOW: headless collector (server)
=======================================

Tourne en continu sur le serveur et publie chaque minute, pour BTC et ETH, ce que la page
/market-flow de shadowmarketpro.com affiche : CVD par taille d'ordre (Binance, Bybit, OKX),
positionnement des whales Hyperliquid, liquidations.

Repris du dashboard local whale_dashboard.py v2 (même logique, mêmes contrôles), sans l'interface
Dash, avec trois différences :
  1. BTC et ETH dans le même processus. Un relevé `clearinghouseState` donne toutes les positions
     d'une adresse : il est appliqué aux deux actifs, ce qui divise par deux le poids consommé.
  2. Budget Hyperliquid partagé et plafonné (FLOW_HL_BUDGET, 600 de poids/min par défaut sur la
     limite officielle de 1 200 par IP) : le bot de trading, sur la même IP, garde de la marge.
  3. Publication : chaque minute, les minutes closes, les échantillons whales et l'état du
     collecteur partent vers l'API d'ingestion du site (jeton FLOW_INGEST_TOKEN), qui les écrit
     dans Supabase. Le serveur n'a aucun accès à la base.

Concepts (voir whale_dashboard.py pour le détail) :
  - STOCK : positions ouvertes observées (relevé REST, estimation incrémentale entre deux relevés
    à partir du flux public `trades`, réconciliée à chaque relevé).
  - FLUX : variation de position observée APRÈS le premier relevé de la session (une adresse
    nouvellement découverte entre dans le stock, jamais dans le flux).
  - AGRESSION CEX : ordres taker reconstitués, classés par taille (<10 k$, 10–100 k$, 100 k–1 M$,
    ≥ 1 M$). Un gros ordre n'est pas forcément une whale directionnelle.
  - RETAIL : ordres agresseurs < 10 k$ (proxy).
  - COUVERTURE : Σ positions observées / (2 × OI Hyperliquid), qualité de l'échantillon.

Lancement : python collector.py            (variables d'environnement : voir Env ci-dessous)
            python collector.py --dry-run  (rien n'est envoyé ; les envois sont résumés dans le journal)
"""

import argparse
import asyncio
import json
import math
import os
import random
import signal
import sqlite3
import statistics
import threading
import time
from collections import defaultdict, deque

import aiohttp
import websockets


# =============================================================================
# CONFIGURATION
# =============================================================================
class Env:
    coins = [c.strip().upper() for c in os.environ.get("FLOW_COINS", "BTC,ETH").split(",") if c.strip()]
    data_dir = os.environ.get("FLOW_DATA_DIR", "/data")
    ingest_url = os.environ.get("FLOW_INGEST_URL", "https://www.shadowmarketpro.com/api/market-flow/ingest")
    ingest_token = os.environ.get("FLOW_INGEST_TOKEN", "")
    hl_budget = int(os.environ.get("FLOW_HL_BUDGET", "600"))
    publish_s = int(os.environ.get("FLOW_PUBLISH_S", "60"))


class Cfg:
    buckets = [
        (0, 10_000, "retail"),
        (10_000, 100_000, "mid"),
        (100_000, 1_000_000, "large"),
        (1_000_000, float("inf"), "mega"),
    ]
    history_min = 24 * 60           # historique en mémoire (minutes)
    big_trade_usd = 1_000_000
    big_liq_usd = 100_000
    db_keep_days = 7

    whale_min_position_usd = 500_000
    whale_categories = [(500_000, 1_000_000, "500k–1M"), (1_000_000, 5_000_000, "1–5M"),
                        (5_000_000, 20_000_000, "5–20M"), (20_000_000, float("inf"), ">20M")]
    hl_concurrency = 4
    hl_hot_s = 60
    hl_warm_s = 300
    hl_cold_s = 6 * 3600
    hl_cold_active_s = 3600
    hl_hot_liq_dist = 0.10
    hl_hot_recent_s = 900
    hl_seed_top = 2000
    hl_sample_s = 60
    hl_liq_checks_per_min = 4
    hl_trade_buffer_s = 180
    hl_dedup_max = 300_000
    hl_recon_window_s = 900
    hl_mem_purge_days = 7
    hl_db_purge_days = 30
    giant_min_position_usd = 5_000_000
    top_positions = 15              # positions publiées (les plus grosses whales de chaque actif)

    hl_info = "https://api.hyperliquid.xyz/info"
    hl_ws = "wss://api.hyperliquid.xyz/ws"
    hl_leaderboard = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"
    bybit_ws = "wss://stream.bybit.com/v5/public/linear"
    okx_ws = "wss://ws.okx.com:8443/ws/v5/public"


class CoinCfg:
    def __init__(self, coin):
        self.coin = coin
        self.binance_symbol = f"{coin}USDT"
        self.bybit_symbol = f"{coin}USDT"
        self.okx_inst = f"{coin}-USDT-SWAP"
        s = self.binance_symbol.lower()
        # Depuis 2026 : aggTrade et forceOrder sont servis uniquement sur /market
        self.binance_ws = f"wss://fstream.binance.com/market/stream?streams={s}@aggTrade/{s}@forceOrder"
        self.okx_instruments = f"https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId={self.okx_inst}"
        self.okx_ctval = {"BTC": 0.01, "ETH": 0.1}.get(coin, 1.0)


CEX_VENUES = ["Binance", "Bybit", "OKX"]
VENUES = CEX_VENUES + ["Hyperliquid"]
HOT, WARM, CANDIDATE, COLD = "HOT", "WARM", "CANDIDATE", "COLD"


def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def bucket_index(usd):
    for i, (lo, hi, _) in enumerate(Cfg.buckets):
        if lo <= usd < hi:
            return i
    return len(Cfg.buckets) - 1


def minute_of(ts_ms):
    return int(ts_ms // 60_000) * 60


def whale_category(value):
    for lo, hi, label in Cfg.whale_categories:
        if lo <= value < hi:
            return label
    return None


# =============================================================================
# LIMITEUR DE POIDS HYPERLIQUID (fenêtre glissante de 60 s, lissée à la seconde), partagé
# =============================================================================
class WeightLimiter:
    def __init__(self, per_min):
        self.per_min = per_min
        self.per_sec = max(per_min / 60 * 3, 20)
        self.log = deque()
        self.pause_until = 0.0
        self.n429 = 0

    def _used(self, now, span=60.0):
        while self.log and self.log[0][0] < now - 60:
            self.log.popleft()
        if span >= 60:
            return sum(w for _, w in self.log)
        return sum(w for t, w in self.log if t >= now - span)

    async def acquire(self, w):
        while True:
            now = time.time()
            if now < self.pause_until:
                await asyncio.sleep(self.pause_until - now)
                continue
            if self._used(now) + w <= self.per_min and self._used(now, 1.0) + w <= self.per_sec:
                self.log.append((now, w))
                return
            await asyncio.sleep(0.2)

    def charge(self, w):
        if w > 0:
            self.log.append((time.time(), w))

    def penalize(self, seconds):
        self.n429 += 1
        self.pause_until = max(self.pause_until, time.time() + seconds)

    def used(self):
        return self._used(time.time())

    def available(self):
        return max(0.0, self.per_min - self.used())


# =============================================================================
# CATALOGUE ET POSITIONS HYPERLIQUID (un traqueur par actif)
# =============================================================================
class Acct:
    """Un compte Hyperliquid. Les champs de position concernent l'actif du traqueur uniquement."""
    __slots__ = ("address", "first_seen", "last_seen", "last_checked", "observed_volume", "trade_count",
                 "max_trade", "priority", "sources", "has_pos", "szi", "value", "entry_px", "liq_px",
                 "leverage", "upnl", "account_value", "last_position_update", "snap_time", "snap_epoch",
                 "baseline_session", "tier", "is_whale", "max_value", "next_due", "inflight", "dirty",
                 "last_liq_check")

    def __init__(self, address, now):
        self.address = address
        self.first_seen = now
        self.last_seen = None
        self.last_checked = None
        self.observed_volume = 0.0
        self.trade_count = 0
        self.max_trade = 0.0
        self.priority = 0.0
        self.sources = set()
        self.has_pos = False
        self.szi = 0.0
        self.value = 0.0
        self.entry_px = None
        self.liq_px = None
        self.leverage = None
        self.upnl = None
        self.account_value = None
        self.last_position_update = None
        self.snap_time = None
        self.snap_epoch = -1
        self.baseline_session = False
        self.tier = CANDIDATE
        self.is_whale = False
        self.max_value = 0.0
        self.next_due = now
        self.inflight = False
        self.dirty = True
        self.last_liq_check = 0.0


def _long_part(x):
    return x if x > 0 else 0.0


def _short_part(x):
    return -x if x < 0 else 0.0


class HLTracker:
    """Catalogue d'adresses, estimation incrémentale, scheduler et métriques, pour un actif."""

    def __init__(self, coin):
        self.coin = coin
        self.lock = threading.RLock()
        self.accounts = {}
        self.pos_set = set()
        self.epoch = 0
        self.ws_connected = False
        self.seen_tids = set()
        self.seen_order = deque()
        self.recent_trades = deque()
        self.px = None
        self.oi_coins = None
        self.oi_usd = None
        self.oi_ts = None
        self.acc_net = 0.0
        self.acc_long = 0.0
        self.acc_short = 0.0
        self.g_acc_net = 0.0
        self.g_acc_long = 0.0
        self.g_acc_short = 0.0
        self.giant_history = deque(maxlen=Cfg.history_min * 3)
        self.recon_abs = deque()
        self.anomalies = deque(maxlen=200)
        self.history = deque(maxlen=Cfg.history_min * 3)
        self.liq_queue = deque()
        self.n_inspected_session = 0
        self.queue_stats = {"due_hot": 0, "due_warm": 0, "candidates": 0, "due_cold": 0}
        self.last_sample = None

    # ── Catalogue ──────────────────────────────────────────────────────────
    def _get(self, address, now):
        a = self.accounts.get(address)
        if a is None:
            a = Acct(address, now)
            self.accounts[address] = a
        return a

    def _priority(self, a, now):
        s = math.log10(1 + a.observed_volume) + 0.7 * math.log10(1 + a.trade_count)
        if "leaderboard" in a.sources:
            s += 2.0
        if a.max_value >= Cfg.whale_min_position_usd:
            s += 3.0
        if a.last_seen and now - a.last_seen < 600:
            s += 1.5
        if a.max_trade >= 100_000:
            s += 1.0
        a.priority = s
        return s

    def add_hl_candidate(self, address, score=0.0, source="manual"):
        if not address or not isinstance(address, str):
            return
        address = address.lower()
        now = time.time()
        with self.lock:
            a = self._get(address, now)
            a.sources.add(source)
            self._priority(a, now)
            a.priority += score
            a.dirty = True

    # ── Flux trades (estimation incrémentale) ──────────────────────────────
    def new_epoch(self):
        with self.lock:
            self.epoch += 1
            self.ws_connected = True
            now = time.time()
            for addr in self.pos_set:
                a = self.accounts[addr]
                a.next_due = min(a.next_due, now)

    def on_trade(self, t):
        """t = WsTrade officiel : coin, side, px, sz, time, tid, users=[acheteur, vendeur]. False si doublon."""
        try:
            tm = int(t["time"])
            tid = t.get("tid")
            px, sz = float(t["px"]), float(t["sz"])
            users = t.get("users") or []
        except (KeyError, TypeError, ValueError):
            return False
        key = (tm, tid)
        now = time.time()
        with self.lock:
            if key in self.seen_tids:
                return False
            self.seen_tids.add(key)
            self.seen_order.append(key)
            while len(self.seen_order) > Cfg.hl_dedup_max:
                self.seen_tids.discard(self.seen_order.popleft())
            self.px = px
            if len(users) != 2:
                return True
            buyer, seller = (users[0] or "").lower(), (users[1] or "").lower()
            self.recent_trades.append((tm, tid, buyer, seller, sz, px))
            cutoff = tm - Cfg.hl_trade_buffer_s * 1000
            while self.recent_trades and self.recent_trades[0][0] < cutoff:
                self.recent_trades.popleft()
            usd = px * sz
            for addr, sign in ((buyer, 1.0), (seller, -1.0)):
                if not addr:
                    continue
                a = self._get(addr, now)
                a.sources.add("live_trade")
                a.last_seen = now
                a.observed_volume += usd
                a.trade_count += 1
                a.max_trade = max(a.max_trade, usd)
                self._priority(a, now)
                a.dirty = True
                valid = (a.snap_epoch == self.epoch and a.snap_time is not None and self.ws_connected)
                if valid and tm > a.snap_time:
                    self._apply_delta(a, sign * sz, px, now)
                elif a.last_checked is not None and a.tier in (COLD, WARM):
                    a.next_due = min(a.next_due, now + 30)
        return True

    def _apply_delta(self, a, d_szi, px, now, reconciliation=False):
        old = a.szi
        new = old + d_szi
        if abs(new) < 1e-9:
            new = 0.0
        if a.baseline_session and max(abs(old), abs(new)) * px >= Cfg.whale_min_position_usd:
            self.acc_net += (new - old) * px
            self.acc_long += (_long_part(new) - _long_part(old)) * px
            self.acc_short += (_short_part(new) - _short_part(old)) * px
        if a.baseline_session and max(abs(old), abs(new)) * px >= Cfg.giant_min_position_usd:
            self.g_acc_net += (new - old) * px
            self.g_acc_long += (_long_part(new) - _long_part(old)) * px
            self.g_acc_short += (_short_part(new) - _short_part(old)) * px
        a.szi = new
        a.value = abs(new) * px
        a.has_pos = new != 0.0
        a.last_position_update = now
        a.max_value = max(a.max_value, a.value)
        a.is_whale = a.value >= Cfg.whale_min_position_usd
        if a.has_pos:
            self.pos_set.add(a.address)
            if a.is_whale and a.tier != HOT:
                a.tier = HOT
                a.next_due = min(a.next_due, now + 30)
        else:
            self.pos_set.discard(a.address)
            a.next_due = min(a.next_due, now + 30)
        if (not reconciliation and abs(new) < abs(old) and a.liq_px and px
                and abs(a.liq_px / px - 1) < 0.03 and old * px >= 100_000):
            self._queue_liq_check(a, now)
        a.dirty = True

    def _queue_liq_check(self, a, now):
        if now - a.last_liq_check > 120:
            a.last_liq_check = now
            since = (a.snap_time or (now * 1000 - 300_000)) - 5000
            self.liq_queue.append((a.address, int(since)))

    # ── Relevés REST (vérité de référence) ────────────────────────────────
    def apply_snapshot(self, address, data, req_ts, ref_px):
        """Applique un clearinghouseState (toutes les positions du compte ; seule celle de l'actif du
        traqueur est lue). Les trades plus récents que l'horodatage serveur sont ré-appliqués."""
        now = time.time()
        with self.lock:
            a = self._get(address, now)
            a.inflight = False
            pos = None
            for ap in data.get("assetPositions", []) or []:
                p = ap.get("position", {}) or {}
                if p.get("coin") == self.coin:
                    pos = p
                    break
            snap_szi = float(pos.get("szi") or 0) if pos else 0.0
            server_ms = int(data.get("time") or req_ts * 1000)
            est = snap_szi
            for tm, tid, buyer, seller, sz, tpx in self.recent_trades:
                if tm > server_ms:
                    if buyer == address:
                        est += sz
                    elif seller == address:
                        est -= sz
            px = self.px or ref_px or 0.0
            had_valid = a.baseline_session and a.last_checked is not None and (now - a.last_checked) < Cfg.hl_recon_window_s
            if had_valid and px:
                diff = est - a.szi
                if abs(diff) > 1e-9:
                    self.recon_abs.append((now, abs(diff) * px))
                    self._apply_delta(a, diff, px, now, reconciliation=True)
            else:
                a.szi = est
                a.value = abs(est) * px if px else 0.0
                a.has_pos = est != 0.0
            if pos:
                pv = abs(float(pos.get("positionValue") or 0))
                a.entry_px = float(pos["entryPx"]) if pos.get("entryPx") else None
                a.liq_px = float(pos["liquidationPx"]) if pos.get("liquidationPx") else None
                lev = pos.get("leverage") or {}
                a.leverage = float(lev.get("value")) if lev.get("value") is not None else None
                a.upnl = float(pos.get("unrealizedPnl") or 0)
                if snap_szi and px:
                    implied = pv / abs(snap_szi)
                    if abs(implied / px - 1) > 0.025:
                        self.anomalies.append((now, f"{address[:8]}… positionValue incohérente ({implied:,.0f} vs {px:,.0f})"))
                if not a.value and pv:
                    a.value = pv
            else:
                a.entry_px = a.liq_px = a.leverage = a.upnl = None
            ms = data.get("marginSummary") or {}
            a.account_value = float(ms.get("accountValue") or 0) if ms else None
            a.snap_time = server_ms
            a.snap_epoch = self.epoch
            a.baseline_session = True
            a.last_checked = now
            a.last_position_update = now
            a.max_value = max(a.max_value, a.value)
            a.is_whale = a.value >= Cfg.whale_min_position_usd
            if a.has_pos:
                self.pos_set.add(address)
            else:
                self.pos_set.discard(address)
            self._classify(a, px, now)
            self._priority(a, now)
            a.dirty = True
            self.n_inspected_session += 1

    def mark_failed(self, address):
        with self.lock:
            a = self.accounts.get(address)
            if a:
                a.inflight = False
                a.next_due = time.time() + 60

    def _classify(self, a, px, now):
        if a.has_pos:
            near_liq = a.liq_px and px and abs(a.liq_px / px - 1) < Cfg.hl_hot_liq_dist
            recent = a.last_seen and now - a.last_seen < Cfg.hl_hot_recent_s
            if a.is_whale or near_liq or recent:
                a.tier, a.next_due = HOT, now + Cfg.hl_hot_s
            else:
                a.tier, a.next_due = WARM, now + Cfg.hl_warm_s
        else:
            a.tier = COLD
            a.next_due = now + (Cfg.hl_cold_active_s if a.observed_volume >= 1_000_000 else Cfg.hl_cold_s)

    # ── Scheduler ─────────────────────────────────────────────────────────
    def pick_batch(self, n, exclude=()):
        """Ordre : HOT échus → WARM échus → CANDIDATE (par priorité) → COLD échus."""
        if n <= 0:
            return []
        now = time.time()
        with self.lock:
            hot, warm, cand, cold = [], [], [], []
            for a in self.accounts.values():
                if a.inflight or a.address in exclude:
                    continue
                if a.last_checked is None:
                    cand.append(a)
                elif a.next_due <= now:
                    (hot if a.tier == HOT else warm if a.tier == WARM else cold).append(a)
            self.queue_stats = {"due_hot": len(hot), "due_warm": len(warm), "candidates": len(cand), "due_cold": len(cold)}
            hot.sort(key=lambda a: a.next_due)
            warm.sort(key=lambda a: a.next_due)
            batch = hot[:n]
            if len(batch) < n:
                batch += warm[:n - len(batch)]
            if len(batch) < n and cand:
                cand.sort(key=lambda a: -a.priority)
                batch += cand[:n - len(batch)]
            if len(batch) < n:
                cold.sort(key=lambda a: -a.priority)
                batch += cold[:n - len(batch)]
            for a in batch:
                a.inflight = True
            return [a.address for a in batch]

    # ── Open interest ─────────────────────────────────────────────────────
    def set_oi(self, oi_coins, mark_px):
        with self.lock:
            self.oi_coins = oi_coins
            self.oi_usd = oi_coins * mark_px if oi_coins is not None and mark_px else None
            self.oi_ts = time.time()
            if mark_px and not self.px:
                self.px = mark_px

    # ── Métriques de stock et de couverture ───────────────────────────────
    def _stock(self, now):
        px = self.px
        wl = ws = all_l = all_s = 0.0
        n_wl = n_ws = 0
        gl = gs = 0.0
        n_gl = n_gs = 0
        giant_vals = []
        positions = []
        for addr in self.pos_set:
            a = self.accounts[addr]
            if a.last_position_update is None or now - a.last_position_update > 6 * 3600 and not a.baseline_session:
                continue
            v = abs(a.szi) * px if px else a.value
            if a.szi > 0:
                all_l += v
            else:
                all_s += v
            if v >= Cfg.whale_min_position_usd:
                if a.szi > 0:
                    wl += v
                    n_wl += 1
                else:
                    ws += v
                    n_ws += 1
            if v >= Cfg.giant_min_position_usd:
                giant_vals.append(v)
                if a.szi > 0:
                    gl += v
                    n_gl += 1
                else:
                    gs += v
                    n_gs += 1
            positions.append(a)
        oi = self.oi_usd if (self.oi_ts and now - self.oi_ts < 300) else None
        cov = {
            "long_all": all_l / oi if oi else None, "short_all": all_s / oi if oi else None,
            "long_whale": wl / oi if oi else None, "short_whale": ws / oi if oi else None,
            "gross_all": (all_l + all_s) / (2 * oi) if oi else None,
        }
        g_gross = gl + gs
        giant_vals.sort(reverse=True)
        giant = dict(long=gl, short=gs, net=gl - gs, gross=g_gross,
                     bias=(gl - gs) / g_gross * 100 if g_gross > 0 else None,
                     n_long=n_gl, n_short=n_gs, n=n_gl + n_gs,
                     top1=sum(giant_vals[:1]) / g_gross if g_gross else None,
                     top3=sum(giant_vals[:3]) / g_gross if g_gross else None)
        return dict(whale_long=wl, whale_short=ws, whale_net=wl - ws, n_wl=n_wl, n_ws=n_ws,
                    all_long=all_l, all_short=all_s, oi=oi, cov=cov, positions=positions, giant=giant)

    def sample(self, ref_px=None):
        """Échantillon : stock + flux accumulé depuis l'échantillon précédent (whales et giants, même ts)."""
        now = time.time()
        with self.lock:
            st = self._stock(now)
            row = (now, self.px or ref_px, st["whale_long"], st["whale_short"], st["whale_net"],
                   self.acc_net, self.acc_long, self.acc_short, st["n_wl"], st["n_ws"],
                   st["cov"]["long_all"], st["cov"]["short_all"], st["oi"],
                   st["cov"]["long_whale"], st["cov"]["short_whale"])
            self.acc_net = self.acc_long = self.acc_short = 0.0
            self.history.append(row)
            g = st["giant"]
            self.giant_history.append((now, self.px or ref_px, g["long"], g["short"], g["net"], g["bias"],
                                       g["n_long"], g["n_short"], self.g_acc_net, self.g_acc_long, self.g_acc_short))
            self.g_acc_net = self.g_acc_long = self.g_acc_short = 0.0
            self.last_sample = now
            return row

    def status(self):
        """État publié : couverture, file, âge des relevés, plus grosses positions."""
        now = time.time()
        with self.lock:
            st = self._stock(now)
            px = self.px
            rows = []
            for a in st["positions"]:
                v = abs(a.szi) * px if px else a.value
                if v >= Cfg.whale_min_position_usd:
                    rows.append((v, a))
            ages = [now - a.last_checked for _, a in rows if a.last_checked]
            rows.sort(key=lambda r: -r[0])
            top = [{
                "address": a.address, "szi": a.szi, "value": v, "entry": a.entry_px, "liq": a.liq_px,
                "lev": a.leverage, "upnl": a.upnl,
                "age_s": round(now - a.last_checked) if a.last_checked else None,
            } for v, a in rows[:Cfg.top_positions]]
            while self.recon_abs and self.recon_abs[0][0] < now - 3600:
                self.recon_abs.popleft()
            g = st["giant"]
            return {
                "px": px, "oi": st["oi"], "coverage": st["cov"],
                "whales": {"long": st["whale_long"], "short": st["whale_short"], "n_long": st["n_wl"], "n_short": st["n_ws"]},
                "giants": {"long": g["long"], "short": g["short"], "n_long": g["n_long"], "n_short": g["n_short"],
                           "top1": g["top1"], "top3": g["top3"]},
                "known": len(self.accounts),
                "inspected": sum(1 for a in self.accounts.values() if a.last_checked is not None),
                "positions": len(self.pos_set),
                "queue": dict(self.queue_stats),
                "median_age_s": statistics.median(ages) if ages else None,
                "oi_age_s": (now - self.oi_ts) if self.oi_ts else None,
                "recon_1h": sum(x for _, x in self.recon_abs),
                "anomalies": [t for ts, t in self.anomalies if ts >= now - 3600][-5:],
                "ws_connected": self.ws_connected,
                "top": top,
            }

    def purge_memory(self):
        now = time.time()
        with self.lock:
            dead = [addr for addr, a in self.accounts.items()
                    if not a.has_pos and a.max_value < Cfg.whale_min_position_usd and not a.inflight
                    and "leaderboard" not in a.sources and not a.dirty
                    and (a.last_seen or a.first_seen) < now - Cfg.hl_mem_purge_days * 86400]
            for addr in dead:
                del self.accounts[addr]
            return len(dead)


# =============================================================================
# ÉTAT D'UN ACTIF (barres CEX par minute, flux, traqueur HL)
# =============================================================================
class CoinState:
    def __init__(self, coin):
        self.cfg = CoinCfg(coin)
        self.coin = coin
        self.lock = threading.Lock()
        self.bars = {}
        self.last_price = None
        self.status = {k: "en attente" for k in VENUES}
        self.feed = {v: {"n": 0, "last": None} for v in VENUES}
        self.venue_px = {}
        self.price_src = "—"
        self.hl = HLTracker(coin)

    def set_status(self, name, txt):
        with self.lock:
            self.status[name] = txt

    def _bar(self, minute):
        b = self.bars.get(minute)
        if b is None:
            n = len(Cfg.buckets)
            b = {"px": self.last_price, "delta": [0.0] * n, "vol": [0.0] * n,
                 "liq_long": defaultdict(float), "liq_short": defaultdict(float)}
            self.bars[minute] = b
            cutoff = minute - Cfg.history_min * 60
            for k in [k for k in self.bars if k < cutoff]:
                del self.bars[k]
        return b

    def _touch(self, venue, px):
        now = time.time()
        f = self.feed.setdefault(venue, {"n": 0, "last": None})
        f["n"] += 1
        f["last"] = now
        self.venue_px[venue] = (px, now)
        bn = self.venue_px.get("Binance")
        if bn and now - bn[1] < 10:
            self.last_price, self.price_src = bn[0], "Binance"
        else:
            self.last_price, self.price_src = px, venue

    def add_order(self, venue, ts_ms, side, usd, px):
        """Ordre agresseur reconstitué (side +1 achat taker, −1 vente). Seuls les CEX font le CVD."""
        with self.lock:
            self._touch(venue, px)
            if venue in CEX_VENUES:
                i = bucket_index(usd)
                b = self._bar(minute_of(ts_ms))
                b["px"] = self.last_price
                b["delta"][i] += side * usd
                b["vol"][i] += usd

    def add_liq(self, venue, ts_ms, pos_side, usd, px):
        """pos_side = côté de la POSITION liquidée ('long' ou 'short')."""
        with self.lock:
            f = self.feed.setdefault(venue, {"n": 0, "last": None})
            f["n"] += 1
            f["last"] = time.time()
            b = self._bar(minute_of(ts_ms))
            (b["liq_long"] if pos_side == "long" else b["liq_short"])[venue] += usd

    def bars_since(self, since_minute, until_minute):
        """Minutes [since, until[ : (minute, px, delta, vol, liq_long, liq_short)."""
        with self.lock:
            return [(k, b["px"], list(b["delta"]), list(b["vol"]), sum(b["liq_long"].values()), sum(b["liq_short"].values()))
                    for k, b in sorted(self.bars.items()) if since_minute <= k < until_minute]


class Hub:
    """Actifs suivis + ressources Hyperliquid partagées (limiteur de poids, état REST)."""

    def __init__(self, coins, budget):
        self.coins = {c: CoinState(c) for c in coins}
        self.limiter = WeightLimiter(budget)
        self.rest_status = "en attente"
        self.publish_status = "en attente"
        self.started = time.time()


# =============================================================================
# SQLITE : une base par actif, même schéma que whale_dashboard.py (whale_BTC.db réutilisable)
# =============================================================================
ACCT_COLS = ["address", "first_seen", "last_seen", "last_checked", "observed_volume", "trade_count", "max_trade",
             "priority_score", "has_btc_position", "btc_szi", "btc_value", "entry_px", "liq_px", "leverage", "upnl",
             "account_value", "last_position_update", "tier", "is_whale", "sources", "max_value"]
GIANT_COLS = ["ts", "btc_price", "giant_long", "giant_short", "giant_net", "giant_net_bias_pct",
              "n_giant_long", "n_giant_short", "giant_net_change", "giant_long_change", "giant_short_change"]
HIST_COLS = ["ts", "price", "whale_long", "whale_short", "whale_net", "position_change", "change_long",
             "change_short", "n_whales_long", "n_whales_short", "coverage_long", "coverage_short",
             "open_interest", "coverage_whale_long", "coverage_whale_short"]


class Store:
    def __init__(self, path):
        self.path = path
        self.con = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        with self.lock:
            self.con.execute("PRAGMA journal_mode=WAL")
            self.con.executescript("""
                CREATE TABLE IF NOT EXISTS bars (minute INTEGER PRIMARY KEY, px REAL, delta TEXT, vol TEXT,
                                                 liq_long REAL, liq_short REAL);
                CREATE TABLE IF NOT EXISTS hl_accounts (
                    address TEXT PRIMARY KEY, first_seen REAL, last_seen REAL, last_checked REAL,
                    observed_volume REAL, trade_count INTEGER, max_trade REAL, priority_score REAL,
                    has_btc_position INTEGER, btc_szi REAL, btc_value REAL, entry_px REAL, liq_px REAL,
                    leverage REAL, upnl REAL, account_value REAL, last_position_update REAL,
                    tier TEXT, is_whale INTEGER, sources TEXT, max_value REAL);
                CREATE TABLE IF NOT EXISTS hl_giant_hist (
                    ts REAL PRIMARY KEY, btc_price REAL, giant_long REAL, giant_short REAL, giant_net REAL,
                    giant_net_bias_pct REAL, n_giant_long INTEGER, n_giant_short INTEGER,
                    giant_net_change REAL, giant_long_change REAL, giant_short_change REAL);
                CREATE TABLE IF NOT EXISTS hl_hist (
                    ts REAL PRIMARY KEY, price REAL, whale_long REAL, whale_short REAL, whale_net REAL,
                    position_change REAL, change_long REAL, change_short REAL,
                    n_whales_long INTEGER, n_whales_short INTEGER, coverage_long REAL, coverage_short REAL,
                    open_interest REAL, coverage_whale_long REAL, coverage_whale_short REAL);
                CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value REAL);
            """)
            self.con.commit()

    def get_meta(self, key):
        with self.lock:
            r = self.con.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return r[0] if r else None

    def set_meta(self, key, value):
        with self.lock:
            self.con.execute("INSERT OR REPLACE INTO meta VALUES (?, ?)", (key, value))
            self.con.commit()

    def load(self, cs):
        cutoff = time.time() - Cfg.history_min * 60
        n = len(Cfg.buckets)
        hl = cs.hl
        with self.lock:
            rows = self.con.execute("SELECT * FROM bars WHERE minute >= ? ORDER BY minute", (cutoff,)).fetchall()
            accts = self.con.execute(f"SELECT {','.join(ACCT_COLS)} FROM hl_accounts").fetchall()
            hist = self.con.execute(f"SELECT {','.join(HIST_COLS)} FROM hl_hist WHERE ts >= ? ORDER BY ts", (cutoff,)).fetchall()
            ghist = self.con.execute(f"SELECT {','.join(GIANT_COLS)} FROM hl_giant_hist WHERE ts >= ? ORDER BY ts", (cutoff,)).fetchall()
            legacy = []
            if self.con.execute("SELECT name FROM sqlite_master WHERE name='hl_addr'").fetchone():
                legacy = [r[0] for r in self.con.execute("SELECT addr FROM hl_addr").fetchall()]
        with cs.lock:
            for minute, px, delta, vol, ll, ls in rows:
                d, v = json.loads(delta), json.loads(vol)
                if len(d) != n:
                    continue
                cs.bars[minute] = {"px": px, "delta": d, "vol": v,
                                   "liq_long": defaultdict(float, {"hist": ll or 0.0}),
                                   "liq_short": defaultdict(float, {"hist": ls or 0.0})}
                if px:
                    cs.last_price = px
        now = time.time()
        with hl.lock:
            for r in accts:
                rec = dict(zip(ACCT_COLS, r))
                a = Acct(rec["address"].lower(), rec["first_seen"] or now)
                a.last_seen, a.last_checked = rec["last_seen"], rec["last_checked"]
                a.observed_volume = rec["observed_volume"] or 0.0
                a.trade_count = rec["trade_count"] or 0
                a.max_trade = rec["max_trade"] or 0.0
                a.priority = rec["priority_score"] or 0.0
                a.has_pos = bool(rec["has_btc_position"])
                a.szi = rec["btc_szi"] or 0.0
                a.value = rec["btc_value"] or 0.0
                a.entry_px, a.liq_px, a.leverage = rec["entry_px"], rec["liq_px"], rec["leverage"]
                a.upnl, a.account_value = rec["upnl"], rec["account_value"]
                a.last_position_update = rec["last_position_update"]
                a.tier = rec["tier"] or CANDIDATE
                a.is_whale = bool(rec["is_whale"])
                a.sources = set((rec["sources"] or "").split(",")) - {""}
                a.max_value = rec["max_value"] or 0.0
                # Pas d'estimation valide après redémarrage : le premier relevé de la session sert de baseline.
                if a.has_pos:
                    a.next_due = now
                    hl.pos_set.add(a.address)
                elif a.last_checked:
                    a.next_due = a.last_checked + (Cfg.hl_cold_active_s if a.observed_volume >= 1e6 else Cfg.hl_cold_s)
                a.dirty = False
                hl.accounts[a.address] = a
            for r in ghist:
                hl.giant_history.append(tuple(r))
            for r in hist:
                hl.history.append(tuple(r))
        for addr in legacy:
            hl.add_hl_candidate(addr, 0.0, "legacy")
        return len(rows), len(accts), len(hist), len(legacy)

    def save(self, cs, since_minute):
        hl = cs.hl
        with cs.lock:
            bars = [(k, b["px"], json.dumps(b["delta"]), json.dumps(b["vol"]),
                     sum(b["liq_long"].values()), sum(b["liq_short"].values()))
                    for k, b in cs.bars.items() if k >= since_minute]
        with hl.lock:
            dirty = [a for a in hl.accounts.values() if a.dirty]
            acct_rows = [(a.address, a.first_seen, a.last_seen, a.last_checked, a.observed_volume, a.trade_count,
                          a.max_trade, a.priority, int(a.has_pos), a.szi, a.value, a.entry_px, a.liq_px, a.leverage,
                          a.upnl, a.account_value, a.last_position_update, a.tier, int(a.is_whale),
                          ",".join(sorted(a.sources)), a.max_value) for a in dirty]
            for a in dirty:
                a.dirty = False
            hist = [h for h in hl.history if h[0] >= since_minute]
            ghist = [h for h in hl.giant_history if h[0] >= since_minute]
        ph = ",".join("?" * len(ACCT_COLS))
        with self.lock:
            self.con.executemany("INSERT OR REPLACE INTO bars VALUES (?,?,?,?,?,?)", bars)
            self.con.executemany(f"INSERT OR REPLACE INTO hl_accounts ({','.join(ACCT_COLS)}) VALUES ({ph})", acct_rows)
            self.con.executemany(f"INSERT OR REPLACE INTO hl_hist ({','.join(HIST_COLS)}) VALUES ({','.join('?' * len(HIST_COLS))})", hist)
            self.con.executemany(f"INSERT OR REPLACE INTO hl_giant_hist ({','.join(GIANT_COLS)}) VALUES ({','.join('?' * len(GIANT_COLS))})", ghist)
            old = time.time() - Cfg.db_keep_days * 86400
            self.con.execute("DELETE FROM bars WHERE minute < ?", (old,))
            self.con.execute("DELETE FROM hl_hist WHERE ts < ?", (old,))
            self.con.execute("DELETE FROM hl_giant_hist WHERE ts < ?", (old,))
            self.con.execute("""DELETE FROM hl_accounts WHERE COALESCE(max_value,0) = 0 AND has_btc_position = 0
                                AND COALESCE(last_seen, first_seen) < ? AND COALESCE(observed_volume,0) < 10000
                                AND sources NOT LIKE '%leaderboard%'""",
                             (time.time() - Cfg.hl_db_purge_days * 86400,))
            self.con.commit()
        return len(acct_rows)


async def persist_loop(hub, stores):
    while True:
        await asyncio.sleep(30)
        for coin, cs in hub.coins.items():
            try:
                await asyncio.to_thread(stores[coin].save, cs, minute_of(time.time() * 1000) - 5 * 60)
            except Exception as e:
                log(f"[{coin}] sauvegarde en erreur : {type(e).__name__} {e}")


# =============================================================================
# RECONSTITUTION DES ORDRES AGRESSEURS
# =============================================================================
class OrderMerger:
    def __init__(self, venue, cs):
        self.venue, self.cs = venue, cs
        self.key, self.usd, self.px, self.ts, self.side = None, 0.0, None, None, 0

    def add(self, ts_ms, side, qty, px, taker=None):
        key = (ts_ms, side, taker)
        if key != self.key:
            self.flush()
            self.key, self.ts, self.side, self.usd = key, ts_ms, side, 0.0
        self.usd += qty * px
        self.px = px

    def flush(self):
        if self.key is not None and self.usd > 0:
            self.cs.add_order(self.venue, self.ts, self.side, self.usd, self.px)
        self.key, self.usd = None, 0.0


# =============================================================================
# WEBSOCKETS (un jeu par actif)
# =============================================================================
async def run_ws(name, url, cs, on_open, on_message, ping_msg=None, ping_every=20, on_close=None):
    backoff = 1
    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=2 ** 24) as ws:
                cs.set_status(name, "connecté")
                backoff = 1
                await on_open(ws)
                last_ping = time.time()
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    except asyncio.TimeoutError:
                        raw = None
                    try:
                        on_message(raw)
                    except Exception as e:
                        cs.set_status(name, f"connecté (msg ignoré : {type(e).__name__})")
                    if ping_msg and time.time() - last_ping > ping_every:
                        await ws.send(ping_msg)
                        last_ping = time.time()
        except Exception as e:
            if on_close:
                on_close()
            cs.set_status(name, f"reconnexion dans {backoff}s ({type(e).__name__})")
            await asyncio.sleep(backoff + random.random())
            backoff = min(backoff * 2, 60)


async def binance_feed(cs):
    merger = OrderMerger("Binance", cs)

    async def on_open(ws):
        pass

    def on_message(raw):
        if raw is None:
            merger.flush()
            return
        d = json.loads(raw).get("data", {})
        e = d.get("e")
        if e == "aggTrade":
            merger.add(int(d["T"]), -1 if d["m"] else 1, float(d["q"]), float(d["p"]))   # m=true → taker VEND
        elif e == "forceOrder":
            o = d["o"]
            px = float(o.get("ap") or o["p"])
            qty = float(o.get("z") or o["q"])
            cs.add_liq("Binance", int(o["T"]), "long" if o["S"] == "SELL" else "short", px * qty, px)

    await run_ws("Binance", cs.cfg.binance_ws, cs, on_open, on_message)


async def bybit_feed(cs):
    merger = OrderMerger("Bybit", cs)

    async def on_open(ws):
        await ws.send(json.dumps({"op": "subscribe",
                                  "args": [f"publicTrade.{cs.cfg.bybit_symbol}", f"allLiquidation.{cs.cfg.bybit_symbol}"]}))

    def on_message(raw):
        if raw is None:
            merger.flush()
            return
        msg = json.loads(raw)
        topic = msg.get("topic", "")
        if topic.startswith("publicTrade"):
            for t in msg.get("data", []):
                merger.add(int(t["T"]), 1 if t["S"] == "Buy" else -1, float(t["v"]), float(t["p"]))
        elif topic.startswith("allLiquidation"):
            for l in msg.get("data", []):
                px, qty = float(l["p"]), float(l["v"])
                # Doc Bybit : S = "Buy" → une position LONG a été liquidée
                cs.add_liq("Bybit", int(l["T"]), "long" if l["S"] == "Buy" else "short", px * qty, px)

    await run_ws("Bybit", Cfg.bybit_ws, cs, on_open, on_message, ping_msg=json.dumps({"op": "ping"}), ping_every=20)


async def okx_feed(cs):
    merger = OrderMerger("OKX", cs)

    async def on_open(ws):
        await ws.send(json.dumps({"op": "subscribe", "args": [
            {"channel": "trades", "instId": cs.cfg.okx_inst},
            {"channel": "liquidation-orders", "instType": "SWAP"},
        ]}))

    def on_message(raw):
        if raw is None:
            merger.flush()
            return
        if raw == "pong":
            return
        msg = json.loads(raw)
        ch = msg.get("arg", {}).get("channel")
        if ch == "trades":
            for t in msg.get("data", []):
                merger.add(int(t["ts"]), 1 if t["side"] == "buy" else -1, float(t["sz"]) * cs.cfg.okx_ctval, float(t["px"]))
        elif ch == "liquidation-orders":
            for item in msg.get("data", []):
                if item.get("instId") != cs.cfg.okx_inst:
                    continue
                for dt in item.get("details", []):
                    px = float(dt["bkPx"])
                    qty = float(dt["sz"]) * cs.cfg.okx_ctval
                    ps = dt.get("posSide", "")
                    if ps not in ("long", "short"):
                        ps = "long" if dt.get("side") == "sell" else "short"
                    cs.add_liq("OKX", int(dt["ts"]), ps, px * qty, px)

    await run_ws("OKX", Cfg.okx_ws, cs, on_open, on_message, ping_msg="ping", ping_every=25)


async def hyperliquid_feed(cs):
    """Flux public `trades` : découverte des adresses (acheteur ET vendeur) + estimation incrémentale."""
    merger = OrderMerger("Hyperliquid", cs)
    hl = cs.hl

    async def on_open(ws):
        hl.new_epoch()
        await ws.send(json.dumps({"method": "subscribe", "subscription": {"type": "trades", "coin": cs.coin}}))

    def on_close():
        with hl.lock:
            hl.ws_connected = False

    def on_message(raw):
        if raw is None:
            merger.flush()
            return
        msg = json.loads(raw)
        if msg.get("channel") != "trades":
            return
        for t in msg.get("data", []):
            if not hl.on_trade(t):
                continue
            px, sz = float(t["px"]), float(t["sz"])
            side = 1 if t["side"] == "B" else -1
            users = t.get("users") or [None, None]
            taker = users[0] if side == 1 else users[1]
            merger.add(int(t["time"]), side, sz, px, taker)

    await run_ws("Hyperliquid", Cfg.hl_ws, cs, on_open, on_message,
                 ping_msg=json.dumps({"method": "ping"}), ping_every=45, on_close=on_close)


# =============================================================================
# HYPERLIQUID REST : client limité (partagé), scheduler commun, OI, liquidations, échantillons
# =============================================================================
class HLClient:
    def __init__(self, session, hub):
        self.session, self.hub = session, hub
        self.sem = asyncio.Semaphore(Cfg.hl_concurrency)
        self.errors = 0

    async def post(self, payload, weight, extra_per=None):
        lim = self.hub.limiter
        for attempt in range(4):
            await lim.acquire(weight)
            try:
                async with self.sem:
                    async with self.session.post(Cfg.hl_info, json=payload,
                                                 timeout=aiohttp.ClientTimeout(total=12)) as r:
                        if r.status == 429:
                            lim.penalize(10 * (attempt + 1) + random.random() * 5)
                            continue
                        if r.status >= 500:
                            await asyncio.sleep(2 ** attempt + random.random())
                            continue
                        if r.status != 200:
                            self.errors += 1
                            return None
                        data = await r.json(content_type=None)
                        if extra_per and isinstance(data, list):
                            lim.charge(len(data) // extra_per)
                        return data
            except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError):
                self.errors += 1
                await asyncio.sleep(2 ** attempt + random.random())
        return None


async def hl_seed(hub, session):
    """Leaderboard (NON officiel, facultatif) : candidats à forte priorité, pour chaque actif."""
    try:
        async with session.get(Cfg.hl_leaderboard, timeout=aiohttp.ClientTimeout(total=60)) as r:
            data = await r.json(content_type=None)
        rows = data.get("leaderboardRows", [])

        def week_vlm(row):
            for w, perf in row.get("windowPerformances", []):
                if w == "week":
                    return float((perf or {}).get("vlm") or 0)
            return 0.0

        half = Cfg.hl_seed_top // 2
        by_cap = sorted(rows, key=lambda x: -float(x.get("accountValue") or 0))[:half]
        by_vol = sorted(rows, key=lambda x: -week_vlm(x))[:half]
        seeds = list(dict.fromkeys(r["ethAddress"] for r in by_cap + by_vol if r.get("ethAddress")))
        for cs in hub.coins.values():
            for a in seeds:
                cs.hl.add_hl_candidate(a, 0.0, "leaderboard")
        log(f"leaderboard : {len(seeds)} candidats importés")
    except Exception as e:
        log(f"leaderboard indisponible ({type(e).__name__}) : découverte via trades")


async def hl_oi_loop(hub, client):
    """Un seul appel metaAndAssetCtxs (poids 20) pour tous les actifs."""
    while True:
        data = await client.post({"type": "metaAndAssetCtxs"}, 20)
        try:
            meta, ctxs = data
            for asset, c in zip(meta["universe"], ctxs):
                cs = hub.coins.get(asset.get("name"))
                if cs:
                    mark = float(c.get("markPx") or c.get("oraclePx"))
                    cs.hl.set_oi(float(c["openInterest"]), mark)
        except Exception:
            pass
        await asyncio.sleep(60)


async def hl_inspect(hub, client, address, pickers):
    """Un relevé clearinghouseState (poids 2) appliqué à TOUS les actifs : une adresse suivie pour BTC
    a aussi sa position ETH relevée, sans coût supplémentaire."""
    req_ts = time.time()
    try:
        data = await client.post({"type": "clearinghouseState", "user": address}, 2)
        if isinstance(data, dict):
            for cs in hub.coins.values():
                cs.hl.apply_snapshot(address, data, req_ts, cs.last_price)
            return
    except Exception:
        pass
    for cs in pickers:
        cs.hl.mark_failed(address)


def pick_shared(hub, n):
    """Lot commun : chaque actif propose sa part (HOT d'abord), puis les places libres reviennent
    aux autres. Une adresse proposée par plusieurs actifs n'est relevée qu'une fois."""
    coins = list(hub.coins.values())
    picked, who = [], defaultdict(list)
    share = max(1, n // len(coins))
    for rnd in range(2):
        for cs in coins:
            room = n - len(picked)
            if room <= 0:
                break
            take = min(room, share) if rnd == 0 else room
            for a in cs.hl.pick_batch(take, exclude=set(picked)):
                picked.append(a)
                who[a].append(cs)
    return [(a, who[a]) for a in picked]


async def hl_scheduler(hub, client):
    """Distribue le budget REST : HOT > WARM > CANDIDATE > COLD, sans jamais dépasser le plafond."""
    while True:
        avail = hub.limiter.available()
        n = int(min(20, max(0, (avail - 60) // 2)))        # garde 60 de poids pour OI + liquidations
        batch = pick_shared(hub, n) if n > 0 else []
        if not batch:
            await asyncio.sleep(2)
            continue
        await asyncio.gather(*(hl_inspect(hub, client, a, pickers) for a, pickers in batch))


async def hl_liq_loop(hub, client):
    """Liquidations HL : fills portant le champ officiel `liquidation` (adresses suivies)."""
    seen = set()
    coins = list(hub.coins.values())
    turn = 0
    while True:
        await asyncio.sleep(60 / Cfg.hl_liq_checks_per_min)
        item = None
        for k in range(len(coins)):
            cs = coins[(turn + k) % len(coins)]
            with cs.hl.lock:
                if cs.hl.liq_queue:
                    item = cs.hl.liq_queue.popleft()
                    break
        turn += 1
        if not item:
            continue
        addr, since = item
        fills = await client.post({"type": "userFillsByTime", "user": addr, "startTime": since,
                                   "aggregateByTime": False}, 20, extra_per=20)
        for f in fills if isinstance(fills, list) else []:
            liq = f.get("liquidation")
            target = hub.coins.get(f.get("coin"))
            if not liq or not target:
                continue
            lu = (liq.get("liquidatedUser") or addr).lower()
            if lu != addr:
                continue
            key = (f.get("time"), f.get("tid"))
            if key in seen:
                continue
            seen.add(key)
            px, sz = float(f["px"]), float(f["sz"])
            target.add_liq("Hyperliquid", int(f["time"]), "long" if f.get("side") == "A" else "short", px * sz, px)
        if len(seen) > 50_000:
            seen.clear()


async def hl_sampler_loop(hub):
    while True:
        await asyncio.sleep(Cfg.hl_sample_s)
        for cs in hub.coins.values():
            cs.hl.sample(cs.last_price)
        hub.rest_status = f"{hub.limiter.used():.0f}/{hub.limiter.per_min} poids/min · 429 : {hub.limiter.n429}"


async def hl_housekeeping(hub):
    while True:
        await asyncio.sleep(3600)
        for cs in hub.coins.values():
            cs.hl.purge_memory()


async def okx_fetch_ctval(session, cs):
    try:
        async with session.get(cs.cfg.okx_instruments, timeout=aiohttp.ClientTimeout(total=10)) as r:
            d = await r.json(content_type=None)
        cs.cfg.okx_ctval = float(d["data"][0]["ctVal"])
    except Exception:
        pass


# =============================================================================
# PUBLICATION VERS LE SITE
# =============================================================================
RESEND_MIN = 3          # minutes déjà publiées renvoyées (trades arrivés en retard)
MAX_ROWS = 600          # lignes par envoi (rattrapage après une coupure : plusieurs envois)


def _num(x, nd=None):
    if x is None:
        return None
    if isinstance(x, float) and not math.isfinite(x):
        return None
    return round(x, nd) if nd is not None else x


def _clean(o):
    """JSON strict : NaN et infinis deviennent null (json.dumps les écrirait tels quels)."""
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def build_payload(hub, cs, since_bar, since_ts, now):
    """Minutes closes depuis since_bar, échantillons whales depuis since_ts, état courant."""
    until = minute_of(now * 1000)                       # la minute en cours n'est pas close
    bars = [{
        "minute": k, "px": _num(px, 2),
        "delta": [_num(x, 2) for x in d], "vol": [_num(x, 2) for x in v],
        "liq_long": _num(ll, 2), "liq_short": _num(ls, 2),
    } for k, px, d, v, ll, ls in cs.bars_since(since_bar, until)][:MAX_ROWS]
    with cs.hl.lock:
        hist = [h for h in cs.hl.history if h[0] > since_ts]
        ghist = {round(g[0], 3): g for g in cs.hl.giant_history if g[0] > since_ts}
    whales = []
    for h in hist[:MAX_ROWS]:
        g = ghist.get(round(h[0], 3))
        whales.append({
            "ts": round(h[0], 3), "px": _num(h[1], 2),
            "whale_long": _num(h[2], 0), "whale_short": _num(h[3], 0),
            "chg_net": _num(h[5], 0), "chg_long": _num(h[6], 0), "chg_short": _num(h[7], 0),
            "n_long": h[8], "n_short": h[9],
            "cov_long": _num(h[10], 5), "cov_short": _num(h[11], 5), "oi": _num(h[12], 0),
            "giant_long": _num(g[2], 0) if g else None, "giant_short": _num(g[3], 0) if g else None,
            "giant_n_long": g[6] if g else None, "giant_n_short": g[7] if g else None,
            "giant_chg_net": _num(g[8], 0) if g else None, "giant_chg_long": _num(g[9], 0) if g else None,
            "giant_chg_short": _num(g[10], 0) if g else None,
        })
    st = cs.hl.status()
    with cs.lock:
        feeds = {v: {"n": f["n"], "age_s": round(now - f["last"]) if f["last"] else None, "status": cs.status.get(v)}
                 for v, f in cs.feed.items()}
        price, src = cs.last_price, cs.price_src
    status = {
        "price": _num(price, 2), "price_src": src, "feeds": feeds, "hl": st, "hl_rest": hub.rest_status,
        "uptime_s": round(now - hub.started), "first_bar": min(cs.bars) if cs.bars else None,
    }
    return _clean({"coin": cs.coin, "sent_at": round(now, 3), "bars": bars, "whales": whales, "status": status})


async def publish_loop(hub, stores, session, dry_run):
    if not dry_run and not Env.ingest_token:
        log("FLOW_INGEST_TOKEN absent : rien n'est publié (le collecteur tourne quand même).")
    while True:
        await asyncio.sleep(Env.publish_s)
        now = time.time()
        for coin, cs in hub.coins.items():
            store = stores[coin]
            since_bar = store.get_meta("published_bar")
            since_bar = (since_bar - RESEND_MIN * 60) if since_bar else now - Cfg.history_min * 60
            since_ts = store.get_meta("published_ts") or 0.0
            payload = build_payload(hub, cs, since_bar, since_ts, now)
            last_bar = payload["bars"][-1]["minute"] if payload["bars"] else None
            last_ts = payload["whales"][-1]["ts"] if payload["whales"] else None
            if dry_run:
                hub.publish_status = f"dry-run {coin} : {len(payload['bars'])} min, {len(payload['whales'])} échantillons"
                log(hub.publish_status)
            elif Env.ingest_token:
                try:
                    async with session.post(Env.ingest_url, json=payload, headers={"Authorization": f"Bearer {Env.ingest_token}"},
                                            timeout=aiohttp.ClientTimeout(total=20)) as r:
                        if r.status != 200:
                            body = (await r.text())[:200]
                            hub.publish_status = f"{coin} : HTTP {r.status} {body}"
                            log(f"publication refusée : {hub.publish_status}")
                            continue
                    hub.publish_status = f"ok {time.strftime('%H:%M:%S')}"
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    hub.publish_status = f"{coin} : {type(e).__name__}"
                    log(f"publication en échec : {hub.publish_status}")
                    continue
            else:
                continue
            if last_bar is not None:
                store.set_meta("published_bar", max(last_bar, since_bar + RESEND_MIN * 60))
            if last_ts is not None:
                store.set_meta("published_ts", last_ts)
        try:
            with open(os.path.join(Env.data_dir, "heartbeat"), "w") as f:
                f.write(str(int(now)))
        except OSError:
            pass


async def report_loop(hub):
    """Une ligne d'état par actif toutes les 5 minutes (journal docker)."""
    while True:
        await asyncio.sleep(float(os.environ.get("FLOW_REPORT_S", "300")))
        for coin, cs in hub.coins.items():
            st = cs.hl.status()
            cov = st["coverage"]["gross_all"]
            feeds = " ".join(f"{v}:{cs.feed[v]['n']}" for v in VENUES)
            log(f"[{coin}] prix {cs.last_price} · couverture {cov:.0%} · whales {st['whales']['n_long']}L/{st['whales']['n_short']}S"
                if cov is not None else f"[{coin}] prix {cs.last_price} · couverture n/d", f"· inspectés {st['inspected']}/{st['known']}",
                f"· trades {feeds} · REST {hub.rest_status} · publication {hub.publish_status}")


# =============================================================================
# ORCHESTRATION (chaque tâche est isolée : une API en panne ne tue pas le programme)
# =============================================================================
async def guarded(name, coro_fn, *args):
    while True:
        try:
            await coro_fn(*args)
            return
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log(f"{name} : erreur {type(e).__name__} {e}, redémarrage dans 10 s")
            await asyncio.sleep(10)


def _quiet_exception_handler(loop, context):
    exc = context.get("exception")
    msg = context.get("message", "")
    if "connection_lost" in msg or isinstance(exc, (ConnectionError, AttributeError)) and "connection" in msg.lower():
        return
    loop.default_exception_handler(context)


async def main_async(dry_run):
    loop = asyncio.get_running_loop()
    loop.set_exception_handler(_quiet_exception_handler)
    stop = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:
            pass
    os.makedirs(Env.data_dir, exist_ok=True)
    hub = Hub(Env.coins, Env.hl_budget)
    stores = {}
    for coin, cs in hub.coins.items():
        stores[coin] = Store(os.path.join(Env.data_dir, f"whale_{coin}.db"))
        nb, na, nh, nl = stores[coin].load(cs)
        log(f"[{coin}] base locale : {nb} minutes, {na} comptes, {nh} échantillons" + (f", {nl} adresses héritées" if nl else ""))
    log(f"collecteur : {', '.join(Env.coins)} · budget Hyperliquid {Env.hl_budget}/min · "
        f"publication {'dry-run' if dry_run else Env.ingest_url}")
    async with aiohttp.ClientSession(headers={"User-Agent": "smp-market-flow/1.0"}) as session:
        client = HLClient(session, hub)
        tasks = [asyncio.create_task(guarded("leaderboard", hl_seed, hub, session))]
        for coin, cs in hub.coins.items():
            await okx_fetch_ctval(session, cs)
            for name, fn in (("Binance", binance_feed), ("Bybit", bybit_feed), ("OKX", okx_feed), ("Hyperliquid", hyperliquid_feed)):
                tasks.append(asyncio.create_task(guarded(f"{coin} {name}", fn, cs)))
        for name, fn, args in (("HL scheduler", hl_scheduler, (hub, client)), ("HL OI", hl_oi_loop, (hub, client)),
                               ("HL liquidations", hl_liq_loop, (hub, client)), ("HL échantillons", hl_sampler_loop, (hub,)),
                               ("HL ménage", hl_housekeeping, (hub,)), ("sauvegarde", persist_loop, (hub, stores)),
                               ("publication", publish_loop, (hub, stores, session, dry_run)), ("rapport", report_loop, (hub,))):
            tasks.append(asyncio.create_task(guarded(name, fn, *args)))
        await stop.wait()
        log("arrêt demandé : sauvegarde finale")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    for coin, cs in hub.coins.items():
        stores[coin].save(cs, 0)
    log("arrêté")


def main():
    ap = argparse.ArgumentParser(description="Market Flow : collecteur CVD + whales (BTC, ETH)")
    ap.add_argument("--dry-run", action="store_true", help="ne publie rien, résume les envois dans le journal")
    args = ap.parse_args()
    asyncio.run(main_async(args.dry_run))


if __name__ == "__main__":
    main()
