//! Agrégation de barres fines (à la minute, par exemple) vers un timeframe plus long.
//!
//! Les barres de sortie sont alignées sur les multiples du timeframe depuis l'époque Unix :
//! minuit UTC pour le journalier, 00 h, 04 h, 08 h… pour le 4 heures. Une barre n'est gardée
//! que si toutes ses barres sources sont présentes et si son volume est strictement positif.
//! Une période sans échange devient donc un trou, signalé par le contrôle d'intégrité,
//! et non une barre plate inventée.

use crate::data::bars::Bar;
use crate::error::{Error, Result};

/// Bilan d'une agrégation.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ResampleReport {
    /// Barres sources lues.
    pub rows_in: u64,
    /// Barres écrites.
    pub bars_out: u64,
    /// Barres écartées parce qu'il leur manquait des barres sources (début, fin ou trou).
    pub dropped_partial: u64,
    /// Barres écartées parce que leur volume est nul (marché fermé ou échange arrêté).
    pub dropped_empty: u64,
    /// Barres écartées parce qu'elles commencent avant la date de départ demandée.
    pub dropped_before: u64,
}

struct Acc {
    start: i64,
    n: u32,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
}

/// Agrégateur en flux : une barre source à la fois, dans l'ordre chronologique.
pub struct Resampler {
    src_ms: i64,
    tf_ms: i64,
    per_bucket: u32,
    from_ms: i64,
    cur: Option<Acc>,
    last_ts: Option<i64>,
    out: Vec<Bar>,
    rep: ResampleReport,
}

impl Resampler {
    /// `src_secs` : durée d'une barre source ; `tf_secs` : durée d'une barre de sortie.
    /// `from_ms` : aucune barre de sortie ne commence avant cet instant.
    pub fn new(src_secs: u32, tf_secs: u32, from_ms: Option<i64>) -> Result<Self> {
        if src_secs == 0 || tf_secs <= src_secs || !tf_secs.is_multiple_of(src_secs) {
            return Err(Error::Config(format!(
                "agrégation impossible : {tf_secs} s n'est pas un multiple strict de {src_secs} s"
            )));
        }
        Ok(Self {
            src_ms: src_secs as i64 * 1000,
            tf_ms: tf_secs as i64 * 1000,
            per_bucket: tf_secs / src_secs,
            from_ms: from_ms.unwrap_or(i64::MIN),
            cur: None,
            last_ts: None,
            out: Vec::new(),
            rep: ResampleReport::default(),
        })
    }

    fn close_bucket(&mut self) {
        let Some(a) = self.cur.take() else { return };
        if a.start < self.from_ms {
            self.rep.dropped_before += 1;
        } else if a.n != self.per_bucket {
            self.rep.dropped_partial += 1;
        } else if a.volume <= 0.0 {
            self.rep.dropped_empty += 1;
        } else {
            self.out.push(Bar {
                ts_open: a.start,
                ts_close: a.start + self.tf_ms,
                open: a.open,
                high: a.high,
                low: a.low,
                close: a.close,
                volume: a.volume,
            });
        }
    }

    /// Ajoute une barre source. Les horodatages doivent croître strictement et tomber
    /// sur la grille de la source.
    pub fn push(&mut self, b: &Bar) -> Result<()> {
        let ts = b.ts_open;
        if ts.rem_euclid(self.src_ms) != 0 {
            return Err(Error::Data(format!("barre source hors grille : {ts} ms")));
        }
        if self.last_ts.is_some_and(|l| ts <= l) {
            return Err(Error::Data(format!("barre source non croissante ou en double : {ts} ms")));
        }
        let vals = [b.open, b.high, b.low, b.close, b.volume];
        if vals.iter().any(|v| !v.is_finite()) || b.volume < 0.0 {
            return Err(Error::Data(format!("barre source invalide : {ts} ms")));
        }
        self.last_ts = Some(ts);
        self.rep.rows_in += 1;
        let start = ts - ts.rem_euclid(self.tf_ms);
        if self.cur.as_ref().is_some_and(|a| a.start != start) {
            self.close_bucket();
        }
        match &mut self.cur {
            Some(a) => {
                a.n += 1;
                a.high = a.high.max(b.high);
                a.low = a.low.min(b.low);
                a.close = b.close;
                a.volume += b.volume;
            }
            None => {
                self.cur = Some(Acc {
                    start,
                    n: 1,
                    open: b.open,
                    high: b.high,
                    low: b.low,
                    close: b.close,
                    volume: b.volume,
                });
            }
        }
        Ok(())
    }

    /// Ferme la dernière barre et renvoie le résultat.
    pub fn finish(mut self) -> (Vec<Bar>, ResampleReport) {
        self.close_bucket();
        self.rep.bars_out = self.out.len() as u64;
        (self.out, self.rep)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::integrity;

    fn minute(i: i64, px: f64, vol: f64) -> Bar {
        Bar { ts_open: i * 60_000, ts_close: (i + 1) * 60_000, open: px, high: px + 1.0, low: px - 1.0, close: px + 0.5, volume: vol }
    }

    #[test]
    fn aggregates_and_drops_partial_ends() {
        // 1 minute -> 5 minutes ; la série commence à la minute 3 et finit à la minute 16.
        let mut r = Resampler::new(60, 300, None).unwrap();
        for i in 3..=16 {
            r.push(&minute(i, 100.0 + i as f64, 2.0)).unwrap();
        }
        let (bars, rep) = r.finish();
        assert_eq!(rep, ResampleReport { rows_in: 14, bars_out: 2, dropped_partial: 2, dropped_empty: 0, dropped_before: 0 });
        let b = bars[0];
        assert_eq!((b.ts_open, b.ts_close), (300_000, 600_000));
        assert_eq!((b.open, b.high, b.low, b.close, b.volume), (105.0, 110.0, 104.0, 109.5, 10.0));
        assert_eq!((bars[1].open, bars[1].close), (110.0, 114.5));
    }

    #[test]
    fn empty_bucket_becomes_a_reported_gap() {
        let mut r = Resampler::new(60, 300, None).unwrap();
        for i in 0..20 {
            let vol = if (5..10).contains(&i) { 0.0 } else { 1.0 };
            r.push(&minute(i, 50.0, vol)).unwrap();
        }
        let (bars, rep) = r.finish();
        assert_eq!((rep.bars_out, rep.dropped_empty, rep.dropped_partial), (3, 1, 0));
        let (ir, _) = integrity::check(&bars, 300);
        assert!(ir.ok());
        assert_eq!(ir.gaps, vec![(1, 1)]);
    }

    #[test]
    fn hole_in_source_drops_the_bucket() {
        let mut r = Resampler::new(60, 300, None).unwrap();
        for i in (0..15).filter(|i| *i != 7) {
            r.push(&minute(i, 50.0, 1.0)).unwrap();
        }
        let (bars, rep) = r.finish();
        assert_eq!((bars.len(), rep.dropped_partial), (2, 1));
        assert_eq!(bars[1].ts_open, 600_000);
    }

    #[test]
    fn start_date_and_bad_input() {
        let mut r = Resampler::new(60, 300, Some(300_000)).unwrap();
        for i in 0..10 {
            r.push(&minute(i, 50.0, 1.0)).unwrap();
        }
        assert!(r.push(&minute(9, 50.0, 1.0)).is_err());
        assert!(r.push(&Bar { ts_open: 600_500, ..minute(10, 50.0, 1.0) }).is_err());
        let (bars, rep) = r.finish();
        assert_eq!((bars.len(), rep.dropped_before), (1, 1));
        assert!(Resampler::new(60, 90, None).is_err());
        assert!(Resampler::new(300, 300, None).is_err());
    }

    #[test]
    fn two_step_aggregation_matches_direct() {
        // 1 m -> 15 m directement, ou 1 m -> 5 m -> 15 m : mêmes barres.
        let src: Vec<Bar> = (0..90).map(|i| minute(i, 100.0 + ((i * 37) % 11) as f64, 1.0 + (i % 3) as f64)).collect();
        let mut direct = Resampler::new(60, 900, None).unwrap();
        let mut mid = Resampler::new(60, 300, None).unwrap();
        for b in &src {
            direct.push(b).unwrap();
            mid.push(b).unwrap();
        }
        let mut second = Resampler::new(300, 900, None).unwrap();
        for b in &mid.finish().0 {
            second.push(b).unwrap();
        }
        assert_eq!(direct.finish().0, second.finish().0);
    }
}
