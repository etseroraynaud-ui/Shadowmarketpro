//! EVMC : moteur de recherche et d'évaluation de prévisions probabilistes multi-horizon.
//!
//! Jalons couverts : M0 (données, configuration, découpage, E/S), M1 (outcomes, baselines,
//! métriques, inférence), M2 (volatilité, simulation), et le port du script Pine avec son
//! chemin typique (`legacy`). L'alpha et le walk-forward estimé (M4) viennent ensuite.

// Lints de style écartés : boucles indexées et conditions imbriquées gardées pour la lisibilité numérique.
#![allow(clippy::needless_range_loop, clippy::collapsible_if, clippy::too_many_arguments, clippy::type_complexity)]

pub mod config;
pub mod data;
pub mod error;
pub mod eval;
pub mod features;
pub mod forecast;
pub mod io;
pub mod legacy;
pub mod math;
pub mod models;
pub mod outcome;
pub mod pipeline;
pub mod report;
pub mod sim;
pub mod types;
pub mod vol;
pub mod wf;

pub use error::{Error, Result};
