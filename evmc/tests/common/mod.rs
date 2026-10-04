//! Outils partagés par les tests d'intégration.
#![allow(dead_code)]

use std::path::{Path, PathBuf};

use evmc::config::Config;
use evmc::data::loader::from_bars;
use evmc::data::synth::{generate, SynthSpec};
use evmc::data::BarSeries;
use evmc::io::table::hex;
use evmc::pipeline::Ctx;
use evmc::wf::split::Split;

/// Dossier temporaire propre à un test.
pub fn tmp_dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("evmc_test_{}_{}", name, std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

/// Configuration réduite : grille courte, profil rapide, peu de répliques.
pub fn test_cfg(out: &Path) -> Config {
    let mut c = Config::default_mvp();
    c.run.profile = "fast".into();
    c.horizons.grid = vec![1, 5, 20, 60];
    c.split.holdout_h_star = 20;
    c.eval.bootstrap_reps = 200;
    c.output.dir = out.to_string_lossy().to_string();
    c.validate().unwrap();
    c
}

pub fn synth_series(spec: &SynthSpec) -> BarSeries {
    let (bars, _) = generate(spec);
    from_bars("SYNTH", "1d", bars).unwrap()
}

pub fn default_series(n: usize, seed: u64) -> BarSeries {
    synth_series(&SynthSpec { n, seed, t_df: Some(5), ..Default::default() })
}

pub fn plan(cfg: &Config, series: &BarSeries) -> Split {
    Split::plan(cfg, series.len() as u32, &hex(&series.logical_hash)).unwrap()
}

pub fn ctx(cfg: Config, series: BarSeries) -> Ctx {
    let split = plan(&cfg, &series);
    Ctx::from_parts(cfg, series, split)
}

/// Exécute `f` dans un pool rayon de `threads` threads.
pub fn in_pool<T: Send>(threads: usize, f: impl FnOnce() -> T + Send) -> T {
    rayon::ThreadPoolBuilder::new().num_threads(threads).build().unwrap().install(f)
}
