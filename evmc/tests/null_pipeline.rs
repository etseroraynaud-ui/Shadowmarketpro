//! Pipeline sur données sans signal : l'instrument de mesure ne doit pas fabriquer de skill.
//!
//! Deux expériences unilatérales, sans Monte Carlo, sur le pipeline entier
//! (features, outcomes, prévisions, scores, bootstrap par blocs, règle de décision) :
//!
//! 1. GARCH sans dérive. `b5_drift` extrapole une dérive qui n'existe pas : sa probabilité de
//!    hausse ne peut pas battre pile ou face en espérance. Le déclarer meilleur est un faux positif.
//! 2. Rendements gaussiens i.i.d. `b4_rw` est le modèle exact, `b2_clim` l'estime sans hypothèse :
//!    déclarer `b4_rw` pire que la climatologie est un faux positif.
//!
//! Le contrôle bilatéral exact de l'inférence seule est dans `inference.rs`.

mod common;

use evmc::data::synth::SynthSpec;
use evmc::eval::evaluate;
use evmc::features::FeatureFrame;
use evmc::forecast::engine;
use evmc::forecast::record::to_table;
use evmc::outcome;
use rayon::prelude::*;

/// Pour chaque série : (horizon, déclaré meilleur, déclaré pire) de la métrique demandée.
fn experiment(
    cfg: &evmc::config::Config,
    n_series: usize,
    seed: u64,
    spec: SynthSpec,
    model: &str,
    metric: &str,
    baseline: &str,
) -> Vec<Vec<(u16, bool, bool)>> {
    let grid = cfg.grid().unwrap();
    (0..n_series)
        .into_par_iter()
        .map(|s| {
            let series = common::synth_series(&SynthSpec { seed, id: s as u64, ..spec.clone() });
            let split = common::plan(cfg, &series);
            let feats = FeatureFrame::build(&series, cfg, &split);
            let outs = outcome::build(&series, &feats, &split, &grid, false).unwrap();
            let fc = to_table(engine::run(&series, &feats, &split, cfg, false).unwrap().records);
            let ev = evaluate(&fc, &outs, &split, cfg, false).unwrap();
            ev.metrics
                .iter()
                .filter(|r| {
                    r.scope == "dev"
                        && r.model_id == model
                        && r.metric == metric
                        && r.baseline_id.as_deref() == Some(baseline)
                })
                .map(|r| {
                    let sig = r.significant == Some(true);
                    (r.horizon, sig && r.value > 0.0, sig && r.value < 0.0)
                })
                .collect()
        })
        .collect()
}

fn rates(res: &[Vec<(u16, bool, bool)>], h: u16) -> (f64, f64) {
    let cell: Vec<&(u16, bool, bool)> = res.iter().flatten().filter(|x| x.0 == h).collect();
    assert_eq!(cell.len(), res.len());
    let n = res.len() as f64;
    (
        cell.iter().filter(|x| x.1).count() as f64 / n,
        cell.iter().filter(|x| x.2).count() as f64 / n,
    )
}

#[test]
fn no_skill_is_declared_on_signal_free_series() {
    let dir = common::tmp_dir("null");
    let mut cfg = common::test_cfg(&dir);
    cfg.models.enabled = vec!["b1_coin".into(), "b2_clim".into(), "b4_rw".into(), "b5_drift".into()];
    cfg.eval.bootstrap_reps = 300;
    cfg.validate().unwrap();
    let n_series = 160usize;

    let garch = SynthSpec { n: 3200, t_df: Some(5), ..Default::default() };
    let a = experiment(&cfg, n_series, 5000, garch, "b5_drift", "brier_diff", "b1_coin");
    let iid = SynthSpec { n: 3200, alpha: 0.0, beta: 0.0, ..Default::default() };
    let b = experiment(&cfg, n_series, 6000, iid, "b4_rw", "crps_diff", "b2_clim");

    for &h in cfg.horizons.grid.iter() {
        let (better, worse) = rates(&a, h);
        eprintln!(
            "GARCH sans dérive, Brier b5_drift contre b1_coin, H={h:<3} : déclaré meilleur {:>4.1} %, pire {:>4.1} %",
            100.0 * better,
            100.0 * worse
        );
        // Unilatéral : 2,5 % nominal, marge pour l'aléa sur 160 séries.
        assert!(better <= 0.06, "H={h} : faux positifs {better}");
        let (better, worse) = rates(&b, h);
        eprintln!(
            "Gaussien i.i.d., CRPS b4_rw contre b2_clim, H={h:<3}     : déclaré meilleur {:>4.1} %, pire {:>4.1} %",
            100.0 * better,
            100.0 * worse
        );
        assert!(worse <= 0.06, "H={h} : faux positifs {worse}");
    }
    std::fs::remove_dir_all(dir).ok();
}
