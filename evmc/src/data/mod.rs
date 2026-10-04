//! Données : chargement, validation, série de base. Aucune interpolation, aucun trou comblé.

pub mod bars;
pub mod integrity;
pub mod loader;
pub mod resample;
pub mod synth;

pub use bars::{Bar, BarSeries};
