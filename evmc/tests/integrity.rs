//! Données : un fichier non conforme est rejeté, un trou est signalé sans être comblé.

mod common;

use evmc::data::integrity::check;
use evmc::data::loader::{from_bars, load_csv};
use evmc::data::synth::{generate, write_csv, SynthSpec};

fn bars(n: usize) -> Vec<evmc::data::Bar> {
    generate(&SynthSpec { n, seed: 3, ..Default::default() }).0
}

#[test]
fn valid_series_passes() {
    let b = bars(500);
    let (rep, gaps) = check(&b, 86_400);
    assert!(rep.ok(), "{:?}", rep.errors);
    assert_eq!(rep.n_bars, 500);
    assert!(rep.gaps.is_empty());
    assert_eq!(*gaps.last().unwrap(), 0);
}

#[test]
fn duplicate_and_unordered_timestamps_are_rejected() {
    let mut b = bars(50);
    b[10].ts_open = b[9].ts_open;
    b[10].ts_close = b[9].ts_close;
    assert!(from_bars("X", "1d", b).is_err());
    let mut b = bars(50);
    b.swap(20, 21);
    assert!(from_bars("X", "1d", b).is_err());
}

#[test]
fn inconsistent_ohlc_and_bad_values_are_rejected() {
    let mut b = bars(50);
    b[5].high = b[5].low * 0.5;
    assert!(from_bars("X", "1d", b).is_err());
    let mut b = bars(50);
    b[5].volume = -1.0;
    assert!(from_bars("X", "1d", b).is_err());
    let mut b = bars(50);
    b[5].close = f64::NAN;
    assert!(from_bars("X", "1d", b).is_err());
    let mut b = bars(50);
    b[5].low = 0.0;
    assert!(from_bars("X", "1d", b).is_err());
    assert!(from_bars("X", "1d", Vec::new()).is_err());
}

#[test]
fn gaps_are_reported_not_filled() {
    let mut b = bars(100);
    b.remove(40);
    b.remove(40);
    let s = from_bars("X", "1d", b).unwrap();
    assert_eq!(s.len(), 98);
    assert_eq!(s.n_gaps(), 1);
    assert!(s.has_gap(39, 40));
    assert!(!s.has_gap(40, 97));
    assert!(s.has_gap(10, 60));
    let (rep, _) = check(&s.bars, 86_400);
    assert_eq!(rep.gaps, vec![(40, 2)]);
}

#[test]
fn csv_round_trip_keeps_logical_hash() {
    let dir = common::tmp_dir("csv");
    let b = bars(300);
    let direct = from_bars("SYNTH", "1d", b.clone()).unwrap();
    let path = dir.join("x.csv");
    write_csv(&path, &b).unwrap();
    let loaded = load_csv(&path, "SYNTH", "1d", "open_utc_ms").unwrap();
    assert_eq!(loaded.logical_hash, direct.logical_hash);
    // Le symbole et le timeframe font partie de l'identité des données.
    let other = load_csv(&path, "OTHER", "1d", "open_utc_ms").unwrap();
    assert_ne!(other.logical_hash, direct.logical_hash);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn shipped_config_matches_defaults() {
    let shipped = evmc::config::Config::load(std::path::Path::new("configs/mvp.toml")).unwrap();
    assert_eq!(shipped, evmc::config::Config::default_mvp());
}

#[test]
fn planned_models_give_an_explicit_error() {
    let mut cfg = evmc::config::Config::default_mvp();
    cfg.models.enabled = vec!["v2_ridge".into()];
    let err = cfg.validate().unwrap_err().to_string();
    assert!(err.contains("M4"), "{err}");
    cfg.models.enabled = vec!["inconnu".into()];
    assert!(cfg.validate().is_err());
}
