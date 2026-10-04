//! Simulation : RNG, noyau de trajectoires, résumés, arrêt adaptatif, oracle analytique.
//! Ce module ne connaît aucun identifiant de modèle : il exécute des `SimInput`.

pub mod analytic;
pub mod kernel;
pub mod rng;

pub use kernel::{simulate, HorizonSummary, ResidSpec, SimInput, SimOutput, Workspace};
