//! Moteur de prévision : passe séquentielle causale (état des modèles, formes fermées),
//! puis Monte Carlo en parallèle par origine. Le résultat ne dépend pas du nombre de threads.

use rayon::prelude::*;

use crate::config::Config;
use crate::data::BarSeries;
use crate::error::Result;
use crate::features::FeatureFrame;
use crate::forecast::invariants;
use crate::forecast::record::ForecastRecord;
use crate::models::{registry, ObserveCtx, Plan, SimSpec, Snapshot};
use crate::sim::{simulate, SimInput, Workspace};
use crate::vol::term::cum_var;
use crate::wf::split::Split;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct EngineStats {
    pub n_origins: usize,
    pub n_sim_jobs: usize,
    pub total_paths: u64,
    pub n_not_converged: usize,
}

pub struct EngineOutput {
    pub records: Vec<ForecastRecord>,
    pub stats: EngineStats,
}

/// Snapshot connu à t, construit à partir des seules features de la barre t.
pub fn snapshot(feats: &FeatureFrame, t: usize) -> Snapshot {
    let (pool_start, pool_len) = feats.pool_window(t);
    Snapshot {
        ts: feats.ts[t],
        bar_idx: t as u32,
        p0: feats.close[t],
        vol: feats.vol_state(t),
        pool_start,
        pool_len,
        pool_mean: feats.pool_mean[t],
    }
}

/// Produit les prévisions de toutes les origines notées. Le holdout n'est parcouru
/// que s'il a été ouvert.
pub fn run(
    series: &BarSeries,
    feats: &FeatureFrame,
    split: &Split,
    cfg: &Config,
    holdout_opened: bool,
) -> Result<EngineOutput> {
    let grid = cfg.grid()?;
    let profile = cfg.profile()?;
    let seed = cfg.run.seed;
    let mut models = registry::build(cfg)?;
    let closes = series.closes();
    let end = if holdout_opened { split.data_end } else { split.holdout_start } as usize;
    let start = split.eval_start as usize;

    let mut records: Vec<ForecastRecord> = Vec::new();
    let mut jobs: Vec<(Snapshot, usize, SimSpec)> = Vec::new();
    for t in 0..end {
        let ctx = ObserveCtx {
            t,
            closes: &closes[..=t],
            gap_prefix: &series.gap_prefix[..=t],
            warm_end: split.warm_end as usize,
            grid: &grid,
        };
        for m in models.iter_mut() {
            m.observe(&ctx);
        }
        if t < start {
            continue;
        }
        split.guard_origin(t as u32, holdout_opened)?;
        let snap = snapshot(feats, t);
        for (mi, m) in models.iter().enumerate() {
            match m.plan(&snap, &grid) {
                Plan::Closed(rows) => records.extend(rows),
                Plan::Simulate(spec) => jobs.push((snap, mi, spec)),
            }
        }
    }

    let pool = &feats.z_garch;
    let models_ref = &models;
    let grid_ref = &grid;
    let simulated: Vec<(Vec<ForecastRecord>, u32, bool)> = jobs
        .par_iter()
        .map_init(
            || Workspace::new(grid_ref, profile.n_max),
            |ws, (snap, mi, spec)| {
                let phi = spec.g_alpha + spec.g_beta;
                let sigma_h: Vec<f64> = grid_ref
                    .as_slice()
                    .iter()
                    .map(|&h| cum_var(spec.h0, spec.h_lr, phi, h as u32).sqrt())
                    .collect();
                let input = SimInput {
                    bar_idx: snap.bar_idx,
                    h0: spec.h0,
                    h_lr: spec.h_lr,
                    g_alpha: spec.g_alpha,
                    g_beta: spec.g_beta,
                    h_cap: spec.h_cap,
                    resid: spec.resid,
                    drift_steps: None,
                    sigma_h: &sigma_h,
                };
                let out = simulate(&input, pool, grid_ref, &profile, seed, ws);
                let rows = models_ref[*mi].finalize(snap, grid_ref, &out);
                (rows, out.n_sims, out.converged)
            },
        )
        .collect();

    let mut stats = EngineStats {
        n_origins: end.saturating_sub(start),
        n_sim_jobs: jobs.len(),
        ..Default::default()
    };
    for (rows, n_sims, converged) in simulated {
        stats.total_paths += n_sims as u64;
        stats.n_not_converged += (!converged) as usize;
        records.extend(rows);
    }
    for r in &records {
        invariants::check(r)?;
    }
    Ok(EngineOutput { records, stats })
}
