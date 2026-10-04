//! Port du script Pine dans le pipeline : tables produites, jonction aux prévisions,
//! évaluation des chemins, page, cache, et indépendance au nombre de threads.

mod common;

use evmc::io::parquet::read_table;
use evmc::legacy::MODEL_ID;
use evmc::pipeline::run_all;
use evmc::report::dashboard;

#[test]
fn legacy_model_runs_end_to_end() {
    let dir = common::tmp_dir("legacy");
    let mut cfg = common::test_cfg(&dir);
    cfg.models.enabled = vec!["b1_coin".into(), "b2_clim".into(), "b5_drift".into(), MODEL_ID.into()];
    cfg.validate().unwrap();
    let series = common::default_series(3000, 23);
    let ctx = common::ctx(cfg.clone(), series.clone());
    assert!(ctx.legacy.is_some());
    let out = common::in_pool(2, || run_all(&ctx).unwrap());
    let (e, d) = (ctx.split.eval_start as usize, ctx.split.holdout_start as usize);
    let n_or = d - e;
    let n_h = cfg.horizons.grid.len();

    // --- tables du port
    let names: Vec<&str> = out.manifest.tables.iter().map(|t| t.name.as_str()).collect();
    for t in ["legacy_paths", "legacy_state", "legacy_dist", "path_metrics", "path_select"] {
        assert!(names.contains(&t), "table {t} absente du manifest");
    }
    let paths = read_table(&ctx.run_dir.join("legacy_paths.parquet"), "legacy_paths").unwrap();
    let state = read_table(&ctx.run_dir.join("legacy_state.parquet"), "legacy_state").unwrap();
    assert_eq!(state.n_rows(), n_or);
    assert_eq!(paths.n_rows(), n_or * 120);
    // aucune origine dans le holdout
    assert!(state.u32("bar_idx").unwrap().iter().all(|b| (*b as usize) >= e && (*b as usize) < d));

    // --- le modèle legacy est noté comme les autres
    let fc = read_table(&ctx.run_dir.join("forecasts.parquet"), "forecasts").unwrap();
    let n_legacy = fc.str("model_id").unwrap().iter().filter(|m| m.as_str() == MODEL_ID).count();
    assert_eq!(n_legacy, n_or * n_h);
    let metrics = evmc::eval::metrics_from_table(&out.metrics).unwrap();
    assert!(metrics.iter().any(|m| m.model_id == MODEL_ID && m.metric == "crps_skill" && m.scope == "dev"));
    assert!(metrics.iter().any(|m| m.model_id == MODEL_ID && m.metric == "cov90" && m.scope == "dev"));

    // --- évaluation des chemins : un taux de bonne direction par pas, entre 0 et 1
    let pm = read_table(&ctx.run_dir.join("path_metrics.parquet"), "path_metrics").unwrap();
    let (model, slice, scope) = (pm.str("model_id").unwrap(), pm.str("slice").unwrap(), pm.str("scope").unwrap());
    let (metric, step, value) = (pm.str("metric").unwrap(), pm.u16("step").unwrap(), pm.f64("value").unwrap());
    let mut seen = [false; 121];
    for i in 0..pm.n_rows() {
        if model[i] == "evmc_typical" && slice[i] == "all" && scope[i] == "dev" && metric[i] == "hit" {
            assert!((0.0..=1.0).contains(&value[i]));
            seen[step[i] as usize] = true;
        }
        // le chemin « prix inchangé » n'annonce aucun sens : pas de taux de direction
        assert!(!(model[i] == "ref_zero" && metric[i] == "hit"));
    }
    // les fenêtres ne sortent pas de la zone visible : tous les pas ont des origines tant que n_or > 120
    assert!(seen[1..=120].iter().all(|s| *s));
    // la référence « dérive » a un avantage nul sur elle-même : la mesure n'est pas produite
    assert!(!(0..pm.n_rows()).any(|i| model[i] == "ref_drift" && metric[i] == "hit_edge"));

    // --- page : bloc legacy présent et dimensionné
    let data = dashboard::build_data(&ctx, &out.manifest).unwrap();
    let lg = &data["legacy"];
    assert_eq!(lg["h"].as_u64().unwrap(), 120);
    assert_eq!(lg["typ"].as_str().unwrap().len(), (n_or * 120 * 2).div_ceil(3) * 4);
    assert_eq!(lg["wu"].as_str().unwrap().len(), (n_or * 120).div_ceil(3) * 4);
    assert_eq!(lg["state"]["dir"].as_array().unwrap().len(), n_or);
    assert_eq!(lg["pm"]["v"]["hit|evmc_typical|all"].as_array().unwrap().len(), 120);
    assert!(data["models"].as_array().unwrap().iter().any(|m| m["id"] == MODEL_ID && m["dist"] == true));

    // --- cache : rien n'est recalculé au second passage
    let again = ctx.step_legacy().unwrap().unwrap();
    assert!(again.iter().all(|t| t.cached));

    // --- même résultat avec un autre nombre de threads, dans un autre dossier
    let dir2 = common::tmp_dir("legacy_t1");
    let mut cfg2 = cfg.clone();
    cfg2.output.dir = dir2.to_string_lossy().to_string();
    let ctx2 = common::ctx(cfg2, series);
    assert_eq!(ctx2.run_id, ctx.run_id);
    let solo = common::in_pool(1, || ctx2.step_legacy().unwrap().unwrap());
    for (a, b) in again.iter().zip(solo.iter()) {
        assert!(!b.cached);
        assert_eq!(a.info.logical_hash, b.info.logical_hash, "{}", a.info.name);
    }
    std::fs::remove_dir_all(dir).ok();
    std::fs::remove_dir_all(dir2).ok();
}
