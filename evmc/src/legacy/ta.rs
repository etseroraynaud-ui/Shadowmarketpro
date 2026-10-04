//! Équivalents des fonctions `ta.*` et `math.*` du Pine utilisées par le script.
//! Convention : une série est un historique `&[f64]` dont le dernier élément est la barre
//! courante ; `NaN` tient lieu de `na`.

// Les constantes du script sont reproduites chiffre pour chiffre.
#![allow(clippy::excessive_precision)]

/// `nz(x, d)`.
#[inline]
pub fn nz(x: f64, d: f64) -> f64 {
    if x.is_nan() { d } else { x }
}

/// `x[k]` : valeur k barres en arrière, `na` si elle n'existe pas.
#[inline]
pub fn back(h: &[f64], k: usize) -> f64 {
    if h.len() > k { h[h.len() - 1 - k] } else { f64::NAN }
}

fn window(h: &[f64], n: usize) -> Option<&[f64]> {
    if n == 0 || h.len() < n {
        return None;
    }
    Some(&h[h.len() - n..])
}

/// `ta.sma` : `na` tant que la fenêtre n'est pas pleine ou si elle contient un `na`.
pub fn sma(h: &[f64], n: usize) -> f64 {
    match window(h, n) {
        Some(w) => w.iter().sum::<f64>() / n as f64,
        None => f64::NAN,
    }
}

/// `math.sum`.
pub fn sum(h: &[f64], n: usize) -> f64 {
    match window(h, n) {
        Some(w) => w.iter().sum::<f64>(),
        None => f64::NAN,
    }
}

/// `ta.stdev` : écart-type de population (biaisé), autour de la moyenne de la fenêtre.
pub fn stdev(h: &[f64], n: usize) -> f64 {
    match window(h, n) {
        Some(w) => {
            let m = w.iter().sum::<f64>() / n as f64;
            (w.iter().map(|x| (x - m) * (x - m)).sum::<f64>() / n as f64).sqrt()
        }
        None => f64::NAN,
    }
}

/// `f_rms(x, n)` du script : `sqrt(max(nz(sma(x², n), 0), 1e-12))`.
pub fn rms(h: &[f64], n: usize) -> f64 {
    let ms = match window(h, n) {
        Some(w) => w.iter().map(|x| x * x).sum::<f64>() / n as f64,
        None => f64::NAN,
    };
    nz(ms, 0.0).max(1e-12).sqrt()
}

/// `ta.highest` et l'écart (en barres, 0 = barre courante) jusqu'au plus haut.
/// À égalité, la barre la plus ancienne est retenue, comme `ta.highestbars`.
pub fn highest(h: &[f64], n: usize) -> (f64, usize) {
    match window(h, n) {
        Some(w) => {
            let mut best = f64::NEG_INFINITY;
            let mut off = 0;
            for (k, x) in w.iter().rev().enumerate() {
                if x.is_nan() {
                    return (f64::NAN, 0);
                }
                if *x >= best {
                    best = *x;
                    off = k;
                }
            }
            (best, off)
        }
        None => (f64::NAN, 0),
    }
}

/// `ta.lowest` et l'écart jusqu'au plus bas.
pub fn lowest(h: &[f64], n: usize) -> (f64, usize) {
    match window(h, n) {
        Some(w) => {
            let mut best = f64::INFINITY;
            let mut off = 0;
            for (k, x) in w.iter().rev().enumerate() {
                if x.is_nan() {
                    return (f64::NAN, 0);
                }
                if *x <= best {
                    best = *x;
                    off = k;
                }
            }
            (best, off)
        }
        None => (f64::NAN, 0),
    }
}

/// `ta.percentrank` : part des `n` valeurs précédentes inférieures ou égales à la valeur
/// courante, en pourcentage. `na` tant qu'il n'y a pas `n` valeurs précédentes.
pub fn percentrank(h: &[f64], n: usize) -> f64 {
    if n == 0 || h.len() < n + 1 {
        return f64::NAN;
    }
    let cur = h[h.len() - 1];
    if cur.is_nan() {
        return f64::NAN;
    }
    let prev = &h[h.len() - 1 - n..h.len() - 1];
    if prev.iter().any(|x| x.is_nan()) {
        return f64::NAN;
    }
    100.0 * prev.iter().filter(|x| **x <= cur).count() as f64 / n as f64
}

/// `ta.pivothigh(src, L, R)` évalué sur la barre courante : valeur du pivot situé R barres
/// en arrière, ou `na`. Le pivot ne doit être dépassé par aucune des L barres de gauche,
/// ni égalé ou dépassé par aucune des R barres de droite.
pub fn pivot_high(h: &[f64], l: usize, r: usize) -> f64 {
    if h.len() < l + r + 1 {
        return f64::NAN;
    }
    let c = h.len() - 1 - r;
    let p = h[c];
    if h[c - l..c].iter().any(|x| *x > p) || h[c + 1..].iter().any(|x| *x >= p) {
        return f64::NAN;
    }
    p
}

/// `ta.pivotlow(src, L, R)`.
pub fn pivot_low(h: &[f64], l: usize, r: usize) -> f64 {
    if h.len() < l + r + 1 {
        return f64::NAN;
    }
    let c = h.len() - 1 - r;
    let p = h[c];
    if h[c - l..c].iter().any(|x| *x < p) || h[c + 1..].iter().any(|x| *x <= p) {
        return f64::NAN;
    }
    p
}

/// `ta.rma` (lissage de Wilder) : amorcé par la moyenne simple des `len` premières valeurs.
#[derive(Clone, Debug)]
pub struct Rma {
    len: u32,
    count: u32,
    sum: f64,
    value: f64,
}

impl Rma {
    pub fn new(len: u32) -> Self {
        Self { len: len.max(1), count: 0, sum: 0.0, value: f64::NAN }
    }
    pub fn update(&mut self, x: f64) -> f64 {
        if self.value.is_nan() {
            self.count += 1;
            self.sum += x;
            if self.count == self.len {
                self.value = self.sum / self.len as f64;
            }
        } else {
            self.value += (x - self.value) / self.len as f64;
        }
        self.value
    }
}

#[inline]
pub fn clamp(x: f64, lo: f64, hi: f64) -> f64 {
    lo.max(hi.min(x))
}

/// `f_tanh` du script (argument borné à ±20).
#[inline]
pub fn tanh(x: f64) -> f64 {
    let e2 = (2.0 * clamp(x, -20.0, 20.0)).exp();
    (e2 - 1.0) / (e2 + 1.0)
}

/// `math.sign`.
#[inline]
pub fn sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        0.0
    }
}

/// `f_ncdf` du script (approximation d'Abramowitz et Stegun).
pub fn ncdf(x: f64) -> f64 {
    let ax = x.abs();
    let k = 1.0 / (1.0 + 0.2316419 * ax);
    let dens = 0.3989422804014327 * (-0.5 * ax * ax).exp();
    let tail = dens
        * k
        * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
    if x >= 0.0 { 1.0 - tail } else { tail }
}

/// `f_norminv` du script (Acklam).
pub fn norminv(p: f64) -> f64 {
    let pp = p.clamp(1e-9, 1.0 - 1e-9);
    const A: [f64; 6] = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.383577518672690e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00,
    ];
    const B: [f64; 5] = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    const C: [f64; 6] = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00,
    ];
    const D: [f64; 4] =
        [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    let tail = |q: f64| {
        (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
            / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1.0)
    };
    if pp < 0.02425 {
        tail((-2.0 * pp.ln()).sqrt())
    } else if pp <= 0.97575 {
        let q = pp - 0.5;
        let rr = q * q;
        (((((A[0] * rr + A[1]) * rr + A[2]) * rr + A[3]) * rr + A[4]) * rr + A[5]) * q
            / (((((B[0] * rr + B[1]) * rr + B[2]) * rr + B[3]) * rr + B[4]) * rr + 1.0)
    } else {
        -tail((-2.0 * (1.0 - pp).ln()).sqrt())
    }
}

/// `f_lcg` : générateur congruentiel du script (Park-Miller, multiplicateur 48271),
/// en arithmétique flottante exacte comme dans le Pine.
#[inline]
pub fn lcg(s: f64) -> f64 {
    let v = s * 48271.0;
    v - (v / 2147483647.0).floor() * 2147483647.0
}

/// `f_varH` : variance cumulée attendue sur n barres.
#[inline]
pub fn var_h(h0: f64, hlr: f64, phi: f64, n: usize) -> f64 {
    let n = n as f64;
    if phi < 0.9999 { n * hlr + (h0 - hlr) * (1.0 - phi.powf(n)) / (1.0 - phi) } else { n * h0 }
}

/// `f_q` : quantile par interpolation linéaire sur un tableau trié.
pub fn q_sorted(s: &[f64], p: f64) -> f64 {
    let n = s.len();
    if n == 0 {
        return f64::NAN;
    }
    let pos = p * (n - 1) as f64;
    let i0 = pos.floor() as usize;
    let i1 = (i0 + 1).min(n - 1);
    s[i0] + (pos - i0 as f64) * (s[i1] - s[i0])
}

/// `f_capShares` : poids positifs normalisés, chacun plafonné à `cap`.
pub fn cap_shares(w: &[f64], cap: f64) -> Vec<f64> {
    let mut w: Vec<f64> = w.iter().map(|x| x.max(0.0)).collect();
    if w.iter().sum::<f64>() > 0.0 {
        for _ in 0..3 {
            let tt: f64 = w.iter().sum();
            for x in w.iter_mut() {
                *x = (*x / tt).min(cap);
            }
        }
        let t2: f64 = w.iter().sum();
        for x in w.iter_mut() {
            *x /= t2;
        }
    }
    w
}

/// `f_posMedian` : médiane des valeurs strictement positives, plancher 1e-12.
pub fn pos_median(a: &[f64]) -> f64 {
    let mut tmp: Vec<f64> = a.iter().copied().filter(|x| *x > 0.0).collect();
    if tmp.is_empty() {
        return 1e-12;
    }
    tmp.sort_unstable_by(|x, y| x.total_cmp(y));
    let n = tmp.len();
    let med = if n % 2 == 1 { tmp[n / 2] } else { 0.5 * (tmp[n / 2 - 1] + tmp[n / 2]) };
    med.max(1e-12)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lcg_is_minstd_48271() {
        // Suite de référence du générateur de Park et Miller (multiplicateur 48271), graine 1.
        let mut s = 1.0;
        let expect = [48271.0, 182605794.0, 1291394886.0, 1914720637.0, 2078669041.0, 407355683.0];
        for e in expect {
            s = lcg(s);
            assert_eq!(s, e);
        }
        // La 10 000e valeur de la suite est une constante publiée.
        let mut s = 1.0;
        for _ in 0..10_000 {
            s = lcg(s);
        }
        assert_eq!(s, 399268537.0);
    }

    #[test]
    fn windows_follow_pine_conventions() {
        let h = [1.0, 2.0, 3.0, 4.0];
        assert!(sma(&h, 5).is_nan());
        assert_eq!(sma(&h, 2), 3.5);
        assert_eq!(sum(&h, 3), 9.0);
        assert!((stdev(&h, 4) - 1.25f64.sqrt()).abs() < 1e-15);
        assert_eq!(back(&h, 1), 3.0);
        assert!(back(&h, 4).is_nan());
        assert_eq!(highest(&[1.0, 5.0, 5.0, 2.0], 4), (5.0, 2));
        assert_eq!(lowest(&[1.0, 1.0, 2.0], 3), (1.0, 2));
        assert_eq!(lowest(&[3.0, 1.0, 2.0], 3), (1.0, 1));
        assert_eq!(percentrank(&[1.0, 2.0, 3.0, 2.0], 3), 100.0 * 2.0 / 3.0);
        assert!(percentrank(&[1.0, 2.0], 2).is_nan());
        assert_eq!(rms(&[3.0, 4.0], 3), 1e-6);
    }

    #[test]
    fn pivots_are_confirmed_r_bars_later() {
        let h = [1.0, 2.0, 5.0, 3.0, 2.0];
        assert_eq!(pivot_high(&h, 2, 2), 5.0);
        assert!(pivot_high(&h[..4], 2, 2).is_nan());
        // Égalité à droite : pas de pivot ; égalité à gauche : pivot.
        assert!(pivot_high(&[1.0, 2.0, 5.0, 5.0, 2.0], 2, 2).is_nan());
        assert_eq!(pivot_high(&[5.0, 2.0, 5.0, 3.0, 2.0], 2, 2), 5.0);
        assert_eq!(pivot_low(&[4.0, 3.0, 1.0, 2.0, 3.0], 2, 2), 1.0);
    }

    #[test]
    fn rma_and_shares() {
        let mut r = Rma::new(3);
        assert!(r.update(3.0).is_nan());
        assert!(r.update(6.0).is_nan());
        assert_eq!(r.update(9.0), 6.0);
        assert_eq!(r.update(9.0), 7.0);
        let w = cap_shares(&[1.0, 0.8, 0.6, 0.4, 1.0, 1.4], 0.5);
        assert!((w.iter().sum::<f64>() - 1.0).abs() < 1e-12);
        assert!((w[5] - 1.4 / 5.2).abs() < 1e-12);
        assert_eq!(pos_median(&[0.0, 3.0, 1.0, -2.0, 2.0, 4.0]), 2.5);
        assert!((ncdf(1.6448536) - 0.95).abs() < 1e-6);
        assert!((norminv(0.975) - 1.959964).abs() < 1e-5);
        assert!((var_h(2.0, 1.0, 0.5, 2) - (2.0 + 1.0 * 1.5)).abs() < 1e-12);
    }
}
