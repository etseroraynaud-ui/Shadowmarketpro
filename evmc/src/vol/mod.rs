//! Volatilité : filtre EWMA (hérité du Pine), variance long terme, filtre GARCH de
//! référence à paramètres fixes, structure par terme. Les paramètres ne sont pas estimés ici.

pub mod term;

use crate::config::VolCfg;

/// Plancher de variance, identique au Pine.
pub const H_FLOOR: f64 = 1e-12;

/// EMA au sens de TradingView : indéfinie tant que la fenêtre n'est pas pleine,
/// amorcée par la moyenne simple des `len` premières valeurs, puis récursive.
#[derive(Clone, Debug)]
pub struct PineEma {
    len: u32,
    alpha: f64,
    count: u32,
    sum: f64,
    value: Option<f64>,
}

impl PineEma {
    pub fn new(len: u32) -> Self {
        let len = len.max(1);
        Self { len, alpha: 2.0 / (len as f64 + 1.0), count: 0, sum: 0.0, value: None }
    }
    pub fn update(&mut self, x: f64) -> Option<f64> {
        match self.value {
            Some(v) => {
                self.value = Some(self.alpha * x + (1.0 - self.alpha) * v);
            }
            None => {
                self.count += 1;
                self.sum += x;
                if self.count == self.len {
                    self.value = Some(self.sum / self.len as f64);
                }
            }
        }
        self.value
    }
}

/// État de volatilité connu après la barre t. Les `h_*` sont des variances pour t+1.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct VolState {
    pub h_ewma: f64,
    pub h_lr: f64,
    pub h_garch: f64,
    pub phi: f64,
}

impl VolState {
    /// Variance cumulée attendue sur 1..k par le filtre GARCH de référence.
    pub fn cum_var_ref(&self, k: u32) -> f64 {
        term::cum_var(self.h_garch, self.h_lr, self.phi, k)
    }
}

/// Sortie du filtre pour une barre.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct VolRow {
    pub r: f64,
    pub h_ewma: f64,
    pub h_lr: f64,
    pub h_garch: f64,
    pub z_ewma: f64,
    pub z_garch: f64,
}

/// Longueur d'EMA équivalente au lambda EWMA, telle que le Pine la calcule.
pub fn ewma_len(lambda: f64) -> u32 {
    ((2.0 / (1.0 - lambda) - 1.0).round() as i64).max(2) as u32
}

/// Filtre de volatilité en ligne : une barre à la fois, dans l'ordre.
#[derive(Clone, Debug)]
pub struct VolFilter {
    ema_ew: PineEma,
    ema_lr: PineEma,
    alpha: f64,
    beta: f64,
    cap_mult: f64,
    clamp: f64,
    prev_h_ewma: Option<f64>,
    h_garch: Option<f64>,
}

impl VolFilter {
    pub fn new(cfg: &VolCfg) -> Self {
        Self {
            ema_ew: PineEma::new(ewma_len(cfg.ewma_lambda)),
            ema_lr: PineEma::new(cfg.lr_len),
            alpha: cfg.garch_alpha,
            beta: cfg.garch_beta,
            cap_mult: cfg.h_cap_mult,
            clamp: cfg.resid_clamp,
            prev_h_ewma: None,
            h_garch: None,
        }
    }

    pub fn phi(&self) -> f64 {
        self.alpha + self.beta
    }

    /// Intègre le log-rendement de la barre courante (0 pour la première barre).
    pub fn update(&mut self, r: f64) -> VolRow {
        let r2 = r * r;
        let h_ewma = self.ema_ew.update(r2).unwrap_or(r2).max(H_FLOOR);
        let h_lr = self.ema_lr.update(r2).unwrap_or(h_ewma).max(H_FLOOR);
        let sig_prev = self.prev_h_ewma.unwrap_or(h_ewma).max(H_FLOOR).sqrt();
        let z_ewma = (r / sig_prev).clamp(-self.clamp, self.clamp);
        // Variance prédite pour cette barre par le filtre de référence.
        let h_pred = self.h_garch.unwrap_or(h_ewma).max(H_FLOOR);
        let z_garch = (r / h_pred.sqrt()).clamp(-self.clamp, self.clamp);
        let omega = (1.0 - self.phi()) * h_lr;
        let h_next = (omega + self.alpha * r2 + self.beta * h_pred)
            .min(self.cap_mult * h_lr)
            .max(H_FLOOR);
        self.prev_h_ewma = Some(h_ewma);
        self.h_garch = Some(h_next);
        VolRow { r, h_ewma, h_lr, h_garch: h_next, z_ewma, z_garch }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pine_ema_seeds_with_sma() {
        let mut e = PineEma::new(3);
        assert_eq!(e.update(1.0), None);
        assert_eq!(e.update(2.0), None);
        assert_eq!(e.update(3.0), Some(2.0));
        assert_eq!(e.update(6.0), Some(0.5 * 6.0 + 0.5 * 2.0));
    }

    #[test]
    fn ewma_len_matches_pine() {
        assert_eq!(ewma_len(0.94), 32);
        assert_eq!(ewma_len(0.5), 3);
    }
}
