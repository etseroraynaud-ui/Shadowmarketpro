//! Erreur-type HAC (Newey-West, noyau de Bartlett) et diagnostic de taille effective.

/// Troncature : ceil(1,5 x (H - 1)) + floor(4 x (n / 100)^(2/9)), bornée à n - 1.
pub fn hac_lag(h: u16, n: usize) -> usize {
    let a = (1.5 * (h as f64 - 1.0)).ceil().max(0.0) as usize;
    let b = (4.0 * (n as f64 / 100.0).powf(2.0 / 9.0)).floor() as usize;
    (a + b).min(n.saturating_sub(1))
}

fn autocov(x: &[f64], mean: f64, k: usize) -> f64 {
    let n = x.len();
    let mut s = 0.0;
    for t in k..n {
        s += (x[t] - mean) * (x[t - k] - mean);
    }
    s / n as f64
}

/// Erreur-type de la moyenne de `x`, robuste à l'autocorrélation jusqu'au retard `lag`.
pub fn newey_west_se(x: &[f64], lag: usize) -> Option<f64> {
    let n = x.len();
    if n < 2 {
        return None;
    }
    let mean = x.iter().sum::<f64>() / n as f64;
    let mut lrv = autocov(x, mean, 0);
    let lag = lag.min(n - 1);
    for k in 1..=lag {
        let w = 1.0 - k as f64 / (lag as f64 + 1.0);
        lrv += 2.0 * w * autocov(x, mean, k);
    }
    Some((lrv.max(0.0) / n as f64).sqrt())
}

/// Taille effective n / (1 + 2 x somme des autocorrélations jusqu'à `lag`), bornée à [1, n].
/// Diagnostic seulement : n'entre dans aucun intervalle.
pub fn ess_acf(x: &[f64], lag: usize) -> Option<f64> {
    let n = x.len();
    if n < 3 {
        return None;
    }
    let mean = x.iter().sum::<f64>() / n as f64;
    let g0 = autocov(x, mean, 0);
    if g0 <= 0.0 {
        return None;
    }
    let lag = lag.min(n - 1);
    let mut s = 0.0;
    for k in 1..=lag {
        s += autocov(x, mean, k) / g0;
    }
    let denom = 1.0 + 2.0 * s;
    if denom <= 0.0 {
        return None;
    }
    Some((n as f64 / denom).clamp(1.0, n as f64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lag_formula() {
        assert_eq!(hac_lag(1, 100), 4);
        assert_eq!(hac_lag(21, 1000), 30 + 6);
        assert_eq!(hac_lag(120, 50), 49);
    }

    #[test]
    fn iid_matches_classical_se() {
        // Suite déterministe sans autocorrélation notable.
        let x: Vec<f64> = (0..5000).map(|i| ((i * 7919 % 1000) as f64) / 1000.0).collect();
        let n = x.len() as f64;
        let m = x.iter().sum::<f64>() / n;
        let var = x.iter().map(|v| (v - m) * (v - m)).sum::<f64>() / n;
        let classical = (var / n).sqrt();
        let nw = newey_west_se(&x, 0).unwrap();
        assert!((nw - classical).abs() < 1e-12);
    }
}
