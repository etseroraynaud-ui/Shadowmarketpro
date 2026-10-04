//! Invariants d'un enregistrement de prévision. Une violation arrête le run.

use crate::error::{Error, Result};
use crate::forecast::record::ForecastRecord;
use crate::types::QGRID;

fn fail(r: &ForecastRecord, msg: &str) -> Error {
    Error::Invariant(format!(
        "{} barre {} horizon {} : {}",
        r.model_id, r.bar_idx, r.horizon, msg
    ))
}

/// Vérifie : valeurs finies, sigma > 0, 0 <= P(up) <= 1, quantiles monotones,
/// et cohérence de loi 1 - F(0) = P(up) à la résolution de la grille.
pub fn check(r: &ForecastRecord) -> Result<()> {
    let scalars = [
        r.predictive_mean,
        r.predictive_median,
        r.predictive_mode,
        r.predictive_sigma,
        r.sigma_robust,
        r.sigma_model,
        r.raw_p_up,
        r.alpha_z,
        r.mu_alpha,
        r.legacy_target,
        r.legacy_d_state,
        r.legacy_confidence,
        r.se_p_up,
        r.se_q_max,
    ];
    if scalars.iter().any(|v| matches!(v, Some(x) if !x.is_finite())) || !r.p0.is_finite() {
        return Err(fail(r, "valeur non finie"));
    }
    if r.p0 <= 0.0 {
        return Err(fail(r, "prix d'origine <= 0"));
    }
    for s in [r.predictive_sigma, r.sigma_model] {
        if matches!(s, Some(x) if x <= 0.0) {
            return Err(fail(r, "sigma <= 0"));
        }
    }
    if matches!(r.sigma_robust, Some(x) if x < 0.0) {
        return Err(fail(r, "sigma robuste < 0"));
    }
    if let Some(p) = r.raw_p_up {
        if !(0.0..=1.0).contains(&p) {
            return Err(fail(r, "P(up) hors de [0, 1]"));
        }
    }
    if let Some(q) = &r.q {
        if q.iter().any(|x| !x.is_finite()) {
            return Err(fail(r, "quantile non fini"));
        }
        if q.windows(2).any(|w| w[1] < w[0]) {
            return Err(fail(r, "quantiles non monotones"));
        }
        if let Some(p) = r.raw_p_up {
            // P(X <= 0) doit tomber entre les niveaux des quantiles qui encadrent 0.
            let below = 1.0 - p;
            let n = q.len();
            let mut lo = 0.0;
            let mut hi = 1.0;
            for i in 0..n {
                if q[i] < 0.0 {
                    lo = QGRID[i];
                }
                if q[n - 1 - i] > 0.0 {
                    hi = QGRID[n - 1 - i];
                }
            }
            if below < lo - r.cdf_slack || below > hi + r.cdf_slack {
                return Err(fail(
                    r,
                    &format!("1 - F(0) = {below:.6} hors de [{lo}, {hi}] : loi incohérente avec P(up)"),
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::analytic::gaussian_summary;
    use crate::types::Family;

    fn rec(mu: f64, sigma: f64) -> ForecastRecord {
        ForecastRecord::empty("b4_rw", Family::Baseline, 0, 10, 5, 100.0)
            .with_summary(&gaussian_summary(mu, sigma), Some(sigma))
    }

    #[test]
    fn gaussian_records_pass() {
        for mu in [-0.2, -0.01, 0.0, 0.003, 0.5] {
            check(&rec(mu, 0.05)).unwrap();
        }
    }

    #[test]
    fn violations_are_caught() {
        let mut r = rec(0.0, 0.05);
        r.predictive_sigma = Some(0.0);
        assert!(check(&r).is_err());
        let mut r = rec(0.0, 0.05);
        r.raw_p_up = Some(1.2);
        assert!(check(&r).is_err());
        let mut r = rec(0.0, 0.05);
        let mut q = r.q.unwrap();
        q.swap(3, 4);
        r.q = Some(q);
        assert!(check(&r).is_err());
        let mut r = rec(0.0, 0.05);
        r.raw_p_up = Some(0.9);
        assert!(check(&r).is_err());
        let mut r = rec(0.0, 0.05);
        r.predictive_mean = Some(f64::NAN);
        assert!(check(&r).is_err());
    }
}
