//! Structure par terme de la variance d'un GARCH(1,1) avec retour vers h_lr.

/// Variance attendue de la barre t+j (j >= 1), sachant l'état à t.
pub fn expected_h(h0: f64, h_lr: f64, phi: f64, j: u32) -> f64 {
    h_lr + phi.powi(j as i32 - 1) * (h0 - h_lr)
}

/// Somme des variances attendues sur t+1..t+k : forme fermée, identique au `f_varH` du Pine.
pub fn cum_var(h0: f64, h_lr: f64, phi: f64, k: u32) -> f64 {
    let kf = k as f64;
    if phi < 0.9999 {
        kf * h_lr + (h0 - h_lr) * (1.0 - phi.powi(k as i32)) / (1.0 - phi)
    } else {
        kf * h0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closed_form_equals_sum() {
        for (h0, hlr, phi) in [(4e-4, 9e-4, 0.98), (2e-3, 5e-4, 0.9), (1e-4, 1e-4, 0.5)] {
            for k in [1u32, 2, 7, 30, 120] {
                let s: f64 = (1..=k).map(|j| expected_h(h0, hlr, phi, j)).sum();
                let c = cum_var(h0, hlr, phi, k);
                assert!((s - c).abs() <= 1e-12 * s.abs().max(1.0), "{s} vs {c}");
            }
        }
        assert!((cum_var(3e-4, 9e-4, 0.98, 1) - 3e-4).abs() < 1e-18);
    }
}
