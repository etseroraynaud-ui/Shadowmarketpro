//! Features strictement en ligne : l'état avance barre par barre, dans l'ordre.
//! Une feature ne reçoit jamais de tranche contenant le futur.
//!
//! Jalon courant : colonnes de volatilité et du pool de résidus. Les facteurs hérités
//! du Pine (D, V, R, A, M, Z, phases, chaîne de Markov, score, hystérésis) arrivent au jalon M3.

use crate::config::Config;
use crate::data::BarSeries;
use crate::error::Result;
use crate::io::table::{Col, Table};
use crate::vol::{VolFilter, VolState};
use crate::wf::split::Split;

/// Table des features en mémoire, une entrée par barre.
#[derive(Clone, Debug, PartialEq)]
pub struct FeatureFrame {
    pub ts: Vec<i64>,
    pub bar_idx: Vec<u32>,
    pub close: Vec<f64>,
    pub warmup_ok: Vec<bool>,
    pub r: Vec<f64>,
    pub h_ewma: Vec<f64>,
    pub h_lr: Vec<f64>,
    pub h_garch: Vec<f64>,
    pub phi: Vec<f64>,
    pub z_ewma: Vec<f64>,
    pub z_garch: Vec<f64>,
    pub pool_len: Vec<u32>,
    pub pool_mean: Vec<f64>,
    pub pool_var: Vec<f64>,
    pub log_vol_ratio: Vec<f64>,
    pub vol_regime: Vec<i8>,
}

impl FeatureFrame {
    pub fn len(&self) -> usize {
        self.ts.len()
    }
    pub fn is_empty(&self) -> bool {
        self.ts.is_empty()
    }

    pub fn vol_state(&self, t: usize) -> VolState {
        VolState {
            h_ewma: self.h_ewma[t],
            h_lr: self.h_lr[t],
            h_garch: self.h_garch[t],
            phi: self.phi[t],
        }
    }

    /// Fenêtre du pool de résidus connue à t : indices [start, start + len) dans `z_garch`.
    pub fn pool_window(&self, t: usize) -> (usize, usize) {
        let len = self.pool_len[t] as usize;
        (t + 1 - len, len)
    }

    /// Calcule les features sur toute la série, de façon causale.
    pub fn build(series: &BarSeries, cfg: &Config, split: &Split) -> Self {
        let n = series.len();
        let mut f = FeatureFrame {
            ts: Vec::with_capacity(n),
            bar_idx: Vec::with_capacity(n),
            close: Vec::with_capacity(n),
            warmup_ok: Vec::with_capacity(n),
            r: Vec::with_capacity(n),
            h_ewma: Vec::with_capacity(n),
            h_lr: Vec::with_capacity(n),
            h_garch: Vec::with_capacity(n),
            phi: Vec::with_capacity(n),
            z_ewma: Vec::with_capacity(n),
            z_garch: Vec::with_capacity(n),
            pool_len: Vec::with_capacity(n),
            pool_mean: Vec::with_capacity(n),
            pool_var: Vec::with_capacity(n),
            log_vol_ratio: Vec::with_capacity(n),
            vol_regime: Vec::with_capacity(n),
        };
        let mut filter = VolFilter::new(&cfg.vol);
        let phi = filter.phi();
        let pool_size = cfg.vol.pool_size as usize;
        // Sommes cumulées de z et z² : la fenêtre glissante s'en déduit sans relire le futur.
        let mut cs = vec![0.0f64; n + 1];
        let mut cs2 = vec![0.0f64; n + 1];
        let mut prev_close = f64::NAN;
        for (t, b) in series.bars.iter().enumerate() {
            let r = if t > 0 && b.close > 0.0 && prev_close > 0.0 {
                (b.close / prev_close).ln()
            } else {
                0.0
            };
            prev_close = b.close;
            let v = filter.update(r);
            cs[t + 1] = cs[t] + v.z_garch;
            cs2[t + 1] = cs2[t] + v.z_garch * v.z_garch;
            // La barre 0 n'a pas de rendement : le pool commence à la barre 1.
            let len = t.min(pool_size);
            let (mean, var) = if len > 0 {
                let a = t + 1 - len;
                let m = (cs[t + 1] - cs[a]) / len as f64;
                let m2 = (cs2[t + 1] - cs2[a]) / len as f64;
                (m, (m2 - m * m).max(0.0))
            } else {
                (0.0, 0.0)
            };
            let ratio = (v.h_ewma / v.h_lr.max(1e-14)).sqrt();
            f.ts.push(b.ts_close);
            f.bar_idx.push(t as u32);
            f.close.push(b.close);
            f.warmup_ok.push(t as u32 >= split.warm_end);
            f.r.push(v.r);
            f.h_ewma.push(v.h_ewma);
            f.h_lr.push(v.h_lr);
            f.h_garch.push(v.h_garch);
            f.phi.push(phi);
            f.z_ewma.push(v.z_ewma);
            f.z_garch.push(v.z_garch);
            f.pool_len.push(len as u32);
            f.pool_mean.push(mean);
            f.pool_var.push(var);
            f.log_vol_ratio.push(0.5 * (v.h_ewma / v.h_lr).ln());
            f.vol_regime.push(if ratio < 0.8 {
                -1
            } else if ratio > 1.25 {
                1
            } else {
                0
            });
        }
        f
    }

    pub fn to_table(&self) -> Table {
        Table::new("features")
            .with("ts", Col::I64(self.ts.clone()))
            .with("bar_idx", Col::U32(self.bar_idx.clone()))
            .with("close", Col::F64(self.close.clone()))
            .with("warmup_ok", Col::Bool(self.warmup_ok.clone()))
            .with("r", Col::F64(self.r.clone()))
            .with("h_ewma", Col::F64(self.h_ewma.clone()))
            .with("h_lr", Col::F64(self.h_lr.clone()))
            .with("h_garch", Col::F64(self.h_garch.clone()))
            .with("phi", Col::F64(self.phi.clone()))
            .with("z_ewma", Col::F64(self.z_ewma.clone()))
            .with("z_garch", Col::F64(self.z_garch.clone()))
            .with("pool_len", Col::U32(self.pool_len.clone()))
            .with("pool_mean", Col::F64(self.pool_mean.clone()))
            .with("pool_var", Col::F64(self.pool_var.clone()))
            .with("log_vol_ratio", Col::F64(self.log_vol_ratio.clone()))
            .with("vol_regime", Col::I8(self.vol_regime.clone()))
    }

    pub fn from_table(t: &Table) -> Result<Self> {
        Ok(FeatureFrame {
            ts: t.i64("ts")?.to_vec(),
            bar_idx: t.u32("bar_idx")?.to_vec(),
            close: t.f64("close")?.to_vec(),
            warmup_ok: t.bool("warmup_ok")?.to_vec(),
            r: t.f64("r")?.to_vec(),
            h_ewma: t.f64("h_ewma")?.to_vec(),
            h_lr: t.f64("h_lr")?.to_vec(),
            h_garch: t.f64("h_garch")?.to_vec(),
            phi: t.f64("phi")?.to_vec(),
            z_ewma: t.f64("z_ewma")?.to_vec(),
            z_garch: t.f64("z_garch")?.to_vec(),
            pool_len: t.u32("pool_len")?.to_vec(),
            pool_mean: t.f64("pool_mean")?.to_vec(),
            pool_var: t.f64("pool_var")?.to_vec(),
            log_vol_ratio: t.f64("log_vol_ratio")?.to_vec(),
            vol_regime: t.i8("vol_regime")?.to_vec(),
        })
    }
}
