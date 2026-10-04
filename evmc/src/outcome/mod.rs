//! Outcomes : réalisés et excursions par (t, H). Indépendants de tout modèle ;
//! aucune ligne du holdout n'est émise tant qu'il est verrouillé.

use rayon::prelude::*;

use crate::data::BarSeries;
use crate::error::Result;
use crate::features::FeatureFrame;
use crate::io::table::{Col, Table};
use crate::types::{HorizonGrid, Zone};
use crate::wf::split::Split;

/// Une ligne de `outcomes.parquet`, clé (ts, horizon).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OutcomeRow {
    pub ts: i64,
    pub bar_idx: u32,
    pub horizon: u16,
    pub ts_end: i64,
    pub p0: f64,
    pub ret: f64,
    pub max_up: f64,
    pub max_dn: f64,
    pub t_up: u16,
    pub t_dn: u16,
    pub dn_before_up_strict: f64,
    pub dn_before_up_incl: f64,
    pub up_before_dn_strict: f64,
    pub up_before_dn_incl: f64,
    pub sigma_ref_h: f64,
    pub sigma_ref_at_up: Option<f64>,
    pub sigma_ref_at_dn: Option<f64>,
    pub ret_z: f64,
    pub max_up_sig_h: f64,
    pub max_dn_sig_h: f64,
    pub max_up_sig_tau: f64,
    pub max_dn_sig_tau: f64,
    pub rv_realized: f64,
    pub open_next: f64,
    pub zone: u8,
    pub fold_id: Option<u16>,
}

/// Outcomes d'une origine : un seul passage sur k = 1..Hmax, une ligne par horizon de la grille.
///
/// `limit` est la première barre inaccessible : la fenêtre doit vérifier t + H < limit.
/// `sigma_ref(k)` est l'écart-type cumulé prédit à t pour [t, t + k].
pub fn origin_outcomes(
    series: &BarSeries,
    t: usize,
    grid: &HorizonGrid,
    limit: usize,
    sigma_ref: impl Fn(u32) -> f64,
    zone: u8,
    fold_id: Option<u16>,
) -> Vec<OutcomeRow> {
    let bars = &series.bars;
    let p0 = bars[t].close;
    let gh = grid.as_slice();
    let mut rows = Vec::with_capacity(gh.len());
    let (mut max_up, mut max_dn) = (0.0f64, 0.0f64);
    let (mut t_up, mut t_dn) = (0u16, 0u16);
    let (mut run_min_d, mut run_max_u) = (0.0f64, 0.0f64);
    let (mut dbu_s, mut dbu_i, mut ubd_s, mut ubd_i) = (0.0f64, 0.0f64, 0.0f64, 0.0f64);
    let mut ssq = 0.0f64;
    let mut prev_close = p0;
    let mut gi = 0usize;
    for k in 1..=grid.h_max() as usize {
        let j = t + k;
        if j >= limit || j >= bars.len() || series.has_gap(j - 1, j) {
            break;
        }
        let b = &bars[j];
        let u = (b.high / p0).ln();
        let d = (b.low / p0).ln();
        let r = (b.close / prev_close).ln();
        prev_close = b.close;
        ssq += r * r;
        if u > max_up {
            max_up = u;
            t_up = k as u16;
            dbu_s = run_min_d;
            dbu_i = run_min_d.min(d).min(0.0);
        }
        if d < max_dn {
            max_dn = d;
            t_dn = k as u16;
            ubd_s = run_max_u;
            ubd_i = run_max_u.max(u).max(0.0);
        }
        run_min_d = run_min_d.min(d);
        run_max_u = run_max_u.max(u);
        if gi < gh.len() && k == gh[gi] as usize {
            let h = gh[gi];
            gi += 1;
            let ret = (b.close / p0).ln();
            let sig_h = sigma_ref(h as u32);
            let sig_up = if t_up > 0 { Some(sigma_ref(t_up as u32)) } else { None };
            let sig_dn = if t_dn > 0 { Some(sigma_ref(t_dn as u32)) } else { None };
            rows.push(OutcomeRow {
                ts: bars[t].ts_close,
                bar_idx: t as u32,
                horizon: h,
                ts_end: b.ts_close,
                p0,
                ret,
                max_up,
                max_dn,
                t_up,
                t_dn,
                dn_before_up_strict: dbu_s,
                dn_before_up_incl: dbu_i,
                up_before_dn_strict: ubd_s,
                up_before_dn_incl: ubd_i,
                sigma_ref_h: sig_h,
                sigma_ref_at_up: sig_up,
                sigma_ref_at_dn: sig_dn,
                ret_z: ret / sig_h,
                max_up_sig_h: max_up / sig_h,
                max_dn_sig_h: max_dn / sig_h,
                max_up_sig_tau: sig_up.map(|s| max_up / s).unwrap_or(0.0),
                max_dn_sig_tau: sig_dn.map(|s| max_dn / s).unwrap_or(0.0),
                rv_realized: ssq.sqrt(),
                open_next: bars[t + 1].open,
                zone,
                fold_id,
            });
        }
    }
    rows
}

/// Construit tous les outcomes accessibles. Les origines de [W, D) n'utilisent aucun prix
/// du holdout ; celles du holdout ne sont émises que s'il est ouvert.
pub fn build(
    series: &BarSeries,
    feats: &FeatureFrame,
    split: &Split,
    grid: &HorizonGrid,
    holdout_opened: bool,
) -> Result<Vec<OutcomeRow>> {
    let w = split.warm_end as usize;
    let d = split.holdout_start as usize;
    let n = split.data_end as usize;
    let end = if holdout_opened { n } else { d };
    let per_origin: Vec<Vec<OutcomeRow>> = (w..end)
        .into_par_iter()
        .map(|t| {
            let zone = split.zone_of(t as u32);
            let limit = if zone == Zone::Holdout { n } else { d };
            let vol = feats.vol_state(t);
            origin_outcomes(
                series,
                t,
                grid,
                limit,
                |k| vol.cum_var_ref(k).sqrt(),
                zone as u8,
                split.fold_of(t as u32),
            )
        })
        .collect();
    let rows: Vec<OutcomeRow> = per_origin.into_iter().flatten().collect();
    for r in &rows {
        split.guard_origin(r.bar_idx, holdout_opened)?;
    }
    Ok(rows)
}

pub fn to_table(rows: &[OutcomeRow]) -> Table {
    macro_rules! col {
        ($variant:ident, $field:ident) => {
            Col::$variant(rows.iter().map(|r| r.$field).collect())
        };
    }
    Table::new("outcomes")
        .with("ts", col!(I64, ts))
        .with("bar_idx", col!(U32, bar_idx))
        .with("horizon", col!(U16, horizon))
        .with("ts_end", col!(I64, ts_end))
        .with("p0", col!(F64, p0))
        .with("ret", col!(F64, ret))
        .with("max_up", col!(F64, max_up))
        .with("max_dn", col!(F64, max_dn))
        .with("t_up", col!(U16, t_up))
        .with("t_dn", col!(U16, t_dn))
        .with("dn_before_up_strict", col!(F64, dn_before_up_strict))
        .with("dn_before_up_incl", col!(F64, dn_before_up_incl))
        .with("up_before_dn_strict", col!(F64, up_before_dn_strict))
        .with("up_before_dn_incl", col!(F64, up_before_dn_incl))
        .with("sigma_ref_h", col!(F64, sigma_ref_h))
        .with("sigma_ref_at_up", col!(NF64, sigma_ref_at_up))
        .with("sigma_ref_at_dn", col!(NF64, sigma_ref_at_dn))
        .with("ret_z", col!(F64, ret_z))
        .with("max_up_sig_h", col!(F64, max_up_sig_h))
        .with("max_dn_sig_h", col!(F64, max_dn_sig_h))
        .with("max_up_sig_tau", col!(F64, max_up_sig_tau))
        .with("max_dn_sig_tau", col!(F64, max_dn_sig_tau))
        .with("rv_realized", col!(F64, rv_realized))
        .with("open_next", col!(F64, open_next))
        .with("zone", col!(U8, zone))
        .with("fold_id", col!(NU16, fold_id))
}

pub fn from_table(t: &Table) -> Result<Vec<OutcomeRow>> {
    let n = t.n_rows();
    let ts = t.i64("ts")?;
    let bar_idx = t.u32("bar_idx")?;
    let horizon = t.u16("horizon")?;
    let ts_end = t.i64("ts_end")?;
    let p0 = t.f64("p0")?;
    let ret = t.f64("ret")?;
    let max_up = t.f64("max_up")?;
    let max_dn = t.f64("max_dn")?;
    let t_up = t.u16("t_up")?;
    let t_dn = t.u16("t_dn")?;
    let dbu_s = t.f64("dn_before_up_strict")?;
    let dbu_i = t.f64("dn_before_up_incl")?;
    let ubd_s = t.f64("up_before_dn_strict")?;
    let ubd_i = t.f64("up_before_dn_incl")?;
    let sig_h = t.f64("sigma_ref_h")?;
    let sig_up = t.nf64("sigma_ref_at_up")?;
    let sig_dn = t.nf64("sigma_ref_at_dn")?;
    let ret_z = t.f64("ret_z")?;
    let mu_h = t.f64("max_up_sig_h")?;
    let md_h = t.f64("max_dn_sig_h")?;
    let mu_t = t.f64("max_up_sig_tau")?;
    let md_t = t.f64("max_dn_sig_tau")?;
    let rv = t.f64("rv_realized")?;
    let open_next = t.f64("open_next")?;
    let zone = t.u8("zone")?;
    let fold = t.nu16("fold_id")?;
    Ok((0..n)
        .map(|i| OutcomeRow {
            ts: ts[i],
            bar_idx: bar_idx[i],
            horizon: horizon[i],
            ts_end: ts_end[i],
            p0: p0[i],
            ret: ret[i],
            max_up: max_up[i],
            max_dn: max_dn[i],
            t_up: t_up[i],
            t_dn: t_dn[i],
            dn_before_up_strict: dbu_s[i],
            dn_before_up_incl: dbu_i[i],
            up_before_dn_strict: ubd_s[i],
            up_before_dn_incl: ubd_i[i],
            sigma_ref_h: sig_h[i],
            sigma_ref_at_up: sig_up[i],
            sigma_ref_at_dn: sig_dn[i],
            ret_z: ret_z[i],
            max_up_sig_h: mu_h[i],
            max_dn_sig_h: md_h[i],
            max_up_sig_tau: mu_t[i],
            max_dn_sig_tau: md_t[i],
            rv_realized: rv[i],
            open_next: open_next[i],
            zone: zone[i],
            fold_id: fold[i],
        })
        .collect())
}
