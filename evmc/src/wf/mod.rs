//! Walk-forward : plan de découpage, plis, verrou du holdout.
//! `TrainView` et l'ouverture du holdout arrivent au jalon M4, avec le premier modèle estimé.

pub mod split;

pub use split::{Fold, Split};
