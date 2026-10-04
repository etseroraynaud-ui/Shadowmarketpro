//! Erreurs typées du moteur.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("E/S : {0}")]
    Io(#[from] std::io::Error),
    #[error("CSV : {0}")]
    Csv(#[from] csv::Error),
    #[error("TOML : {0}")]
    TomlDe(#[from] toml::de::Error),
    #[error("TOML : {0}")]
    TomlSer(#[from] toml::ser::Error),
    #[error("JSON : {0}")]
    Json(#[from] serde_json::Error),
    #[error("Parquet : {0}")]
    Parquet(#[from] parquet::errors::ParquetError),
    #[error("Arrow : {0}")]
    Arrow(#[from] arrow::error::ArrowError),
    #[error("configuration invalide : {0}")]
    Config(String),
    #[error("données invalides : {0}")]
    Data(String),
    #[error("découpage : {0}")]
    Split(String),
    #[error("invariant violé : {0}")]
    Invariant(String),
    #[error("holdout verrouillé : {0}")]
    Locked(String),
    #[error("schéma : {0}")]
    Schema(String),
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
