//! Barres validées et série de base.

use crate::types::Ts;

/// Une barre OHLCV. `ts_close` est l'instant où la barre devient connue.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Bar {
    pub ts_open: Ts,
    pub ts_close: Ts,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// Série de barres d'un symbole et d'un timeframe, dans l'ordre chronologique.
#[derive(Clone, Debug)]
pub struct BarSeries {
    pub symbol: String,
    pub timeframe: String,
    pub timeframe_secs: u32,
    pub bars: Vec<Bar>,
    /// `gap_prefix[i]` = nombre de trous situés avant ou sur la barre i
    /// (un trou « sur » i signifie qu'il manque des barres entre i-1 et i).
    pub gap_prefix: Vec<u32>,
    pub logical_hash: [u8; 32],
}

impl BarSeries {
    pub fn len(&self) -> usize {
        self.bars.len()
    }
    pub fn is_empty(&self) -> bool {
        self.bars.is_empty()
    }
    /// Vrai si la fenêtre de barres (a, b] contient un trou de données.
    pub fn has_gap(&self, a: usize, b: usize) -> bool {
        self.gap_prefix[b] > self.gap_prefix[a]
    }
    pub fn n_gaps(&self) -> u32 {
        *self.gap_prefix.last().unwrap_or(&0)
    }
    pub fn closes(&self) -> Vec<f64> {
        self.bars.iter().map(|b| b.close).collect()
    }
}

/// Hash logique des barres : indépendant du format du fichier d'origine.
pub fn hash_bars(symbol: &str, timeframe: &str, bars: &[Bar]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"evmc.bars.v1");
    h.update(&(symbol.len() as u32).to_le_bytes());
    h.update(symbol.as_bytes());
    h.update(&(timeframe.len() as u32).to_le_bytes());
    h.update(timeframe.as_bytes());
    h.update(&(bars.len() as u64).to_le_bytes());
    for b in bars {
        h.update(&b.ts_open.to_le_bytes());
        h.update(&b.ts_close.to_le_bytes());
        for v in [b.open, b.high, b.low, b.close, b.volume] {
            h.update(&v.to_bits().to_le_bytes());
        }
    }
    *h.finalize().as_bytes()
}
