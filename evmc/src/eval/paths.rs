//! Évaluation du chemin typique : à chaque pas h du chemin (1 à H barres), le log-rendement
//! annoncé est comparé au log-rendement réalisé. La question posée est : à quel nombre de
//! barres, et dans quel régime, le chemin prédit-il le mieux ?
//!
//! Chemins notés : le chemin typique du Pine, son squelette directionnel, la médiane de son
//! éventail, et trois références (droite vers la cible, dérive historique, prix inchangé).
//! La référence de direction est la dérive : sur un actif qui monte, annoncer « hausse »
//! chaque jour donne déjà plus d'une fois sur deux raison.

use crate::config::EvalCfg;
use crate::data::BarSeries;
use crate::error::{Error, Result};
use crate::eval::bootstrap::{percentile_ci, BlockPlan};
use crate::io::table::{Col, Table};
use crate::wf::split::Split;

pub const PATH_MODELS: [&str; 6] =
    ["evmc_typical", "evmc_backbone", "evmc_median", "ref_line", "ref_drift", "ref_zero"];
/// Référence de direction et référence d'erreur.
const I_DRIFT: usize = 4;
const I_ZERO: usize = 5;

pub const SLICES: [&str; 13] = [
    "all", "vol_low", "vol_normal", "vol_high", "dir_bull", "dir_neutral", "dir_bear", "ph_normal",
    "ph_range", "ph_coil", "mk_bull", "mk_bear", "mk_neutral",
];

/// Seuils du tableau Pine : volatilité « Low » sous 0,8 fois la moyenne longue, « High » au-dessus de 1,25.
pub const VOL_LOW: f64 = 0.8;
pub const VOL_HIGH: f64 = 1.25;

#[derive(Clone, Debug, PartialEq)]
pub struct PathMetric {
    pub model: String,
    pub slice: String,
    /// "dev" pour toute la zone notée, "fold_k" pour un pli.
    pub scope: String,
    pub step: u16,
    pub metric: String,
    pub value: f64,
    pub ci_lo: Option<f64>,
    pub ci_hi: Option<f64>,
    pub significant: Option<bool>,
    pub block_len: Option<u32>,
    pub n_obs: u32,
}

/// Choix du meilleur pas sur les plis passés, noté sur le pli suivant.
#[derive(Clone, Debug, PartialEq)]
pub struct PathSelect {
    pub model: String,
    /// "hit" : taux de bonne direction ; "edge" : écart à la référence de dérive.
    pub criterion: String,
    pub fold: u16,
    pub step_star: u16,
    pub in_sample: f64,
    pub hit_oos: f64,
    pub ref_hit_oos: f64,
    pub n_oos: u32,
}

pub struct PathEval {
    pub metrics: Vec<PathMetric>,
    pub select: Vec<PathSelect>,
}

/// Données d'entrée, à plat : `x[m][o * h + (k - 1)]` = log-rendement annoncé par le chemin m
/// à l'origine o pour le pas k.
struct Frame {
    n_or: usize,
    h: usize,
    x: Vec<Vec<f64>>,
    /// Réalisé, `NaN` si la fenêtre sort de la zone autorisée ou traverse un trou.
    r: Vec<f64>,
    sigma: Vec<f64>,
    fold: Vec<Option<u16>>,
    slices: Vec<Vec<bool>>,
}

fn sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        0.0
    }
}

/// 1 si le sens annoncé est le bon, 0 sinon, 0,5 si le chemin n'annonce aucun sens.
fn hit(x: f64, r: f64) -> f64 {
    if x == 0.0 {
        0.5
    } else if sign(x) == sign(r) {
        1.0
    } else {
        0.0
    }
}

fn build_frame(paths: &Table, state: &Table, series: &BarSeries, split: &Split, holdout_opened: bool) -> Result<Frame> {
    let s_bar = state.u32("bar_idx")?;
    let n_or = s_bar.len();
    if n_or == 0 {
        return Err(Error::Other("aucune origine legacy à évaluer".into()));
    }
    let p_bar = paths.u32("bar_idx")?;
    let h = paths.n_rows() / n_or;
    if h == 0 || paths.n_rows() != n_or * h {
        return Err(Error::Schema("legacy_paths : nombre de lignes incohérent".into()));
    }
    let typical = paths.f64("typical")?;
    let backbone = paths.f64("backbone")?;
    let q50 = paths.f64("q50")?;
    let sigma = paths.f64("sigma_path")?.to_vec();
    let final_r = state.f64("final_r")?;
    let closes = series.closes();
    let limit = if holdout_opened { split.data_end } else { split.holdout_start } as usize;

    // dérive historique connue à chaque barre : moyenne des log-rendements des barres 1..=t
    let mut drift = vec![0.0; closes.len()];
    let mut acc = 0.0;
    for t in 1..closes.len() {
        acc += (closes[t] / closes[t - 1]).ln();
        drift[t] = acc / t as f64;
    }

    let mut x: Vec<Vec<f64>> = vec![Vec::with_capacity(n_or * h); PATH_MODELS.len()];
    let mut r = Vec::with_capacity(n_or * h);
    for o in 0..n_or {
        let t = s_bar[o] as usize;
        if p_bar[o * h] as usize != t {
            return Err(Error::Schema("legacy_paths et legacy_state ne sont pas alignées".into()));
        }
        for k in 1..=h {
            let i = o * h + k - 1;
            x[0].push(typical[i]);
            x[1].push(backbone[i]);
            x[2].push(q50[i]);
            x[3].push(final_r[o] * k as f64 / h as f64);
            x[4].push(drift[t] * k as f64);
            x[5].push(0.0);
            let e = t + k;
            r.push(if e < limit && !series.has_gap(t, e) { (closes[e] / closes[t]).ln() } else { f64::NAN });
        }
    }

    let vol = state.f64("vol_ratio")?;
    let dir = state.i8("dir_regime")?;
    let scen = state.u8("scenario")?;
    let mk = state.u8("mk_state")?;
    let slices: Vec<Vec<bool>> = vec![
        vec![true; n_or],
        vol.iter().map(|v| *v < VOL_LOW).collect(),
        vol.iter().map(|v| (VOL_LOW..=VOL_HIGH).contains(v)).collect(),
        vol.iter().map(|v| *v > VOL_HIGH).collect(),
        dir.iter().map(|d| *d > 0).collect(),
        dir.iter().map(|d| *d == 0).collect(),
        dir.iter().map(|d| *d < 0).collect(),
        scen.iter().map(|s| *s == 0).collect(),
        scen.iter().map(|s| *s == 1).collect(),
        scen.iter().map(|s| *s == 2).collect(),
        mk.iter().map(|s| *s == 0).collect(),
        mk.iter().map(|s| *s == 1).collect(),
        mk.iter().map(|s| *s == 2).collect(),
    ];
    let fold = s_bar.iter().map(|b| split.fold_of(*b)).collect();
    Ok(Frame { n_or, h, x, r, sigma, fold, slices })
}

fn mean(v: &[f64]) -> f64 {
    v.iter().sum::<f64>() / v.len() as f64
}

fn pearson(a: &[f64], b: &[f64]) -> Option<f64> {
    let n = a.len() as f64;
    if a.len() < 3 {
        return None;
    }
    let (ma, mb) = (mean(a), mean(b));
    let (mut sab, mut saa, mut sbb) = (0.0, 0.0, 0.0);
    for (x, y) in a.iter().zip(b) {
        sab += (x - ma) * (y - mb);
        saa += (x - ma) * (x - ma);
        sbb += (y - mb) * (y - mb);
    }
    if saa <= 1e-30 * n || sbb <= 1e-30 * n { None } else { Some(sab / (saa * sbb).sqrt()) }
}

/// Intervalle par bootstrap de blocs circulaires de la moyenne de `v` : le plus large des
/// trois longueurs de bloc ; « significatif » si les trois excluent zéro.
fn boot_mean(v: &[f64], step: u16, cfg: &EvalCfg, seed: u64) -> (Option<(f64, f64)>, Option<bool>, Option<u32>) {
    let n = v.len();
    if n < 40 {
        return (None, None, None);
    }
    let mut widest: Option<(f64, f64)> = None;
    let mut all_excl = true;
    let mut block = 0u32;
    for mult in &cfg.block_mult {
        let l = ((mult * step as f64).round() as usize).max(cfg.block_min as usize).min(n);
        let plan = BlockPlan::new(n, l, cfg.bootstrap_reps as usize, seed, step);
        let mut reps: Vec<f64> = plan.replicate_sums(v).into_iter().map(|s| s / n as f64).collect();
        match percentile_ci(&mut reps, cfg.ci_level) {
            Some((lo, hi)) => {
                if !(lo > 0.0 || hi < 0.0) {
                    all_excl = false;
                }
                if widest.is_none_or(|(a, b)| hi - lo > b - a) {
                    widest = Some((lo, hi));
                    block = l as u32;
                }
            }
            None => return (None, None, None),
        }
    }
    (widest, Some(all_excl), Some(block))
}

/// Mesures d'un chemin sur un ensemble de lignes (origines) à un pas donné.
struct Cell {
    n: usize,
    hit: Vec<f64>,
    hit_ref: Vec<f64>,
    /// (|r| - |r - x|) / sigma : gain d'erreur absolue contre le prix inchangé.
    gain: Vec<f64>,
    abs_err: f64,
    abs_zero: f64,
    bias: f64,
    ic: Option<f64>,
}

fn cell(f: &Frame, m: usize, k: usize, rows: &[usize]) -> Cell {
    let mut hitv = Vec::with_capacity(rows.len());
    let mut hit_ref = Vec::with_capacity(rows.len());
    let mut gain = Vec::with_capacity(rows.len());
    let (mut xs, mut rs) = (Vec::with_capacity(rows.len()), Vec::with_capacity(rows.len()));
    let (mut ae, mut az, mut bias) = (0.0, 0.0, 0.0);
    for &o in rows {
        let i = o * f.h + k - 1;
        let (x, r, s) = (f.x[m][i], f.r[i], f.sigma[i].max(1e-12));
        hitv.push(hit(x, r));
        hit_ref.push(hit(f.x[I_DRIFT][i], r));
        gain.push((r.abs() - (r - x).abs()) / s);
        ae += (r - x).abs() / s;
        az += r.abs() / s;
        bias += (r - x) / s;
        xs.push(x);
        rs.push(r);
    }
    let n = rows.len();
    let nf = n.max(1) as f64;
    Cell { n, hit: hitv, hit_ref, gain, abs_err: ae / nf, abs_zero: az / nf, bias: bias / nf, ic: pearson(&xs, &rs) }
}

#[allow(clippy::too_many_arguments)]
fn push_cell(
    out: &mut Vec<PathMetric>,
    c: &Cell,
    m: usize,
    slice: &str,
    scope: &str,
    k: usize,
    with_ci: bool,
    cfg: &EvalCfg,
    seed: u64,
) {
    if c.n == 0 {
        return;
    }
    let step = k as u16;
    let mut row = |metric: &str, value: f64, ci: Option<(f64, f64)>, sig: Option<bool>, bl: Option<u32>| {
        if value.is_finite() {
            out.push(PathMetric {
                model: PATH_MODELS[m].to_string(),
                slice: slice.to_string(),
                scope: scope.to_string(),
                step,
                metric: metric.to_string(),
                value,
                ci_lo: ci.map(|c| c.0),
                ci_hi: ci.map(|c| c.1),
                significant: sig,
                block_len: bl,
                n_obs: c.n as u32,
            });
        }
    };
    let h = mean(&c.hit);
    let diff: Vec<f64> = c.hit.iter().zip(&c.hit_ref).map(|(a, b)| a - b).collect();
    if m != I_ZERO {
        if with_ci {
            // L'intervalle du taux lui-même est recentré : on teste hit - 0,5.
            let centred: Vec<f64> = c.hit.iter().map(|x| x - 0.5).collect();
            let (ci, _, bl) = boot_mean(&centred, step, cfg, seed);
            row("hit", h, ci.map(|(a, b)| (a + 0.5, b + 0.5)), None, bl);
        } else {
            row("hit", h, None, None, None);
        }
        if m != I_DRIFT {
            if with_ci {
                let (ci, sig, bl) = boot_mean(&diff, step, cfg, seed);
                row("hit_edge", mean(&diff), ci, sig, bl);
            } else {
                row("hit_edge", mean(&diff), None, None, None);
            }
        }
        if let Some(ic) = c.ic {
            row("ic", ic, None, None, None);
        }
        if with_ci {
            let (ci, sig, bl) = boot_mean(&c.gain, step, cfg, seed);
            row("mae_gain", mean(&c.gain), ci, sig, bl);
        } else {
            row("mae_gain", mean(&c.gain), None, None, None);
        }
        if c.abs_zero > 0.0 {
            row("mae_skill", 1.0 - c.abs_err / c.abs_zero, None, None, None);
        }
    }
    row("mae_sigma", c.abs_err, None, None, None);
    row("bias_sigma", c.bias, None, None, None);
}

/// Évalue les chemins. `grid` : pas auxquels les tranches de régime reçoivent un intervalle
/// (la tranche « all » en reçoit un à chaque pas).
pub fn evaluate(
    paths: &Table,
    state: &Table,
    series: &BarSeries,
    split: &Split,
    cfg: &EvalCfg,
    grid: &[u16],
    seed: u64,
    holdout_opened: bool,
) -> Result<PathEval> {
    use rayon::prelude::*;
    let f = build_frame(paths, state, series, split, holdout_opened)?;
    let n_folds = split.folds.len();

    // --- métriques par pas, en parallèle ; l'ordre de sortie ne dépend pas du nombre de threads
    let per_step: Vec<Vec<PathMetric>> = (1..=f.h)
        .into_par_iter()
        .map(|k| {
            let mut out = Vec::new();
            let valid: Vec<usize> = (0..f.n_or).filter(|o| !f.r[o * f.h + k - 1].is_nan()).collect();
            for (si, sname) in SLICES.iter().enumerate() {
                let rows: Vec<usize> = valid.iter().copied().filter(|o| f.slices[si][*o]).collect();
                let with_ci = si == 0 || grid.contains(&(k as u16));
                for m in 0..PATH_MODELS.len() {
                    let c = cell(&f, m, k, &rows);
                    // Les références n'ont besoin d'intervalles que pour la tranche complète.
                    let ci = with_ci && (m < 4 || si == 0);
                    push_cell(&mut out, &c, m, sname, "dev", k, ci, cfg, seed);
                }
            }
            for fo in 0..n_folds as u16 {
                let rows: Vec<usize> = valid.iter().copied().filter(|o| f.fold[*o] == Some(fo)).collect();
                for m in 0..PATH_MODELS.len() {
                    let c = cell(&f, m, k, &rows);
                    push_cell(&mut out, &c, m, "all", &format!("fold_{fo}"), k, false, cfg, seed);
                }
            }
            out
        })
        .collect();
    let metrics: Vec<PathMetric> = per_step.into_iter().flatten().collect();

    // --- choix du pas sur le passé, note sur le pli suivant
    // sommes par pli : hits[m][fold][k], hits de la référence, effectifs
    let mut sums = vec![vec![vec![(0.0f64, 0.0f64, 0u32); f.h + 1]; n_folds]; PATH_MODELS.len()];
    for o in 0..f.n_or {
        let Some(fo) = f.fold[o] else { continue };
        for k in 1..=f.h {
            let i = o * f.h + k - 1;
            let r = f.r[i];
            if r.is_nan() {
                continue;
            }
            let href = hit(f.x[I_DRIFT][i], r);
            for (m, sm) in sums.iter_mut().enumerate() {
                let c = &mut sm[fo as usize][k];
                c.0 += hit(f.x[m][i], r);
                c.1 += href;
                c.2 += 1;
            }
        }
    }
    let mut select = Vec::new();
    const MIN_PAST: u32 = 200;
    for m in 0..3 {
        for crit in ["hit", "edge"] {
            for fo in 2..n_folds {
                let mut best: Option<(usize, f64)> = None;
                for k in 1..=f.h {
                    let (mut a, mut b, mut n) = (0.0, 0.0, 0u32);
                    for past in sums[m][..fo].iter() {
                        a += past[k].0;
                        b += past[k].1;
                        n += past[k].2;
                    }
                    if n < MIN_PAST {
                        continue;
                    }
                    let v = if crit == "hit" { a / n as f64 } else { (a - b) / n as f64 };
                    if best.is_none_or(|(_, bv)| v > bv) {
                        best = Some((k, v));
                    }
                }
                let Some((k, v)) = best else { continue };
                let cur = sums[m][fo][k];
                if cur.2 == 0 {
                    continue;
                }
                select.push(PathSelect {
                    model: PATH_MODELS[m].to_string(),
                    criterion: crit.to_string(),
                    fold: fo as u16,
                    step_star: k as u16,
                    in_sample: v,
                    hit_oos: cur.0 / cur.2 as f64,
                    ref_hit_oos: cur.1 / cur.2 as f64,
                    n_oos: cur.2,
                });
            }
        }
    }
    Ok(PathEval { metrics, select })
}

pub fn metrics_table(rows: &[PathMetric]) -> Table {
    Table::new("path_metrics")
        .with("model_id", Col::Str(rows.iter().map(|r| r.model.clone()).collect()))
        .with("slice", Col::Str(rows.iter().map(|r| r.slice.clone()).collect()))
        .with("scope", Col::Str(rows.iter().map(|r| r.scope.clone()).collect()))
        .with("step", Col::U16(rows.iter().map(|r| r.step).collect()))
        .with("metric", Col::Str(rows.iter().map(|r| r.metric.clone()).collect()))
        .with("value", Col::F64(rows.iter().map(|r| r.value).collect()))
        .with("ci_lo", Col::NF64(rows.iter().map(|r| r.ci_lo).collect()))
        .with("ci_hi", Col::NF64(rows.iter().map(|r| r.ci_hi).collect()))
        .with("significant", Col::NBool(rows.iter().map(|r| r.significant).collect()))
        .with("block_len", Col::NU32(rows.iter().map(|r| r.block_len).collect()))
        .with("n_obs", Col::U32(rows.iter().map(|r| r.n_obs).collect()))
}

pub fn select_table(rows: &[PathSelect]) -> Table {
    Table::new("path_select")
        .with("model_id", Col::Str(rows.iter().map(|r| r.model.clone()).collect()))
        .with("criterion", Col::Str(rows.iter().map(|r| r.criterion.clone()).collect()))
        .with("fold", Col::U16(rows.iter().map(|r| r.fold).collect()))
        .with("step_star", Col::U16(rows.iter().map(|r| r.step_star).collect()))
        .with("in_sample", Col::F64(rows.iter().map(|r| r.in_sample).collect()))
        .with("hit_oos", Col::F64(rows.iter().map(|r| r.hit_oos).collect()))
        .with("ref_hit_oos", Col::F64(rows.iter().map(|r| r.ref_hit_oos).collect()))
        .with("n_oos", Col::U32(rows.iter().map(|r| r.n_oos).collect()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hit_convention() {
        assert_eq!(hit(0.1, 0.2), 1.0);
        assert_eq!(hit(-0.1, 0.2), 0.0);
        assert_eq!(hit(0.0, 0.2), 0.5);
        assert_eq!(hit(0.1, 0.0), 0.0);
    }

    #[test]
    fn pearson_matches_hand_value() {
        let a = [1.0, 2.0, 3.0, 4.0];
        let b = [2.0, 4.0, 6.0, 8.5];
        let r = pearson(&a, &b).unwrap();
        assert!((r - 0.998_381_439_457_029_8).abs() < 1e-12);
        assert!(pearson(&[1.0, 1.0, 1.0], &[1.0, 2.0, 3.0]).is_none());
    }
}
