//! Noyau de trajectoires GARCH(1,1) et arrêt adaptatif.
//!
//! Boucle externe sur les trajectoires, interne sur les pas. Chaque trajectoire consomme
//! exactement deux u64 par pas depuis son propre flux (uniforme de transition, indice de
//! résidu), même quand un modèle ne se sert pas du premier : les flux restent alignés.

use crate::config::SimProfile;
use crate::math::{half_sample_mode, norm_inv, quantile_select, quantile_sorted, sort_f64};
use crate::sim::rng::{derive_key, index, u01, word, StreamRng};
use crate::types::{HorizonGrid, N_Q, QGRID, WATCHED_Q};

/// Nombre de trajectoires avancées de front.
const LANES: usize = 8;

/// Source des chocs standardisés.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ResidSpec {
    /// Loi normale par inversion de la fonction de répartition.
    Gaussian,
    /// Bootstrap de résidus : fenêtre [start, start + len) du pool, centrée puis mise à l'échelle.
    Fhs { start: usize, len: usize, center: f64, scale: f64 },
}

/// Entrée complète d'une simulation à l'origine `bar_idx`.
#[derive(Clone, Copy, Debug)]
pub struct SimInput<'a> {
    pub bar_idx: u32,
    /// Variance de la première barre simulée.
    pub h0: f64,
    pub h_lr: f64,
    pub g_alpha: f64,
    pub g_beta: f64,
    pub h_cap: f64,
    pub resid: ResidSpec,
    /// Incréments de dérive par pas (longueur Hmax), ou None pour la loi neutre.
    pub drift_steps: Option<&'a [f64]>,
    /// sigma_H analytique par horizon de la grille : échelle des tolérances d'arrêt.
    pub sigma_h: &'a [f64],
}

/// Résumé de la loi simulée à un horizon.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HorizonSummary {
    pub mean: f64,
    pub std: f64,
    pub p_up: f64,
    pub se_p_up: f64,
    /// Plus grande erreur-type des quantiles surveillés, en unités de sigma_H.
    pub se_q_max: f64,
    /// Erreur-type de la moyenne, en unités de sigma_H.
    pub se_mean: f64,
    pub mode_approx: f64,
    pub q: [f64; N_Q],
}

#[derive(Clone, Debug, PartialEq)]
pub struct SimOutput {
    pub n_sims: u32,
    pub converged: bool,
    pub per_h: Vec<HorizonSummary>,
}

/// Espace de travail d'un thread, alloué une fois à `n_max`.
pub struct Workspace {
    /// Tampon d'aléa d'une trajectoire : 2 u64 par pas.
    u: Vec<u8>,
    /// Terminaux par horizon de la grille : `term[gi][trajectoire]`.
    pub term: Vec<Vec<f64>>,
    scratch: Vec<f64>,
    sum: Vec<f64>,
    sum2: Vec<f64>,
    n_up: Vec<u64>,
    bq_sum: Vec<f64>,
    bq_sum2: Vec<f64>,
}

impl Workspace {
    pub fn new(grid: &HorizonGrid, n_max: u32) -> Self {
        let g = grid.len();
        Self {
            u: vec![0; LANES * 16 * grid.h_max() as usize],
            term: vec![vec![0.0; n_max as usize]; g],
            scratch: vec![0.0; n_max as usize],
            sum: vec![0.0; g],
            sum2: vec![0.0; g],
            n_up: vec![0; g],
            bq_sum: vec![0.0; g * WATCHED_Q.len()],
            bq_sum2: vec![0.0; g * WATCHED_Q.len()],
        }
    }
}

/// Simule depuis `input` jusqu'à convergence ou `n_max`. Les terminaux restent dans `ws.term`.
pub fn simulate(
    input: &SimInput,
    pool: &[f64],
    grid: &HorizonGrid,
    profile: &SimProfile,
    seed: u64,
    ws: &mut Workspace,
) -> SimOutput {
    let gh = grid.as_slice();
    let g = gh.len();
    let h_max = grid.h_max() as usize;
    let nw = WATCHED_Q.len();
    debug_assert!(ws.term[0].len() >= profile.n_max as usize);
    debug_assert_eq!(input.sigma_h.len(), g);
    let mut rng = StreamRng::new(derive_key(seed, "sim", &[input.bar_idx as u64]));
    let omega = (1.0 - input.g_alpha - input.g_beta) * input.h_lr;
    ws.sum.iter_mut().for_each(|x| *x = 0.0);
    ws.sum2.iter_mut().for_each(|x| *x = 0.0);
    ws.n_up.iter_mut().for_each(|x| *x = 0);
    ws.bq_sum.iter_mut().for_each(|x| *x = 0.0);
    ws.bq_sum2.iter_mut().for_each(|x| *x = 0.0);

    let batch = profile.batch as usize;
    let mut n = 0usize;
    let mut n_batches = 0usize;
    let mut converged = false;
    let mut se_p = vec![0.0f64; g];
    let mut se_q = vec![0.0f64; g];
    let mut se_m = vec![0.0f64; g];

    while n < profile.n_max as usize {
        // --- un lot de trajectoires, dans l'ordre des indices
        // Les trajectoires avancent par groupes de LANES : chacune garde son propre flux
        // et sa propre arithmétique, le groupement ne sert qu'à recouvrir les chaînes de calcul.
        let mut p = n;
        while p < n + batch {
            let m = LANES.min(n + batch - p);
            for j in 0..m {
                let off = j * 16 * h_max;
                rng.fill_stream_bytes((p + j) as u64, &mut ws.u[off..off + 16 * h_max]);
            }
            let u = &ws.u;
            let mut x = [0.0f64; LANES];
            let mut h = [input.h0; LANES];
            let mut gi = 0usize;
            let mut next = gh[0] as usize;
            for k in 0..h_max {
                let d = input.drift_steps.map(|d| d[k]).unwrap_or(0.0);
                for j in 0..m {
                    // Mot pair : uniforme de transition (réservé aux dynamiques à états) ;
                    // mot impair : résidu.
                    let u2 = word(u, j * 2 * h_max + 2 * k + 1);
                    let z = match input.resid {
                        ResidSpec::Gaussian => norm_inv(u01(u2)),
                        ResidSpec::Fhs { start, len, center, scale } => {
                            (pool[start + index(u2, len)] - center) * scale
                        }
                    };
                    let eps = h[j].sqrt() * z;
                    x[j] += eps + d;
                    h[j] = (omega + input.g_alpha * eps * eps + input.g_beta * h[j]).min(input.h_cap);
                }
                if k + 1 == next {
                    ws.term[gi][p..p + m].copy_from_slice(&x[..m]);
                    gi += 1;
                    next = if gi < g { gh[gi] as usize } else { usize::MAX };
                }
            }
            p += m;
        }
        // --- statistiques cumulées et quantiles du lot
        for gi in 0..g {
            let slice = &ws.term[gi][n..n + batch];
            let (mut s, mut s2, mut up) = (0.0f64, 0.0f64, 0u64);
            for &x in slice {
                s += x;
                s2 += x * x;
                up += (x > 0.0) as u64;
            }
            ws.sum[gi] += s;
            ws.sum2[gi] += s2;
            ws.n_up[gi] += up;
            ws.scratch[..batch].copy_from_slice(slice);
            for (wi, qi) in WATCHED_Q.iter().enumerate() {
                let q = quantile_select(&mut ws.scratch[..batch], QGRID[*qi]);
                ws.bq_sum[gi * nw + wi] += q;
                ws.bq_sum2[gi * nw + wi] += q * q;
            }
        }
        n += batch;
        n_batches += 1;
        // --- critère d'arrêt : trois erreurs-types sous leur tolérance à tous les horizons
        let nf = n as f64;
        let nb = n_batches as f64;
        let mut ok = n_batches >= 2;
        for gi in 0..g {
            let sig = input.sigma_h[gi].max(1e-300);
            let p = ws.n_up[gi] as f64 / nf;
            se_p[gi] = (p * (1.0 - p) / nf).sqrt();
            let mean = ws.sum[gi] / nf;
            let var = ((ws.sum2[gi] - nf * mean * mean) / (nf - 1.0)).max(0.0);
            se_m[gi] = (var / nf).sqrt() / sig;
            let mut worst = 0.0f64;
            if n_batches >= 2 {
                for wi in 0..nw {
                    let m = ws.bq_sum[gi * nw + wi] / nb;
                    let v = ((ws.bq_sum2[gi * nw + wi] - nb * m * m) / (nb - 1.0)).max(0.0);
                    worst = worst.max((v / nb).sqrt() / sig);
                }
            } else {
                worst = f64::INFINITY;
            }
            se_q[gi] = worst;
            if se_p[gi] > profile.tol_p || se_q[gi] > profile.tol_q || se_m[gi] > profile.tol_mean {
                ok = false;
            }
        }
        if n >= profile.n_min as usize && ok {
            converged = true;
            break;
        }
    }

    // --- résumé final sur tous les terminaux
    let nf = n as f64;
    let mut per_h = Vec::with_capacity(g);
    for gi in 0..g {
        ws.scratch[..n].copy_from_slice(&ws.term[gi][..n]);
        let sorted = &mut ws.scratch[..n];
        sort_f64(sorted);
        let mut q = [0.0; N_Q];
        for (i, p) in QGRID.iter().enumerate() {
            q[i] = quantile_sorted(sorted, *p);
        }
        let mean = ws.sum[gi] / nf;
        let var = ((ws.sum2[gi] - nf * mean * mean) / (nf - 1.0)).max(0.0);
        per_h.push(HorizonSummary {
            mean,
            std: var.sqrt(),
            p_up: ws.n_up[gi] as f64 / nf,
            se_p_up: se_p[gi],
            se_q_max: se_q[gi],
            se_mean: se_m[gi],
            mode_approx: half_sample_mode(sorted),
            q,
        });
    }
    SimOutput { n_sims: n as u32, converged, per_h }
}
