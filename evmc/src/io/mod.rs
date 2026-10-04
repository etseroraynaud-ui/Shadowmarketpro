//! E/S : tables Parquet, hash logique, manifest. Aucune logique statistique ici.

pub mod manifest;
pub mod parquet;
pub mod table;

pub use table::{hex, Col, Table};
