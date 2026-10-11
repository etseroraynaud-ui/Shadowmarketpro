# Tests du collecteur Market Flow (sans réseau) : python -m unittest flow/test_collector.py
#
# FLOW_TEST_DB=/chemin/whale_BTC.db ajoute un test de chargement d'une base du dashboard local.

import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import collector as C  # noqa: E402


def snap(t_ms, **positions):
    """clearinghouseState minimal : positions {coin: szi}."""
    return {"time": t_ms, "marginSummary": {"accountValue": "1000000"},
            "assetPositions": [{"position": {"coin": c, "szi": str(s), "positionValue": str(abs(s) * PX[c]),
                                             "entryPx": str(PX[c]), "liquidationPx": None,
                                             "leverage": {"type": "cross", "value": 5}, "unrealizedPnl": "0"}}
                               for c, s in positions.items()]}


PX = {"BTC": 100_000.0, "ETH": 4_000.0}


class MultiCoin(unittest.TestCase):
    def setUp(self):
        self.hub = C.Hub(["BTC", "ETH"], 600)
        for c, cs in self.hub.coins.items():
            cs.hl.px = PX[c]
            cs.last_price = PX[c]

    def test_one_snapshot_feeds_both_coins(self):
        now = time.time()
        addr = "0x" + "a" * 40
        for cs in self.hub.coins.values():
            cs.hl.apply_snapshot(addr, snap(int(now * 1000), BTC=10, ETH=-300), now, cs.last_price)
        btc, eth = self.hub.coins["BTC"].hl, self.hub.coins["ETH"].hl
        self.assertEqual(btc.accounts[addr].szi, 10)
        self.assertEqual(eth.accounts[addr].szi, -300)
        self.assertTrue(btc.accounts[addr].is_whale)           # 1 M$
        self.assertTrue(eth.accounts[addr].is_whale)           # 1,2 M$
        # Premier relevé = baseline : jamais compté comme flux
        self.assertEqual(btc.acc_net, 0.0)
        self.assertEqual(eth.acc_net, 0.0)
        # Deuxième relevé : l'écart devient du flux, sur chaque actif séparément
        later = now + 1
        for cs in self.hub.coins.values():
            cs.hl.apply_snapshot(addr, snap(int(later * 1000), BTC=12, ETH=-300), later, cs.last_price)
        self.assertAlmostEqual(btc.acc_net, 2 * PX["BTC"])
        self.assertAlmostEqual(btc.acc_long, 2 * PX["BTC"])
        self.assertEqual(eth.acc_net, 0.0)

    def test_trades_update_position_between_snapshots(self):
        now = time.time()
        addr, other = "0x" + "b" * 40, "0x" + "c" * 40
        hl = self.hub.coins["BTC"].hl
        hl.new_epoch()
        hl.apply_snapshot(addr, snap(int(now * 1000), BTC=-10), now, PX["BTC"])
        hl.on_trade({"coin": "BTC", "side": "B", "px": str(PX["BTC"]), "sz": "4", "time": int(now * 1000) + 10,
                     "tid": 1, "users": [addr, other]})
        self.assertAlmostEqual(hl.accounts[addr].szi, -6)          # short −10 + achat 4
        self.assertAlmostEqual(hl.acc_short, -4 * PX["BTC"])      # rachat de short
        self.assertFalse(hl.on_trade({"coin": "BTC", "side": "B", "px": "1", "sz": "1", "time": int(now * 1000) + 10,
                                      "tid": 1, "users": [addr, other]}))  # doublon ignoré

    def test_shared_batch_has_no_duplicates(self):
        addrs = ["0x%040x" % i for i in range(30)]
        for cs in self.hub.coins.values():
            for a in addrs:
                cs.hl.add_hl_candidate(a, 0.0, "leaderboard")
        batch = C.pick_shared(self.hub, 20)
        picked = [a for a, _ in batch]
        self.assertEqual(len(picked), 20)
        self.assertEqual(len(set(picked)), 20)
        for a, pickers in batch:
            self.assertTrue(pickers)
            for cs in pickers:
                self.assertTrue(cs.hl.accounts[a].inflight)

    def test_payload_is_strict_json_with_closed_minutes_only(self):
        cs = self.hub.coins["BTC"]
        now = time.time()
        cur = C.minute_of(now * 1000)
        cs.add_order("Binance", (cur - 120) * 1000, 1, 5_000, PX["BTC"])       # retail achat
        cs.add_order("Bybit", (cur - 120) * 1000 + 5, -1, 2_000_000, PX["BTC"])  # méga vente
        cs.add_liq("OKX", (cur - 60) * 1000, "long", 150_000, PX["BTC"])
        cs.add_order("Binance", now * 1000, 1, 50_000, PX["BTC"])               # minute en cours : pas publiée
        cs.hl.anomalies.append((now, "x"))
        cs.hl.sample(PX["BTC"])
        cs.hl.history[-1] = cs.hl.history[-1][:10] + (float("nan"),) + cs.hl.history[-1][11:]
        p = C.build_payload(self.hub, cs, cur - 600, 0.0, now)
        txt = json.dumps(p, allow_nan=False)                                      # lève une erreur si NaN
        self.assertIn('"coin": "BTC"', txt)
        minutes = [b["minute"] for b in p["bars"]]
        self.assertEqual(minutes, [cur - 120, cur - 60])
        self.assertEqual(p["bars"][0]["delta"], [5000.0, 0.0, 0.0, -2000000.0])
        self.assertEqual(p["bars"][1]["liq_long"], 150000.0)
        self.assertEqual(len(p["whales"]), 1)
        self.assertIsNone(p["whales"][0]["cov_long"])
        self.assertEqual(p["whales"][0]["giant_long"], 0)

    def test_store_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            store = C.Store(os.path.join(d, "whale_BTC.db"))
            cs = self.hub.coins["BTC"]
            now = time.time()
            cs.add_order("Binance", (C.minute_of(now * 1000) - 60) * 1000, 1, 20_000, PX["BTC"])
            cs.hl.apply_snapshot("0x" + "d" * 40, snap(int(now * 1000), BTC=20), now, PX["BTC"])
            cs.hl.sample(PX["BTC"])
            store.save(cs, 0)
            store.set_meta("published_bar", 123.0)
            fresh = C.Hub(["BTC"], 600).coins["BTC"]
            nb, na, nh, _ = C.Store(os.path.join(d, "whale_BTC.db")).load(fresh)
            self.assertEqual((nb, na, nh), (1, 1, 1))
            self.assertEqual(fresh.hl.accounts["0x" + "d" * 40].szi, 20)
            self.assertFalse(fresh.hl.accounts["0x" + "d" * 40].baseline_session)   # pas de faux flux au redémarrage
            self.assertEqual(store.get_meta("published_bar"), 123.0)


class Spot(unittest.TestCase):
    def test_coinbase_side_is_the_maker_side(self):
        base = {"type": "match", "taker_order_id": "t1", "size": "0.5", "price": "100000", "time": "2026-10-11T17:23:31.667123Z"}
        ts, side, qty, px, key = C.parse_coinbase_match({**base, "side": "sell"})   # maker vendeur → agresseur acheteur
        self.assertEqual((side, qty, px), (1, 0.5, 100000.0))
        self.assertEqual(ts, 1791739411667)
        self.assertEqual(C.parse_coinbase_match({**base, "side": "buy"})[1], -1)
        self.assertIsNone(C.parse_coinbase_match({**base, "type": "last_match", "side": "sell"}))
        self.assertIsNone(C.parse_coinbase_match({"type": "subscriptions"}))
        # Les fills d'un même ordre agresseur ont la même clé, quel que soit leur horodatage
        k2 = C.parse_coinbase_match({**base, "side": "sell", "time": "2026-10-11T17:23:31.668000Z"})[4]
        self.assertEqual(key, k2)

    def test_okx_spot_in_coins_swap_in_contracts(self):
        spot = C.parse_okx_trade({"instId": "BTC-USDT", "ts": "1", "side": "sell", "sz": "0.2", "px": "100000"}, "BTC-USDT", 0.01)
        swap = C.parse_okx_trade({"instId": "BTC-USDT-SWAP", "ts": "1", "side": "buy", "sz": "20", "px": "100000"}, "BTC-USDT", 0.01)
        self.assertEqual(spot, (True, 1, -1, 0.2, 100000.0))
        self.assertEqual(swap, (False, 1, 1, 0.2, 100000.0))

    def test_spot_counted_apart_and_null_without_spot(self):
        hub = C.Hub(["BTC"], 600)
        cs = hub.coins["BTC"]
        cs.last_price = 100_000.0
        now = time.time()
        cur = C.minute_of(now * 1000)
        cs.add_order("Bybit", (cur - 120) * 1000, 1, 50_000, 100_000)            # perp seulement
        cs.add_order("Coinbase", (cur - 60) * 1000, -1, 2_000_000, 100_000)       # spot méga vente
        cs.add_order("Binance", (cur - 60) * 1000, 1, 5_000, 100_000)             # perp retail
        m = C.OrderMerger("Coinbase", cs)                                          # un ordre en 2 fills
        m.add((cur - 60) * 1000, 1, 0.1, 100_000, key=("coinbase", "o1", 1))
        m.add((cur - 60) * 1000 + 3, 1, 0.1, 100_000, key=("coinbase", "o1", 1))
        m.flush()
        p = C.build_payload(hub, cs, cur - 600, 0.0, now)
        b0, b1 = p["bars"]
        self.assertEqual(b0["delta"], [0.0, 50000.0, 0.0, 0.0])
        self.assertIsNone(b0["spot_delta"])                                        # pas de flux spot : null, pas 0
        self.assertEqual(b1["delta"], [5000.0, 0.0, 0.0, 0.0])
        self.assertEqual(b1["spot_delta"], [0.0, 20000.0, 0.0, -2000000.0])       # 2 fills recollés en un ordre de 20 k$
        self.assertEqual(b1["spot_vol"], [0.0, 20000.0, 0.0, 2000000.0])
        json.dumps(p, allow_nan=False)

    def test_old_database_gets_spot_columns(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "whale_BTC.db")
            con = sqlite3.connect(path)
            con.execute("CREATE TABLE bars (minute INTEGER PRIMARY KEY, px REAL, delta TEXT, vol TEXT, liq_long REAL, liq_short REAL)")
            now = time.time()
            m0 = C.minute_of(now * 1000) - 120
            con.execute("INSERT INTO bars VALUES (?, 1, '[1,0,0,0]', '[1,0,0,0]', 0, 0)", (m0,))
            con.commit(); con.close()
            store = C.Store(path)
            cs = C.Hub(["BTC"], 600).coins["BTC"]
            nb, _, _, _ = store.load(cs)
            self.assertEqual(nb, 1)
            self.assertEqual(cs.bars[m0]["spot_n"], 0)
            cs.add_order("Binance spot", (m0 + 60) * 1000, 1, 300_000, 100_000)
            store.save(cs, 0)
            fresh = C.Hub(["BTC"], 600).coins["BTC"]
            C.Store(path).load(fresh)
            self.assertEqual(fresh.bars[m0 + 60]["sdelta"], [0.0, 0.0, 300000.0, 0.0])
            self.assertEqual(fresh.bars[m0]["spot_n"], 0)


@unittest.skipUnless(os.environ.get("FLOW_TEST_DB"), "FLOW_TEST_DB non défini")
class LegacyDatabase(unittest.TestCase):
    def test_loads_dashboard_database(self):
        cs = C.Hub(["BTC"], 600).coins["BTC"]
        nb, na, nh, _ = C.Store(os.environ["FLOW_TEST_DB"]).load(cs)
        self.assertGreater(na, 0)
        print(f"\n  base du dashboard : {nb} minutes (24 h glissantes), {na} comptes, {nh} échantillons")


if __name__ == "__main__":
    unittest.main()
