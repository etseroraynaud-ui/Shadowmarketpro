//! Baselines P0. Toute statistique expansive respecte la règle de maturité :
//! une fenêtre (t', H) n'est utilisée qu'une fois t' + H <= t.

use crate::forecast::record::ForecastRecord;
use crate::math::{half_sample_mode, quantile_sorted};
use crate::models::{Forecaster, ModelInfo, ObserveCtx, Plan, SimSpec, Snapshot};
use crate::sim::analytic::gaussian_summary;
use crate::sim::ResidSpec;
use crate::types::{HorizonGrid, IQ_25, IQ_50, IQ_75, N_Q, QGRID};

fn empty(info: &'static ModelInfo, s: &Snapshot, h: u16) -> ForecastRecord {
    ForecastRecord::empty(info.id, info.family, s.ts, s.bar_idx, h, s.p0)
}

fn gaussian_rows(
    info: &'static ModelInfo,
    s: &Snapshot,
    grid: &HorizonGrid,
    f: impl Fn(u16) -> Option<(f64, f64)>,
) -> Vec<ForecastRecord> {
    grid.as_slice()
        .iter()
        .map(|&h| match f(h) {
            Some((mu, sigma)) if sigma > 0.0 => {
                empty(info, s, h).with_summary(&gaussian_summary(mu, sigma), Some(sigma))
            }
            _ => empty(info, s, h),
        })
        .collect()
}

/// b1_coin : P(up) = 0,5, direction seule.
pub struct Coin {
    pub info: &'static ModelInfo,
}

impl Forecaster for Coin {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        Plan::Closed(
            grid.as_slice()
                .iter()
                .map(|&h| {
                    let mut r = empty(self.info, s, h);
                    r.raw_p_up = Some(0.5);
                    r
                })
                .collect(),
        )
    }
}

/// b3_zero : moyenne = médiane = 0, ponctuel seul.
pub struct Zero {
    pub info: &'static ModelInfo,
}

impl Forecaster for Zero {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        Plan::Closed(
            grid.as_slice()
                .iter()
                .map(|&h| {
                    let mut r = empty(self.info, s, h);
                    r.predictive_mean = Some(0.0);
                    r.predictive_median = Some(0.0);
                    r
                })
                .collect(),
        )
    }
}

/// b2_clim : loi empirique expansive des rendements à H arrivés à maturité.
pub struct Clim {
    info: &'static ModelInfo,
    sorted: Vec<Vec<f64>>,
    sum: Vec<f64>,
    sum2: Vec<f64>,
    n_up: Vec<u64>,
}

/// Nombre minimal de fenêtres mûres pour émettre une loi climatologique.
pub const CLIM_MIN_OBS: usize = 30;

impl Clim {
    pub fn new(info: &'static ModelInfo, n_h: usize) -> Self {
        Self {
            info,
            sorted: vec![Vec::new(); n_h],
            sum: vec![0.0; n_h],
            sum2: vec![0.0; n_h],
            n_up: vec![0; n_h],
        }
    }
}

impl Forecaster for Clim {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn observe(&mut self, ctx: &ObserveCtx) {
        let t = ctx.t;
        for (gi, &h) in ctx.grid.as_slice().iter().enumerate() {
            let h = h as usize;
            if t < h {
                continue;
            }
            let t0 = t - h;
            if t0 < ctx.warm_end || ctx.gap_prefix[t] > ctx.gap_prefix[t0] {
                continue;
            }
            let ret = (ctx.closes[t] / ctx.closes[t0]).ln();
            let v = &mut self.sorted[gi];
            let pos = v.partition_point(|x| *x < ret);
            v.insert(pos, ret);
            self.sum[gi] += ret;
            self.sum2[gi] += ret * ret;
            self.n_up[gi] += (ret > 0.0) as u64;
        }
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        let rows = grid
            .as_slice()
            .iter()
            .enumerate()
            .map(|(gi, &h)| {
                let v = &self.sorted[gi];
                let n = v.len();
                let mut r = empty(self.info, s, h);
                if n < CLIM_MIN_OBS {
                    return r;
                }
                let nf = n as f64;
                let mean = self.sum[gi] / nf;
                let var = ((self.sum2[gi] - nf * mean * mean) / (nf - 1.0)).max(0.0);
                if var <= 0.0 {
                    return r;
                }
                let mut q = [0.0; N_Q];
                for (i, p) in QGRID.iter().enumerate() {
                    q[i] = quantile_sorted(v, *p);
                }
                r.predictive_mean = Some(mean);
                r.predictive_median = Some(q[IQ_50]);
                r.predictive_mode = Some(half_sample_mode(v));
                r.predictive_sigma = Some(var.sqrt());
                r.sigma_robust = Some((q[IQ_75] - q[IQ_25]) / 1.349);
                r.raw_p_up = Some(self.n_up[gi] as f64 / nf);
                r.q = Some(q);
                r.cdf_slack = 2.0 / nf + 1e-12;
                r
            })
            .collect();
        Plan::Closed(rows)
    }
}

/// b4_rw et b5_drift : moments expansifs des rendements d'une barre depuis W.
pub struct Expanding {
    info: &'static ModelInfo,
    with_drift: bool,
    n: u64,
    mean: f64,
    m2: f64,
}

impl Expanding {
    pub fn new(info: &'static ModelInfo, with_drift: bool) -> Self {
        Self { info, with_drift, n: 0, mean: 0.0, m2: 0.0 }
    }
}

impl Forecaster for Expanding {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn observe(&mut self, ctx: &ObserveCtx) {
        let t = ctx.t;
        if t == 0 || t < ctx.warm_end || ctx.gap_prefix[t] > ctx.gap_prefix[t - 1] {
            return;
        }
        let r = (ctx.closes[t] / ctx.closes[t - 1]).ln();
        // Moyenne et somme des carrés centrés en ligne (Welford).
        self.n += 1;
        let d = r - self.mean;
        self.mean += d / self.n as f64;
        self.m2 += d * (r - self.mean);
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        let ok = self.n >= 2;
        let var = if ok { self.m2 / (self.n - 1) as f64 } else { 0.0 };
        let mean = self.mean;
        let with_drift = self.with_drift;
        Plan::Closed(gaussian_rows(self.info, s, grid, |h| {
            if !ok {
                return None;
            }
            let hf = h as f64;
            Some((if with_drift { hf * mean } else { 0.0 }, (hf * var).sqrt()))
        }))
    }
}

/// b6_ewma : N(0, H x h_ewma).
pub struct Ewma {
    pub info: &'static ModelInfo,
}

impl Forecaster for Ewma {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        let h_ewma = s.vol.h_ewma;
        Plan::Closed(gaussian_rows(self.info, s, grid, |h| Some((0.0, (h as f64 * h_ewma).sqrt()))))
    }
}

/// b7a_garch_gauss : N(0, variance cumulée du filtre GARCH de référence).
pub struct GarchGauss {
    pub info: &'static ModelInfo,
}

impl Forecaster for GarchGauss {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn plan(&self, s: &Snapshot, grid: &HorizonGrid) -> Plan {
        let vol = s.vol;
        Plan::Closed(gaussian_rows(self.info, s, grid, |h| {
            Some((0.0, vol.cum_var_ref(h as u32).sqrt()))
        }))
    }
}

/// b7_garch_fhs : Monte Carlo neutre, FHS-GARCH à dérive nulle, résidus centrés non re-normalisés.
pub struct GarchFhs {
    pub info: &'static ModelInfo,
    pub g_alpha: f64,
    pub g_beta: f64,
    pub h_cap_mult: f64,
    pub pool_min: usize,
}

impl Forecaster for GarchFhs {
    fn info(&self) -> &'static ModelInfo {
        self.info
    }
    fn plan(&self, s: &Snapshot, _grid: &HorizonGrid) -> Plan {
        let resid = if s.pool_len >= self.pool_min {
            ResidSpec::Fhs { start: s.pool_start, len: s.pool_len, center: s.pool_mean, scale: 1.0 }
        } else {
            ResidSpec::Gaussian
        };
        Plan::Simulate(SimSpec {
            h0: s.vol.h_garch,
            h_lr: s.vol.h_lr,
            g_alpha: self.g_alpha,
            g_beta: self.g_beta,
            h_cap: self.h_cap_mult * s.vol.h_lr,
            resid,
        })
    }
}
