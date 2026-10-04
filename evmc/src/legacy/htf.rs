//! Ancres des VWAP : pivots repérés sur une unité de temps de référence (semaine, jour,
//! 4 heures), comme les trois `request.security(..., f_pivAnchor(...))` du script.
//!
//! Une valeur calculée sur une barre de référence n'est visible, depuis le graphique, qu'une
//! fois cette barre close : c'est le comportement de `lookahead_off` sur l'historique.

use crate::data::bars::Bar;
use crate::legacy::ta;

/// Barre d'une unité de temps de référence.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RefBar {
    pub ts_open: i64,
    pub ts_close: i64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl From<&Bar> for RefBar {
    fn from(b: &Bar) -> Self {
        Self { ts_open: b.ts_open, ts_close: b.ts_close, high: b.high, low: b.low, close: b.close, volume: b.volume }
    }
}

/// Regroupe des barres en périodes de `period_ms`, alignées sur `offset_ms` depuis l'époque.
/// La semaine de TradingView commence le lundi : `offset_ms` vaut alors quatre jours.
pub fn group(bars: &[Bar], period_ms: i64, offset_ms: i64) -> Vec<RefBar> {
    let mut out: Vec<RefBar> = Vec::new();
    for b in bars {
        let start = (b.ts_open - offset_ms).div_euclid(period_ms) * period_ms + offset_ms;
        match out.last_mut() {
            Some(last) if last.ts_open == start => {
                last.high = last.high.max(b.high);
                last.low = last.low.min(b.low);
                last.close = b.close;
                last.volume += b.volume;
            }
            _ => out.push(RefBar {
                ts_open: start,
                ts_close: start + period_ms,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: b.volume,
            }),
        }
    }
    out
}

/// Sortie de `f_pivAnchor` pour une barre de référence : heure d'ouverture de la barre du
/// dernier pivot (ou `None`), et VWAP ancré calculé sur les barres de référence (ou `NaN`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Anchor {
    pub t_anchor: Option<i64>,
    pub avwap: f64,
}

/// `f_pivAnchor(L, R, mode)` sur toute une série de référence. L'entrée j ne dépend que
/// des barres 0..=j.
pub fn piv_anchor(bars: &[RefBar], l: usize, r: usize, mode: &str) -> Vec<Anchor> {
    let n = bars.len();
    let highs: Vec<f64> = bars.iter().map(|b| b.high).collect();
    let lows: Vec<f64> = bars.iter().map(|b| b.low).collect();
    let mut cpv = Vec::with_capacity(n);
    let mut cvv = Vec::with_capacity(n);
    let (mut acc_pv, mut acc_v) = (0.0, 0.0);
    let mut t_h: Option<i64> = None;
    let mut t_l: Option<i64> = None;
    let mut since_h: Option<usize> = None;
    let mut since_l: Option<usize> = None;
    let mut out = Vec::with_capacity(n);
    for j in 0..n {
        let b = &bars[j];
        let v = ta::nz(b.volume, 0.0);
        acc_pv += (b.high + b.low + b.close) / 3.0 * v;
        acc_v += v;
        cpv.push(acc_pv);
        cvv.push(acc_v);
        if !ta::pivot_high(&highs[..=j], l, r).is_nan() {
            t_h = Some(bars[j - r].ts_open);
            since_h = Some(0);
        } else if let Some(s) = since_h.as_mut() {
            *s += 1;
        }
        if !ta::pivot_low(&lows[..=j], l, r).is_nan() {
            t_l = Some(bars[j - r].ts_open);
            since_l = Some(0);
        } else if let Some(s) = since_l.as_mut() {
            *s += 1;
        }
        let b_h = since_h.unwrap_or(100_000) + r;
        let b_l = since_l.unwrap_or(100_000) + r;
        let (t_a, b_a) = match mode {
            "Last pivot high" => (t_h, b_h),
            "Last pivot low" => (t_l, b_l),
            _ => (
                match (t_h, t_l) {
                    (None, x) => x,
                    (x, None) => x,
                    (Some(a), Some(c)) => Some(a.max(c)),
                },
                b_h.min(b_l),
            ),
        };
        let kk = (b_a + 1).min(j).min(4999);
        let dvv = cvv[j] - cvv[j - kk];
        let avwap = if b_a < 100_000 && dvv > 0.0 { (cpv[j] - cpv[j - kk]) / dvv } else { f64::NAN };
        out.push(Anchor { t_anchor: t_a, avwap });
    }
    out
}

/// Curseur : dernière barre de référence close au plus tard à l'instant donné.
#[derive(Clone, Debug)]
pub struct RefCursor {
    closes: Vec<i64>,
    anchors: Vec<Anchor>,
    next: usize,
}

impl RefCursor {
    pub fn new(bars: &[RefBar], anchors: Vec<Anchor>) -> Self {
        Self { closes: bars.iter().map(|b| b.ts_close).collect(), anchors, next: 0 }
    }
    /// Valeur visible à la clôture `ts_close` ; les appels doivent se suivre dans le temps.
    pub fn at(&mut self, ts_close: i64) -> Anchor {
        while self.next < self.closes.len() && self.closes[self.next] <= ts_close {
            self.next += 1;
        }
        if self.next == 0 { Anchor { t_anchor: None, avwap: f64::NAN } } else { self.anchors[self.next - 1] }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400_000;

    fn bar(day: i64, px: f64) -> Bar {
        Bar { ts_open: day * DAY, ts_close: (day + 1) * DAY, open: px, high: px + 1.0, low: px - 1.0, close: px, volume: 10.0 }
    }

    #[test]
    fn weeks_start_on_monday() {
        // Le 5 janvier 1970 (jour 4) est un lundi.
        let bars: Vec<Bar> = (2..20).map(|d| bar(d, 100.0 + d as f64)).collect();
        let w = group(&bars, 7 * DAY, 4 * DAY);
        assert_eq!(w[0].ts_open, -3 * DAY);
        assert_eq!(w[1].ts_open, 4 * DAY);
        assert_eq!(w[1].ts_close, 11 * DAY);
        assert_eq!((w[1].high, w[1].low, w[1].close, w[1].volume), (111.0, 103.0, 110.0, 70.0));
        assert_eq!(w[2].ts_open, 11 * DAY);
    }

    #[test]
    fn anchor_follows_the_latest_confirmed_pivot() {
        // Sommet au jour 5, confirmé deux barres plus tard.
        let px = [10.0, 11.0, 12.0, 13.0, 14.0, 20.0, 13.0, 12.0, 11.0, 10.5];
        let bars: Vec<RefBar> =
            px.iter().enumerate().map(|(d, p)| RefBar::from(&bar(d as i64, *p))).collect();
        let a = piv_anchor(&bars, 3, 2, "Latest pivot (high or low)");
        assert!(a[6].t_anchor.is_none() && a[6].avwap.is_nan());
        assert_eq!(a[7].t_anchor, Some(5 * DAY));
        // VWAP des barres 5 à 7, volumes égaux : moyenne des prix typiques.
        let tp = |p: f64| (p + 1.0 + p - 1.0 + p) / 3.0;
        assert!((a[7].avwap - (tp(20.0) + tp(13.0) + tp(12.0)) / 3.0).abs() < 1e-12);
        assert_eq!(a[9].t_anchor, Some(5 * DAY));
    }

    #[test]
    fn cursor_only_exposes_closed_bars() {
        let bars: Vec<Bar> = (4..25).map(|d| bar(d, 100.0)).collect();
        let w = group(&bars, 7 * DAY, 4 * DAY);
        let anchors: Vec<Anchor> =
            (0..w.len()).map(|j| Anchor { t_anchor: Some(j as i64), avwap: j as f64 }).collect();
        let mut c = RefCursor::new(&w, anchors);
        // Du lundi au samedi de la première semaine : aucune semaine close.
        assert!(c.at(10 * DAY).t_anchor.is_none());
        // Clôture du dimanche : la première semaine devient visible.
        assert_eq!(c.at(11 * DAY).t_anchor, Some(0));
        assert_eq!(c.at(17 * DAY).t_anchor, Some(0));
        assert_eq!(c.at(18 * DAY).t_anchor, Some(1));
    }
}
