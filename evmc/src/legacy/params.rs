//! Inputs du Pine « EVMC Directional », sous leur nom d'origine.
//! Le fichier `configs/legacy_defaults.toml` en est la source ; les inputs d'affichage
//! qu'il contient sont ignorés ici.

#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

/// Valeurs par défaut du script, embarquées pour les tests et comme repli.
const PINE_DEFAULTS: &str = include_str!("../../configs/legacy_defaults.toml");

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LegacyParams {
    // --- Projection
    pub i_H: usize,
    pub i_engine: String,
    pub i_sims: usize,
    pub i_mcBudget: usize,
    pub i_bins: usize,
    // --- Volatilité
    pub i_ewma_lambda: f64,
    pub i_lrLen: u32,
    pub i_gAlpha: f64,
    pub i_gBeta: f64,
    pub i_useFHS: bool,
    pub i_poolN: usize,
    pub i_atrLen: u32,
    // --- Dérive
    pub i_dL1: usize,
    pub i_dL2: usize,
    pub i_dL3: usize,
    pub i_dW1: f64,
    pub i_dW2: f64,
    pub i_dW3: f64,
    pub i_t0: f64,
    pub i_driftCap: f64,
    // --- Score directionnel
    pub i_wD: f64,
    pub i_wV: f64,
    pub i_wR: f64,
    pub i_wA: f64,
    pub i_wM: f64,
    pub i_wZ: f64,
    pub i_maxShare: f64,
    pub i_scoreGain: f64,
    pub i_extThr: f64,
    pub i_extWidth: f64,
    pub i_useRsi: bool,
    // --- VWAP ancrés
    pub i_avL: usize,
    pub i_avR: usize,
    pub i_avMode: String,
    pub i_rvWW: f64,
    pub i_rvWD: f64,
    pub i_rvW4: f64,
    pub i_rvZ: f64,
    pub i_rvCross: f64,
    // --- Supports et résistances
    pub i_pvL: usize,
    pub i_pvR: usize,
    pub i_clusterTol: f64,
    pub i_testTol: f64,
    pub i_resolveBars: usize,
    pub i_maxLevels: usize,
    pub i_ctrlOff: f64,
    pub i_srPrior: f64,
    pub i_srDecay: f64,
    pub i_srGain: f64,
    pub i_srCross: f64,
    // --- Zones d'accumulation
    pub i_zoneBinPct: f64,
    pub i_zoneSmooth: f64,
    pub i_zoneTPO: f64,
    pub i_zoneFlowW: f64,
    pub i_zoneMin: f64,
    pub i_zoneTau: f64,
    pub i_zoneWin: f64,
    pub i_zoneDecay: f64,
    pub i_zoneContra: f64,
    pub i_zoneGain: f64,
    pub i_zoneCross: f64,
    pub i_zoneTarget: f64,
    pub i_zoneN: usize,
    // --- Phases de marché
    pub i_phEnable: bool,
    pub i_impDays: f64,
    pub i_impZ: f64,
    pub i_impER: f64,
    pub i_rangeMult: f64,
    pub i_rangeRetr: f64,
    pub i_rangeSwings: usize,
    pub i_rangeKappa: f64,
    pub i_rangeVol: f64,
    pub i_rangeDecay: f64,
    pub i_rangeAmp: f64,
    pub i_postDir: f64,
    pub i_coilThr: f64,
    pub i_coilDays: f64,
    pub i_trapDays: f64,
    pub i_trapSweep: f64,
    pub i_expMult: f64,
    pub i_coilAmp: f64,
    // --- Compression
    pub i_compLen: usize,
    pub i_lambdaComp: f64,
    pub i_compVol: f64,
    // --- Hystérésis
    pub i_alphaStable: f64,
    pub i_enterThr: f64,
    pub i_flipThr: f64,
    pub i_confirmN: u32,
    pub i_floorStr: f64,
    pub i_minGain: f64,
    pub i_maxGain: f64,
    // --- Inclinaison et chemin directionnel
    pub i_beta: f64,
    pub i_kDir: f64,
    pub i_dirCapSig: f64,
    pub i_dirInFan: bool,
    pub i_tailQ: f64,
    pub i_G: usize,
    pub i_Wmax: usize,
    pub i_lamSmooth: f64,
    pub i_lamTurn: f64,
    pub i_termWin: i64,
    // --- Chaîne de Markov sur états observés discrétisés
    pub i_mk_enable: bool,
    pub i_mk_len: usize,
    pub i_mk_alpha: f64,
    pub i_mk_detector: String,
    pub i_mk_z_thr: f64,
    pub i_mkKBull: f64,
    pub i_mkKBear: f64,
    pub i_mkKNeu: f64,
    pub i_sig_bull: f64,
    pub i_sig_bear: f64,
    pub i_sig_neutral: f64,
    pub i_flip_mr_enable: bool,
    pub i_flip_thr: f64,
    pub i_flip_width: f64,
    pub i_flip_kappa: f64,
    // --- Chemin typique
    pub i_show_candles: bool,
    pub i_candleH: usize,
    pub i_texAmp: f64,
    pub i_anL: usize,
    pub i_anK: usize,
    pub i_anTau: f64,
    pub i_anSep: usize,
    pub i_anKeepVol: bool,
    pub i_anBuf: usize,
    pub i_anWS: f64,
    pub i_anWV: f64,
    pub i_anHyst: f64,
}

impl LegacyParams {
    pub fn from_toml(text: &str) -> Result<Self> {
        let p: LegacyParams = toml::from_str(text)
            .map_err(|e| Error::Config(format!("inputs legacy illisibles : {e}")))?;
        p.validate()?;
        Ok(p)
    }

    pub fn load(path: &std::path::Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .map_err(|e| Error::Config(format!("lecture de {} impossible : {e}", path.display())))?;
        Self::from_toml(&text)
    }

    /// Valeurs par défaut du script Pine.
    pub fn pine_defaults() -> Self {
        Self::from_toml(PINE_DEFAULTS).expect("configs/legacy_defaults.toml embarqué invalide")
    }

    /// Refuse les réglages que ce port ne reproduit pas, plutôt que de les ignorer en silence.
    pub fn validate(&self) -> Result<()> {
        let bad = |m: &str| Err(Error::Config(format!("inputs legacy : {m}")));
        if self.i_engine != "Monte Carlo FHS-GARCH" {
            return bad("seul le moteur « Monte Carlo FHS-GARCH » est porté");
        }
        if self.i_mk_detector != "Price Z-score" {
            return bad("seul le détecteur de régime « Price Z-score » est porté");
        }
        if !["Latest pivot (high or low)", "Last pivot high", "Last pivot low"].contains(&self.i_avMode.as_str()) {
            return bad("i_avMode inconnu");
        }
        if !(10..=250).contains(&self.i_H) || self.i_G < 3 || self.i_poolN < 100 || self.i_anBuf < 500 {
            return bad("i_H, i_G, i_poolN ou i_anBuf hors bornes");
        }
        if self.i_anL < 2 || self.i_anK < 1 || self.i_bins < 5 || self.i_mk_len < 2 {
            return bad("i_anL, i_anK, i_bins ou i_mk_len hors bornes");
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_defaults_match_the_script() {
        let p = LegacyParams::pine_defaults();
        assert_eq!((p.i_H, p.i_sims, p.i_mcBudget, p.i_G, p.i_Wmax), (120, 1500, 240_000, 61, 5));
        assert_eq!((p.i_gAlpha, p.i_gBeta, p.i_poolN), (0.06, 0.92, 750));
        assert_eq!((p.i_anL, p.i_anK, p.i_anBuf, p.i_texAmp), (24, 5, 3000, 0.70));
        assert_eq!((p.i_wD, p.i_wV, p.i_wR, p.i_wA, p.i_wM, p.i_wZ), (1.0, 0.8, 0.6, 0.4, 1.0, 1.4));
        assert!(p.i_mk_enable && p.i_phEnable && p.i_dirInFan && p.i_useFHS);
    }
}
