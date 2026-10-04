//! Découpage : plis disjoints et couvrants, lock figé, holdout inaccessible sans ouverture.

mod common;

use evmc::config::Config;
use evmc::features::FeatureFrame;
use evmc::outcome;
use evmc::sim::rng::{derive_key, index, StreamRng};
use evmc::types::Zone;
use evmc::wf::split::Split;

#[test]
fn fold_properties_hold_for_random_sizes() {
    let mut rng = StreamRng::new(derive_key(11, "synth", &[99]));
    rng.seek(0);
    let mut planned = 0;
    for _ in 0..400 {
        let mut cfg = Config::default_mvp();
        cfg.split.test_fold_bars = 50 + index(rng.next_u64(), 400) as u32;
        cfg.split.holdout_m_target = 5 + index(rng.next_u64(), 30) as u32;
        cfg.split.min_dev_folds = 1 + index(rng.next_u64(), 5) as u32;
        let hs = [1u16, 5, 10, 20, 30, 60, 120];
        cfg.split.holdout_h_star = hs[index(rng.next_u64(), hs.len())];
        let n = 1400 + index(rng.next_u64(), 9000) as u32;
        let Ok(s) = Split::plan(&cfg, n, "h") else { continue };
        planned += 1;
        assert!(s.warm_end < s.eval_start && s.eval_start < s.holdout_start && s.holdout_start < s.data_end);
        assert_eq!(s.data_end, n);
        assert_eq!(s.holdout_bars, (s.m_target + 1) * s.h_star as u32);
        assert!(s.h_star <= s.h_star_requested);
        assert!(s.folds.len() as u32 >= cfg.split.min_dev_folds);
        // Plis contigus, disjoints, couvrant exactement [E, D).
        assert_eq!(s.folds[0].test_start, s.eval_start);
        assert_eq!(s.folds.last().unwrap().test_end, s.holdout_start);
        for w in s.folds.windows(2) {
            assert_eq!(w[0].test_end, w[1].test_start);
            assert!(w[0].test_start < w[0].test_end);
        }
        for t in [0, s.warm_end, s.eval_start, s.holdout_start - 1, s.holdout_start, n - 1] {
            let z = s.zone_of(t);
            assert_eq!(z == Zone::Dev, s.fold_of(t).is_some());
            assert_eq!(s.guard_origin(t, false).is_err(), z == Zone::Holdout);
            assert!(s.guard_origin(t, true).is_ok());
        }
    }
    assert!(planned > 100, "trop peu de plans valides : {planned}");
}

#[test]
fn lock_is_written_once_and_verified() {
    let dir = common::tmp_dir("lock");
    let mut cfg = common::test_cfg(&dir);
    let series = common::default_series(3200, 5);
    let hash = evmc::io::table::hex(&series.logical_hash);
    let split = Split::plan(&cfg, 3200, &hash).unwrap();
    let path = dir.join("split.lock.toml");
    split.write_lock(&path, "2026-01-01T00:00:00Z").unwrap();
    // Un second plan ne peut pas écraser le lock.
    assert!(split.write_lock(&path, "2026-01-02T00:00:00Z").is_err());
    let loaded = Split::load_lock(&path, &cfg, 3200, &hash).unwrap();
    assert_eq!(loaded.lock_hash, split.lock_hash);
    assert_eq!(loaded.folds, split.folds);
    // Autres données, autre config ou lock retouché : refus.
    assert!(Split::load_lock(&path, &cfg, 3201, &hash).is_err());
    assert!(Split::load_lock(&path, &cfg, 3200, "autre").is_err());
    cfg.split.test_fold_bars += 1;
    assert!(Split::load_lock(&path, &cfg, 3200, &hash).is_err());
    cfg.split.test_fold_bars -= 1;
    let txt = std::fs::read_to_string(&path).unwrap();
    let tampered = txt.replace(
        &format!("holdout_start = {}", split.holdout_start),
        &format!("holdout_start = {}", split.holdout_start + 100),
    );
    assert_ne!(txt, tampered);
    std::fs::write(&path, tampered).unwrap();
    assert!(Split::load_lock(&path, &cfg, 3200, &hash).is_err());
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn outcomes_never_touch_the_locked_holdout() {
    let dir = common::tmp_dir("holdout");
    let cfg = common::test_cfg(&dir);
    let series = common::default_series(3200, 6);
    let split = common::plan(&cfg, &series);
    let grid = cfg.grid().unwrap();
    let feats = FeatureFrame::build(&series, &cfg, &split);
    let d = split.holdout_start;
    let locked = outcome::build(&series, &feats, &split, &grid, false).unwrap();
    assert!(!locked.is_empty());
    for r in &locked {
        assert!(r.bar_idx >= split.warm_end);
        assert!(r.bar_idx + (r.horizon as u32) < d, "fenêtre dans le holdout");
        assert_eq!(r.ts_end, series.bars[(r.bar_idx + r.horizon as u32) as usize].ts_close);
        assert!(r.zone == Zone::Seed as u8 || r.zone == Zone::Dev as u8);
        assert_eq!(r.fold_id.is_some(), r.zone == Zone::Dev as u8);
    }
    // Chaque horizon perd ses H dernières origines avant D.
    for &h in grid.as_slice() {
        let n = locked.iter().filter(|r| r.horizon == h).count() as u32;
        assert_eq!(n, d - split.warm_end - h as u32);
    }
    // Après ouverture, les origines du holdout apparaissent et les lignes dev ne changent pas.
    let opened = outcome::build(&series, &feats, &split, &grid, true).unwrap();
    assert!(opened.iter().any(|r| r.bar_idx >= d));
    let dev_after: Vec<_> = opened.iter().filter(|r| r.bar_idx < d).cloned().collect();
    assert_eq!(dev_after, locked);
    std::fs::remove_dir_all(dir).ok();
}
