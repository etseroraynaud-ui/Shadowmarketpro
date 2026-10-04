//! Monte Carlo contre l'oracle analytique, arrêt adaptatif, filtre de volatilité.

mod common;

use evmc::config::SimProfile;
use evmc::data::synth::{generate, SynthSpec};
use evmc::sim::{simulate, ResidSpec, SimInput, SimOutput, Workspace};
use evmc::types::{HorizonGrid, IQ_05, IQ_50, IQ_95};
use evmc::vol::term::cum_var;
use evmc::vol::VolFilter;

fn grid() -> HorizonGrid {
    HorizonGrid::new(vec![1, 2, 3, 5, 7, 10, 14, 20, 30, 45, 60, 90, 120]).unwrap()
}

fn fixed(n: u32, batch: u32) -> SimProfile {
    SimProfile { n_min: n, n_max: n, batch, tol_p: 1e-9, tol_q: 1e-9, tol_mean: 1e-9 }
}

fn run(h0: f64, h_lr: f64, resid: ResidSpec, pool: &[f64], profile: &SimProfile, bar: u32) -> (SimOutput, Vec<f64>) {
    let g = grid();
    let (a, b) = (0.06, 0.92);
    let sigma_h: Vec<f64> = g.as_slice().iter().map(|&h| cum_var(h0, h_lr, a + b, h as u32).sqrt()).collect();
    let input = SimInput {
        bar_idx: bar,
        h0,
        h_lr,
        g_alpha: a,
        g_beta: b,
        h_cap: 25.0 * h_lr,
        resid,
        drift_steps: None,
        sigma_h: &sigma_h,
    };
    let mut ws = Workspace::new(&g, profile.n_max);
    (simulate(&input, pool, &g, profile, 123, &mut ws), sigma_h)
}

#[test]
fn gaussian_monte_carlo_matches_the_analytic_engine() {
    // Trois états : volatilité basse, à l'équilibre, haute.
    for (i, (h0, h_lr)) in [(2e-4, 9e-4), (9e-4, 9e-4), (3e-3, 9e-4)].into_iter().enumerate() {
        let n = 60_000u32;
        let (out, sigma_h) = run(h0, h_lr, ResidSpec::Gaussian, &[], &fixed(n, 5000), 1000 + i as u32);
        assert_eq!(out.n_sims, n);
        let nf = n as f64;
        for (gi, s) in out.per_h.iter().enumerate() {
            let sig = sigma_h[gi];
            // Moyenne nulle à 4 erreurs-types.
            assert!(s.mean.abs() < 4.0 * sig / nf.sqrt(), "moyenne h{gi} état {i}");
            // Variance cumulée : forme fermée. Tolérance élargie par le kurtosis du GARCH.
            let rel = (s.std * s.std) / (sig * sig) - 1.0;
            assert!(rel.abs() < 0.05, "variance h{gi} état {i} : écart {rel:+.4}");
            // P(up) = 0,5 à 4 erreurs-types.
            assert!((s.p_up - 0.5).abs() < 4.0 * 0.5 / nf.sqrt(), "p_up h{gi} état {i}");
            assert!(s.q[IQ_05] < s.q[IQ_50] && s.q[IQ_50] < s.q[IQ_95]);
        }
        // À un pas, la loi est exactement normale : le quantile à 5 % vaut -1,645 sigma.
        let q05 = out.per_h[0].q[IQ_05] / sigma_h[0];
        assert!((q05 + 1.6449).abs() < 0.03, "q05 = {q05}");
    }
}

#[test]
fn fhs_reproduces_the_pool_distribution() {
    // Pool à deux points, de variance 4 après centrage : la variance à un pas vaut 4 h0.
    let pool: Vec<f64> = (0..400).map(|i| if i % 2 == 0 { 3.0 } else { -1.0 }).collect();
    let resid = ResidSpec::Fhs { start: 0, len: 400, center: 1.0, scale: 1.0 };
    let (out, _) = run(1e-4, 1e-4, resid, &pool, &fixed(40_000, 5000), 7);
    let s = &out.per_h[0];
    assert!((s.std * s.std / (4.0 * 1e-4) - 1.0).abs() < 1e-9 + 0.02);
    assert!((s.p_up - 0.5).abs() < 0.012);
    // Remise à l'échelle : même pool, écart-type ramené à 1.
    let resid = ResidSpec::Fhs { start: 0, len: 400, center: 1.0, scale: 0.5 };
    let (out, _) = run(1e-4, 1e-4, resid, &pool, &fixed(40_000, 5000), 7);
    assert!((out.per_h[0].std * out.per_h[0].std / 1e-4 - 1.0).abs() < 0.02);
}

#[test]
fn simulation_is_reproducible_and_independent_of_batching() {
    let (a, _) = run(5e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(8000, 1000), 42);
    let (b, _) = run(5e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(8000, 1000), 42);
    assert_eq!(a, b);
    // Autre découpage en lots : mêmes trajectoires, donc mêmes quantiles et même P(up).
    let (c, _) = run(5e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(8000, 500), 42);
    for (x, y) in a.per_h.iter().zip(&c.per_h) {
        assert_eq!(x.q, y.q);
        assert_eq!(x.p_up, y.p_up);
        assert_eq!(x.mode_approx, y.mode_approx);
    }
    // Autre origine : autre flux.
    let (d, _) = run(5e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(8000, 1000), 43);
    assert_ne!(a.per_h[0].q, d.per_h[0].q);
}

#[test]
fn adaptive_stop_scales_with_the_profile() {
    let cfg = evmc::config::Config::default_mvp();
    let mut prev = 0u32;
    for name in ["fast", "normal", "validation"] {
        let p = cfg.sim[name];
        let (out, _) = run(9e-4, 9e-4, ResidSpec::Gaussian, &[], &p, 5);
        let (again, _) = run(9e-4, 9e-4, ResidSpec::Gaussian, &[], &p, 5);
        assert_eq!(out, again, "arrêt non reproductible ({name})");
        assert!(out.converged, "{name} non convergé à {}", out.n_sims);
        assert!(out.n_sims >= p.n_min && out.n_sims <= p.n_max);
        assert!(out.n_sims % p.batch == 0);
        assert!(out.n_sims >= prev, "{name} : {} < {prev}", out.n_sims);
        for s in &out.per_h {
            assert!(s.se_p_up <= p.tol_p && s.se_q_max <= p.tol_q && s.se_mean <= p.tol_mean);
        }
        prev = out.n_sims;
    }
}

#[test]
fn monte_carlo_error_shrinks_like_inverse_sqrt_n() {
    let (a, _) = run(9e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(5000, 1000), 9);
    let (b, _) = run(9e-4, 9e-4, ResidSpec::Gaussian, &[], &fixed(20_000, 1000), 9);
    for (x, y) in a.per_h.iter().zip(&b.per_h) {
        let r_mean = y.se_mean / x.se_mean;
        let r_p = y.se_p_up / x.se_p_up;
        assert!((r_mean - 0.5).abs() < 0.05, "se_mean : rapport {r_mean}");
        assert!((r_p - 0.5).abs() < 0.02, "se_p : rapport {r_p}");
    }
}

#[test]
fn reference_filter_standardises_a_simulated_garch() {
    // Série GARCH de mêmes alpha et beta que le filtre : les résidus doivent avoir une variance proche de 1.
    let cfg = evmc::config::Config::default_mvp();
    let (bars, _) = generate(&SynthSpec { n: 12_000, seed: 77, ..Default::default() });
    let mut f = VolFilter::new(&cfg.vol);
    let mut prev = bars[0].close;
    let (mut s2, mut n) = (0.0, 0usize);
    for (t, b) in bars.iter().enumerate() {
        let r = if t == 0 { 0.0 } else { (b.close / prev).ln() };
        prev = b.close;
        let row = f.update(r);
        assert!(row.h_ewma > 0.0 && row.h_lr > 0.0 && row.h_garch > 0.0);
        if t >= 750 {
            s2 += row.z_garch * row.z_garch;
            n += 1;
        }
    }
    let m = s2 / n as f64;
    assert!((m - 1.0).abs() < 0.06, "moyenne de z² = {m}");
}
