"""Étude multi-timeframe : regroupement des chocs et contrôle positif simulé."""
import numpy as np
import pandas as pd

from shockfade import mtf
from shockfade.synthetic import simulate_asset


def test_decluster_runs_and_cross_asset_merge():
    T = np.array([0, 5, 200, 1000, 1004]) * 60_000 * 30
    ev = pd.DataFrame({'asset': ['A', 'A', 'A', 'B', 'A'], 'T': T, 'delta': 30})
    dc = mtf.decluster(ev, run_bars=8)
    assert dc['cluster'].nunique() == 4          # A:{0, 5}, A:{200}, A:{1004}, B:{1000}
    assert dc['first_in_cluster'].sum() == 4
    # B à 1000 et A à 1010 se chevauchent : même groupe croisé
    x = dc.set_index(['asset', 'T'])['xcluster']
    assert x[('B', T[3])] == x[('A', T[4])]


def test_positive_control_shows_reversion_at_m30():
    a, _ = simulate_asset('MTFPOS', days=240, transient=0.6, half_life=60.0, seed=5)
    sh = mtf.bar_z(a, 30)
    ev = mtf.detect(a, sh, '2020-04-01', '2020-08-20', mtf.regime_v1(a), None, k_min=3.0)
    ev = mtf.outcomes(a, ev, 30, None)
    assert len(ev) > 30
    assert ev['g2'].mean() > 0 and ev['race50'].mean() > 0.5


def test_negative_control_race_is_balanced():
    a, _ = simulate_asset('MTFNEG', days=240, transient=0.0, seed=6)
    sh = mtf.bar_z(a, 30)
    ev = mtf.outcomes(a, mtf.detect(a, sh, '2020-04-01', '2020-08-20', mtf.regime_v1(a), None, k_min=3.0), 30, None)
    assert abs(ev['race50'].mean() - 0.5) < 0.12
