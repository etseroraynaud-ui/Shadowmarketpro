//! Configuration d'un run : un fichier TOML par expérience, validé au chargement
//! et recopié intégralement dans le manifest.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::types::HorizonGrid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub run: RunCfg,
    pub data: DataCfg,
    pub horizons: HorizonsCfg,
    pub warmup: WarmupCfg,
    pub split: SplitCfg,
    pub vol: VolCfg,
    pub sim: BTreeMap<String, SimProfile>,
    pub alpha: AlphaCfg,
    pub models: ModelsCfg,
    pub eval: EvalCfg,
    pub output: OutputCfg,
    /// Contexte de marché lu par le port du script Pine.
    #[serde(default)]
    pub legacy: LegacyCfg,
}

/// Ce que le Pine lit dans `syminfo` : marché ouvert en continu, pas de cotation.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LegacyCfg {
    /// Crypto ou change : semaine de sept jours, année de 365 jours.
    pub h24: bool,
    pub mintick: f64,
}

impl Default for LegacyCfg {
    fn default() -> Self {
        Self { h24: true, mintick: 0.01 }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RunCfg {
    pub name: String,
    pub seed: u64,
    pub profile: String,
    /// 0 = tous les coeurs.
    pub threads: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AuxData {
    pub timeframe: String,
    pub path: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct DataCfg {
    pub symbol: String,
    pub timeframe: String,
    pub path: String,
    /// open_utc_ms | open_utc_s | close_utc_ms | open_iso
    pub ts_convention: String,
    #[serde(default)]
    pub aux: Vec<AuxData>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct HorizonsCfg {
    pub grid: Vec<u16>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct WarmupCfg {
    pub min_bars: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SplitCfg {
    pub lock_file: String,
    pub min_train_bars: u32,
    pub test_fold_bars: u32,
    pub holdout_h_star: u16,
    pub holdout_m_target: u32,
    pub holdout_max_frac: f64,
    pub min_dev_folds: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct VolCfg {
    pub ewma_lambda: f64,
    pub lr_len: u32,
    pub garch_alpha: f64,
    pub garch_beta: f64,
    pub h_cap_mult: f64,
    pub pool_size: u32,
    pub pool_min: u32,
    pub resid_clamp: f64,
}

/// Profil d'arrêt adaptatif. Tolérances de quantiles et de moyenne en unités de sigma_H.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SimProfile {
    pub n_min: u32,
    pub n_max: u32,
    pub batch: u32,
    pub tol_p: f64,
    pub tol_q: f64,
    pub tol_mean: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AlphaCfg {
    pub target_clamp: f64,
    pub alpha_z_cap: f64,
    pub ridge_lambda0: f64,
    pub standardize: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ModelsCfg {
    pub enabled: Vec<String>,
    pub legacy_defaults: String,
    /// rstab | final
    pub legacy_target: String,
    #[serde(default)]
    pub features: BTreeMap<String, Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct EvalCfg {
    /// per_horizon | common_origin
    pub support: String,
    pub bootstrap_reps: u32,
    pub block_mult: Vec<f64>,
    pub block_min: u32,
    pub ci_level: f64,
    pub hac: bool,
    pub reliability_bins: u32,
    pub logloss_clip: f64,
    pub warn_n_over_h: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct OutputCfg {
    pub dir: String,
    pub compression: String,
}

/// Convertit un libellé de timeframe ("1d", "4h", "15m", "1w") en secondes.
pub fn timeframe_secs(tf: &str) -> Result<u32> {
    let tf = tf.trim().to_ascii_lowercase();
    if tf.len() < 2 {
        return Err(Error::Config(format!("timeframe illisible : {tf}")));
    }
    let (num, unit) = tf.split_at(tf.len() - 1);
    let n: u32 = num
        .parse()
        .map_err(|_| Error::Config(format!("timeframe illisible : {tf}")))?;
    let mult = match unit {
        "m" => 60,
        "h" => 3600,
        "d" => 86_400,
        "w" => 604_800,
        _ => return Err(Error::Config(format!("unité de timeframe inconnue : {tf}"))),
    };
    if n == 0 {
        return Err(Error::Config(format!("timeframe nul : {tf}")));
    }
    Ok(n * mult)
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let txt = std::fs::read_to_string(path).map_err(|e| {
            Error::Config(format!("lecture de {} impossible : {e}", path.display()))
        })?;
        let cfg: Config = toml::from_str(&txt)?;
        cfg.validate()?;
        Ok(cfg)
    }

    pub fn grid(&self) -> Result<HorizonGrid> {
        HorizonGrid::new(self.horizons.grid.clone())
    }

    /// Profil de simulation actif.
    pub fn profile(&self) -> Result<SimProfile> {
        self.sim.get(&self.run.profile).copied().ok_or_else(|| {
            Error::Config(format!("profil de simulation inconnu : {}", self.run.profile))
        })
    }

    /// alpha + beta du filtre GARCH de référence.
    pub fn phi(&self) -> f64 {
        self.vol.garch_alpha + self.vol.garch_beta
    }

    pub fn validate(&self) -> Result<()> {
        let grid = self.grid()?;
        let h_max = grid.h_max() as u32;
        timeframe_secs(&self.data.timeframe)?;
        for a in &self.data.aux {
            timeframe_secs(&a.timeframe)?;
        }
        match self.data.ts_convention.as_str() {
            "open_utc_ms" | "open_utc_s" | "close_utc_ms" | "open_iso" => {}
            other => {
                return Err(Error::Config(format!("data.ts_convention inconnue : {other}")));
            }
        }
        if self.split.min_train_bars < h_max + 250 {
            return Err(Error::Config(format!(
                "split.min_train_bars = {} doit être >= Hmax + 250 = {}",
                self.split.min_train_bars,
                h_max + 250
            )));
        }
        if self.split.test_fold_bars == 0 || self.split.holdout_m_target == 0 {
            return Err(Error::Config(
                "split.test_fold_bars et split.holdout_m_target doivent être > 0".into(),
            ));
        }
        if !grid.contains(self.split.holdout_h_star) {
            return Err(Error::Config(format!(
                "split.holdout_h_star = {} n'est pas dans la grille d'horizons",
                self.split.holdout_h_star
            )));
        }
        if !(self.split.holdout_max_frac > 0.0 && self.split.holdout_max_frac < 1.0) {
            return Err(Error::Config("split.holdout_max_frac doit être dans ]0, 1[".into()));
        }
        let v = &self.vol;
        if !(v.ewma_lambda > 0.0 && v.ewma_lambda < 1.0) {
            return Err(Error::Config("vol.ewma_lambda doit être dans ]0, 1[".into()));
        }
        if v.garch_alpha < 0.0 || v.garch_beta < 0.0 || v.garch_alpha + v.garch_beta >= 1.0 {
            return Err(Error::Config(
                "vol.garch_alpha + vol.garch_beta doit être < 1, coefficients >= 0".into(),
            ));
        }
        if v.pool_min == 0 || v.pool_min > v.pool_size {
            return Err(Error::Config("vol.pool_min doit être dans [1, pool_size]".into()));
        }
        if v.lr_len < 2 || v.h_cap_mult <= 1.0 || v.resid_clamp <= 0.0 {
            return Err(Error::Config("section [vol] : valeurs hors bornes".into()));
        }
        if self.sim.is_empty() {
            return Err(Error::Config("aucun profil [sim.*] défini".into()));
        }
        for (name, p) in &self.sim {
            if p.batch == 0 || p.n_min < 2 * p.batch || p.n_max < p.n_min {
                return Err(Error::Config(format!(
                    "profil sim.{name} : il faut batch > 0, n_min >= 2 x batch, n_max >= n_min"
                )));
            }
            if p.n_min % p.batch != 0 || p.n_max % p.batch != 0 {
                return Err(Error::Config(format!(
                    "profil sim.{name} : n_min et n_max doivent être multiples de batch"
                )));
            }
            if p.tol_p <= 0.0 || p.tol_q <= 0.0 || p.tol_mean <= 0.0 {
                return Err(Error::Config(format!("profil sim.{name} : tolérances <= 0")));
            }
        }
        self.profile()?;
        if self.models.enabled.is_empty() {
            return Err(Error::Config("models.enabled est vide".into()));
        }
        let mut seen = std::collections::BTreeSet::new();
        for id in &self.models.enabled {
            if !seen.insert(id.as_str()) {
                return Err(Error::Config(format!("modèle en double : {id}")));
            }
            crate::models::registry::lookup(id)?;
        }
        match self.models.legacy_target.as_str() {
            "rstab" | "final" => {}
            o => return Err(Error::Config(format!("models.legacy_target inconnu : {o}"))),
        }
        let e = &self.eval;
        match e.support.as_str() {
            "per_horizon" | "common_origin" => {}
            o => return Err(Error::Config(format!("eval.support inconnu : {o}"))),
        }
        if e.block_mult.is_empty() || e.block_mult.iter().any(|m| *m <= 0.0) {
            return Err(Error::Config("eval.block_mult : valeurs > 0 requises".into()));
        }
        if e.bootstrap_reps < 100 || e.block_min == 0 {
            return Err(Error::Config(
                "eval.bootstrap_reps >= 100 et eval.block_min >= 1 requis".into(),
            ));
        }
        if !(e.ci_level > 0.5 && e.ci_level < 1.0) {
            return Err(Error::Config("eval.ci_level doit être dans ]0.5, 1[".into()));
        }
        if e.reliability_bins < 2 || !(e.logloss_clip > 0.0 && e.logloss_clip < 0.5) {
            return Err(Error::Config("section [eval] : valeurs hors bornes".into()));
        }
        match self.output.compression.as_str() {
            "zstd" | "none" => {}
            o => return Err(Error::Config(format!("output.compression inconnue : {o}"))),
        }
        Ok(())
    }

    /// Représentation canonique d'une section, pour les clés de cache.
    pub fn section_json<T: Serialize>(section: &T) -> String {
        serde_json::to_string(section).expect("section sérialisable")
    }

    /// Configuration par défaut du MVP (tests et génération de gabarit).
    pub fn default_mvp() -> Self {
        let mut sim = BTreeMap::new();
        sim.insert(
            "fast".to_string(),
            SimProfile { n_min: 1000, n_max: 4000, batch: 500, tol_p: 0.015, tol_q: 0.07, tol_mean: 0.03 },
        );
        sim.insert(
            "normal".to_string(),
            SimProfile { n_min: 2000, n_max: 20000, batch: 1000, tol_p: 0.0075, tol_q: 0.035, tol_mean: 0.015 },
        );
        sim.insert(
            "validation".to_string(),
            SimProfile { n_min: 10000, n_max: 100000, batch: 5000, tol_p: 0.003, tol_q: 0.015, tol_mean: 0.006 },
        );
        let mut features = BTreeMap::new();
        let feat = |v: &[&str]| -> Vec<String> { v.iter().map(|s| s.to_string()).collect() };
        features.insert("v2_drift".to_string(), feat(&[]));
        features.insert("v2_score".to_string(), feat(&["score_raw"]));
        features.insert("v2_dstate".to_string(), feat(&["d_state"]));
        features.insert("v2_phase".to_string(), feat(&["score_raw", "phase_range", "phase_coil"]));
        features.insert("v2_markov".to_string(), feat(&["score_raw", "mk_bull", "mk_bear"]));
        features.insert(
            "v2_ridge".to_string(),
            feat(&["f_d", "f_v", "f_r", "f_a", "f_m", "f_z", "compression", "log_vol_ratio"]),
        );
        Config {
            run: RunCfg { name: "mvp".into(), seed: 20261003, profile: "normal".into(), threads: 0 },
            data: DataCfg {
                symbol: "SYNTH".into(),
                timeframe: "1d".into(),
                path: "data/synth_1d.csv".into(),
                ts_convention: "open_utc_ms".into(),
                aux: vec![],
            },
            horizons: HorizonsCfg { grid: vec![1, 2, 3, 5, 7, 10, 14, 20, 30, 45, 60, 90, 120] },
            warmup: WarmupCfg { min_bars: 750 },
            split: SplitCfg {
                lock_file: "configs/mvp.split.lock.toml".into(),
                min_train_bars: 750,
                test_fold_bars: 250,
                holdout_h_star: 30,
                holdout_m_target: 20,
                holdout_max_frac: 0.35,
                min_dev_folds: 4,
            },
            vol: VolCfg {
                ewma_lambda: 0.94,
                lr_len: 500,
                garch_alpha: 0.06,
                garch_beta: 0.92,
                h_cap_mult: 25.0,
                pool_size: 750,
                pool_min: 250,
                resid_clamp: 8.0,
            },
            sim,
            alpha: AlphaCfg { target_clamp: 4.0, alpha_z_cap: 0.5, ridge_lambda0: 50.0, standardize: true },
            models: ModelsCfg {
                enabled: crate::models::registry::AVAILABLE.iter().map(|m| m.id.to_string()).collect(),
                legacy_defaults: "configs/legacy_defaults.toml".into(),
                legacy_target: "rstab".into(),
                features,
            },
            eval: EvalCfg {
                support: "per_horizon".into(),
                bootstrap_reps: 2000,
                block_mult: vec![1.0, 2.0, 3.0],
                block_min: 10,
                ci_level: 0.95,
                hac: true,
                reliability_bins: 10,
                logloss_clip: 1e-4,
                warn_n_over_h: 30,
            },
            output: OutputCfg { dir: "runs".into(), compression: "zstd".into() },
            legacy: LegacyCfg::default(),
        }
    }
}
