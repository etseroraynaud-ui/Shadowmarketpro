"""Non-fuite temporelle : toute quantité connue en T est identique sur l'échantillon complet et sur
l'échantillon tronqué en T (volatilité, sauts, flux, état-espace, Hawkes, chocs de barre)."""
import numpy as np
import pytest

from shockfade import hawkes as hk
from shockfade import ou
from shockfade import pipeline as pl
from shockfade import vol as vl
from shockfade.data import Minute
from shockfade.synthetic import simulate_asset


def _truncate(a: pl.Asset, n: int) -> pl.Asset:
    m = a.m
    mm = Minute(**{k: getattr(m, k)[:n] for k in ['t', 'o', 'h', 'l', 'c', 'v', 'qv', 'n', 'flow', 'ok']})
    v = vl.compute(mm.c, mm.ok)
    from shockfade import jumps as jp
    return pl.Asset(a.sym, a.t0, mm, v, jp.detect(v.L), ou.flow_input(mm.flow, mm.ok), a.x[:n], a.basis[:n], pl._rv_percentile(mm))


@pytest.fixture(scope='module')
def assets():
    a, _ = simulate_asset('NOLEAK', days=75, transient=0.4, seed=7)
    cut = 70 * 1440 + 733            # minute arbitraire, au milieu d'une barre
    return a, _truncate(a, cut), cut


def test_volatility_and_jumps(assets):
    a, b, cut = assets
    for k in ['s', 'bv', 'v', 'L']:
        np.testing.assert_array_equal(getattr(a.vol, k)[:cut], getattr(b.vol, k)[:cut])
    np.testing.assert_array_equal(a.jump[:cut], b.jump[:cut])
    np.testing.assert_array_equal(a.u[:cut], b.u[:cut])


def test_bar_shocks(assets):
    a, b, cut = assets
    _, Ra, Za, _ = pl.bar_shocks(a, 5)
    _, Rb, Zb, _ = pl.bar_shocks(b, 5)
    nb = cut // 5
    np.testing.assert_array_equal(Za[:nb], Zb[:nb])


def test_kalman_filter_is_causal(assets):
    a, b, cut = assets
    p = {'phi': 0.9, 'lam_F': 0.3, 'lam_Q': 0.2, 'sig_F': 0.8, 'sig_Q': 0.3, 'sig_e': 0.1, 'sig_FJ': 0.5, 'sig_QJ': 0.4}
    f = ou.SSFit(p, 0.0, 0, None, True)
    jl = lambda z: np.where(z.jump != 0, z.vol.L ** 2, 0.0)
    Qa, _, _ = ou.filter_states(a.x, a.u, a.vol.v, jl(a), f)
    Qb, _, _ = ou.filter_states(b.x, b.u, b.vol.v, jl(b), f)
    np.testing.assert_allclose(Qa[:cut], Qb[:cut], rtol=0, atol=0)


def test_hawkes_states_are_causal(assets):
    a, b, cut = assets
    ta, ma = pl.all_jump_events(a)
    tb, mb = pl.all_jump_events(b)
    q = np.array([float(cut - 300), float(cut)])
    beta = np.array([[0.1, 0.2], [0.15, 0.05]])
    np.testing.assert_allclose(hk.states_at(ta, ma, q, beta), hk.states_at(tb, mb, q, beta))


def test_naive_ar1_uses_past_only(assets):
    a, b, cut = assets
    T = cut - 1
    assert ou.naive_ar1(a.x, T) == ou.naive_ar1(b.x, T)
