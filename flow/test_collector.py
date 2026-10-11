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


@unittest.skipUnless(os.environ.get("FLOW_TEST_DB"), "FLOW_TEST_DB non défini")
class LegacyDatabase(unittest.TestCase):
    def test_loads_dashboard_database(self):
        cs = C.Hub(["BTC"], 600).coins["BTC"]
        nb, na, nh, _ = C.Store(os.environ["FLOW_TEST_DB"]).load(cs)
        self.assertGreater(na, 0)
        print(f"\n  base du dashboard : {nb} minutes (24 h glissantes), {na} comptes, {nh} échantillons")


if __name__ == "__main__":
    unittest.main()
