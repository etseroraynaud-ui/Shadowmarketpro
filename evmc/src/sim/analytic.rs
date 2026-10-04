//! Oracle analytique : loi normale de même moyenne et de même variance cumulée.
//! Sert de baseline (`b7a_garch_gauss`) et de référence aux tests du Monte Carlo.

use crate::math::{norm_cdf, norm_inv};
use crate::sim::kernel::HorizonSummary;
use crate::types::{N_Q, QGRID};

/// Résumé d'une loi N(mu, sigma²).
pub fn gaussian_summary(mu: f64, sigma: f64) -> HorizonSummary {
    let mut q = [0.0; N_Q];
    for (i, p) in QGRID.iter().enumerate() {
        q[i] = mu + sigma * norm_inv(*p);
    }
    HorizonSummary {
        mean: mu,
        std: sigma,
        p_up: norm_cdf(mu / sigma),
        se_p_up: 0.0,
        se_q_max: 0.0,
        se_mean: 0.0,
        mode_approx: mu,
        q,
    }
}
