//! Manifest d'un run : tout ce qu'il faut pour le reproduire et le vérifier.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::error::Result;
use crate::io::table::hex;

/// Version du code : version du paquet, commit git, empreinte des sources.
pub fn code_version() -> String {
    format!(
        "{}+git.{}.src.{}",
        env!("CARGO_PKG_VERSION"),
        env!("EVMC_GIT"),
        env!("EVMC_SRC_HASH")
    )
}

/// Hash du lockfile de dépendances embarqué à la compilation.
pub fn cargo_lock_hash() -> String {
    hex(blake3::hash(include_bytes!("../../Cargo.lock")).as_bytes())
}

pub fn rustc_version() -> &'static str {
    env!("EVMC_RUSTC")
}

pub fn target_triple() -> &'static str {
    env!("EVMC_TARGET")
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct DataInfo {
    pub path: String,
    pub rows: u64,
    pub first_ts_close: i64,
    pub last_ts_close: i64,
    pub first_utc: String,
    pub last_utc: String,
    pub n_gaps: u32,
    pub logical_hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct TableInfo {
    pub name: String,
    pub file: String,
    pub rows: u64,
    pub logical_hash: String,
    pub step_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub run_id: String,
    pub created_utc: String,
    pub code_version: String,
    pub cargo_lock_hash: String,
    pub rustc: String,
    pub target: String,
    pub schema_version: u32,
    pub seed: u64,
    pub rng_derivation: String,
    pub symbol: String,
    pub timeframe: String,
    pub profile: String,
    pub threads: usize,
    pub data: DataInfo,
    pub split_lock_hash: String,
    pub holdout_opened: bool,
    pub models: Vec<String>,
    pub notes: Vec<String>,
    pub tables: Vec<TableInfo>,
    pub config: Config,
}

/// Identifiant de run : hash des seules entrées qui déterminent les résultats.
/// La date, le nombre de threads et le dossier de sortie n'y entrent pas.
pub fn run_id(cfg: &Config, data_hash: &str, split_lock_hash: &str) -> String {
    let mut c = cfg.clone();
    c.run.threads = 0;
    c.output.dir = String::new();
    c.output.compression = String::new();
    let mut h = blake3::Hasher::new();
    h.update(b"evmc.run.v1");
    for part in [
        code_version(),
        cargo_lock_hash(),
        Config::section_json(&c),
        data_hash.to_string(),
        split_lock_hash.to_string(),
    ] {
        h.update(&(part.len() as u64).to_le_bytes());
        h.update(part.as_bytes());
    }
    hex(&h.finalize().as_bytes()[..16])
}

impl Manifest {
    pub fn write(&self, path: &Path) -> Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }
    pub fn read(path: &Path) -> Result<Self> {
        Ok(serde_json::from_str(&std::fs::read_to_string(path)?)?)
    }
}

/// Date UTC courante au format ISO 8601.
pub fn now_utc() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    crate::data::loader::format_utc_ms(ms)
}
