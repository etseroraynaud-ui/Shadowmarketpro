//! Registre des modèles : identifiants disponibles et identifiants prévus.

use crate::config::Config;
use crate::error::{Error, Result};
use crate::models::baselines::*;
use crate::models::{Forecaster, ModelInfo};
use crate::types::Family;

pub const AVAILABLE: [ModelInfo; 8] = [
    ModelInfo { id: "b1_coin", family: Family::Baseline },
    ModelInfo { id: "b2_clim", family: Family::Baseline },
    ModelInfo { id: "b3_zero", family: Family::Baseline },
    ModelInfo { id: "b4_rw", family: Family::Baseline },
    ModelInfo { id: "b5_drift", family: Family::Baseline },
    ModelInfo { id: "b6_ewma", family: Family::Baseline },
    ModelInfo { id: "b7a_garch_gauss", family: Family::Baseline },
    ModelInfo { id: "b7_garch_fhs", family: Family::Baseline },
];

/// Modèle produit hors du moteur de prévision : le port du script Pine calcule sa propre
/// simulation (étape `legacy`), ses lignes sont jointes à la table des prévisions.
pub const EXTERNAL: [ModelInfo; 1] = [ModelInfo { id: crate::legacy::MODEL_ID, family: Family::EvmcLegacy }];

/// Modèles spécifiés mais pas encore implémentés, avec leur jalon.
pub const PLANNED: [(&str, &str); 13] = [
    ("v2_drift", "M4"),
    ("v2_score", "M4"),
    ("v2_dstate", "M4"),
    ("v2_phase", "M4"),
    ("v2_markov", "M4"),
    ("v2_ridge", "M4"),
    ("legacy_proxy", "M5"),
    ("legacy_no_markov", "M5"),
    ("legacy_no_flipmr", "M5"),
    ("legacy_no_phase", "M5"),
    ("legacy_no_kd", "M5"),
    ("legacy_no_mubase", "M5"),
    ("legacy_no_hyst", "M5"),
];

pub fn lookup(id: &str) -> Result<&'static ModelInfo> {
    if let Some(m) = AVAILABLE.iter().chain(EXTERNAL.iter()).find(|m| m.id == id) {
        return Ok(m);
    }
    if let Some((_, jalon)) = PLANNED.iter().find(|(p, _)| *p == id) {
        return Err(Error::Config(format!(
            "modèle {id} : spécifié, implémentation prévue au jalon {jalon}"
        )));
    }
    Err(Error::Config(format!("modèle inconnu : {id}")))
}

/// Instancie les modèles activés, dans l'ordre de la configuration.
pub fn build(cfg: &Config) -> Result<Vec<Box<dyn Forecaster>>> {
    let grid = cfg.grid()?;
    let mut out: Vec<Box<dyn Forecaster>> = Vec::new();
    for id in &cfg.models.enabled {
        let info = lookup(id)?;
        if EXTERNAL.iter().any(|m| m.id == info.id) {
            continue;
        }
        let m: Box<dyn Forecaster> = match info.id {
            "b1_coin" => Box::new(Coin { info }),
            "b2_clim" => Box::new(Clim::new(info, grid.len())),
            "b3_zero" => Box::new(Zero { info }),
            "b4_rw" => Box::new(Expanding::new(info, false)),
            "b5_drift" => Box::new(Expanding::new(info, true)),
            "b6_ewma" => Box::new(Ewma { info }),
            "b7a_garch_gauss" => Box::new(GarchGauss { info }),
            "b7_garch_fhs" => Box::new(GarchFhs {
                info,
                g_alpha: cfg.vol.garch_alpha,
                g_beta: cfg.vol.garch_beta,
                h_cap_mult: cfg.vol.h_cap_mult,
                pool_min: cfg.vol.pool_min as usize,
            }),
            other => return Err(Error::Config(format!("modèle sans constructeur : {other}"))),
        };
        out.push(m);
    }
    Ok(out)
}
