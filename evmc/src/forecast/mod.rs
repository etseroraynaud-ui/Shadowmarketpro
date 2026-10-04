//! Prévisions : enregistrement immuable après écriture, invariants vérifiés avant écriture.

pub mod engine;
pub mod invariants;
pub mod record;

pub use record::{ForecastFrame, ForecastRecord};
