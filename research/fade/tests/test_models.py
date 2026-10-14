"""Tests sur processus simulés à paramètres connus (protocole § 9)."""
import math

import numpy as np
import pytest

from shockfade import hawkes as hk
from shockfade import jumps as jp
from shockfade import ou
from shockfade import stats as st
from shockfade import vol as vl


def _diffusion(days, seed, jumps_per_day=0.0, jump_sigmas=10.0):
    rng = np.random.default_rng(seed)
    n = days * 1440
    tod = (np.arange(n) % 1440) / 1440
    sig = 4e-4 * (0.75 + 0.5 * np.exp(-((tod - 0.6) ** 2) / 0.02))
    r = sig * rng.standard_normal(n)
    J = np.zeros(n, dtype=int)
    if jumps_per_day:
        k = rng.random(n) < jumps_per_day / 1440
        sgn = np.where(rng.random(n) < 0.5, 1, -1)
        r[k] += sgn[k] * jump_sigmas * sig[k]
        J[k] = sgn[k]
    c = 100 * np.exp(np.cumsum(r))
    return c, J


def test_lee_mykland_threshold():
    assert abs(jp.lm_threshold(1440, 0.01) - 5.7775) < 1e-3
    assert jp.lm_threshold(1440, 0.05) < jp.lm_threshold(1440, 0.01) < jp.lm_threshold(1440, 0.001)


def test_lee_mykland_size_and_power():
    c, _ = _diffusion(160, 1)
    v = vl.compute(c, np.ones(len(c), bool))
    det = jp.detect(v.L)
    valid_days = np.isfinite(v.L).sum() / 1440
    # taille : P(au moins une fausse détection par jour) ≈ α = 1 % ; tolérance large
    assert (det != 0).sum() / valid_days < 0.05
    c, J = _diffusion(160, 2, jumps_per_day=3, jump_sigmas=10)
    v = vl.compute(c, np.ones(len(c), bool))
    det = jp.detect(v.L)
    ok = np.isfinite(v.L) & (J != 0)
    assert np.mean(det[ok] == J[ok]) > 0.9          # puissance pour des sauts de 10 σ


def test_seasonality_is_causal_and_recovers_shape():
    c, _ = _diffusion(100, 3)
    r = vl.log_returns(c, np.ones(len(c), bool))
    s = vl.seasonality(r)
    assert np.all(np.isnan(s[: 30 * 1440]))
    day = s[90 * 1440: 91 * 1440]
    tod = (np.arange(1440)) / 1440
    true = 0.75 + 0.5 * np.exp(-((tod - 0.6) ** 2) / 0.02)
    true = true / np.median(true)
    assert np.corrcoef(day, true)[0, 1] > 0.9


def test_hawkes_recovery_and_gof():
    mu = np.array([0.002, 0.0025])
    alpha = np.array([[0.06, 0.01], [0.02, 0.08]])
    beta = np.array([[0.1, 0.05], [0.05, 0.12]])
    t, m = hk.simulate(180 * 1440.0, mu, alpha, beta, seed=1)
    f = hk.fit(t, m, 0.0, 180 * 1440.0)
    assert f.rho < 0.99
    np.testing.assert_allclose(f.mu, mu, rtol=0.25)
    np.testing.assert_allclose(f.branching, alpha / beta, atol=0.08)
    gof = hk.time_rescaling(t, m, 0.0, f)
    assert gof['up']['p'] > 0.01 and gof['down']['p'] > 0.01
    pois = hk.fit_poisson(m, 0.0, 180 * 1440.0)
    assert hk.time_rescaling(t, m, 0.0, pois)['up']['p'] < 1e-6
    assert hk.lr_test(f, pois)['p_chi2'] < 1e-10


def test_hawkes_gradient_matches_finite_differences():
    t, m = hk.simulate(20 * 1440.0, [0.002, 0.002], [[0.05, 0.02], [0.01, 0.04]], [[0.1, 0.2], [0.3, 0.1]], seed=4)
    mu = np.array([0.0021, 0.0019]); al = np.array([[0.04, 0.02], [0.015, 0.05]]); be = np.array([[0.12, 0.18], [0.25, 0.09]])
    use = np.ones((2, 2), bool)
    ll, gmu, ga, gb = hk._loglik(t, m.astype(np.int64), 0.0, 20 * 1440.0, mu, al, be, use)
    eps = 1e-7
    for (k, j) in [(0, 0), (0, 1), (1, 0), (1, 1)]:
        a2 = al.copy(); a2[k, j] += eps
        b2 = be.copy(); b2[k, j] += eps
        assert abs((hk._loglik(t, m.astype(np.int64), 0.0, 20 * 1440.0, mu, a2, be, use)[0] - ll) / eps - ga[k, j]) < 1e-2 * max(1, abs(ga[k, j]))
        assert abs((hk._loglik(t, m.astype(np.int64), 0.0, 20 * 1440.0, mu, al, b2, use)[0] - ll) / eps - gb[k, j]) < 1e-2 * max(1, abs(gb[k, j]))


def test_hawkes_forecast_poisson_limit():
    f = hk.fit_poisson(np.array([0, 1] * 50), 0.0, 1000.0)       # μ = 0,05 / min par sens
    R0 = np.zeros((2, 2))
    fc = hk.forecast(R0, f, np.array([10.0, 20.0]), same=0, npaths=20000, seed=3)
    np.testing.assert_allclose(fc[:, 0], 1 - np.exp(-0.05 * np.array([10, 20])), atol=0.01)


def test_state_space_recovers_transient_component():
    P = dict(phi=0.95, lam_F=0.3, lam_Q=0.3, sig_F=0.8, sig_Q=0.3, sig_e=0.1, sig_FJ=0.5, sig_QJ=0.5)
    x, u, v, jl2, F, Q = ou.simulate(200_000, P, seed=3, jump_prob=0.002)
    f = ou.fit(x, u, v, jl2, hessian=False)
    assert abs(f.phi - 0.95) < 0.01
    assert abs(f.params['lam_Q'] - 0.3) < 0.05 and abs(f.params['lam_F'] - 0.3) < 0.05
    assert abs(f.psi_jump() - 0.5) < 0.15
    Qf, _, _ = ou.filter_states(x, u, v, jl2, f)
    assert np.corrcoef(Qf[100:], Q[100:])[0, 1] > 0.6


def test_state_space_finds_no_transient_in_random_walk():
    P = dict(phi=0.5, lam_F=0.3, lam_Q=0.0, sig_F=1.0, sig_Q=1e-6, sig_e=1e-6, sig_FJ=0.8, sig_QJ=1e-6)
    x, u, v, jl2, F, Q = ou.simulate(200_000, P, seed=4, jump_prob=0.002)
    full = ou.fit(x, u, v, jl2, hessian=False)
    rest = ou.fit(x, u, v, jl2, restricted=True, hessian=False, start={'lam_F': 0.5, 'sig_F': 1.0, 'sig_e': 0.1, 'sig_FJ': 0.6})
    assert 2 * (full.loglik - rest.loglik) < 11.3        # χ²(3) à 1 %, borne prudente
    assert abs(full.params['lam_Q']) < 0.05


def test_naive_ou_on_random_walk_shows_spurious_reversion():
    """Biais de Dickey–Fuller : sur une marche aléatoire, l'AR(1) glissant « voit » de la réversion."""
    rng = np.random.default_rng(5)
    bs = []
    for k in range(300):
        x = np.cumsum(rng.standard_normal(1441))
        b, _ = ou.naive_ar1(x, 1440)
        bs.append(b)
    bs = np.array(bs)
    assert np.mean(bs) < 1 - 2.0 / 1440          # E[b − 1] ≈ −(1 + 3b)/n ≈ −4/n
    assert np.mean(bs < 1) > 0.9


def test_holm_and_bh():
    p = np.array([0.01, 0.04, 0.03, 0.005])
    np.testing.assert_allclose(st.holm(p), [0.03, 0.06, 0.06, 0.02])
    np.testing.assert_allclose(st.bh(p), [0.02, 0.04, 0.04, 0.02])


def test_cluster_mean_equals_iid_when_singletons():
    rng = np.random.default_rng(0)
    x = rng.standard_normal(500)
    r = st.cluster_mean(x, np.arange(500))
    assert abs(r['se'] - x.std(ddof=0) / math.sqrt(500) * math.sqrt(500 / 499)) < 1e-3


def test_clark_west_detects_true_signal():
    rng = np.random.default_rng(1)
    f = rng.standard_normal(4000)
    y = 0.3 * f + rng.standard_normal(4000)
    r = st.clark_west(y, np.zeros(4000), 0.3 * f, np.arange(4000) // 10)
    assert r['p'] < 1e-6 and r['r2_oos'] > 0
