//! Générateur de séries synthétiques : fixtures de test et de mise au point.
//! Processus GARCH(1,1) à dérive constante, extrêmes intrabarre par sous-pas.

use crate::data::bars::Bar;
use crate::math::norm_inv;
use crate::sim::rng::{derive_key, u01, StreamRng};

#[derive(Clone, Debug)]
pub struct SynthSpec {
    pub n: usize,
    pub seed: u64,
    /// Identifiant de fixture : distingue les séries d'un même seed.
    pub id: u64,
    pub timeframe_secs: u32,
    pub start_open_ms: i64,
    pub p0: f64,
    /// Écart-type inconditionnel du rendement d'une barre.
    pub sigma: f64,
    pub alpha: f64,
    pub beta: f64,
    /// Dérive du log-rendement par barre.
    pub drift: f64,
    /// Sous-pas par barre pour construire High et Low.
    pub sub_steps: u32,
    /// Degrés de liberté d'innovations de Student (entier >= 3), ou None pour une loi normale.
    pub t_df: Option<u32>,
}

impl Default for SynthSpec {
    fn default() -> Self {
        Self {
            n: 4000,
            seed: 1,
            id: 0,
            timeframe_secs: 86_400,
            start_open_ms: 1_420_070_400_000, // 2015-01-01
            p0: 100.0,
            sigma: 0.03,
            alpha: 0.06,
            beta: 0.92,
            drift: 0.0,
            sub_steps: 24,
            t_df: None,
        }
    }
}

/// Génère `n` barres. Renvoie aussi la variance conditionnelle vraie de chaque barre.
pub fn generate(spec: &SynthSpec) -> (Vec<Bar>, Vec<f64>) {
    let step = spec.timeframe_secs as i64 * 1000;
    let h_lr = spec.sigma * spec.sigma;
    let omega = (1.0 - spec.alpha - spec.beta) * h_lr;
    let key = derive_key(spec.seed, "synth", &[spec.id]);
    let mut rng = StreamRng::new(key);
    let sub = spec.sub_steps.max(1) as usize;
    let mut bars = Vec::with_capacity(spec.n);
    let mut hs = Vec::with_capacity(spec.n);
    let mut h = h_lr;
    let mut x = spec.p0.ln();
    let mut g = vec![0.0f64; sub];
    for i in 0..spec.n {
        rng.seek(i as u64);
        let mut gauss = || norm_inv(u01(rng.next_u64()));
        for v in g.iter_mut() {
            *v = gauss();
        }
        // Mélange d'échelle pour des innovations de Student de variance 1.
        let mix = match spec.t_df {
            Some(df) if df >= 3 => {
                let mut chi = 0.0;
                for _ in 0..df {
                    let z = gauss();
                    chi += z * z;
                }
                let dff = df as f64;
                (dff / chi).sqrt() / (dff / (dff - 2.0)).sqrt()
            }
            _ => 1.0,
        };
        let vol_noise = gauss();
        let sd_sub = (h / sub as f64).sqrt() * mix;
        let mu_sub = spec.drift / sub as f64;
        let open_x = x;
        let (mut hi, mut lo) = (x, x);
        for v in g.iter() {
            x += mu_sub + sd_sub * v;
            hi = hi.max(x);
            lo = lo.min(x);
        }
        let r = x - open_x;
        let e = r - spec.drift;
        let volume = 1000.0 * (0.5 * vol_noise).exp() * (1.0 + e.abs() / h.sqrt());
        let ts_open = spec.start_open_ms + i as i64 * step;
        bars.push(Bar {
            ts_open,
            ts_close: ts_open + step,
            open: open_x.exp(),
            high: hi.exp(),
            low: lo.exp(),
            close: x.exp(),
            volume,
        });
        hs.push(h);
        h = omega + spec.alpha * e * e + spec.beta * h;
    }
    (bars, hs)
}

/// Écrit des barres au format CSV attendu par le chargeur (convention open_utc_ms).
pub fn write_csv(path: &std::path::Path, bars: &[Bar]) -> crate::error::Result<()> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            std::fs::create_dir_all(dir)?;
        }
    }
    let mut w = csv::Writer::from_path(path)?;
    w.write_record(["time", "open", "high", "low", "close", "volume"])?;
    for b in bars {
        w.write_record([
            b.ts_open.to_string(),
            format!("{:?}", b.open),
            format!("{:?}", b.high),
            format!("{:?}", b.low),
            format!("{:?}", b.close),
            format!("{:?}", b.volume),
        ])?;
    }
    w.flush()?;
    Ok(())
}
