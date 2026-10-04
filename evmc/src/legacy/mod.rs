//! Port du script Pine « EVMC Directional — FHS-GARCH Fan + Deterministic Typical Candles ».
//!
//! Le script est repris tel quel, sous ses réglages par défaut : mêmes formules, même ordre
//! de calcul, même générateur aléatoire. Le moteur par barre (`engine`) reproduit `f_engine` ;
//! la projection (`project`) reproduit le bloc exécuté sur la dernière barre, lancé ici à
//! chaque origine notée comme si le graphique venait d'être chargé sur cette barre.
//!
//! Écarts connus avec TradingView, faute d'export de référence pour les mesurer :
//! - `ta.ema` est amorcée par une moyenne simple, comme dans le reste du moteur ; l'effet
//!   s'éteint pendant le warm-up ;
//! - la mémoire du panier d'analogues entre deux barres (hystérésis `i_anHyst`) n'a pas
//!   d'équivalent ici : chaque origine choisit ses analogues comme au premier chargement ;
//! - les compteurs de calibration hors échantillon du tableau Pine ne sont pas repris,
//!   l'évaluation du moteur les remplace.

pub mod engine;
pub mod htf;
pub mod params;
pub mod project;
pub mod ta;

use rayon::prelude::*;

use crate::data::bars::Bar;
use crate::io::table::{Col, Table};
use crate::types::{N_Q, QNAMES};

pub use engine::{BarState, Engine, Market};
pub use params::LegacyParams;
pub use project::{project, Projection, Snap};

/// Identifiant du modèle dans la table des prévisions.
pub const MODEL_ID: &str = "legacy_full";

/// Sortie du port pour une origine.
#[derive(Clone, Debug, PartialEq)]
pub struct OriginOut {
    pub bar_idx: u32,
    pub ts: i64,
    pub state: BarState,
    pub h0: f64,
    pub hlr: f64,
    pub proj: Projection,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LegacyRun {
    pub h: usize,
    pub phi: f64,
    pub origins: Vec<OriginOut>,
    /// Origines pour lesquelles le script n'aurait rien tracé (moteur pas prêt).
    pub n_not_ready: usize,
}

/// Nombre d'origines projetées en parallèle par lot.
const BATCH: usize = 128;

/// Parcourt les barres `0..end` et projette à chaque origine de `start..end`.
/// `ts_close` : instant de clôture de chaque barre, clé temporelle des tables.
pub fn run(
    bars: &[Bar],
    aux_4h: Option<&[Bar]>,
    market: Market,
    params: &LegacyParams,
    start: usize,
    end: usize,
    steps: &[usize],
) -> LegacyRun {
    let end = end.min(bars.len());
    let mut eng = Engine::new(params.clone(), market, &bars[..end], aux_4h);
    let phi = eng.gPhi;
    let mut origins: Vec<OriginOut> = Vec::with_capacity(end.saturating_sub(start));
    let mut batch: Vec<(usize, BarState, Snap)> = Vec::with_capacity(BATCH);
    let mut n_not_ready = 0;
    let flush = |batch: &mut Vec<(usize, BarState, Snap)>, origins: &mut Vec<OriginOut>, miss: &mut usize| {
        let outs: Vec<Option<OriginOut>> = batch
            .par_iter()
            .map(|(t, st, snap)| {
                project(snap, params, steps).map(|proj| OriginOut {
                    bar_idx: *t as u32,
                    ts: bars[*t].ts_close,
                    state: *st,
                    h0: snap.cH0,
                    hlr: snap.cHLR,
                    proj,
                })
            })
            .collect();
        for o in outs {
            match o {
                Some(o) => origins.push(o),
                None => *miss += 1,
            }
        }
        batch.clear();
    };
    for (t, b) in bars[..end].iter().enumerate() {
        let st = eng.step(b);
        if t >= start {
            batch.push((t, st, eng.snap()));
            if batch.len() == BATCH {
                flush(&mut batch, &mut origins, &mut n_not_ready);
            }
        }
    }
    flush(&mut batch, &mut origins, &mut n_not_ready);
    LegacyRun { h: params.i_H, phi, origins, n_not_ready }
}

/// Table `legacy_paths` : une ligne par origine et par pas du chemin (1..=H).
pub fn paths_table(run: &LegacyRun) -> Table {
    let n = run.origins.len() * run.h;
    let mut bar_idx = Vec::with_capacity(n);
    let mut ts = Vec::with_capacity(n);
    let mut step = Vec::with_capacity(n);
    let mut cols: [Vec<f64>; 10] = std::array::from_fn(|_| Vec::with_capacity(n));
    for o in &run.origins {
        let p = &o.proj;
        let mut cum = 0.0;
        for k in 1..=run.h {
            bar_idx.push(o.bar_idx);
            ts.push(o.ts);
            step.push(k as u16);
            cum += p.eh[k - 1];
            let vals = [
                p.typical[k],
                p.backbone[k],
                p.wick_up[k],
                p.wick_dn[k],
                p.qa[0][k - 1],
                p.qa[1][k - 1],
                p.qa[2][k - 1],
                p.qa[3][k - 1],
                p.qa[4][k - 1],
                cum.sqrt(),
            ];
            for (c, v) in cols.iter_mut().zip(vals) {
                c.push(v);
            }
        }
    }
    let names = ["typical", "backbone", "wick_up", "wick_dn", "q05", "q25", "q50", "q75", "q95", "sigma_path"];
    let mut t = Table::new("legacy_paths")
        .with("ts", Col::I64(ts))
        .with("bar_idx", Col::U32(bar_idx))
        .with("step", Col::U16(step));
    for (name, c) in names.iter().zip(cols) {
        t.push(name, Col::F64(c));
    }
    t
}

/// Table `legacy_state` : une ligne par origine, l'état du script et le résumé de sa projection.
pub fn state_table(run: &LegacyRun) -> Table {
    let o = &run.origins;
    let f = |g: &dyn Fn(&OriginOut) -> f64| Col::F64(o.iter().map(g).collect());
    let zone = |g: &dyn Fn(&OriginOut) -> Option<f64>| Col::NF64(o.iter().map(g).collect());
    let mut t = Table::new("legacy_state")
        .with("ts", Col::I64(o.iter().map(|x| x.ts).collect()))
        .with("bar_idx", Col::U32(o.iter().map(|x| x.bar_idx).collect()))
        .with("p0", f(&|x| x.proj.p0))
        .with("dir_regime", Col::I8(o.iter().map(|x| x.state.dir_regime).collect()))
        .with("regime_age", Col::U32(o.iter().map(|x| x.state.regime_age).collect()))
        .with("stable_score", f(&|x| x.state.stable))
        .with("raw_score", f(&|x| x.state.raw))
        .with("d_state", f(&|x| x.state.d_state));
    for (i, name) in ["f_d", "f_v", "f_r", "f_a", "f_m", "f_z"].iter().enumerate() {
        t.push(name, f(&|x| x.state.f[i]));
    }
    t.push("compression", f(&|x| x.state.comp));
    t.push("amp", f(&|x| x.state.amp));
    t.push("phase", Col::U8(o.iter().map(|x| x.state.phase).collect()));
    t.push("scenario", Col::U8(o.iter().map(|x| x.proj.scenario).collect()));
    t.push("coil_dir", Col::I8(o.iter().map(|x| x.proj.coil_dir as i8).collect()));
    t.push("mk_state", Col::U8(o.iter().map(|x| x.state.mk).collect()));
    t.push("vol_ratio", f(&|x| x.state.v_ratio));
    t.push("h0", f(&|x| x.h0));
    t.push("hlr", f(&|x| x.hlr));
    t.push("mu_base", f(&|x| x.state.mu_base));
    t.push("atr", f(&|x| x.state.atr));
    t.push("rstab", f(&|x| x.state.rstab));
    t.push("corr", f(&|x| x.proj.corr));
    t.push("final_r", f(&|x| x.proj.final_r));
    t.push("p_up", f(&|x| x.proj.p_up));
    t.push("ev_pct", f(&|x| x.proj.ev_pct));
    t.push("cvar_pct", f(&|x| x.proj.cvar_pct));
    t.push("confidence", f(&|x| x.proj.confidence));
    t.push("sig_hr", f(&|x| x.proj.sig_hr));
    t.push("ana_k", Col::U8(o.iter().map(|x| x.proj.ana_k as u8).collect()));
    t.push("ana_dist", zone(&|x| if x.proj.ana_dist.is_nan() { None } else { Some(x.proj.ana_dist) }));
    t.push("ana_best_age", Col::I32(o.iter().map(|x| x.proj.ana_best_age as i32).collect()));
    // mur le plus fort de chaque côté, en prix
    t.push("sup_lo", zone(&|x| x.proj.zones_sup.first().map(|z| x.proj.p0 * z.lo.exp())));
    t.push("sup_hi", zone(&|x| x.proj.zones_sup.first().map(|z| x.proj.p0 * z.hi.exp())));
    t.push("res_lo", zone(&|x| x.proj.zones_res.first().map(|z| x.proj.p0 * z.lo.exp())));
    t.push("res_hi", zone(&|x| x.proj.zones_res.first().map(|z| x.proj.p0 * z.hi.exp())));
    t.push("used_fhs", Col::Bool(o.iter().map(|x| x.proj.used_fhs).collect()));
    t.push("n_sims", Col::U32(o.iter().map(|x| x.proj.eff_s as u32).collect()));
    t
}

/// Table `legacy_dist` : loi simulée par le script aux horizons de la grille.
pub fn dist_table(run: &LegacyRun) -> Table {
    let mut ts = Vec::new();
    let mut bar_idx = Vec::new();
    let mut horizon = Vec::new();
    let mut sc: [Vec<f64>; 9] = std::array::from_fn(|_| Vec::new());
    let mut q: [Vec<f64>; N_Q] = std::array::from_fn(|_| Vec::new());
    let mut n_sims = Vec::new();
    for o in &run.origins {
        let p = &o.proj;
        for s in &p.steps {
            ts.push(o.ts);
            bar_idx.push(o.bar_idx);
            horizon.push(s.h as u16);
            let sigma_model = p.eh[..s.h].iter().sum::<f64>().sqrt();
            let vals = [p.p0, s.mean, s.std, s.p_up, s.mode, sigma_model, p.typical[s.h], o.state.d_state, p.confidence];
            for (c, v) in sc.iter_mut().zip(vals) {
                c.push(v);
            }
            for (c, v) in q.iter_mut().zip(s.q) {
                c.push(v);
            }
            n_sims.push(p.eff_s as u32);
        }
    }
    let names = ["p0", "mean", "std", "p_up", "mode", "sigma_model", "typical", "d_state", "confidence"];
    let mut t = Table::new("legacy_dist")
        .with("ts", Col::I64(ts))
        .with("bar_idx", Col::U32(bar_idx))
        .with("horizon", Col::U16(horizon));
    for (name, c) in names.iter().zip(sc) {
        t.push(name, Col::F64(c));
    }
    for (name, c) in QNAMES.iter().zip(q) {
        t.push(name, Col::F64(c));
    }
    t.push("n_sims", Col::U32(n_sims));
    t
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::synth::{generate, SynthSpec};

    fn fixture(n: usize, seed: u64) -> Vec<Bar> {
        generate(&SynthSpec { n, seed, t_df: Some(5), ..Default::default() }).0
    }

    const MK: Market = Market { tf_secs: 86_400, h24: true, mintick: 0.01 };

    #[test]
    fn projection_is_well_formed() {
        let bars = fixture(1400, 3);
        let p = LegacyParams::pine_defaults();
        let run = run(&bars, None, MK, &p, 1300, 1400, &[1, 20, 120]);
        assert_eq!(run.origins.len() + run.n_not_ready, 100);
        assert!(run.origins.len() >= 99);
        for o in &run.origins {
            let pr = &o.proj;
            assert_eq!((pr.backbone.len(), pr.typical.len(), pr.steps.len()), (121, 121, 3));
            assert_eq!((pr.backbone[0], pr.typical[0]), (0.0, 0.0));
            // Le chemin typique et le squelette arrivent sur la même cible : la texture est pontée.
            assert!((pr.typical[120] - pr.backbone[120]).abs() < 1e-12);
            assert!(pr.backbone.iter().chain(&pr.typical).all(|x| x.is_finite()));
            assert!(pr.wick_up.iter().chain(&pr.wick_dn).all(|x| *x >= 0.0 && x.is_finite()));
            for t in 0..120 {
                assert!(pr.qa[0][t] <= pr.qa[1][t] && pr.qa[1][t] <= pr.qa[2][t]);
                assert!(pr.qa[2][t] <= pr.qa[3][t] && pr.qa[3][t] <= pr.qa[4][t]);
            }
            assert!((0.0..=1.0).contains(&pr.p_up) && (0.0..=0.95).contains(&pr.confidence));
            assert!(pr.final_r.is_finite() && pr.eff_s == 1500 && pr.used_fhs);
            assert!(pr.ana_k >= 1 && pr.ana_best_age >= 120);
        }
        assert_eq!(paths_table(&run).n_rows(), run.origins.len() * 120);
        assert_eq!(dist_table(&run).n_rows(), run.origins.len() * 3);
        paths_table(&run).validate().unwrap();
        state_table(&run).validate().unwrap();
        dist_table(&run).validate().unwrap();
    }

    #[test]
    fn future_bars_do_not_change_the_projection() {
        // Même origine, série tronquée juste après ou prolongée de 300 barres : même sortie.
        let bars = fixture(1500, 9);
        let p = LegacyParams::pine_defaults();
        let long = run(&bars, None, MK, &p, 1150, 1500, &[5, 60]);
        let short = run(&bars[..1200], None, MK, &p, 1150, 1200, &[5, 60]);
        assert_eq!(short.origins.len(), 50);
        assert_eq!(&long.origins[..50], &short.origins[..]);
        // Et modifier le futur ne change rien non plus.
        let mut alt = bars.clone();
        for b in alt[1200..].iter_mut() {
            b.close *= 1.5;
            b.high *= 1.6;
            b.open *= 1.5;
            b.low *= 1.4;
            b.volume *= 3.0;
        }
        let alt_run = run(&alt, None, MK, &p, 1150, 1500, &[5, 60]);
        assert_eq!(&alt_run.origins[..50], &short.origins[..]);
        assert_ne!(&alt_run.origins[50..], &long.origins[50..]);
    }

    #[test]
    fn result_does_not_depend_on_thread_count() {
        let bars = fixture(1300, 4);
        let p = LegacyParams::pine_defaults();
        let one = rayon::ThreadPoolBuilder::new().num_threads(1).build().unwrap();
        let four = rayon::ThreadPoolBuilder::new().num_threads(4).build().unwrap();
        let a = one.install(|| run(&bars, None, MK, &p, 1000, 1300, &[1, 120]));
        let b = four.install(|| run(&bars, None, MK, &p, 1000, 1300, &[1, 120]));
        assert_eq!(a, b);
    }
}
