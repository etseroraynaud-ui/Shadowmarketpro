//! Manifest, cache par étape, vérification d'un run archivé, contenu des tables.

mod common;

use evmc::eval::{metrics_from_table, reliability_from_table};
use evmc::io::manifest::Manifest;
use evmc::io::parquet::{read_table, write_table};
use evmc::io::table::{Col, Table};
use evmc::pipeline::{self, run_all};
use evmc::report::write_report;

#[test]
fn full_run_is_verifiable_cached_and_reported() {
    let dir = common::tmp_dir("manifest");
    let cfg = common::test_cfg(&dir);
    let series = common::default_series(3200, 41);
    let ctx = common::ctx(cfg.clone(), series.clone());
    let out = common::in_pool(2, || run_all(&ctx).unwrap());
    let d = ctx.split.holdout_start;
    let e = ctx.split.eval_start;

    // --- manifest
    let m = Manifest::read(&ctx.run_dir.join("manifest.json")).unwrap();
    assert_eq!(m, out.manifest);
    assert_eq!(m.run_id, ctx.run_id);
    assert_eq!(m.seed, cfg.run.seed);
    assert_eq!(m.config, cfg);
    assert_eq!(m.data.rows, 3200);
    assert_eq!(m.split_lock_hash, ctx.split.lock_hash);
    assert!(!m.holdout_opened);
    assert!(m.code_version.contains("src."));
    assert_eq!(m.cargo_lock_hash.len(), 64);
    let names: Vec<&str> = m.tables.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(names, ["features", "forecasts", "metrics", "outcomes", "reliability", "scores"]);
    assert!(pipeline::verify(&ctx.run_dir).unwrap().iter().all(|(_, ok)| *ok));

    // --- prévisions : toutes les origines de la zone notée, aucune du holdout
    let fc = read_table(&ctx.run_dir.join("forecasts.parquet"), "forecasts").unwrap();
    let bars = fc.u32("bar_idx").unwrap();
    assert!(bars.iter().all(|b| *b >= e && *b < d));
    let n_models = cfg.models.enabled.len();
    assert_eq!(fc.n_rows(), (d - e) as usize * n_models * cfg.horizons.grid.len());
    // Triées par (model_id, ts, horizon).
    let (ids, ts, hz) = (fc.str("model_id").unwrap(), fc.i64("ts").unwrap(), fc.u16("horizon").unwrap());
    for i in 1..fc.n_rows() {
        let a = (&ids[i - 1], ts[i - 1], hz[i - 1]);
        let b = (&ids[i], ts[i], hz[i]);
        assert!(a < b, "ordre des lignes à {i}");
    }
    // Champs nuls selon le modèle.
    let p = fc.nf64("raw_p_up").unwrap();
    let q50 = fc.nf64("q5000").unwrap();
    let mean = fc.nf64("predictive_mean").unwrap();
    let nsims = fc.u32("n_sims").unwrap();
    for i in 0..fc.n_rows() {
        match ids[i].as_str() {
            "b1_coin" => assert!(p[i] == Some(0.5) && q50[i].is_none() && mean[i].is_none()),
            "b3_zero" => assert!(p[i].is_none() && q50[i].is_none() && mean[i] == Some(0.0)),
            "b7_garch_fhs" => assert!(nsims[i] >= 1000 && q50[i].is_some()),
            _ => assert!(nsims[i] == 0 && p[i].is_some() && q50[i].is_some() && mean[i].is_some()),
        }
    }

    // --- métriques
    let metrics = metrics_from_table(&out.metrics).unwrap();
    let rel = reliability_from_table(&out.reliability).unwrap();
    assert!(metrics.iter().all(|r| r.value.is_finite()));
    let find = |model: &str, base: Option<&str>, h: u16, scope: &str, name: &str| {
        metrics
            .iter()
            .find(|r| {
                r.model_id == model
                    && r.baseline_id.as_deref() == base
                    && r.horizon == h
                    && r.scope == scope
                    && r.metric == name
            })
            .unwrap_or_else(|| panic!("métrique absente : {model} {base:?} {h} {scope} {name}"))
    };
    let brier = find("b1_coin", None, 1, "dev", "brier");
    assert_eq!(brier.value, 0.25);
    assert_eq!(brier.n_obs, d - e - 1);
    assert_eq!(brier.n_over_h, d - e - 1);
    let crps = find("b7_garch_fhs", None, 5, "dev", "crps");
    assert!(crps.ci_lo.unwrap() < crps.value && crps.value < crps.ci_hi.unwrap());
    assert!(crps.hac_se.unwrap() > 0.0 && crps.block_len.is_some());
    let diff = find("b7_garch_fhs", Some("b2_clim"), 5, "dev", "crps_diff");
    assert!(diff.significant.is_some());
    let skill = find("b7_garch_fhs", Some("b2_clim"), 5, "dev", "crps_skill");
    assert_eq!(skill.value > 0.0, diff.value > 0.0);
    // Les horizons longs sont signalés par le diagnostic n / H.
    let long = find("b2_clim", None, 60, "dev", "crps");
    assert_eq!(long.n_over_h, long.n_obs / 60);
    assert_eq!(long.warn_low_n, long.n_over_h < cfg.eval.warn_n_over_h);
    // Par pli : valeurs sans intervalle.
    let fold = find("b7_garch_fhs", None, 5, "fold_0", "crps");
    assert!(fold.ci_lo.is_none() && fold.hac_se.is_none());
    // Excursions : quantiles croissants.
    let (a, b, c) = (
        find("_outcomes", None, 20, "dev", "long_mfe_sig_h_q50").value,
        find("_outcomes", None, 20, "dev", "long_mfe_sig_h_q75").value,
        find("_outcomes", None, 20, "dev", "long_mfe_sig_h_q90").value,
    );
    assert!(0.0 <= a && a <= b && b <= c);
    assert_eq!(
        find("_outcomes", None, 20, "dev", "short_mae_sig_h_q75").value,
        find("_outcomes", None, 20, "dev", "long_mfe_sig_h_q75").value
    );
    // Fiabilité : effectifs égaux, fréquences dans [0, 1].
    let r5: Vec<_> = rel.iter().filter(|r| r.model_id == "b2_clim" && r.horizon == 5).collect();
    assert_eq!(r5.len(), cfg.eval.reliability_bins as usize);
    let total: u32 = r5.iter().map(|r| r.n).sum();
    assert_eq!(total, find("b2_clim", None, 5, "dev", "brier").n_obs);
    assert!(r5.iter().all(|r| (0.0..=1.0).contains(&r.y_freq) && r.ci_lo <= r.y_freq && r.y_freq <= r.ci_hi));
    assert!(r5.windows(2).all(|w| w[0].p_mean <= w[1].p_mean));

    // --- rapport
    let files = write_report(&ctx.run_dir, &m, &ctx.split, &metrics, &rel).unwrap();
    assert_eq!(files.len(), 4);
    let md = std::fs::read_to_string(ctx.run_dir.join("report/summary.md")).unwrap();
    assert!(md.contains("b7_garch_fhs") && md.contains("verrouillé"));

    // --- cache : un second run ne recalcule rien et donne les mêmes hash
    let f = ctx.step_features().unwrap();
    assert!(f.cached);
    let (fc2, stats) = ctx.step_forecast(&f, None).unwrap();
    assert!(fc2.cached && stats.is_none());
    let again = common::in_pool(2, || run_all(&ctx).unwrap());
    for (a, b) in m.tables.iter().zip(&again.manifest.tables) {
        assert_eq!((a.name.as_str(), &a.logical_hash), (b.name.as_str(), &b.logical_hash));
    }

    // --- changer la section eval ne relance ni les features ni les prévisions
    let mut cfg2 = cfg.clone();
    cfg2.eval.bootstrap_reps = 150;
    let ctx2 = common::ctx(cfg2, series);
    assert_ne!(ctx2.run_id, ctx.run_id);
    let f2 = ctx2.step_features().unwrap();
    let (fc3, _) = ctx2.step_forecast(&f2, None).unwrap();
    assert!(f2.cached && fc3.cached);
    assert_eq!(fc3.info.logical_hash, fc2.info.logical_hash);
    let o2 = ctx2.step_outcomes(&f2).unwrap();
    assert!(o2.cached);
    let ev = common::in_pool(2, || ctx2.step_evaluate(&fc3, &o2).unwrap());
    assert!(!ev[1].cached);

    // --- une table altérée est détectée
    let path = ctx.run_dir.join("outcomes.parquet");
    let t = read_table(&path, "outcomes").unwrap();
    let mut ret = t.f64("ret").unwrap().to_vec();
    ret[10] += 1e-9;
    let mut altered = Table::new("outcomes");
    for name in t.col_names() {
        let col = if name == "ret" { Col::F64(ret.clone()) } else { t.col(name).unwrap().clone() };
        altered.push(name, col);
    }
    std::fs::remove_file(&path).unwrap();
    write_table(&path, &altered, "zstd", &[]).unwrap();
    let checks = pipeline::verify(&ctx.run_dir).unwrap();
    assert_eq!(checks.iter().filter(|(_, ok)| !*ok).map(|(n, _)| n.as_str()).collect::<Vec<_>>(), ["outcomes"]);
    std::fs::remove_dir_all(dir).ok();
}
