//! Métriques agrégées : définitions par modèle et par horizon, valeur sur l'échantillon,
//! intervalle par bootstrap de blocs, erreur-type HAC pour les moyennes de pertes.

use std::collections::BTreeMap;

use rayon::prelude::*;

use crate::eval::bootstrap::{percentile_ci, weighted_quantiles, BlockPlan};
use crate::eval::hac::{ess_acf, newey_west_se};
use crate::eval::scores::{ScoreRow, INTERVAL_TAGS};
use crate::math::{quantile_sorted, sort_f64};
use crate::outcome::OutcomeRow;

/// Forme d'une statistique, exprimée sur les moyennes de séries par ligne.
#[derive(Clone, Debug, PartialEq)]
pub enum Kind {
    Mean(usize),
    /// Racine de la moyenne.
    Rmse(usize),
    Ratio(usize, usize),
    OneMinusRatio(usize, usize),
    /// Écart-type à partir des moments d'ordre 1 et 2.
    Std(usize, usize),
    /// Différence de moyennes appariée : première série moins seconde.
    Diff(usize, usize),
    /// 0,5 x (a / b + c / d).
    BalAcc([usize; 4]),
    /// Quantile d'une série (indice dans `qseries`).
    Quantile(usize, f64),
    /// Valeur fixe, sans intervalle.
    Value(f64),
}

#[derive(Clone, Debug, PartialEq)]
pub struct Def {
    pub name: String,
    pub baseline: Option<String>,
    pub point_kind: Option<&'static str>,
    pub kind: Kind,
}

/// Séries et définitions de métriques d'un modèle à un horizon.
#[derive(Clone, Debug, Default)]
pub struct ModelBlock {
    pub model_id: String,
    pub n: usize,
    pub series: Vec<Vec<f64>>,
    pub qseries: Vec<Vec<f64>>,
    pub defs: Vec<Def>,
}

impl ModelBlock {
    pub fn new(model_id: &str, n: usize) -> Self {
        Self { model_id: model_id.to_string(), n, ..Default::default() }
    }
    fn add(&mut self, v: Vec<f64>) -> usize {
        debug_assert_eq!(v.len(), self.n);
        self.series.push(v);
        self.series.len() - 1
    }
    fn addq(&mut self, v: Vec<f64>) -> usize {
        debug_assert_eq!(v.len(), self.n);
        self.qseries.push(v);
        self.qseries.len() - 1
    }
    fn def(&mut self, name: &str, kind: Kind) {
        self.defs.push(Def { name: name.to_string(), baseline: None, point_kind: None, kind });
    }
    fn def_full(&mut self, name: &str, baseline: Option<&str>, pk: Option<&'static str>, kind: Kind) {
        self.defs.push(Def {
            name: name.to_string(),
            baseline: baseline.map(|s| s.to_string()),
            point_kind: pk,
            kind,
        });
    }
}

/// Résultat d'une métrique.
#[derive(Clone, Debug, PartialEq)]
pub struct Evaluated {
    pub value: f64,
    pub ci: Option<(f64, f64)>,
    pub block_len: Option<u32>,
    pub hac_se: Option<f64>,
    pub significant: Option<bool>,
    pub ess: Option<f64>,
}

fn col(rows: &[ScoreRow], f: impl Fn(&ScoreRow) -> Option<f64>) -> Option<Vec<f64>> {
    if rows.is_empty() {
        return None;
    }
    rows.iter().map(f).collect()
}

/// Fréquences des classes de PIT (classes de largeur égale).
fn pit_hist(pit: &[f64], bins: usize) -> Vec<f64> {
    let mut h = vec![0.0; bins];
    for p in pit {
        let b = ((p * bins as f64) as usize).min(bins - 1);
        h[b] += 1.0;
    }
    let n = pit.len() as f64;
    h.iter().map(|c| c / n).collect()
}

/// Affectation des lignes à des classes d'effectifs égaux selon P(up).
pub fn equal_count_bins(p: &[f64], bins: usize) -> Vec<usize> {
    let n = p.len();
    let mut order: Vec<usize> = (0..n).collect();
    order.sort_by(|a, b| p[*a].total_cmp(&p[*b]).then(a.cmp(b)));
    let mut out = vec![0usize; n];
    for (rank, ix) in order.iter().enumerate() {
        out[*ix] = (rank * bins / n).min(bins - 1);
    }
    out
}

/// Construit le bloc de métriques d'un modèle sur un ensemble de lignes alignées.
///
/// `base` associe un identifiant de baseline à ses scores sur les mêmes lignes.
pub fn build_model_block(
    model_id: &str,
    rows: &[ScoreRow],
    rets: &[f64],
    base: &BTreeMap<&str, &[ScoreRow]>,
    bins: usize,
) -> ModelBlock {
    let n = rows.len();
    let mut b = ModelBlock::new(model_id, n);
    if n == 0 {
        return b;
    }

    // --- prévision ponctuelle, un jeu de métriques par candidat
    type Getter = fn(&ScoreRow) -> Option<f64>;
    let kinds: [(&'static str, Getter); 4] = [
        ("mean", |r| r.err_mean),
        ("median", |r| r.err_median),
        ("mode", |r| r.err_mode),
        ("legacy_target", |r| r.err_legacy),
    ];
    let mut i_ret2: Option<usize> = None;
    let mut i_b5: Option<usize> = None;
    for (pk, getter) in kinds {
        let Some(e) = col(rows, getter) else { continue };
        let i_e = b.add(e.clone());
        let i_abs = b.add(e.iter().map(|x| x.abs()).collect());
        let i_sq = b.add(e.iter().map(|x| x * x).collect());
        let q_abs = b.addq(e.iter().map(|x| x.abs()).collect());
        b.def_full("bias", None, Some(pk), Kind::Mean(i_e));
        b.def_full("mae", None, Some(pk), Kind::Mean(i_abs));
        b.def_full("rmse", None, Some(pk), Kind::Rmse(i_sq));
        b.def_full("medae", None, Some(pk), Kind::Quantile(q_abs, 0.5));
        if model_id != "b3_zero" {
            let ix = match i_ret2 {
                Some(ix) => ix,
                None => {
                    let ix = b.add(rets.iter().map(|x| x * x).collect());
                    i_ret2 = Some(ix);
                    ix
                }
            };
            b.def_full("r2_oos", Some("b3_zero"), Some(pk), Kind::OneMinusRatio(i_sq, ix));
        }
        if model_id != "b5_drift" {
            if i_b5.is_none() {
                if let Some(eb) = base.get("b5_drift").and_then(|r| col(r, |x| x.err_mean)) {
                    i_b5 = Some(b.add(eb.iter().map(|x| x * x).collect()));
                }
            }
            if let Some(ix) = i_b5 {
                b.def_full("r2_oos", Some("b5_drift"), Some(pk), Kind::OneMinusRatio(i_sq, ix));
            }
        }
    }

    // --- erreur normalisée
    if let Some(z) = col(rows, |r| r.z_err) {
        let i_z = b.add(z.clone());
        let i_z2 = b.add(z.iter().map(|x| x * x).collect());
        let q_z = b.addq(z);
        b.def("z_mean", Kind::Mean(i_z));
        b.def("z_std", Kind::Std(i_z, i_z2));
        for (tag, p) in [("z_q05", 0.05), ("z_q25", 0.25), ("z_q50", 0.50), ("z_q75", 0.75), ("z_q95", 0.95)] {
            b.def(tag, Kind::Quantile(q_z, p));
        }
    }

    // --- distribution
    if let Some(crps) = col(rows, |r| r.crps) {
        for k in 0..4 {
            let tag = INTERVAL_TAGS[k];
            let inside: Vec<f64> =
                rows.iter().map(|r| r.inside[k].unwrap_or(false) as u8 as f64).collect();
            let width: Vec<f64> = rows.iter().map(|r| r.width[k].unwrap_or(0.0)).collect();
            let is: Vec<f64> = rows.iter().map(|r| r.iscore[k].unwrap_or(0.0)).collect();
            let (a, w, s) = (b.add(inside), b.add(width), b.add(is));
            b.def(&format!("cov{tag}"), Kind::Mean(a));
            b.def(&format!("width{tag}"), Kind::Mean(w));
            b.def(&format!("is{tag}"), Kind::Mean(s));
        }
        let i_crps = b.add(crps);
        b.def("crps", Kind::Mean(i_crps));
        for bid in ["b2_clim", "b7_garch_fhs"] {
            if bid == model_id {
                continue;
            }
            if let Some(bc) = base.get(bid).and_then(|r| col(r, |x| x.crps)) {
                let i_b = b.add(bc);
                b.def_full("crps_skill", Some(bid), None, Kind::OneMinusRatio(i_crps, i_b));
                b.def_full("crps_diff", Some(bid), None, Kind::Diff(i_b, i_crps));
            }
        }
        if let Some(pit) = col(rows, |r| r.pit) {
            for (j, f) in pit_hist(&pit, 10).into_iter().enumerate() {
                b.def(&format!("pit_bin_{j}"), Kind::Value(f));
            }
        }
    }

    // --- direction
    if let Some(brier) = col(rows, |r| r.brier) {
        let i_br = b.add(brier);
        b.def("brier", Kind::Mean(i_br));
        if let Some(ll) = col(rows, |r| r.logloss) {
            let i_ll = b.add(ll);
            b.def("logloss", Kind::Mean(i_ll));
        }
        for bid in ["b1_coin", "b2_clim"] {
            if bid == model_id {
                continue;
            }
            if let Some(bb) = base.get(bid).and_then(|r| col(r, |x| x.brier)) {
                let i_b = b.add(bb);
                b.def_full("brier_skill", Some(bid), None, Kind::OneMinusRatio(i_br, i_b));
                b.def_full("brier_diff", Some(bid), None, Kind::Diff(i_b, i_br));
            }
        }
        let called: Vec<f64> = rows.iter().map(|r| r.hit.is_some() as u8 as f64).collect();
        let hits: Vec<f64> = rows.iter().map(|r| r.hit.unwrap_or(0) as f64).collect();
        let any_called = called.iter().any(|c| *c > 0.0);
        let i_called = b.add(called);
        b.def("call_rate", Kind::Mean(i_called));
        if any_called {
            let i_hit = b.add(hits);
            b.def("hit_rate", Kind::Ratio(i_hit, i_called));
        }
        // Balanced accuracy : une ligne sans appel (P = 0,5) compte pour un demi-succès.
        let credit = |r: &ScoreRow| -> f64 {
            match r.hit {
                Some(h) => h as f64,
                None => 0.5,
            }
        };
        let up: Vec<f64> = rows.iter().map(|r| r.y_up as f64).collect();
        let dn: Vec<f64> = rows.iter().map(|r| 1.0 - r.y_up as f64).collect();
        let tp: Vec<f64> = rows.iter().map(|r| r.y_up as f64 * credit(r)).collect();
        let tn: Vec<f64> = rows.iter().map(|r| (1.0 - r.y_up as f64) * credit(r)).collect();
        if up.iter().any(|x| *x > 0.0) && dn.iter().any(|x| *x > 0.0) {
            let ix = [b.add(tp), b.add(up.clone()), b.add(tn), b.add(dn)];
            b.def("balanced_accuracy", Kind::BalAcc(ix));
        }
        // Décomposition de Murphy et ECE sur des classes d'effectifs égaux.
        if let Some(p) = col(rows, |r| r.p_up) {
            let nb = bins.min(n).max(1);
            let assign = equal_count_bins(&p, nb);
            let mut cnt = vec![0.0f64; nb];
            let mut sp = vec![0.0f64; nb];
            let mut sy = vec![0.0f64; nb];
            for i in 0..n {
                cnt[assign[i]] += 1.0;
                sp[assign[i]] += p[i];
                sy[assign[i]] += up[i];
            }
            let nf = n as f64;
            let ybar = up.iter().sum::<f64>() / nf;
            let (mut rel, mut res, mut ece) = (0.0, 0.0, 0.0);
            for k in 0..nb {
                if cnt[k] == 0.0 {
                    continue;
                }
                let (pk, yk) = (sp[k] / cnt[k], sy[k] / cnt[k]);
                rel += cnt[k] * (pk - yk) * (pk - yk) / nf;
                res += cnt[k] * (yk - ybar) * (yk - ybar) / nf;
                ece += cnt[k] * (pk - yk).abs() / nf;
            }
            b.def("brier_rel", Kind::Value(rel));
            b.def("brier_res", Kind::Value(res));
            b.def("brier_unc", Kind::Value(ybar * (1.0 - ybar)));
            b.def("ece", Kind::Value(ece));
        }
    }
    b
}

/// Bloc descriptif des excursions, indépendant de tout modèle.
pub fn build_excursion_block(outs: &[&OutcomeRow]) -> ModelBlock {
    let n = outs.len();
    let mut b = ModelBlock::new("_outcomes", n);
    if n == 0 {
        return b;
    }
    let g = |f: &dyn Fn(&OutcomeRow) -> f64| -> Vec<f64> { outs.iter().map(|o| f(o)).collect() };
    // Le MFE d'un côté est le MAE de l'autre : chaque série n'est enregistrée qu'une fois.
    let up_raw = b.addq(g(&|o| o.max_up));
    let up_h = b.addq(g(&|o| o.max_up_sig_h));
    let up_tau = b.addq(g(&|o| o.max_up_sig_tau));
    let dn_raw = b.addq(g(&|o| -o.max_dn));
    let dn_h = b.addq(g(&|o| -o.max_dn_sig_h));
    let dn_tau = b.addq(g(&|o| -o.max_dn_sig_tau));
    let named: Vec<(&str, usize)> = vec![
        ("long_mfe_raw", up_raw),
        ("long_mfe_sig_h", up_h),
        ("long_mfe_sig_tau", up_tau),
        ("long_mae_raw", dn_raw),
        ("long_mae_sig_h", dn_h),
        ("long_mae_sig_tau", dn_tau),
        ("long_mae_pre_strict_raw", b.addq(g(&|o| -o.dn_before_up_strict))),
        ("long_mae_pre_strict_sig_h", b.addq(g(&|o| -o.dn_before_up_strict / o.sigma_ref_h))),
        ("long_mae_pre_incl_raw", b.addq(g(&|o| -o.dn_before_up_incl))),
        ("long_mae_pre_incl_sig_h", b.addq(g(&|o| -o.dn_before_up_incl / o.sigma_ref_h))),
        ("short_mfe_raw", dn_raw),
        ("short_mfe_sig_h", dn_h),
        ("short_mfe_sig_tau", dn_tau),
        ("short_mae_raw", up_raw),
        ("short_mae_sig_h", up_h),
        ("short_mae_sig_tau", up_tau),
        ("short_mae_pre_strict_raw", b.addq(g(&|o| o.up_before_dn_strict))),
        ("short_mae_pre_strict_sig_h", b.addq(g(&|o| o.up_before_dn_strict / o.sigma_ref_h))),
        ("short_mae_pre_incl_raw", b.addq(g(&|o| o.up_before_dn_incl))),
        ("short_mae_pre_incl_sig_h", b.addq(g(&|o| o.up_before_dn_incl / o.sigma_ref_h))),
    ];
    for (name, ix) in named {
        for (tag, p) in [("q50", 0.50), ("q75", 0.75), ("q90", 0.90)] {
            b.def(&format!("{name}_{tag}"), Kind::Quantile(ix, p));
        }
    }
    b
}

fn eval_kind(kind: &Kind, m: &dyn Fn(usize) -> f64, q: &dyn Fn(usize, f64) -> f64) -> f64 {
    match kind {
        Kind::Mean(i) => m(*i),
        Kind::Rmse(i) => m(*i).max(0.0).sqrt(),
        Kind::Ratio(a, b) => m(*a) / m(*b),
        Kind::OneMinusRatio(a, b) => 1.0 - m(*a) / m(*b),
        Kind::Std(a, b) => (m(*b) - m(*a) * m(*a)).max(0.0).sqrt(),
        Kind::Diff(a, b) => m(*a) - m(*b),
        Kind::BalAcc(ix) => 0.5 * (m(ix[0]) / m(ix[1]) + m(ix[2]) / m(ix[3])),
        Kind::Quantile(i, p) => q(*i, *p),
        Kind::Value(v) => *v,
    }
}

/// Valeurs des métriques sur l'échantillon, sans intervalle.
pub fn values(block: &ModelBlock) -> Vec<f64> {
    let n = block.n as f64;
    let means: Vec<f64> = block.series.iter().map(|s| s.iter().sum::<f64>() / n).collect();
    let sorted: Vec<Vec<f64>> = block
        .qseries
        .iter()
        .map(|s| {
            let mut v = s.clone();
            sort_f64(&mut v);
            v
        })
        .collect();
    block
        .defs
        .iter()
        .map(|d| eval_kind(&d.kind, &|i| means[i], &|i, p| quantile_sorted(&sorted[i], p)))
        .collect()
}

/// Évalue un bloc : valeur, intervalle le plus large parmi les longueurs de bloc,
/// erreur-type HAC et significativité des différences appariées.
///
/// `plans` contient les tirages des longueurs de bloc admissibles ; `all_feasible`
/// indique si toutes les longueurs demandées le sont (sinon la règle de décision ne s'applique pas).
pub fn evaluate_block(
    block: &ModelBlock,
    plans: &[BlockPlan],
    all_feasible: bool,
    ci_level: f64,
    hac_lag: Option<usize>,
) -> Vec<Evaluated> {
    let n = block.n;
    let vals = values(block);
    let nd = block.defs.len();
    let mut out: Vec<Evaluated> = vals
        .iter()
        .map(|v| Evaluated { value: *v, ci: None, block_len: None, hac_se: None, significant: None, ess: None })
        .collect();
    if n == 0 {
        return out;
    }

    // --- HAC et taille effective, pour les moyennes et les différences
    if let Some(lag) = hac_lag {
        for (di, d) in block.defs.iter().enumerate() {
            let series: Option<Vec<f64>> = match &d.kind {
                Kind::Mean(i) => Some(block.series[*i].clone()),
                Kind::Diff(a, b) => Some(
                    block.series[*a].iter().zip(&block.series[*b]).map(|(x, y)| x - y).collect(),
                ),
                _ => None,
            };
            if let Some(s) = series {
                out[di].hac_se = newey_west_se(&s, lag);
                out[di].ess = ess_acf(&s, lag);
            }
        }
    }
    if plans.is_empty() {
        return out;
    }

    // --- séries utiles au bootstrap
    let mut needed = vec![false; block.series.len()];
    let mut any_q = false;
    for d in &block.defs {
        match &d.kind {
            Kind::Mean(i) | Kind::Rmse(i) => needed[*i] = true,
            Kind::Ratio(a, b) | Kind::OneMinusRatio(a, b) | Kind::Std(a, b) | Kind::Diff(a, b) => {
                needed[*a] = true;
                needed[*b] = true;
            }
            Kind::BalAcc(ix) => ix.iter().for_each(|i| needed[*i] = true),
            Kind::Quantile(_, _) => any_q = true,
            Kind::Value(_) => {}
        }
    }
    let order: Vec<Vec<u32>> = if any_q {
        block
            .qseries
            .iter()
            .map(|s| {
                let mut o: Vec<u32> = (0..n as u32).collect();
                o.sort_by(|a, b| s[*a as usize].total_cmp(&s[*b as usize]));
                o
            })
            .collect()
    } else {
        Vec::new()
    };

    let mut widest: Vec<Option<(f64, f64, u32)>> = vec![None; nd];
    let mut all_exclude_zero = vec![true; nd];
    for plan in plans {
        let reps = plan.reps;
        let nf = n as f64;
        let rep_means: Vec<Vec<f64>> = block
            .series
            .iter()
            .enumerate()
            .map(|(i, s)| {
                if needed[i] {
                    plan.replicate_sums(s).into_iter().map(|x| x / nf).collect()
                } else {
                    Vec::new()
                }
            })
            .collect();
        // Quantiles : une passe par réplique, multiplicités partagées par toutes les métriques.
        let q_defs: Vec<usize> = block
            .defs
            .iter()
            .enumerate()
            .filter(|(_, d)| matches!(d.kind, Kind::Quantile(_, _)))
            .map(|(i, _)| i)
            .collect();
        // Quantiles d'une même série regroupés : un seul parcours trié par série et par réplique.
        // Chaque groupe porte ses niveaux distincts, croissants, et les métriques qui les lisent.
        struct QGroup {
            series: usize,
            ps: Vec<f64>,
            slots: Vec<(usize, usize)>,
        }
        let mut groups: Vec<QGroup> = Vec::new();
        for (slot, di) in q_defs.iter().enumerate() {
            if let Kind::Quantile(i, p) = &block.defs[*di].kind {
                let gix = match groups.iter().position(|g| g.series == *i) {
                    Some(ix) => ix,
                    None => {
                        groups.push(QGroup { series: *i, ps: Vec::new(), slots: Vec::new() });
                        groups.len() - 1
                    }
                };
                let g = &mut groups[gix];
                if !g.ps.contains(p) {
                    g.ps.push(*p);
                }
                g.slots.push((slot, 0));
            }
        }
        for g in groups.iter_mut() {
            g.ps.sort_by(|a, b| a.total_cmp(b));
            for (slot, pix) in g.slots.iter_mut() {
                if let Kind::Quantile(_, p) = &block.defs[q_defs[*slot]].kind {
                    *pix = g.ps.iter().position(|x| x == p).unwrap_or(0);
                }
            }
        }
        // Une ligne par réplique, calculée en parallèle ; l'ordre des répliques est conservé.
        let mut q_reps: Vec<Vec<f64>> = vec![Vec::with_capacity(reps); q_defs.len()];
        if !q_defs.is_empty() {
            let nq = q_defs.len();
            let per_rep: Vec<Vec<f64>> = (0..reps)
                .into_par_iter()
                .map_init(
                    || (vec![0u32; n], vec![0i32; n + 1]),
                    |(counts, diff), rep| {
                        plan.counts(rep, counts, diff);
                        let mut row = vec![f64::NAN; nq];
                        let mut vals = [0.0f64; 8];
                        for g in &groups {
                            let m = g.ps.len();
                            weighted_quantiles(
                                &block.qseries[g.series],
                                &order[g.series],
                                counts,
                                n,
                                &g.ps,
                                &mut vals[..m],
                            );
                            for (slot, pix) in &g.slots {
                                row[*slot] = vals[*pix];
                            }
                        }
                        row
                    },
                )
                .collect();
            for row in per_rep {
                for (k, v) in row.into_iter().enumerate() {
                    q_reps[k].push(v);
                }
            }
        }
        let mut qk = 0usize;
        for (di, d) in block.defs.iter().enumerate() {
            let mut reps_v: Vec<f64> = match &d.kind {
                Kind::Value(_) => continue,
                Kind::Quantile(_, _) => {
                    let v = std::mem::take(&mut q_reps[qk]);
                    qk += 1;
                    v
                }
                kind => (0..reps)
                    .map(|rep| eval_kind(kind, &|i| rep_means[i][rep], &|_, _| f64::NAN))
                    .collect(),
            };
            match percentile_ci(&mut reps_v, ci_level) {
                Some((lo, hi)) => {
                    if !(lo > 0.0 || hi < 0.0) {
                        all_exclude_zero[di] = false;
                    }
                    let wider = match widest[di] {
                        Some((l0, h0, _)) => hi - lo > h0 - l0,
                        None => true,
                    };
                    if wider {
                        widest[di] = Some((lo, hi, plan.l as u32));
                    }
                }
                None => all_exclude_zero[di] = false,
            }
        }
    }
    for (di, d) in block.defs.iter().enumerate() {
        if let Some((lo, hi, l)) = widest[di] {
            out[di].ci = Some((lo, hi));
            out[di].block_len = Some(l);
            if matches!(d.kind, Kind::Diff(_, _)) && all_feasible {
                out[di].significant = Some(all_exclude_zero[di]);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bins_have_equal_counts() {
        let p: Vec<f64> = (0..103).map(|i| ((i * 37) % 103) as f64 / 103.0).collect();
        let a = equal_count_bins(&p, 10);
        let mut c = [0; 10];
        a.iter().for_each(|b| c[*b] += 1);
        assert!(c.iter().all(|x| *x == 10 || *x == 11));
        // Les classes sont ordonnées par P croissante.
        for i in 0..p.len() {
            for j in 0..p.len() {
                if p[i] < p[j] {
                    assert!(a[i] <= a[j]);
                }
            }
        }
    }

    #[test]
    fn kinds_evaluate() {
        let m = |i: usize| [2.0, 4.0, 5.0][i];
        let q = |_: usize, _: f64| 0.0;
        assert_eq!(eval_kind(&Kind::Rmse(1), &m, &q), 2.0);
        assert_eq!(eval_kind(&Kind::OneMinusRatio(0, 1), &m, &q), 0.5);
        assert_eq!(eval_kind(&Kind::Std(0, 2), &m, &q), 1.0);
        assert_eq!(eval_kind(&Kind::Diff(1, 0), &m, &q), 2.0);
    }
}
