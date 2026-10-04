//! `ForecastRecord` : une ligne de `forecasts.parquet`, clé (model_id, ts, horizon).

use crate::error::Result;
use crate::io::table::{Col, Table};
use crate::sim::HorizonSummary;
use crate::types::{Family, IQ_25, IQ_50, IQ_75, N_Q, QNAMES};

#[derive(Clone, Debug, PartialEq)]
pub struct ForecastRecord {
    pub model_id: &'static str,
    pub family: Family,
    pub ts: i64,
    pub bar_idx: u32,
    pub horizon: u16,
    pub p0: f64,
    pub predictive_mean: Option<f64>,
    pub predictive_median: Option<f64>,
    pub predictive_mode: Option<f64>,
    pub predictive_sigma: Option<f64>,
    pub sigma_robust: Option<f64>,
    pub sigma_model: Option<f64>,
    pub raw_p_up: Option<f64>,
    pub q: Option<[f64; N_Q]>,
    pub alpha_z: Option<f64>,
    pub mu_alpha: Option<f64>,
    pub alpha_capped: Option<bool>,
    pub fit_id: Option<u32>,
    pub legacy_target: Option<f64>,
    pub legacy_target_kind: Option<&'static str>,
    pub legacy_d_state: Option<f64>,
    pub legacy_confidence: Option<f64>,
    pub n_sims: u32,
    pub se_p_up: Option<f64>,
    pub se_q_max: Option<f64>,
    pub converged: bool,
    /// Tolérance du contrôle de cohérence 1 - F(0) = P(up). Non persistée.
    pub cdf_slack: f64,
}

impl ForecastRecord {
    /// Ligne vide : seuls la clé et le prix d'origine sont renseignés.
    pub fn empty(model_id: &'static str, family: Family, ts: i64, bar_idx: u32, horizon: u16, p0: f64) -> Self {
        Self {
            model_id,
            family,
            ts,
            bar_idx,
            horizon,
            p0,
            predictive_mean: None,
            predictive_median: None,
            predictive_mode: None,
            predictive_sigma: None,
            sigma_robust: None,
            sigma_model: None,
            raw_p_up: None,
            q: None,
            alpha_z: None,
            mu_alpha: None,
            alpha_capped: None,
            fit_id: None,
            legacy_target: None,
            legacy_target_kind: None,
            legacy_d_state: None,
            legacy_confidence: None,
            n_sims: 0,
            se_p_up: None,
            se_q_max: None,
            converged: true,
            cdf_slack: 1e-9,
        }
    }

    /// Remplit les champs de loi à partir d'un résumé (simulé ou analytique).
    pub fn with_summary(mut self, s: &HorizonSummary, sigma_model: Option<f64>) -> Self {
        self.predictive_mean = Some(s.mean);
        self.predictive_median = Some(s.q[IQ_50]);
        self.predictive_mode = Some(s.mode_approx);
        self.predictive_sigma = Some(s.std);
        self.sigma_robust = Some((s.q[IQ_75] - s.q[IQ_25]) / 1.349);
        self.sigma_model = sigma_model;
        self.raw_p_up = Some(s.p_up);
        self.q = Some(s.q);
        self
    }
}

/// Assemble la table `forecasts`, triée par (model_id, ts, horizon).
pub fn to_table(mut recs: Vec<ForecastRecord>) -> Table {
    recs.sort_by(|a, b| {
        a.model_id.cmp(b.model_id).then(a.ts.cmp(&b.ts)).then(a.horizon.cmp(&b.horizon))
    });
    let mut t = Table::new("forecasts");
    t.push("model_id", Col::Str(recs.iter().map(|r| r.model_id.to_string()).collect()));
    t.push("family", Col::Str(recs.iter().map(|r| r.family.as_str().to_string()).collect()));
    t.push("ts", Col::I64(recs.iter().map(|r| r.ts).collect()));
    t.push("bar_idx", Col::U32(recs.iter().map(|r| r.bar_idx).collect()));
    t.push("horizon", Col::U16(recs.iter().map(|r| r.horizon).collect()));
    t.push("p0", Col::F64(recs.iter().map(|r| r.p0).collect()));
    t.push("predictive_mean", Col::NF64(recs.iter().map(|r| r.predictive_mean).collect()));
    t.push("predictive_median", Col::NF64(recs.iter().map(|r| r.predictive_median).collect()));
    t.push("predictive_mode", Col::NF64(recs.iter().map(|r| r.predictive_mode).collect()));
    t.push("predictive_sigma", Col::NF64(recs.iter().map(|r| r.predictive_sigma).collect()));
    t.push("sigma_robust", Col::NF64(recs.iter().map(|r| r.sigma_robust).collect()));
    t.push("sigma_model", Col::NF64(recs.iter().map(|r| r.sigma_model).collect()));
    t.push("raw_p_up", Col::NF64(recs.iter().map(|r| r.raw_p_up).collect()));
    for (i, name) in QNAMES.iter().enumerate() {
        t.push(name, Col::NF64(recs.iter().map(|r| r.q.map(|q| q[i])).collect()));
    }
    t.push("alpha_z", Col::NF64(recs.iter().map(|r| r.alpha_z).collect()));
    t.push("mu_alpha", Col::NF64(recs.iter().map(|r| r.mu_alpha).collect()));
    t.push("alpha_capped", Col::NBool(recs.iter().map(|r| r.alpha_capped).collect()));
    t.push("fit_id", Col::NU32(recs.iter().map(|r| r.fit_id).collect()));
    t.push("legacy_target", Col::NF64(recs.iter().map(|r| r.legacy_target).collect()));
    t.push(
        "legacy_target_kind",
        Col::NStr(recs.iter().map(|r| r.legacy_target_kind.map(|s| s.to_string())).collect()),
    );
    t.push("legacy_d_state", Col::NF64(recs.iter().map(|r| r.legacy_d_state).collect()));
    t.push("legacy_confidence", Col::NF64(recs.iter().map(|r| r.legacy_confidence).collect()));
    t.push("n_sims", Col::U32(recs.iter().map(|r| r.n_sims).collect()));
    t.push("se_p_up", Col::NF64(recs.iter().map(|r| r.se_p_up).collect()));
    t.push("se_q_max", Col::NF64(recs.iter().map(|r| r.se_q_max).collect()));
    t.push("converged", Col::Bool(recs.iter().map(|r| r.converged).collect()));
    t
}

/// Lignes du modèle `legacy_full`, reconstruites depuis la table `legacy_dist` du port Pine.
/// La cible legacy d'un horizon est la valeur du chemin typique à cet horizon.
pub fn legacy_records(t: &Table) -> Result<Vec<ForecastRecord>> {
    let info = crate::models::registry::lookup(crate::legacy::MODEL_ID)?;
    let (ts, bar_idx, horizon) = (t.i64("ts")?, t.u32("bar_idx")?, t.u16("horizon")?);
    let (p0, mean, std) = (t.f64("p0")?, t.f64("mean")?, t.f64("std")?);
    let (p_up, mode, sigma_model) = (t.f64("p_up")?, t.f64("mode")?, t.f64("sigma_model")?);
    let (typical, d_state, confidence) = (t.f64("typical")?, t.f64("d_state")?, t.f64("confidence")?);
    let n_sims = t.u32("n_sims")?;
    let mut qcols = Vec::with_capacity(N_Q);
    for name in QNAMES.iter() {
        qcols.push(t.f64(name)?);
    }
    let mut out = Vec::with_capacity(ts.len());
    for i in 0..ts.len() {
        let mut q = [0.0; N_Q];
        for (j, c) in qcols.iter().enumerate() {
            q[j] = c[i];
        }
        let mut r = ForecastRecord::empty(info.id, info.family, ts[i], bar_idx[i], horizon[i], p0[i]);
        r.predictive_mean = Some(mean[i]);
        r.predictive_median = Some(q[IQ_50]);
        r.predictive_mode = Some(mode[i]);
        r.predictive_sigma = Some(std[i]);
        r.sigma_robust = Some((q[IQ_75] - q[IQ_25]) / 1.349);
        r.sigma_model = Some(sigma_model[i]);
        r.raw_p_up = Some(p_up[i]);
        r.q = Some(q);
        r.legacy_target = Some(typical[i]);
        r.legacy_target_kind = Some("typical_path");
        r.legacy_d_state = Some(d_state[i]);
        r.legacy_confidence = Some(confidence[i]);
        r.n_sims = n_sims[i];
        r.se_p_up = Some((p_up[i] * (1.0 - p_up[i]) / n_sims[i] as f64).sqrt());
        r.cdf_slack = 2.0 / n_sims[i] as f64 + 1e-12;
        out.push(r);
    }
    Ok(out)
}

/// Vue colonne de `forecasts.parquet` pour l'évaluation.
#[derive(Clone, Debug)]
pub struct ForecastFrame {
    pub model_id: Vec<String>,
    pub family: Vec<String>,
    pub ts: Vec<i64>,
    pub bar_idx: Vec<u32>,
    pub horizon: Vec<u16>,
    pub mean: Vec<Option<f64>>,
    pub median: Vec<Option<f64>>,
    pub mode: Vec<Option<f64>>,
    pub sigma: Vec<Option<f64>>,
    pub raw_p_up: Vec<Option<f64>>,
    pub q: Vec<Vec<Option<f64>>>,
    pub legacy_target: Vec<Option<f64>>,
}

impl ForecastFrame {
    pub fn from_table(t: &Table) -> Result<Self> {
        let mut q = Vec::with_capacity(N_Q);
        for name in QNAMES.iter() {
            q.push(t.nf64(name)?.to_vec());
        }
        Ok(Self {
            model_id: t.str("model_id")?.to_vec(),
            family: t.str("family")?.to_vec(),
            ts: t.i64("ts")?.to_vec(),
            bar_idx: t.u32("bar_idx")?.to_vec(),
            horizon: t.u16("horizon")?.to_vec(),
            mean: t.nf64("predictive_mean")?.to_vec(),
            median: t.nf64("predictive_median")?.to_vec(),
            mode: t.nf64("predictive_mode")?.to_vec(),
            sigma: t.nf64("predictive_sigma")?.to_vec(),
            raw_p_up: t.nf64("raw_p_up")?.to_vec(),
            q,
            legacy_target: t.nf64("legacy_target")?.to_vec(),
        })
    }
    pub fn len(&self) -> usize {
        self.ts.len()
    }
    pub fn is_empty(&self) -> bool {
        self.ts.is_empty()
    }
}
