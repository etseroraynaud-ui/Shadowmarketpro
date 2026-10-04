//! Contrôles d'intégrité des barres. Un fichier non conforme est rejeté ;
//! les trous de données sont signalés, jamais comblés.

use crate::data::bars::Bar;
use crate::error::{Error, Result};

#[derive(Clone, Debug, Default)]
pub struct IntegrityReport {
    pub n_bars: usize,
    pub first_ts_close: i64,
    pub last_ts_close: i64,
    /// (index de la barre qui suit le trou, nombre de barres manquantes)
    pub gaps: Vec<(usize, u64)>,
    pub errors: Vec<String>,
}

impl IntegrityReport {
    pub fn ok(&self) -> bool {
        self.errors.is_empty()
    }
}

const MAX_ERRORS: usize = 20;

/// Vérifie les barres et renvoie le rapport ainsi que le cumul des trous.
pub fn check(bars: &[Bar], timeframe_secs: u32) -> (IntegrityReport, Vec<u32>) {
    let mut rep = IntegrityReport { n_bars: bars.len(), ..Default::default() };
    let mut gap_prefix = vec![0u32; bars.len()];
    let step = timeframe_secs as i64 * 1000;
    let push = |rep: &mut IntegrityReport, msg: String| {
        if rep.errors.len() < MAX_ERRORS {
            rep.errors.push(msg);
        }
    };
    if bars.is_empty() {
        push(&mut rep, "aucune barre".into());
        return (rep, gap_prefix);
    }
    rep.first_ts_close = bars[0].ts_close;
    rep.last_ts_close = bars[bars.len() - 1].ts_close;
    let mut gaps = 0u32;
    for (i, b) in bars.iter().enumerate() {
        let vals = [b.open, b.high, b.low, b.close, b.volume];
        if vals.iter().any(|v| !v.is_finite()) {
            push(&mut rep, format!("barre {i} : valeur non finie"));
            continue;
        }
        if b.open <= 0.0 || b.high <= 0.0 || b.low <= 0.0 || b.close <= 0.0 {
            push(&mut rep, format!("barre {i} : prix <= 0"));
        }
        if b.high < b.open.max(b.close) || b.low > b.open.min(b.close) || b.high < b.low {
            push(&mut rep, format!("barre {i} : OHLC incohérent"));
        }
        if b.volume < 0.0 {
            push(&mut rep, format!("barre {i} : volume négatif"));
        }
        if b.ts_close - b.ts_open != step {
            push(&mut rep, format!("barre {i} : durée différente du timeframe"));
        }
        if i > 0 {
            let d = b.ts_open - bars[i - 1].ts_open;
            if d <= 0 {
                push(&mut rep, format!("barre {i} : horodatage non croissant ou en double"));
            } else if d % step != 0 {
                push(&mut rep, format!("barre {i} : écart non multiple du timeframe"));
            } else if d > step {
                gaps += 1;
                rep.gaps.push((i, (d / step - 1) as u64));
            }
        }
        gap_prefix[i] = gaps;
    }
    (rep, gap_prefix)
}

/// Variante stricte : erreur typée si le rapport contient des erreurs.
pub fn check_strict(bars: &[Bar], timeframe_secs: u32) -> Result<(IntegrityReport, Vec<u32>)> {
    let (rep, gp) = check(bars, timeframe_secs);
    if !rep.ok() {
        return Err(Error::Data(format!(
            "fichier rejeté ({} erreur(s)) : {}",
            rep.errors.len(),
            rep.errors.join(" ; ")
        )));
    }
    Ok((rep, gp))
}
