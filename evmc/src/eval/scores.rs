//! Scores par ligne : calculés à la jointure prévision x outcome, jamais stockés avec la prévision.

use crate::types::{IQ_025, IQ_05, IQ_10, IQ_25, IQ_75, IQ_90, IQ_95, IQ_975, N_Q, QGRID};

/// Intervalles centraux notés : (niveau nominal, indice bas, indice haut).
pub const INTERVALS: [(f64, usize, usize); 4] = [
    (0.50, IQ_25, IQ_75),
    (0.80, IQ_10, IQ_90),
    (0.90, IQ_05, IQ_95),
    (0.95, IQ_025, IQ_975),
];

pub const INTERVAL_TAGS: [&str; 4] = ["50", "80", "90", "95"];

/// Une ligne de `scores.parquet`.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ScoreRow {
    pub err_mean: Option<f64>,
    pub err_median: Option<f64>,
    pub err_mode: Option<f64>,
    pub err_legacy: Option<f64>,
    pub z_err: Option<f64>,
    pub pit: Option<f64>,
    pub y_up: u8,
    pub brier: Option<f64>,
    pub logloss: Option<f64>,
    pub hit: Option<u8>,
    pub inside: [Option<bool>; 4],
    pub width: [Option<f64>; 4],
    pub iscore: [Option<f64>; 4],
    pub crps: Option<f64>,
    /// P(up) de la prévision, repris pour les classes de fiabilité. Non persisté.
    pub p_up: Option<f64>,
}

/// Champs d'une prévision utiles au score.
#[derive(Clone, Copy, Debug, Default)]
pub struct ForecastView<'a> {
    pub mean: Option<f64>,
    pub median: Option<f64>,
    pub mode: Option<f64>,
    pub sigma: Option<f64>,
    pub raw_p_up: Option<f64>,
    pub q: Option<&'a [f64; N_Q]>,
    pub legacy_target: Option<f64>,
}

/// Poids d'intégration de la grille de quantiles : cellules bornées par les milieux,
/// étendues jusqu'à 0 et 1 aux extrémités. Leur somme vaut 1.
pub fn crps_weights() -> [f64; N_Q] {
    let mut w = [0.0; N_Q];
    for i in 0..N_Q {
        let lo = if i == 0 { 0.0 } else { 0.5 * (QGRID[i - 1] + QGRID[i]) };
        let hi = if i == N_Q - 1 { 1.0 } else { 0.5 * (QGRID[i] + QGRID[i + 1]) };
        w[i] = hi - lo;
    }
    w
}

/// CRPS approché par la perte pinball moyenne sur la grille : 2 x somme des w_i x rho_tau_i(y - q_i).
pub fn crps_from_quantiles(q: &[f64; N_Q], y: f64, w: &[f64; N_Q]) -> f64 {
    let mut s = 0.0;
    for i in 0..N_Q {
        let u = y - q[i];
        let rho = if u >= 0.0 { QGRID[i] * u } else { (QGRID[i] - 1.0) * u };
        s += w[i] * rho;
    }
    2.0 * s
}

/// PIT du réalisé : F(y) par interpolation linéaire entre les quantiles.
/// En dehors de la grille, la moitié de la masse de queue restante.
pub fn pit_from_quantiles(q: &[f64; N_Q], y: f64) -> f64 {
    if y < q[0] {
        return 0.5 * QGRID[0];
    }
    if y >= q[N_Q - 1] {
        return 1.0 - 0.5 * (1.0 - QGRID[N_Q - 1]);
    }
    let i = q.partition_point(|x| *x <= y) - 1;
    let (a, b) = (q[i], q[i + 1]);
    if b > a {
        QGRID[i] + (QGRID[i + 1] - QGRID[i]) * (y - a) / (b - a)
    } else {
        0.5 * (QGRID[i] + QGRID[i + 1])
    }
}

/// Score d'intervalle (Winkler) au niveau nominal `level`.
pub fn interval_score(lo: f64, hi: f64, y: f64, level: f64) -> f64 {
    let a = 1.0 - level;
    (hi - lo) + (2.0 / a) * (lo - y).max(0.0) + (2.0 / a) * (y - hi).max(0.0)
}

pub fn score(f: &ForecastView, ret: f64, clip: f64, w: &[f64; N_Q]) -> ScoreRow {
    let y = (ret > 0.0) as u8;
    let mut s = ScoreRow { y_up: y, ..Default::default() };
    s.err_mean = f.mean.map(|m| ret - m);
    s.err_median = f.median.map(|m| ret - m);
    s.err_mode = f.mode.map(|m| ret - m);
    s.err_legacy = f.legacy_target.map(|m| ret - m);
    if let (Some(m), Some(sig)) = (f.mean, f.sigma) {
        s.z_err = Some((ret - m) / sig);
    }
    s.p_up = f.raw_p_up;
    if let Some(p) = f.raw_p_up {
        let yf = y as f64;
        s.brier = Some((p - yf) * (p - yf));
        let pc = p.clamp(clip, 1.0 - clip);
        s.logloss = Some(-(yf * pc.ln() + (1.0 - yf) * (1.0 - pc).ln()));
        s.hit = if p > 0.5 {
            Some(y)
        } else if p < 0.5 {
            Some(1 - y)
        } else {
            None
        };
    }
    if let Some(q) = f.q {
        s.pit = Some(pit_from_quantiles(q, ret));
        s.crps = Some(crps_from_quantiles(q, ret, w));
        for (k, (level, il, ih)) in INTERVALS.iter().enumerate() {
            let (lo, hi) = (q[*il], q[*ih]);
            s.inside[k] = Some(ret >= lo && ret <= hi);
            s.width[k] = Some(hi - lo);
            s.iscore[k] = Some(interval_score(lo, hi, ret, *level));
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::{norm_cdf, norm_pdf};
    use crate::sim::analytic::gaussian_summary;

    #[test]
    fn weights_sum_to_one() {
        let s: f64 = crps_weights().iter().sum();
        assert!((s - 1.0).abs() < 1e-12);
    }

    #[test]
    fn brier_of_coin_is_quarter() {
        let f = ForecastView { raw_p_up: Some(0.5), ..Default::default() };
        let w = crps_weights();
        for ret in [-0.1, 0.2] {
            let s = score(&f, ret, 1e-4, &w);
            assert_eq!(s.brier, Some(0.25));
            assert!((s.logloss.unwrap() - std::f64::consts::LN_2).abs() < 1e-12);
            assert_eq!(s.hit, None);
        }
    }

    #[test]
    fn crps_close_to_gaussian_closed_form() {
        // CRPS(N(0, s), y) = s [ z (2 Phi(z) - 1) + 2 phi(z) - 1 / sqrt(pi) ].
        let sigma = 0.04;
        let g = gaussian_summary(0.0, sigma);
        let w = crps_weights();
        let (mut approx, mut exact) = (0.0, 0.0);
        let n = 4001;
        for i in 0..n {
            // y parcourt les quantiles de la loi : moyenne = CRPS attendu sous la loi exacte.
            let p = (i as f64 + 0.5) / n as f64;
            let z = crate::math::norm_inv(p);
            approx += crps_from_quantiles(&g.q, sigma * z, &w);
            exact += sigma
                * (z * (2.0 * norm_cdf(z) - 1.0) + 2.0 * norm_pdf(z)
                    - 1.0 / std::f64::consts::PI.sqrt());
        }
        let rel = (approx - exact).abs() / exact;
        assert!(rel < 0.02, "écart relatif {rel}");
    }

    #[test]
    fn pit_is_uniform_for_exact_forecasts() {
        let g = gaussian_summary(0.01, 0.05);
        let n = 2000;
        let mut inside90 = 0;
        for i in 0..n {
            let p = (i as f64 + 0.5) / n as f64;
            let y = 0.01 + 0.05 * crate::math::norm_inv(p);
            let pit = pit_from_quantiles(&g.q, y);
            // Écart borné par l'erreur d'interpolation linéaire entre deux niveaux.
            assert!((pit - p).abs() < 0.012, "p={p} pit={pit}");
            inside90 += (y >= g.q[IQ_05] && y <= g.q[IQ_95]) as usize;
        }
        assert!((inside90 as f64 / n as f64 - 0.90).abs() < 0.002);
    }

    #[test]
    fn interval_score_penalises_misses() {
        assert_eq!(interval_score(-1.0, 1.0, 0.0, 0.9), 2.0);
        assert!((interval_score(-1.0, 1.0, 1.5, 0.9) - (2.0 + 20.0 * 0.5)).abs() < 1e-12);
    }
}
