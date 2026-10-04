//! Causalité : aucune sortie à t ne dépend d'une barre postérieure à t.

mod common;

use evmc::data::loader::from_bars;
use evmc::features::FeatureFrame;
use evmc::forecast::engine;
use evmc::forecast::record::ForecastRecord;
use evmc::outcome;

fn key(r: &ForecastRecord) -> (&'static str, u32, u16) {
    (r.model_id, r.bar_idx, r.horizon)
}

fn sorted(mut v: Vec<ForecastRecord>) -> Vec<ForecastRecord> {
    v.sort_by(|a, b| key(a).cmp(&key(b)));
    v
}

#[test]
fn features_are_invariant_to_truncation() {
    let dir = common::tmp_dir("trunc_feat");
    let cfg = common::test_cfg(&dir);
    let full = common::default_series(3200, 21);
    let split = common::plan(&cfg, &full);
    let f_full = FeatureFrame::build(&full, &cfg, &split);
    for cut in [1usize, 2, 33, 501, 1500, 2777] {
        let part = from_bars("SYNTH", "1d", full.bars[..cut].to_vec()).unwrap();
        let f_part = FeatureFrame::build(&part, &cfg, &split);
        assert_eq!(f_part.len(), cut);
        macro_rules! same {
            ($($field:ident),*) => {$(
                assert_eq!(f_part.$field[..], f_full.$field[..cut], "{} à la coupe {}", stringify!($field), cut);
            )*};
        }
        same!(ts, bar_idx, close, warmup_ok, r, h_ewma, h_lr, h_garch, phi, z_ewma, z_garch,
              pool_len, pool_mean, pool_var, log_vol_ratio, vol_regime);
    }
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn forecasts_are_invariant_to_truncation() {
    let dir = common::tmp_dir("trunc_fc");
    let cfg = common::test_cfg(&dir);
    let full = common::default_series(3400, 22);
    let split_full = common::plan(&cfg, &full);
    let feats_full = FeatureFrame::build(&full, &cfg, &split_full);
    let out_full = engine::run(&full, &feats_full, &split_full, &cfg, false).unwrap();

    // Série tronquée : son propre découpage, donc une zone notée plus courte.
    let cut = 3200;
    let part = from_bars("SYNTH", "1d", full.bars[..cut].to_vec()).unwrap();
    let split_part = common::plan(&cfg, &part);
    assert!(split_part.holdout_start < split_full.holdout_start);
    let feats_part = FeatureFrame::build(&part, &cfg, &split_part);
    let out_part = engine::run(&part, &feats_part, &split_part, &cfg, false).unwrap();
    assert!(!out_part.records.is_empty());

    let d = split_part.holdout_start;
    let from_full: Vec<ForecastRecord> =
        sorted(out_full.records.into_iter().filter(|r| r.bar_idx < d).collect());
    let from_part = sorted(out_part.records);
    assert_eq!(from_full.len(), from_part.len());
    // Égalité exacte, Monte Carlo compris : le flux d'aléa ne dépend que de l'origine.
    assert_eq!(from_full, from_part);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn future_perturbation_leaves_the_past_unchanged() {
    let dir = common::tmp_dir("perturb");
    let cfg = common::test_cfg(&dir);
    let base = common::default_series(3200, 23);
    let split = common::plan(&cfg, &base);
    let grid = cfg.grid().unwrap();
    let t0 = 2000usize;
    // Après t0 : prix multipliés par un facteur croissant, volumes doublés.
    let mut bars = base.bars.clone();
    for (i, b) in bars.iter_mut().enumerate().skip(t0 + 1) {
        let f = 1.0 + 0.001 * (i - t0) as f64;
        b.open *= f;
        b.high *= f * 1.01;
        b.low *= f * 0.99;
        b.close *= f;
        b.volume *= 2.0;
    }
    let pert = from_bars("SYNTH", "1d", bars).unwrap();
    assert_ne!(pert.logical_hash, base.logical_hash);

    let f_base = FeatureFrame::build(&base, &cfg, &split);
    let f_pert = FeatureFrame::build(&pert, &cfg, &split);
    assert_eq!(f_base.h_garch[..=t0], f_pert.h_garch[..=t0]);
    assert_eq!(f_base.z_garch[..=t0], f_pert.z_garch[..=t0]);
    assert_eq!(f_base.pool_mean[..=t0], f_pert.pool_mean[..=t0]);
    assert_ne!(f_base.h_garch[t0 + 1..], f_pert.h_garch[t0 + 1..]);

    let fc_base = engine::run(&base, &f_base, &split, &cfg, false).unwrap().records;
    let fc_pert = engine::run(&pert, &f_pert, &split, &cfg, false).unwrap().records;
    let upto = |v: Vec<ForecastRecord>| -> Vec<ForecastRecord> {
        sorted(v.into_iter().filter(|r| r.bar_idx as usize <= t0).collect())
    };
    let (a, b) = (upto(fc_base), upto(fc_pert));
    assert!(!a.is_empty());
    assert_eq!(a, b);

    // Outcomes : identiques tant que la fenêtre se termine avant ou sur t0.
    let o_base = outcome::build(&base, &f_base, &split, &grid, false).unwrap();
    let o_pert = outcome::build(&pert, &f_pert, &split, &grid, false).unwrap();
    let ends_before = |v: &[outcome::OutcomeRow]| -> Vec<outcome::OutcomeRow> {
        v.iter().filter(|r| (r.bar_idx + r.horizon as u32) as usize <= t0).cloned().collect()
    };
    assert_eq!(ends_before(&o_base), ends_before(&o_pert));
    std::fs::remove_dir_all(dir).ok();
}
