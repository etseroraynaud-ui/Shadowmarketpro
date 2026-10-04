//! Types scalaires partagés par tous les modules.

use crate::error::{Error, Result};

/// Millisecondes UTC de la clôture de barre : instant où l'information devient disponible.
pub type Ts = i64;
/// Index dans la série de base.
pub type BarIdx = u32;
/// Horizon en nombre de barres.
pub type Horizon = u16;

/// Nombre de niveaux de la grille de quantiles.
pub const N_Q: usize = 21;

/// Grille de quantiles du schéma version 1.
pub const QGRID: [f64; N_Q] = [
    0.005, 0.01, 0.025, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80,
    0.85, 0.90, 0.95, 0.975, 0.99, 0.995,
];

/// Noms de colonnes des quantiles : niveau × 10 000.
pub const QNAMES: [&str; N_Q] = [
    "q0050", "q0100", "q0250", "q0500", "q1000", "q1500", "q2000", "q2500", "q3000", "q4000",
    "q5000", "q6000", "q7000", "q7500", "q8000", "q8500", "q9000", "q9500", "q9750", "q9900",
    "q9950",
];

// Positions utiles dans QGRID.
pub const IQ_025: usize = 2;
pub const IQ_05: usize = 3;
pub const IQ_10: usize = 4;
pub const IQ_25: usize = 7;
pub const IQ_50: usize = 10;
pub const IQ_75: usize = 13;
pub const IQ_90: usize = 16;
pub const IQ_95: usize = 17;
pub const IQ_975: usize = 18;

/// Quantiles surveillés par l'arrêt adaptatif (5, 25, 50, 75, 95 %).
pub const WATCHED_Q: [usize; 5] = [IQ_05, IQ_25, IQ_50, IQ_75, IQ_95];

/// Zone d'une origine dans le découpage.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Zone {
    Warmup = 0,
    Seed = 1,
    Dev = 2,
    Holdout = 3,
}

/// Famille d'un modèle.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Family {
    Baseline,
    EvmcLegacy,
    EvmcResearchV2,
}

impl Family {
    pub fn as_str(&self) -> &'static str {
        match self {
            Family::Baseline => "BASELINE",
            Family::EvmcLegacy => "EVMC_LEGACY",
            Family::EvmcResearchV2 => "EVMC_RESEARCH_V2",
        }
    }
}

/// Grille d'horizons validée : triée, sans doublon, strictement positive.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HorizonGrid {
    h: Vec<Horizon>,
}

impl HorizonGrid {
    pub fn new(h: Vec<Horizon>) -> Result<Self> {
        if h.is_empty() {
            return Err(Error::Config("horizons.grid est vide".into()));
        }
        if h[0] == 0 {
            return Err(Error::Config("horizons.grid contient 0".into()));
        }
        for w in h.windows(2) {
            if w[1] <= w[0] {
                return Err(Error::Config(
                    "horizons.grid doit être strictement croissante".into(),
                ));
            }
        }
        Ok(Self { h })
    }
    pub fn as_slice(&self) -> &[Horizon] {
        &self.h
    }
    pub fn len(&self) -> usize {
        self.h.len()
    }
    pub fn is_empty(&self) -> bool {
        self.h.is_empty()
    }
    pub fn h_max(&self) -> Horizon {
        *self.h.last().unwrap()
    }
    pub fn contains(&self, h: Horizon) -> bool {
        self.h.binary_search(&h).is_ok()
    }
}
