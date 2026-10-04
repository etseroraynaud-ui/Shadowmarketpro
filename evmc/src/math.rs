//! Fonctions numériques communes : loi normale, quantiles empiriques, mode approché.

// Les constantes publiées sont reproduites avec tous leurs chiffres.
#![allow(clippy::excessive_precision)]

/// Fonction de répartition de la loi normale centrée réduite (West 2005, double précision).
pub fn norm_cdf(x: f64) -> f64 {
    if x.is_nan() {
        return f64::NAN;
    }
    let xa = x.abs();
    let c = if xa > 37.0 {
        0.0
    } else {
        let e = (-xa * xa / 2.0).exp();
        if xa < 7.071_067_811_865_47 {
            let mut b = 3.526_249_659_989_11e-2 * xa + 0.700_383_064_443_688;
            b = b * xa + 6.373_962_203_531_65;
            b = b * xa + 33.912_866_078_383;
            b = b * xa + 112.079_291_497_871;
            b = b * xa + 221.213_596_169_931;
            b = b * xa + 220.206_867_912_376;
            let num = e * b;
            let mut d = 8.838_834_764_831_84e-2 * xa + 1.755_667_163_182_64;
            d = d * xa + 16.064_177_579_207;
            d = d * xa + 86.780_732_202_946_1;
            d = d * xa + 296.564_248_779_674;
            d = d * xa + 637.333_633_378_831;
            d = d * xa + 793.826_512_519_948;
            d = d * xa + 440.413_735_824_752;
            num / d
        } else {
            let mut b = xa + 0.65;
            b = xa + 4.0 / b;
            b = xa + 3.0 / b;
            b = xa + 2.0 / b;
            b = xa + 1.0 / b;
            e / b / 2.506_628_274_631
        }
    };
    if x > 0.0 { 1.0 - c } else { c }
}

/// Densité de la loi normale centrée réduite.
pub fn norm_pdf(x: f64) -> f64 {
    (-0.5 * x * x).exp() / (2.0 * std::f64::consts::PI).sqrt()
}

/// Évalue un polynôme par le schéma de Horner ; coefficients du plus haut degré au plus bas.
#[inline]
fn horner(c: &[f64], x: f64) -> f64 {
    c.iter().fold(0.0, |acc, k| acc * x + k)
}

/// Quantile de la loi normale centrée réduite (Wichura, AS 241, PPND16).
pub fn norm_inv(p: f64) -> f64 {
    const A: [f64; 8] = [
        2.509_080_928_730_122_672_7e3,
        3.343_057_558_358_812_810_5e4,
        6.726_577_092_700_870_085_3e4,
        4.592_195_393_154_987_145_7e4,
        1.373_169_376_550_946_112_5e4,
        1.971_590_950_306_551_442_7e3,
        1.331_416_678_917_843_774_5e2,
        3.387_132_872_796_366_608_0e0,
    ];
    const B: [f64; 8] = [
        5.226_495_278_852_854_561_0e3,
        2.872_908_573_572_194_267_4e4,
        3.930_789_580_009_271_061_0e4,
        2.121_379_430_158_659_586_7e4,
        5.394_196_021_424_751_107_7e3,
        6.871_870_074_920_579_083_0e2,
        4.231_333_070_160_091_125_2e1,
        1.0,
    ];
    const C: [f64; 8] = [
        7.745_450_142_783_414_076_40e-4,
        2.272_384_498_926_918_458_33e-2,
        2.417_807_251_774_506_117_70e-1,
        1.270_458_252_452_368_382_58e0,
        3.647_848_324_763_204_605_04e0,
        5.769_497_221_460_691_405_50e0,
        4.630_337_846_156_545_295_90e0,
        1.423_437_110_749_683_577_34e0,
    ];
    const D: [f64; 8] = [
        1.050_750_071_644_416_843_24e-9,
        5.475_938_084_995_344_946_00e-4,
        1.519_866_656_361_645_719_66e-2,
        1.481_039_764_274_800_745_90e-1,
        6.897_673_349_851_000_045_50e-1,
        1.676_384_830_183_803_849_40e0,
        2.053_191_626_637_758_821_87e0,
        1.0,
    ];
    const E: [f64; 8] = [
        2.010_334_399_292_288_132_65e-7,
        2.711_555_568_743_487_578_15e-5,
        1.242_660_947_388_078_438_60e-3,
        2.653_218_952_657_612_309_30e-2,
        2.965_605_718_285_048_912_30e-1,
        1.784_826_539_917_291_335_80e0,
        5.463_784_911_164_114_369_90e0,
        6.657_904_643_501_103_777_20e0,
    ];
    const F: [f64; 8] = [
        2.044_263_103_389_939_785_64e-15,
        1.421_511_758_316_445_888_70e-7,
        1.846_318_317_510_054_681_80e-5,
        7.868_691_311_456_132_591_00e-4,
        1.487_536_129_085_061_485_25e-2,
        1.369_298_809_227_358_053_10e-1,
        5.998_322_065_558_879_376_90e-1,
        1.0,
    ];
    if !(p > 0.0 && p < 1.0) {
        return if p == 0.0 {
            f64::NEG_INFINITY
        } else if p == 1.0 {
            f64::INFINITY
        } else {
            f64::NAN
        };
    }
    let q = p - 0.5;
    if q.abs() <= 0.425 {
        let r = 0.180_625 - q * q;
        return q * horner(&A, r) / horner(&B, r);
    }
    let r0 = if q < 0.0 { p } else { 1.0 - p };
    let r = (-r0.ln()).sqrt();
    let val = if r <= 5.0 {
        horner(&C, r - 1.6) / horner(&D, r - 1.6)
    } else {
        horner(&E, r - 5.0) / horner(&F, r - 5.0)
    };
    if q < 0.0 { -val } else { val }
}

/// Quantile empirique de type 7 (interpolation linéaire) sur un tableau trié.
pub fn quantile_sorted(sorted: &[f64], p: f64) -> f64 {
    let n = sorted.len();
    debug_assert!(n > 0);
    if n == 1 {
        return sorted[0];
    }
    let pos = p * (n - 1) as f64;
    let i0 = pos.floor() as usize;
    let i1 = (i0 + 1).min(n - 1);
    let fr = pos - i0 as f64;
    sorted[i0] + fr * (sorted[i1] - sorted[i0])
}

/// Quantile de type 7 sans tri complet : réordonne partiellement `v`.
pub fn quantile_select(v: &mut [f64], p: f64) -> f64 {
    let n = v.len();
    debug_assert!(n > 0);
    if n == 1 {
        return v[0];
    }
    let pos = p * (n - 1) as f64;
    let i0 = pos.floor() as usize;
    let fr = pos - i0 as f64;
    let (_, a, right) = v.select_nth_unstable_by(i0, |x, y| x.total_cmp(y));
    let a = *a;
    if fr == 0.0 || right.is_empty() {
        return a;
    }
    let b = right.iter().copied().fold(f64::INFINITY, f64::min);
    a + fr * (b - a)
}

/// Mode approché par demi-échantillon (Bickel) sur un tableau trié.
pub fn half_sample_mode(sorted: &[f64]) -> f64 {
    let mut lo = 0usize;
    let mut n = sorted.len();
    debug_assert!(n > 0);
    loop {
        match n {
            1 => return sorted[lo],
            2 => return 0.5 * (sorted[lo] + sorted[lo + 1]),
            3 => {
                let d1 = sorted[lo + 1] - sorted[lo];
                let d2 = sorted[lo + 2] - sorted[lo + 1];
                return if d1 < d2 {
                    0.5 * (sorted[lo] + sorted[lo + 1])
                } else if d2 < d1 {
                    0.5 * (sorted[lo + 1] + sorted[lo + 2])
                } else {
                    sorted[lo + 1]
                };
            }
            _ => {
                let half = n.div_ceil(2);
                let mut best = lo;
                let mut best_w = f64::INFINITY;
                for i in lo..=(lo + n - half) {
                    let w = sorted[i + half - 1] - sorted[i];
                    if w < best_w {
                        best_w = w;
                        best = i;
                    }
                }
                lo = best;
                n = half;
            }
        }
    }
}

/// Tri croissant total (aucun NaN attendu).
pub fn sort_f64(v: &mut [f64]) {
    v.sort_unstable_by(|a, b| a.total_cmp(b));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_known_values() {
        assert!((norm_cdf(0.0) - 0.5).abs() < 1e-15);
        assert!((norm_cdf(1.0) - 0.841_344_746_068_542_9).abs() < 1e-13);
        assert!((norm_cdf(1.96) - 0.975_002_104_851_779_5).abs() < 1e-13);
        assert!((norm_cdf(-3.0) - 0.001_349_898_031_630_094_6).abs() < 1e-14);
        assert!((norm_inv(0.975) - 1.959_963_984_540_054).abs() < 1e-12);
        assert!((norm_inv(0.5)).abs() < 1e-15);
    }

    #[test]
    fn normal_round_trip() {
        let mut p = 1e-9;
        while p < 1.0 {
            let x = norm_inv(p);
            let rel = (norm_cdf(x) - p).abs() / p.min(1.0 - p);
            assert!(rel < 1e-9, "p={p} x={x} rel={rel}");
            p = if p < 0.01 { p * 3.0 } else { p + 0.0137 };
        }
    }

    #[test]
    fn quantiles_agree() {
        let v: Vec<f64> = (0..101).map(|i| ((i * 37) % 101) as f64).collect();
        let mut s = v.clone();
        sort_f64(&mut s);
        for p in [0.0, 0.005, 0.05, 0.25, 0.5, 0.731, 0.95, 1.0] {
            let mut w = v.clone();
            assert!((quantile_select(&mut w, p) - quantile_sorted(&s, p)).abs() < 1e-12);
        }
        assert_eq!(quantile_sorted(&s, 0.5), 50.0);
    }

    #[test]
    fn hsm_finds_cluster() {
        let mut v = vec![-5.0, -3.0, 0.9, 1.0, 1.05, 1.1, 1.2, 4.0, 9.0];
        sort_f64(&mut v);
        let m = half_sample_mode(&v);
        assert!((0.9..=1.2).contains(&m));
    }
}
