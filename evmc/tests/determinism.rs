//! Déterminisme : même code, mêmes données, même config, même seed -> mêmes valeurs
//! et mêmes lignes dans le même ordre, quel que soit le nombre de threads.

mod common;

use evmc::pipeline::{self, run_all};

fn hashes(threads: usize, tag: &str, seed: u64) -> Vec<(String, String, u64)> {
    let dir = common::tmp_dir(tag);
    let mut cfg = common::test_cfg(&dir);
    cfg.run.seed = seed;
    let series = common::default_series(3200, 31);
    let ctx = common::ctx(cfg, series);
    let out = common::in_pool(threads, || run_all(&ctx).unwrap());
    let checks = pipeline::verify(&ctx.run_dir).unwrap();
    assert!(checks.iter().all(|(_, ok)| *ok), "{checks:?}");
    let h = out.manifest.tables.iter().map(|t| (t.name.clone(), t.logical_hash.clone(), t.rows)).collect();
    std::fs::remove_dir_all(dir).ok();
    h
}

#[test]
fn same_inputs_give_same_tables_whatever_the_thread_count() {
    let a = hashes(1, "det_a", 7);
    let b = hashes(2, "det_b", 7);
    let c = hashes(4, "det_c", 7);
    assert_eq!(a.len(), 6);
    assert_eq!(a, b);
    assert_eq!(a, c);
    // Un autre seed change les tables simulées et rééchantillonnées, pas les autres.
    let d = hashes(2, "det_d", 8);
    for ((name, ha, _), (_, hd, _)) in a.iter().zip(&d) {
        match name.as_str() {
            "features" | "outcomes" => assert_eq!(ha, hd, "{name}"),
            "forecasts" | "metrics" | "scores" | "reliability" => assert_ne!(ha, hd, "{name}"),
            other => panic!("table inattendue : {other}"),
        }
    }
}
