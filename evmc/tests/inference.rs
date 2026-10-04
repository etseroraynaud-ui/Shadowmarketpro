//! Métriques et inférence : identités connues, couverture du bootstrap par blocs,
//! erreur-type HAC, prévisions exactes.

mod common;

use std::collections::BTreeMap;

use evmc::eval::bootstrap::BlockPlan;
use evmc::eval::hac::{ess_acf, hac_lag, newey_west_se};
use evmc::eval::metrics::{build_model_block, evaluate_block, values, Def, Kind, ModelBlock};
use evmc::eval::scores::{crps_weights, score, ForecastView, ScoreRow};
use evmc::math::norm_inv;
use evmc::sim::analytic::gaussian_summary;
use evmc::sim::rng::{derive_key, u01, StreamRng};

fn gauss(seed: u64, id: u64, n: usize) -> Vec<f64> {
    let mut rng = StreamRng::new(derive_key(seed, "synth", &[id]));
    rng.seek(0);
    (0..n).map(|_| norm_inv(u01(rng.next_u64()))).collect()
}

fn metric(block: &ModelBlock, vals: &[f64], name: &str) -> f64 {
    let i = block.defs.iter().position(|d| d.name == name).unwrap_or_else(|| panic!("{name}"));
    vals[i]
}

#[test]
fn exact_forecasts_are_calibrated() {
    // y ~ N(mu, sigma) et la prévision est cette même loi : couvertures nominales, PIT plat, z ~ N(0, 1).
    let (mu, sigma) = (0.002, 0.05);
    let g = gaussian_summary(mu, sigma);
    let w = crps_weights();
    let y: Vec<f64> = gauss(1, 1, 40_000).into_iter().map(|z| mu + sigma * z).collect();
    let view = ForecastView {
        mean: Some(g.mean),
        median: Some(g.mean),
        mode: Some(g.mean),
        sigma: Some(g.std),
        raw_p_up: Some(g.p_up),
        q: Some(&g.q),
        legacy_target: None,
    };
    let rows: Vec<ScoreRow> = y.iter().map(|r| score(&view, *r, 1e-4, &w)).collect();
    let block = build_model_block("exact", &rows, &y, &BTreeMap::new(), 10);
    let v = values(&block);
    for (name, nominal) in [("cov50", 0.50), ("cov80", 0.80), ("cov90", 0.90), ("cov95", 0.95)] {
        let c = metric(&block, &v, name);
        assert!((c - nominal).abs() < 0.01, "{name} = {c}");
    }
    for j in 0..10 {
        let f = metric(&block, &v, &format!("pit_bin_{j}"));
        assert!((f - 0.1).abs() < 0.01, "pit_bin_{j} = {f}");
    }
    assert!(metric(&block, &v, "z_mean").abs() < 0.02);
    assert!((metric(&block, &v, "z_std") - 1.0).abs() < 0.02);
    assert!((metric(&block, &v, "z_q95") - 1.645).abs() < 0.04);
    // CRPS attendu d'une loi normale exacte : sigma / sqrt(pi), à l'erreur de grille près.
    let crps = metric(&block, &v, "crps");
    let exact = sigma / std::f64::consts::PI.sqrt();
    assert!((crps / exact - 1.0).abs() < 0.03, "crps {crps} contre {exact}");
    // Un intervalle deux fois trop large est pénalisé par le score d'intervalle.
    let wide = gaussian_summary(mu, 2.0 * sigma);
    let view_wide = ForecastView { q: Some(&wide.q), ..view };
    let rows_wide: Vec<ScoreRow> = y.iter().map(|r| score(&view_wide, *r, 1e-4, &w)).collect();
    let bw = build_model_block("large", &rows_wide, &y, &BTreeMap::new(), 10);
    let vw = values(&bw);
    assert!(metric(&bw, &vw, "cov90") > 0.99);
    assert!(metric(&bw, &vw, "is90") > metric(&block, &v, "is90"));
    assert!(metric(&bw, &vw, "crps") > crps);
}

#[test]
fn coin_and_perfect_direction() {
    let w = crps_weights();
    let y = gauss(2, 2, 5000);
    let coin = ForecastView { raw_p_up: Some(0.5), ..Default::default() };
    let rows: Vec<ScoreRow> = y.iter().map(|r| score(&coin, *r, 1e-4, &w)).collect();
    let b = build_model_block("b1_coin", &rows, &y, &BTreeMap::new(), 10);
    let v = values(&b);
    assert_eq!(metric(&b, &v, "brier"), 0.25);
    assert_eq!(metric(&b, &v, "call_rate"), 0.0);
    assert_eq!(metric(&b, &v, "balanced_accuracy"), 0.5);
    assert!(b.defs.iter().all(|d| d.name != "hit_rate"));
    // Un devin : P = 0,9 quand ça monte, 0,1 sinon.
    let oracle: Vec<ScoreRow> = y
        .iter()
        .map(|r| {
            let p = if *r > 0.0 { 0.9 } else { 0.1 };
            score(&ForecastView { raw_p_up: Some(p), ..Default::default() }, *r, 1e-4, &w)
        })
        .collect();
    let mut base: BTreeMap<&str, &[ScoreRow]> = BTreeMap::new();
    base.insert("b1_coin", &rows);
    let bo = build_model_block("devin", &oracle, &y, &base, 10);
    let vo = values(&bo);
    assert!((metric(&bo, &vo, "brier") - 0.01).abs() < 1e-12);
    assert_eq!(metric(&bo, &vo, "hit_rate"), 1.0);
    assert_eq!(metric(&bo, &vo, "balanced_accuracy"), 1.0);
    assert!((metric(&bo, &vo, "brier_skill") - 0.96).abs() < 1e-12);
    assert!((metric(&bo, &vo, "brier_diff") - 0.24).abs() < 1e-12);
    // Murphy : Brier = fiabilité - résolution + incertitude, exact quand P est constant par classe.
    // Deux valeurs de P en effectifs égaux, deux classes : chaque classe porte une seule valeur.
    let two: Vec<ScoreRow> = y
        .iter()
        .enumerate()
        .map(|(i, r)| {
            let p = if i % 2 == 0 { 0.2 } else { 0.8 };
            score(&ForecastView { raw_p_up: Some(p), ..Default::default() }, *r, 1e-4, &w)
        })
        .collect();
    let bt = build_model_block("deux", &two, &y, &BTreeMap::new(), 2);
    let vt = values(&bt);
    let (rel, res, unc) =
        (metric(&bt, &vt, "brier_rel"), metric(&bt, &vt, "brier_res"), metric(&bt, &vt, "brier_unc"));
    assert!((rel - res + unc - metric(&bt, &vt, "brier")).abs() < 1e-12, "{rel} {res} {unc}");
    assert!((metric(&bt, &vt, "ece") - 0.3).abs() < 0.03);
}

/// Bloc d'une seule moyenne, pour tester l'inférence.
fn mean_block(x: Vec<f64>) -> ModelBlock {
    let n = x.len();
    let mut b = ModelBlock::new("m", n);
    b.series.push(x);
    b.defs.push(Def { name: "mean".into(), baseline: None, point_kind: None, kind: Kind::Mean(0) });
    b
}

#[test]
fn block_bootstrap_covers_the_true_mean_of_overlapping_returns() {
    // Sommes glissantes de H rendements i.i.d. : moyenne vraie 0, forte autocorrélation.
    let (h, n, reps_mc) = (10usize, 800usize, 300usize);
    let mut covered_blocks = 0;
    let mut covered_naive = 0;
    for s in 0..reps_mc {
        let e = gauss(100, s as u64, n + h);
        let x: Vec<f64> = (0..n).map(|i| e[i..i + h].iter().sum::<f64>()).collect();
        let b = mean_block(x.clone());
        let plans: Vec<BlockPlan> =
            [10usize, 20, 30].iter().map(|l| BlockPlan::new(n, *l, 400, 5, h as u16)).collect();
        let ev = &evaluate_block(&b, &plans, true, 0.95, Some(hac_lag(h as u16, n)))[0];
        let (lo, hi) = ev.ci.unwrap();
        covered_blocks += (lo <= 0.0 && 0.0 <= hi) as usize;
        // Intervalle naïf, comme si les lignes étaient indépendantes.
        let m = x.iter().sum::<f64>() / n as f64;
        let sd = (x.iter().map(|v| (v - m) * (v - m)).sum::<f64>() / (n - 1) as f64).sqrt();
        let half = 1.96 * sd / (n as f64).sqrt();
        covered_naive += (m - half <= 0.0 && 0.0 <= m + half) as usize;
        // n effectif : diagnostic nettement inférieur à n.
        assert!(ev.ess.unwrap() < n as f64 / 3.0);
    }
    let cb = covered_blocks as f64 / reps_mc as f64;
    let cn = covered_naive as f64 / reps_mc as f64;
    eprintln!("couverture à 95 % : blocs {cb:.3}, naïve {cn:.3}");
    assert!(cb > 0.88 && cb <= 1.0, "couverture par blocs = {cb}");
    assert!(cn < 0.75, "couverture naïve = {cn} : elle devrait être nettement trop faible");
}

#[test]
fn hac_tracks_the_true_standard_error() {
    let (h, n, m) = (10usize, 2000usize, 300usize);
    let mut means = Vec::new();
    let mut ses = Vec::new();
    for s in 0..m {
        let e = gauss(200, s as u64, n + h);
        let x: Vec<f64> = (0..n).map(|i| e[i..i + h].iter().sum::<f64>()).collect();
        means.push(x.iter().sum::<f64>() / n as f64);
        ses.push(newey_west_se(&x, hac_lag(h as u16, n)).unwrap());
        if s == 0 {
            let ess = ess_acf(&x, hac_lag(h as u16, n)).unwrap();
            assert!(ess > 50.0 && ess < 600.0, "ess = {ess}");
        }
    }
    let mm = means.iter().sum::<f64>() / m as f64;
    let true_se = (means.iter().map(|v| (v - mm) * (v - mm)).sum::<f64>() / (m - 1) as f64).sqrt();
    let avg_se = ses.iter().sum::<f64>() / m as f64;
    eprintln!("erreur-type HAC moyenne {avg_se:.4}, vraie {true_se:.4}");
    assert!((avg_se / true_se - 1.0).abs() < 0.2, "HAC {avg_se} contre {true_se}");
}

#[test]
fn paired_difference_detects_a_better_model_and_not_a_tie() {
    let n = 1500;
    let y = gauss(300, 1, n);
    let w = crps_weights();
    let good = gaussian_summary(0.0, 1.0);
    let bad = gaussian_summary(0.0, 2.0);
    let rows = |g: &evmc::sim::HorizonSummary| -> Vec<ScoreRow> {
        y.iter()
            .map(|r| {
                score(
                    &ForecastView {
                        mean: Some(0.0),
                        sigma: Some(g.std),
                        raw_p_up: Some(0.5),
                        q: Some(&g.q),
                        ..Default::default()
                    },
                    *r,
                    1e-4,
                    &w,
                )
            })
            .collect()
    };
    let (rg, rb) = (rows(&good), rows(&bad));
    let plans: Vec<BlockPlan> = [10usize, 20, 30].iter().map(|l| BlockPlan::new(n, *l, 500, 5, 1)).collect();
    let mut base: BTreeMap<&str, &[ScoreRow]> = BTreeMap::new();
    base.insert("b2_clim", &rb);
    let b = build_model_block("bon", &rg, &y, &base, 10);
    let ev = evaluate_block(&b, &plans, true, 0.95, Some(4));
    let i = b.defs.iter().position(|d| d.name == "crps_diff").unwrap();
    assert!(ev[i].value > 0.0);
    assert_eq!(ev[i].significant, Some(true));
    assert!(ev[i].ci.unwrap().0 > 0.0);
    let k = b.defs.iter().position(|d| d.name == "crps_skill").unwrap();
    assert!(ev[k].value > 0.05 && ev[k].significant.is_none());
    // Même modèle des deux côtés : différence nulle, jamais significative.
    let mut tie: BTreeMap<&str, &[ScoreRow]> = BTreeMap::new();
    tie.insert("b2_clim", &rg);
    let bt = build_model_block("bon", &rg, &y, &tie, 10);
    let evt = evaluate_block(&bt, &plans, true, 0.95, Some(4));
    let j = bt.defs.iter().position(|d| d.name == "crps_diff").unwrap();
    assert_eq!(evt[j].value, 0.0);
    assert_eq!(evt[j].significant, Some(false));
    // Une longueur de bloc inadmissible suspend la règle de décision.
    let evp = evaluate_block(&b, &plans[..2], false, 0.95, Some(4));
    assert_eq!(evp[i].significant, None);
    assert!(evp[i].ci.is_some());
}
