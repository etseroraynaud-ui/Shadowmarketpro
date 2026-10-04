//! Évaluation : jointure prévision x outcome, scores par ligne, métriques avec inférence,
//! courbes de fiabilité. Ne modifie jamais une prévision ni un outcome.

pub mod paths;
pub mod bootstrap;
pub mod hac;
pub mod metrics;
pub mod scores;

use std::collections::BTreeMap;

use rayon::prelude::*;

use crate::config::Config;
use crate::error::{Error, Result};
use crate::eval::bootstrap::BlockPlan;
use crate::eval::hac::hac_lag;
use crate::eval::metrics::{
    build_excursion_block, build_model_block, equal_count_bins, evaluate_block, values, Evaluated,
    Kind, ModelBlock,
};
use crate::eval::scores::{crps_weights, score, ForecastView, ScoreRow};
use crate::forecast::record::ForecastFrame;
use crate::io::table::{Col, Table};
use crate::outcome::OutcomeRow;
use crate::types::{Zone, N_Q};
use crate::wf::split::Split;

const NONE: u32 = u32::MAX;

/// Une ligne de `metrics.parquet`.
#[derive(Clone, Debug, PartialEq)]
pub struct MetricRow {
    pub model_id: String,
    pub baseline_id: Option<String>,
    pub horizon: u16,
    pub scope: String,
    pub support: String,
    pub metric: String,
    pub point_kind: Option<String>,
    pub value: f64,
    pub ci_lo: Option<f64>,
    pub ci_hi: Option<f64>,
    pub block_len: Option<u32>,
    pub hac_se: Option<f64>,
    pub significant: Option<bool>,
    pub n_obs: u32,
    pub n_over_h: u32,
    pub ess_acf: Option<f64>,
    pub warn_low_n: bool,
}

/// Une ligne de `reliability.parquet`.
#[derive(Clone, Debug, PartialEq)]
pub struct ReliabilityRow {
    pub model_id: String,
    pub horizon: u16,
    pub scope: String,
    pub bin: u8,
    pub p_mean: f64,
    pub y_freq: f64,
    pub n: u32,
    pub ci_lo: f64,
    pub ci_hi: f64,
}

pub struct EvalOutput {
    pub scores: Table,
    pub metrics: Vec<MetricRow>,
    pub reliability: Vec<ReliabilityRow>,
    /// Nombre de lignes notées par horizon.
    pub support: Vec<(u16, usize)>,
}

fn rows_from(
    block: &ModelBlock,
    ev: &[Evaluated],
    horizon: u16,
    scope: &str,
    support: &str,
    warn_n: u32,
) -> Vec<MetricRow> {
    let n = block.n as u32;
    let n_over_h = n / horizon as u32;
    block
        .defs
        .iter()
        .zip(ev)
        .filter(|(_, e)| e.value.is_finite())
        .map(|(d, e)| MetricRow {
            model_id: block.model_id.clone(),
            baseline_id: d.baseline.clone(),
            horizon,
            scope: scope.to_string(),
            support: support.to_string(),
            metric: d.name.clone(),
            point_kind: d.point_kind.map(|s| s.to_string()),
            value: e.value,
            ci_lo: e.ci.map(|c| c.0),
            ci_hi: e.ci.map(|c| c.1),
            block_len: e.block_len,
            hac_se: e.hac_se,
            significant: e.significant,
            n_obs: n,
            n_over_h,
            ess_acf: e.ess,
            warn_low_n: n_over_h < warn_n,
        })
        .collect()
}

/// Longueurs de bloc d'un horizon : max(block_min, mult x H), dédoublonnées.
pub fn block_lengths(cfg: &Config, horizon: u16) -> Vec<usize> {
    let mut ls: Vec<usize> = cfg
        .eval
        .block_mult
        .iter()
        .map(|m| ((m * horizon as f64).round() as usize).max(cfg.eval.block_min as usize))
        .collect();
    ls.sort_unstable();
    ls.dedup();
    ls
}

pub fn evaluate(
    forecasts: &Table,
    outcomes: &[OutcomeRow],
    split: &Split,
    cfg: &Config,
    holdout_opened: bool,
) -> Result<EvalOutput> {
    let grid = cfg.grid()?;
    let gh = grid.as_slice();
    let n_bars = split.n_bars as usize;
    let ff = ForecastFrame::from_table(forecasts)?;
    let gi_of = |h: u16| -> Result<usize> {
        gh.binary_search(&h)
            .map_err(|_| Error::Schema(format!("horizon {h} absent de la grille")))
    };

    // --- index des prévisions et des outcomes
    let mut model_ids: Vec<String> = Vec::new();
    for m in &ff.model_id {
        if model_ids.last() != Some(m) && !model_ids.contains(m) {
            model_ids.push(m.clone());
        }
    }
    let m_of: BTreeMap<&str, usize> =
        model_ids.iter().enumerate().map(|(i, s)| (s.as_str(), i)).collect();
    let nm = model_ids.len();
    let mut fidx = vec![vec![vec![NONE; n_bars]; gh.len()]; nm];
    for i in 0..ff.len() {
        split.guard_origin(ff.bar_idx[i], holdout_opened)?;
        let m = m_of[ff.model_id[i].as_str()];
        fidx[m][gi_of(ff.horizon[i])?][ff.bar_idx[i] as usize] = i as u32;
    }
    let mut oidx = vec![vec![NONE; n_bars]; gh.len()];
    for (i, o) in outcomes.iter().enumerate() {
        split.guard_origin(o.bar_idx, holdout_opened)?;
        oidx[gi_of(o.horizon)?][o.bar_idx as usize] = i as u32;
    }

    // --- support commun à tous les modèles, par horizon (zone notée seulement)
    let common = cfg.eval.support == "common_origin";
    let g_max = gh.len() - 1;
    let supports: Vec<Vec<u32>> = (0..gh.len())
        .map(|gi| {
            (split.eval_start..split.holdout_start)
                .filter(|&t| {
                    let t = t as usize;
                    oidx[gi][t] != NONE
                        && (!common || oidx[g_max][t] != NONE)
                        && (0..nm).all(|m| fidx[m][gi][t] != NONE)
                })
                .collect()
        })
        .collect();

    // --- scores par ligne
    let w = crps_weights();
    let clip = cfg.eval.logloss_clip;
    let scores: Vec<Vec<Vec<ScoreRow>>> = (0..nm)
        .into_par_iter()
        .map(|m| {
            (0..gh.len())
                .map(|gi| {
                    supports[gi]
                        .iter()
                        .map(|&t| {
                            let fi = fidx[m][gi][t as usize] as usize;
                            let o = &outcomes[oidx[gi][t as usize] as usize];
                            let mut q = [0.0; N_Q];
                            let mut has_q = true;
                            for k in 0..N_Q {
                                match ff.q[k][fi] {
                                    Some(v) => q[k] = v,
                                    None => has_q = false,
                                }
                            }
                            let view = ForecastView {
                                mean: ff.mean[fi],
                                median: ff.median[fi],
                                mode: ff.mode[fi],
                                sigma: ff.sigma[fi],
                                raw_p_up: ff.raw_p_up[fi],
                                q: if has_q { Some(&q) } else { None },
                                legacy_target: ff.legacy_target[fi],
                            };
                            score(&view, o.ret, clip, &w)
                        })
                        .collect()
                })
                .collect()
        })
        .collect();

    // --- table des scores, triée par (model_id, ts, horizon)
    let mut order: Vec<usize> = (0..nm).collect();
    order.sort_by(|a, b| model_ids[*a].cmp(&model_ids[*b]));
    let mut keys: Vec<(usize, u32, usize, usize)> = Vec::new(); // (modèle, barre, gi, rang)
    for &m in &order {
        let mut k: Vec<(usize, u32, usize, usize)> = Vec::new();
        for gi in 0..gh.len() {
            for (r, &t) in supports[gi].iter().enumerate() {
                k.push((m, t, gi, r));
            }
        }
        k.sort_by(|a, b| a.1.cmp(&b.1).then(a.2.cmp(&b.2)));
        keys.extend(k);
    }
    let sr = |k: &(usize, u32, usize, usize)| -> &ScoreRow { &scores[k.0][k.2][k.3] };
    let out_of = |k: &(usize, u32, usize, usize)| -> &OutcomeRow {
        &outcomes[oidx[k.2][k.1 as usize] as usize]
    };
    let mut st = Table::new("scores");
    st.push("model_id", Col::Str(keys.iter().map(|k| model_ids[k.0].clone()).collect()));
    st.push("ts", Col::I64(keys.iter().map(|k| out_of(k).ts).collect()));
    st.push("horizon", Col::U16(keys.iter().map(|k| gh[k.2]).collect()));
    st.push("zone", Col::U8(keys.iter().map(|_| Zone::Dev as u8).collect()));
    st.push("fold_id", Col::U16(keys.iter().map(|k| split.fold_of(k.1).unwrap_or(u16::MAX)).collect()));
    st.push("err_mean", Col::NF64(keys.iter().map(|k| sr(k).err_mean).collect()));
    st.push("err_median", Col::NF64(keys.iter().map(|k| sr(k).err_median).collect()));
    st.push("err_mode", Col::NF64(keys.iter().map(|k| sr(k).err_mode).collect()));
    st.push("err_legacy", Col::NF64(keys.iter().map(|k| sr(k).err_legacy).collect()));
    st.push("z_err", Col::NF64(keys.iter().map(|k| sr(k).z_err).collect()));
    st.push("pit", Col::NF64(keys.iter().map(|k| sr(k).pit).collect()));
    st.push("y_up", Col::U8(keys.iter().map(|k| sr(k).y_up).collect()));
    st.push("brier", Col::NF64(keys.iter().map(|k| sr(k).brier).collect()));
    st.push("logloss", Col::NF64(keys.iter().map(|k| sr(k).logloss).collect()));
    st.push("hit", Col::NU8(keys.iter().map(|k| sr(k).hit).collect()));
    for (j, tag) in scores::INTERVAL_TAGS.iter().enumerate() {
        st.push(&format!("in{tag}"), Col::NBool(keys.iter().map(|k| sr(k).inside[j]).collect()));
    }
    for (j, tag) in scores::INTERVAL_TAGS.iter().enumerate() {
        st.push(&format!("width{tag}"), Col::NF64(keys.iter().map(|k| sr(k).width[j]).collect()));
    }
    for (j, tag) in scores::INTERVAL_TAGS.iter().enumerate() {
        st.push(&format!("is{tag}"), Col::NF64(keys.iter().map(|k| sr(k).iscore[j]).collect()));
    }
    st.push("crps", Col::NF64(keys.iter().map(|k| sr(k).crps).collect()));

    // --- métriques et fiabilité, horizon par horizon
    let seed = cfg.run.seed;
    let reps = cfg.eval.bootstrap_reps as usize;
    let bins = cfg.eval.reliability_bins as usize;
    let warn_n = cfg.eval.warn_n_over_h;
    let baseline_ids = ["b1_coin", "b2_clim", "b5_drift", "b7_garch_fhs"];
    let mut metric_rows: Vec<MetricRow> = Vec::new();
    let mut rel_rows: Vec<ReliabilityRow> = Vec::new();
    let mut support_sizes = Vec::new();
    for gi in 0..gh.len() {
        let h = gh[gi];
        let sup = &supports[gi];
        let n = sup.len();
        support_sizes.push((h, n));
        if n == 0 {
            continue;
        }
        let outs: Vec<&OutcomeRow> =
            sup.iter().map(|&t| &outcomes[oidx[gi][t as usize] as usize]).collect();
        let rets: Vec<f64> = outs.iter().map(|o| o.ret).collect();
        let lengths = block_lengths(cfg, h);
        let feasible: Vec<usize> = lengths.iter().copied().filter(|l| 2 * l <= n).collect();
        let all_feasible = feasible.len() == lengths.len();
        let plans: Vec<BlockPlan> =
            feasible.iter().map(|&l| BlockPlan::new(n, l, reps, seed, h)).collect();
        let lag = if cfg.eval.hac { Some(hac_lag(h, n)) } else { None };
        let base: BTreeMap<&str, &[ScoreRow]> = baseline_ids
            .iter()
            .filter_map(|id| m_of.get(id).map(|&m| (*id, scores[m][gi].as_slice())))
            .collect();

        // Zone notée entière : valeur, intervalle, HAC.
        let mut blocks: Vec<ModelBlock> = (0..nm)
            .map(|m| build_model_block(&model_ids[m], &scores[m][gi], &rets, &base, bins))
            .collect();
        blocks.push(build_excursion_block(&outs));
        let evaluated: Vec<Vec<Evaluated>> = blocks
            .par_iter()
            .map(|b| evaluate_block(b, &plans, all_feasible, cfg.eval.ci_level, lag))
            .collect();
        for (b, ev) in blocks.iter().zip(&evaluated) {
            metric_rows.extend(rows_from(b, ev, h, "dev", &cfg.eval.support, warn_n));
        }

        // Par pli : valeurs seules, pour la stabilité.
        for fold in &split.folds {
            let idx: Vec<usize> = (0..n)
                .filter(|&i| sup[i] >= fold.test_start && sup[i] < fold.test_end)
                .collect();
            if idx.is_empty() {
                continue;
            }
            let sub_rets: Vec<f64> = idx.iter().map(|&i| rets[i]).collect();
            let sub_scores: Vec<Vec<ScoreRow>> =
                (0..nm).map(|m| idx.iter().map(|&i| scores[m][gi][i]).collect()).collect();
            let sub_base: BTreeMap<&str, &[ScoreRow]> = baseline_ids
                .iter()
                .filter_map(|id| m_of.get(id).map(|&m| (*id, sub_scores[m].as_slice())))
                .collect();
            let sub_outs: Vec<&OutcomeRow> = idx.iter().map(|&i| outs[i]).collect();
            let mut fb: Vec<ModelBlock> = (0..nm)
                .map(|m| build_model_block(&model_ids[m], &sub_scores[m], &sub_rets, &sub_base, bins))
                .collect();
            fb.push(build_excursion_block(&sub_outs));
            let scope = format!("fold_{}", fold.id);
            for b in &fb {
                let ev: Vec<Evaluated> = values(b)
                    .into_iter()
                    .map(|v| Evaluated { value: v, ci: None, block_len: None, hac_se: None, significant: None, ess: None })
                    .collect();
                metric_rows.extend(rows_from(b, &ev, h, &scope, &cfg.eval.support, warn_n));
            }
        }

        // Fiabilité : classes d'effectifs égaux, intervalle par blocs sur la fréquence observée.
        let rel: Vec<Vec<ReliabilityRow>> = (0..nm)
            .into_par_iter()
            .map(|m| {
                let rows = &scores[m][gi];
                let Some(p) = rows.iter().map(|r| r.p_up).collect::<Option<Vec<f64>>>() else {
                    return Vec::new();
                };
                let nb = bins.min(n).max(1);
                let assign = equal_count_bins(&p, nb);
                let mut blk = ModelBlock::new(&model_ids[m], n);
                let mut stats = Vec::new();
                for k in 0..nb {
                    let ind: Vec<f64> = assign.iter().map(|a| (*a == k) as u8 as f64).collect();
                    let yk: Vec<f64> =
                        rows.iter().zip(&ind).map(|(r, i)| r.y_up as f64 * i).collect();
                    let cnt: f64 = ind.iter().sum();
                    let psum: f64 = p.iter().zip(&ind).map(|(x, i)| x * i).sum();
                    stats.push((cnt, psum));
                    blk.series.push(yk);
                    blk.series.push(ind);
                    blk.defs.push(metrics::Def {
                        name: format!("bin_{k}"),
                        baseline: None,
                        point_kind: None,
                        kind: Kind::Ratio(2 * k, 2 * k + 1),
                    });
                }
                let ev = evaluate_block(&blk, &plans, all_feasible, cfg.eval.ci_level, None);
                ev.iter()
                    .enumerate()
                    .filter(|(k, e)| stats[*k].0 > 0.0 && e.value.is_finite())
                    .map(|(k, e)| ReliabilityRow {
                        model_id: model_ids[m].clone(),
                        horizon: h,
                        scope: "dev".to_string(),
                        bin: k as u8,
                        p_mean: stats[k].1 / stats[k].0,
                        y_freq: e.value,
                        n: stats[k].0 as u32,
                        ci_lo: e.ci.map(|c| c.0).unwrap_or(e.value),
                        ci_hi: e.ci.map(|c| c.1).unwrap_or(e.value),
                    })
                    .collect()
            })
            .collect();
        rel_rows.extend(rel.into_iter().flatten());
    }

    metric_rows.sort_by(|a, b| {
        a.model_id
            .cmp(&b.model_id)
            .then(a.baseline_id.cmp(&b.baseline_id))
            .then(a.horizon.cmp(&b.horizon))
            .then(a.scope.cmp(&b.scope))
            .then(a.metric.cmp(&b.metric))
            .then(a.point_kind.cmp(&b.point_kind))
    });
    rel_rows.sort_by(|a, b| {
        a.model_id
            .cmp(&b.model_id)
            .then(a.horizon.cmp(&b.horizon))
            .then(a.scope.cmp(&b.scope))
            .then(a.bin.cmp(&b.bin))
    });
    Ok(EvalOutput { scores: st, metrics: metric_rows, reliability: rel_rows, support: support_sizes })
}

pub fn metrics_to_table(rows: &[MetricRow]) -> Table {
    Table::new("metrics")
        .with("model_id", Col::Str(rows.iter().map(|r| r.model_id.clone()).collect()))
        .with("baseline_id", Col::NStr(rows.iter().map(|r| r.baseline_id.clone()).collect()))
        .with("horizon", Col::U16(rows.iter().map(|r| r.horizon).collect()))
        .with("scope", Col::Str(rows.iter().map(|r| r.scope.clone()).collect()))
        .with("support", Col::Str(rows.iter().map(|r| r.support.clone()).collect()))
        .with("metric", Col::Str(rows.iter().map(|r| r.metric.clone()).collect()))
        .with("point_kind", Col::NStr(rows.iter().map(|r| r.point_kind.clone()).collect()))
        .with("value", Col::F64(rows.iter().map(|r| r.value).collect()))
        .with("ci_lo", Col::NF64(rows.iter().map(|r| r.ci_lo).collect()))
        .with("ci_hi", Col::NF64(rows.iter().map(|r| r.ci_hi).collect()))
        .with("block_len", Col::NU32(rows.iter().map(|r| r.block_len).collect()))
        .with("hac_se", Col::NF64(rows.iter().map(|r| r.hac_se).collect()))
        .with("significant", Col::NBool(rows.iter().map(|r| r.significant).collect()))
        .with("n_obs", Col::U32(rows.iter().map(|r| r.n_obs).collect()))
        .with("n_over_h", Col::U32(rows.iter().map(|r| r.n_over_h).collect()))
        .with("ess_acf", Col::NF64(rows.iter().map(|r| r.ess_acf).collect()))
        .with("warn_low_n", Col::Bool(rows.iter().map(|r| r.warn_low_n).collect()))
}

pub fn metrics_from_table(t: &Table) -> Result<Vec<MetricRow>> {
    let model_id = t.str("model_id")?;
    let baseline_id = t.nstr("baseline_id")?;
    let horizon = t.u16("horizon")?;
    let scope = t.str("scope")?;
    let support = t.str("support")?;
    let metric = t.str("metric")?;
    let point_kind = t.nstr("point_kind")?;
    let value = t.f64("value")?;
    let ci_lo = t.nf64("ci_lo")?;
    let ci_hi = t.nf64("ci_hi")?;
    let block_len = t.nu32("block_len")?;
    let hac_se = t.nf64("hac_se")?;
    let significant = t.nbool("significant")?;
    let n_obs = t.u32("n_obs")?;
    let n_over_h = t.u32("n_over_h")?;
    let ess = t.nf64("ess_acf")?;
    let warn = t.bool("warn_low_n")?;
    Ok((0..t.n_rows())
        .map(|i| MetricRow {
            model_id: model_id[i].clone(),
            baseline_id: baseline_id[i].clone(),
            horizon: horizon[i],
            scope: scope[i].clone(),
            support: support[i].clone(),
            metric: metric[i].clone(),
            point_kind: point_kind[i].clone(),
            value: value[i],
            ci_lo: ci_lo[i],
            ci_hi: ci_hi[i],
            block_len: block_len[i],
            hac_se: hac_se[i],
            significant: significant[i],
            n_obs: n_obs[i],
            n_over_h: n_over_h[i],
            ess_acf: ess[i],
            warn_low_n: warn[i],
        })
        .collect())
}

pub fn reliability_to_table(rows: &[ReliabilityRow]) -> Table {
    Table::new("reliability")
        .with("model_id", Col::Str(rows.iter().map(|r| r.model_id.clone()).collect()))
        .with("horizon", Col::U16(rows.iter().map(|r| r.horizon).collect()))
        .with("scope", Col::Str(rows.iter().map(|r| r.scope.clone()).collect()))
        .with("bin", Col::U8(rows.iter().map(|r| r.bin).collect()))
        .with("p_mean", Col::F64(rows.iter().map(|r| r.p_mean).collect()))
        .with("y_freq", Col::F64(rows.iter().map(|r| r.y_freq).collect()))
        .with("n", Col::U32(rows.iter().map(|r| r.n).collect()))
        .with("ci_lo", Col::F64(rows.iter().map(|r| r.ci_lo).collect()))
        .with("ci_hi", Col::F64(rows.iter().map(|r| r.ci_hi).collect()))
}

pub fn reliability_from_table(t: &Table) -> Result<Vec<ReliabilityRow>> {
    let model_id = t.str("model_id")?;
    let horizon = t.u16("horizon")?;
    let scope = t.str("scope")?;
    let bin = t.u8("bin")?;
    let p_mean = t.f64("p_mean")?;
    let y_freq = t.f64("y_freq")?;
    let n = t.u32("n")?;
    let lo = t.f64("ci_lo")?;
    let hi = t.f64("ci_hi")?;
    Ok((0..t.n_rows())
        .map(|i| ReliabilityRow {
            model_id: model_id[i].clone(),
            horizon: horizon[i],
            scope: scope[i].clone(),
            bin: bin[i],
            p_mean: p_mean[i],
            y_freq: y_freq[i],
            n: n[i],
            ci_lo: lo[i],
            ci_hi: hi[i],
        })
        .collect())
}
