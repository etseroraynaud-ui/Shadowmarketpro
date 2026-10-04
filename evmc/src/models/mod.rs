//! Modèles : registre, interface commune, traduction de l'état connu à t en plan de prévision.
//! Aucun modèle ne calcule de métrique.

pub mod baselines;
pub mod registry;

use crate::forecast::record::ForecastRecord;
use crate::sim::{ResidSpec, SimOutput};
use crate::types::{Family, HorizonGrid};
use crate::vol::VolState;

/// Description statique d'un modèle.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ModelInfo {
    pub id: &'static str,
    pub family: Family,
}

/// Tout ce qu'un modèle peut lire à l'origine t.
#[derive(Clone, Copy, Debug)]
pub struct Snapshot {
    pub ts: i64,
    pub bar_idx: u32,
    pub p0: f64,
    pub vol: VolState,
    /// Fenêtre du pool de résidus connue à t.
    pub pool_start: usize,
    pub pool_len: usize,
    pub pool_mean: f64,
}

/// Contexte de mise à jour causale : seules les barres <= t sont adressables.
pub struct ObserveCtx<'a> {
    pub t: usize,
    /// Clôtures des barres 0..=t.
    pub closes: &'a [f64],
    /// Cumul des trous de données sur 0..=t.
    pub gap_prefix: &'a [u32],
    pub warm_end: usize,
    pub grid: &'a HorizonGrid,
}

/// Paramètres d'une simulation demandée par un modèle.
#[derive(Clone, Copy, Debug)]
pub struct SimSpec {
    pub h0: f64,
    pub h_lr: f64,
    pub g_alpha: f64,
    pub g_beta: f64,
    pub h_cap: f64,
    pub resid: ResidSpec,
}

/// Ce qu'un modèle demande au moteur à l'origine t.
pub enum Plan {
    /// Lignes calculées en forme fermée.
    Closed(Vec<ForecastRecord>),
    /// Simulation à exécuter par le noyau.
    Simulate(SimSpec),
}

/// Interface commune aux baselines et aux modèles EVMC.
pub trait Forecaster: Send + Sync {
    fn info(&self) -> &'static ModelInfo;
    /// Mise à jour causale, appelée pour chaque barre dans l'ordre, avant `plan`.
    fn observe(&mut self, _ctx: &ObserveCtx) {}
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan;
    /// Construit les lignes à partir de la simulation demandée par `plan`.
    fn finalize(&self, s: &Snapshot, grid: &HorizonGrid, sim: &SimOutput) -> Vec<ForecastRecord> {
        let info = self.info();
        grid.as_slice()
            .iter()
            .enumerate()
            .map(|(gi, &h)| {
                let sum = &sim.per_h[gi];
                let mut r = ForecastRecord::empty(info.id, info.family, s.ts, s.bar_idx, h, s.p0)
                    .with_summary(sum, Some(s.vol.cum_var_ref(h as u32).sqrt()));
                r.n_sims = sim.n_sims;
                r.se_p_up = Some(sum.se_p_up);
                r.se_q_max = Some(sum.se_q_max);
                r.converged = sim.converged;
                r.cdf_slack = 2.0 / sim.n_sims as f64 + 1e-12;
                r
            })
            .collect()
    }
}
