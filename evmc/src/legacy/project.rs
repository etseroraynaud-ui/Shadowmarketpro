//! Projection du Pine à une origine : éventail Monte Carlo FHS-GARCH dirigé, cible
//! directionnelle, squelette par phases, chemin de Viterbi, texture par analogues.
//! C'est le bloc `if barstate.islast` du script, exécuté ici à chaque origine comme si le
//! graphique venait d'être chargé sur cette barre (mode « Last confirmed »).

#![allow(non_snake_case)]

use std::collections::HashMap;

use crate::legacy::engine::{phase_target, z_profile, Engine, Level, ZoneBin};
use crate::legacy::params::LegacyParams;
use crate::legacy::ta::{self, clamp, lcg};
use crate::math::half_sample_mode;
use crate::types::{N_Q, QGRID};

const NEG: f64 = -1.0e18;

/// Ce que la projection lit de l'état du moteur. Copie détachée : plusieurs origines
/// peuvent être projetées en parallèle.
#[derive(Clone, Debug)]
pub struct Snap {
    pub P0: f64,
    pub B0: i64,
    pub nConf: u64,
    pub Rstab: f64,
    pub cMu: f64,
    pub cH0: f64,
    pub cHLR: f64,
    pub cAmp: f64,
    pub cBeta: f64,
    pub cDState: f64,
    pub cMk: u8,
    pub stableScore: f64,
    pub dirRegime: i32,
    pub regimeAge: u32,
    pub atrS: f64,
    pub momZ: f64,
    pub wBin: f64,
    pub Wi: usize,
    pub trapBars: usize,
    pub gA: f64,
    pub gB: f64,
    pub gPhi: f64,
    pub pRefG: f64,
    pub levels: Vec<Level>,
    pub zones: HashMap<i64, ZoneBin>,
    pub gFV: f64,
    pub gFA: f64,
    pub vw: [f64; 3],
    pub phase: u8,
    pub impDir: i32,
    pub rgExt: f64,
    pub rgFar: f64,
    pub rgStart: i64,
    pub rgDur: i64,
    pub coilHi: f64,
    pub coilLo: f64,
    pub sweptHi: bool,
    pub sweptLo: bool,
    pub mk_probs: [f64; 9],
    pub zPool: Vec<f64>,
    pub zCount: usize,
    pub anZ: Vec<f64>,
    pub anU: Vec<f64>,
    pub anW: Vec<f64>,
    pub anS: Vec<f64>,
    pub anV: Vec<f64>,
    pub anHead: i64,
    pub anCount: usize,
}

impl Engine {
    /// État lu par la projection, après la dernière barre intégrée.
    pub fn snap(&self) -> Snap {
        Snap {
            P0: self.cClose,
            B0: self.cBar,
            nConf: self.nConf,
            Rstab: self.Rstab,
            cMu: self.cMu,
            cH0: self.cH0,
            cHLR: self.cHLR,
            cAmp: self.cAmp,
            cBeta: self.cBeta,
            cDState: self.cDState,
            cMk: self.cMk,
            stableScore: self.stableScore,
            dirRegime: self.dirRegime,
            regimeAge: self.regimeAge,
            atrS: self.atrS,
            momZ: self.momZ,
            wBin: self.w_bin,
            Wi: self.Wi,
            trapBars: self.trap_bars,
            gA: self.gA,
            gB: self.gB,
            gPhi: self.gPhi,
            pRefG: self.pRefG,
            levels: self.levels.clone(),
            zones: self.zones.clone(),
            gFV: self.gFV,
            gFA: self.gFA,
            vw: [self.vwW, self.vwD, self.vw4h],
            phase: self.phase,
            impDir: self.impDir,
            rgExt: self.rgExt,
            rgFar: self.rgFar,
            rgStart: self.rgStart,
            rgDur: self.rgDur,
            coilHi: self.coilHi,
            coilLo: self.coilLo,
            sweptHi: self.sweptHi,
            sweptLo: self.sweptLo,
            mk_probs: self.mk_probs,
            zPool: self.zPool.clone(),
            zCount: self.zCount,
            anZ: self.anZ.clone(),
            anU: self.anU.clone(),
            anW: self.anW.clone(),
            anS: self.anS.clone(),
            anV: self.anV.clone(),
            anHead: self.anHead,
            anCount: self.anCount,
        }
    }
}

/// Résumé de la loi simulée à un horizon.
#[derive(Clone, Debug, PartialEq)]
pub struct StepSummary {
    pub h: usize,
    pub mean: f64,
    pub std: f64,
    pub p_up: f64,
    pub mode: f64,
    pub q: [f64; N_Q],
}

/// Zone retenue par `f_pickZones` : bornes en log-distance à l'ancre, force, flux.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PickedZone {
    pub lo: f64,
    pub hi: f64,
    pub strength: f64,
    pub flow: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Projection {
    pub h: usize,
    pub p0: f64,
    /// Quantiles 5, 25, 50, 75, 95 % ; l'indice t correspond à l'horizon t + 1.
    pub qa: [Vec<f64>; 5],
    pub p_up: f64,
    pub ev_pct: f64,
    pub cvar_pct: f64,
    pub q_tlo: f64,
    pub q_thi: f64,
    pub corr: f64,
    /// Cible directionnelle à l'horizon H, en log-rendement.
    pub final_r: f64,
    pub sig_hr: f64,
    /// Chemin directionnel (`pth`), H + 1 points, en log-rendement depuis l'ancre.
    pub backbone: Vec<f64>,
    /// Chemin typique (`typPx`) : squelette plus texture des analogues.
    pub typical: Vec<f64>,
    /// Mèches hautes et basses des bougies typiques, en log au-delà du corps.
    pub wick_up: Vec<f64>,
    pub wick_dn: Vec<f64>,
    /// Variance attendue par barre, après l'ajustement de range.
    pub eh: Vec<f64>,
    /// 0 normal, 1 range après impulsion, 2 compression.
    pub scenario: u8,
    pub coil_dir: i32,
    pub confidence: f64,
    pub ana_k: usize,
    pub ana_dist: f64,
    pub ana_best_age: i64,
    pub zones_sup: Vec<PickedZone>,
    pub zones_res: Vec<PickedZone>,
    pub used_fhs: bool,
    pub eff_s: usize,
    pub viterbi_w: usize,
    pub steps: Vec<StepSummary>,
}

/// `f_cumSorted` : coût cumulé des niveaux situés sous chaque point de la grille.
fn cum_sorted(xs: &[f64], cs: &[f64], base: f64, stp: f64, out: &mut [f64]) {
    let n = xs.len();
    let mut m = 0;
    let mut acc = 0.0;
    for (j, o) in out.iter_mut().enumerate() {
        let xa = base + j as f64 * stp;
        while m < n && xs[m] < xa {
            acc += cs[m];
            m += 1;
        }
        *o = acc;
    }
}

/// `f_sortPair` : tri croissant des positions, les coûts suivent.
fn sort_pair(xs: &[f64], cs: &[f64]) -> (Vec<f64>, Vec<f64>) {
    let mut idx: Vec<usize> = (0..xs.len()).collect();
    idx.sort_by(|a, b| xs[*a].total_cmp(&xs[*b]));
    (idx.iter().map(|i| xs[*i]).collect(), idx.iter().map(|i| cs[*i]).collect())
}

/// `f_zonePen` : coût des murs à traverser pour atteindre x depuis l'ancre.
fn zone_pen(x: f64, a_x: &[f64], a_c: &[f64], d_x: &[f64], d_c: &[f64]) -> f64 {
    let mut pen = 0.0;
    if x < 0.0 {
        for (xm, c) in a_x.iter().zip(a_c) {
            if *xm > x && *xm < 0.0 {
                pen += c;
            }
        }
    } else {
        for (xm, c) in d_x.iter().zip(d_c) {
            if *xm < x && *xm > 0.0 {
                pen += c;
            }
        }
    }
    pen
}

/// `f_pickZones` : les `n_pick` murs les plus forts, étendus à leurs voisins contigus.
fn pick_zones(xs: &[f64], cs: &[f64], flw: &[f64], n_pick: usize, w: f64) -> Vec<PickedZone> {
    let mut out = Vec::new();
    let n = xs.len();
    if n == 0 {
        return out;
    }
    let mut used = vec![false; n];
    for _ in 0..n_pick {
        let mut bi: Option<usize> = None;
        let mut bc = 0.0;
        for m in 0..n {
            if !used[m] && cs[m] > bc {
                bc = cs[m];
                bi = Some(m);
            }
        }
        let Some(bi) = bi else { break };
        let (mut a, mut b) = (bi, bi);
        while a > 0 && !used[a - 1] && xs[a] - xs[a - 1] < 1.5 * w && cs[a - 1] >= 0.35 * bc {
            a -= 1;
        }
        while b < n - 1 && !used[b + 1] && xs[b + 1] - xs[b] < 1.5 * w && cs[b + 1] >= 0.35 * bc {
            b += 1;
        }
        for u in used.iter_mut().take((b + 3).min(n - 1) + 1).skip(a.saturating_sub(3)) {
            *u = true;
        }
        out.push(PickedZone { lo: xs[a] - 0.5 * w, hi: xs[b] + 0.5 * w, strength: bc, flow: flw[bi] });
    }
    out
}

/// `f_insSorted` : insertion dans une liste triée par distance croissante.
fn ins_sorted(a_a: &mut Vec<i64>, a_d: &mut Vec<f64>, age: i64, d: f64) {
    let pos = a_d.iter().position(|x| d < *x).unwrap_or(a_d.len());
    a_d.insert(pos, d);
    a_a.insert(pos, age);
}

fn ring(arr: &[f64], idx: i64) -> f64 {
    let cap = arr.len() as i64;
    arr[idx.rem_euclid(cap) as usize]
}

/// Projette depuis l'état `s`. `steps` : horizons (en barres, entre 1 et H) dont la loi
/// simulée est résumée. Renvoie `None` tant que le moteur n'est pas prêt.
pub fn project(s: &Snap, p: &LegacyParams, steps: &[usize]) -> Option<Projection> {
    let H = p.i_H;
    let P0 = s.P0;
    let ready = !P0.is_nan() && !s.cH0.is_nan() && !s.Rstab.is_nan() && s.nConf > 60;
    if !ready {
        return None;
    }
    let B0 = s.B0;
    let Hf = H as f64;

    // ---------- paramètres de Markov : dérives centrées, volatilités normalisées
    let mkOn = p.i_mk_enable;
    let pr = &s.mk_probs;
    let (p00, p01, p02, p10, p11, p12, p20, p21, p22) = (pr[0], pr[1], pr[2], pr[3], pr[4], pr[5], pr[6], pr[7], pr[8]);
    let (mut pi0, mut pi1, mut pi2) = (0.0, 0.0, 1.0);
    if mkOn {
        pi0 = 1.0 / 3.0;
        pi1 = 1.0 / 3.0;
        pi2 = 1.0 / 3.0;
        for _ in 0..200 {
            let n0 = pi0 * p00 + pi1 * p10 + pi2 * p20;
            let n1 = pi0 * p01 + pi1 * p11 + pi2 * p21;
            let n2 = pi0 * p02 + pi1 * p12 + pi2 * p22;
            let nsum = (n0 + n1 + n2).max(1e-12);
            pi0 = n0 / nsum;
            pi1 = n1 / nsum;
            pi2 = n2 / nsum;
        }
    }
    let kMean = pi0 * p.i_mkKBull + pi1 * p.i_mkKBear + pi2 * p.i_mkKNeu;
    let smRms = (pi0 * p.i_sig_bull * p.i_sig_bull + pi1 * p.i_sig_bear * p.i_sig_bear + pi2 * p.i_sig_neutral * p.i_sig_neutral)
        .max(1e-12)
        .sqrt();
    let kc = [p.i_mkKBull - kMean, p.i_mkKBear - kMean, p.i_mkKNeu - kMean];
    let smN = [p.i_sig_bull / smRms, p.i_sig_bear / smRms, p.i_sig_neutral / smRms];
    let flipOn = p.i_flip_mr_enable && mkOn;
    let fw0 = if flipOn { clamp((p01 - p.i_flip_thr) / p.i_flip_width.max(1e-6), 0.0, 1.0) } else { 0.0 };
    let fw1 = if flipOn { clamp((p10 - p.i_flip_thr) / p.i_flip_width.max(1e-6), 0.0, 1.0) } else { 0.0 };
    let fw = [fw0, fw1, 0.0];
    let s0: usize = if mkOn { s.cMk as usize } else { 2 };

    // ---------- structure par terme de la variance attendue
    let hLRx = s.cHLR;
    let gPhi = s.gPhi;
    let omega = (1.0 - gPhi) * hLRx;
    let mut Eh: Vec<f64> = (0..H).map(|k| (hLRx + gPhi.powf(k as f64) * (s.cH0 - hLRx)).max(1e-14)).collect();

    // ---------- listes de niveaux (log-distance à l'ancre)
    let (mut sX, mut sC) = (Vec::new(), Vec::new());
    if p.i_srCross > 0.0 {
        for lv in s.levels.iter().filter(|l| !l.ctrl) {
            let nnL = lv.rej + lv.brk;
            if nnL > 0.0 {
                let pRjL = (lv.rej + p.i_srPrior * s.pRefG) / (nnL + p.i_srPrior);
                let tfL = 1.0 - (-lv.touches / 3.0).exp();
                let costL = p.i_srCross * tfL * 0f64.max(((1.0 - s.pRefG) / (1.0 - pRjL).max(0.02)).ln());
                if costL > 0.0 {
                    sX.push((lv.price / P0).ln());
                    sC.push(costL);
                }
            }
        }
    }
    let (mut aX, mut aC, mut aF) = (Vec::new(), Vec::new(), Vec::new());
    let (mut dX, mut dC, mut dF) = (Vec::new(), Vec::new(), Vec::new());
    let lP0z = P0.ln();
    let wBin = s.wBin;
    let atrBc = (s.atrS / P0 / wBin).max(1.0);
    let perBin = 1.0 / (0.5 * atrBc);
    let sigHa = ta::var_h(s.cH0, hLRx, gPhi, H).max(1e-14).sqrt();
    let spanZ = 5.0 * sigHa;
    let kC = (lP0z / wBin).floor() as i64;
    let Rz = 600f64.min((spanZ / wBin).ceil()) as i64;
    let hwc = 1f64.max((p.i_zoneSmooth * atrBc + 0.5).floor()) as i64;
    let (qV, qN, qA) = z_profile(&s.zones, kC - Rz, kC + Rz, B0, p.i_zoneTau, hwc);
    let rV = ta::pos_median(&qV);
    let rN = ta::pos_median(&qN);
    let fMean = if s.gFV > 0.0 { s.gFA / s.gFV } else { 0.0 };
    let momZa = s.momZ;
    for i in 0..=(2 * Rz) as usize {
        let svI = qV[i];
        if svI > 0.0 {
            let st = clamp((1.0 - p.i_zoneTPO) * svI / rV + p.i_zoneTPO * qN[i] / rN - 1.0, 0.0, 6.0);
            if st > p.i_zoneMin {
                let xk = ((kC - Rz + i as i64) as f64 + 0.5) * wBin - lP0z;
                let dA = xk / (atrBc * wBin);
                let side = if dA < -0.5 {
                    1.0
                } else if dA > 0.5 {
                    -1.0
                } else if momZa <= 0.0 {
                    1.0
                } else {
                    -1.0
                };
                let flr = qA[i] / svI - fMean;
                let role = 1.0 + p.i_zoneFlowW * clamp(side * flr / 0.15, -0.8, 2.0);
                let cz = st * role * perBin;
                if side > 0.0 {
                    aX.push(xk);
                    aC.push(cz);
                    aF.push(flr);
                } else {
                    dX.push(xk);
                    dC.push(cz);
                    dF.push(flr);
                }
            }
        }
    }
    let zPickS = pick_zones(&aX, &aC, &aF, p.i_zoneN, wBin);
    let zPickR = pick_zones(&dX, &dC, &dF, p.i_zoneN, wBin);
    // VWAP ancrés : murs supplémentaires
    if p.i_rvCross > 0.0 {
        for (vq, wt) in s.vw.iter().zip([p.i_rvWW, p.i_rvWD, p.i_rvW4]) {
            if !vq.is_nan() && *vq > 0.0 {
                let xv = (vq / P0).ln();
                let dV = xv / (atrBc * wBin);
                let supV = if dV < -0.3 {
                    true
                } else if dV > 0.3 {
                    false
                } else {
                    momZa <= 0.0
                };
                if supV {
                    aX.push(xv);
                    aC.push(p.i_rvCross * wt);
                } else {
                    dX.push(xv);
                    dC.push(p.i_rvCross * wt);
                }
            }
        }
    }
    let (sXs, sCs) = sort_pair(&sX, &sC);
    let (aXs, aCs) = sort_pair(&aX, &aC);
    let (dXs, dCs) = sort_pair(&dX, &dC);
    let hasZones = aXs.len() + dXs.len() > 0;

    // ---------- paramètres de phase
    let remR = s.rgStart + s.rgDur - B0;
    let rngOn = p.i_phEnable && s.phase == 1 && remR > 0;
    let coilOn = p.i_phEnable && s.phase == 2;
    let swL = 2i64.max((s.rgDur as f64 / (p.i_rangeSwings as f64 + 0.5)) as i64);
    let kapR = p.i_rangeKappa * 2f64.ln() / (swL as f64 / 2.0).max(1.0);
    let (lExt0, lFar0) = if rngOn { ((s.rgExt / P0).ln(), (s.rgFar / P0).ln()) } else { (0.0, 0.0) };
    let mut xMidR = if rngOn { 0.5 * (lExt0 + lFar0) } else { 0.0 };
    let xTop = lExt0.max(lFar0);
    let xBot = lExt0.min(lFar0);
    let mut vSc = vec![1.0; H];
    if rngOn {
        let hRg = (xTop - xBot).max(1e-6);
        let mut bestKey = 0.0;
        for (xq, c) in aX.iter().zip(&aC).chain(dX.iter().zip(&dC)) {
            if *xq > xBot + 0.1 * hRg && *xq < xTop - 0.1 * hRg && *c > bestKey {
                bestKey = *c;
                xMidR = *xq;
            }
        }
        let vR = p.i_rangeVol * 0.5 * hRg / (swL.max(1) as f64).sqrt();
        let tauD = 2f64.max(p.i_rangeDecay * s.Wi as f64);
        for t in 0..H {
            if (t as i64) < remR {
                let e0 = Eh[t];
                let tgtV = vR * vR;
                if e0 > tgtV {
                    let e1 = tgtV + (e0 - tgtV) * (-(t as f64) / tauD).exp();
                    Eh[t] = e1;
                    vSc[t] = (e1 / e0).sqrt();
                }
            }
        }
    }
    let wall = 6.0 * atrBc * wBin;
    let supSum: f64 = zPickS.iter().map(|z| z.strength * (-0.5 * (z.hi / wall).powi(2)).exp()).sum();
    let resSum: f64 = zPickR.iter().map(|z| z.strength * (-0.5 * (z.lo / wall).powi(2)).exp()).sum();

    // ---------- éventail : Monte Carlo FHS-GARCH, nombres aléatoires communs
    let mut qa: [Vec<f64>; 5] = std::array::from_fn(|_| vec![0.0; H]);
    let bsNow = clamp(s.cBeta * s.cDState, -3.5, 3.5);
    let kd = if p.i_dirInFan { clamp(p.i_kDir * s.cAmp * s.cDState, -p.i_dirCapSig, p.i_dirCapSig) } else { 0.0 };
    let bsT = if rngOn { bsNow * p.i_postDir * 0f64.max(Hf - remR as f64) / Hf } else { bsNow };
    let kdP = if rngOn { kd * p.i_postDir } else { kd };

    let effS = 300usize.max(p.i_sims.min(p.i_mcBudget / H));
    let mut zp: Vec<f64> = Vec::new();
    if p.i_useFHS && s.zCount >= 100 {
        zp.extend_from_slice(&s.zPool[..s.zCount]);
        let n = zp.len() as f64;
        let zm = zp.iter().sum::<f64>() / n;
        let mut zsd = (zp.iter().map(|z| (z - zm) * (z - zm)).sum::<f64>() / n).sqrt();
        if zsd.is_nan() || zsd <= 0.0 {
            zsd = 1.0;
        }
        for z in zp.iter_mut() {
            *z = (*z - zm) / zsd;
        }
    }
    let nP = zp.len();
    let usedFHS = nP >= 100;
    let mut simX = vec![0.0f64; effS];
    let mut simH = vec![s.cH0; effS];
    let mut simS = vec![s0; effS];
    let mut simR = vec![1.0f64; effS];
    for (k, r) in simR.iter_mut().enumerate() {
        let mut sd0 = (k as f64 + 1.0) * 2654435761.0;
        sd0 = sd0 - (sd0 / 2147483646.0).floor() * 2147483646.0 + 1.0;
        *r = lcg(lcg(lcg(sd0)));
    }
    let hMax = 25.0 * hLRx;
    let (mut pUp, mut evPct, mut cvarPct) = (f64::NAN, f64::NAN, f64::NAN);
    let (mut qTlo, mut qThi, mut corr) = (f64::NAN, f64::NAN, 0.0);
    let mut summaries: Vec<StepSummary> = Vec::with_capacity(steps.len());
    let mut srt = vec![0.0f64; effS];
    for t in 0..H {
        let inR = rngOn && (t as i64) < remR;
        let vsc = if inR { vSc[t] } else { 1.0 };
        for k in 0..effS {
            let mut rs = lcg(simR[k]);
            let u1 = rs / 2147483647.0;
            rs = lcg(rs);
            let u2 = rs / 2147483647.0;
            simR[k] = rs;
            let mut st = simS[k];
            if mkOn {
                let (pa, pb) = match st {
                    0 => (p00, p01),
                    1 => (p10, p11),
                    _ => (p20, p21),
                };
                st = if u1 < pa {
                    0
                } else if u1 < pa + pb {
                    1
                } else {
                    2
                };
                simS[k] = st;
            }
            let h = simH[k];
            let sdv = h.sqrt();
            let z = if usedFHS { zp[(nP - 1).min((u2 * nP as f64) as usize)] } else { ta::norminv(u2) };
            let eps = sdv * smN[st] * z * vsc;
            let x = simX[k];
            let drift = if inR {
                -kapR * (x - xMidR) - 3.0 * kapR * (0f64.max(x - xTop) + 0f64.min(x - xBot))
            } else {
                s.cMu + (kdP + kc[st]) * sdv - if flipOn { p.i_flip_kappa * fw[st] * x } else { 0.0 }
            };
            simX[k] = x + drift + eps;
            simH[k] = (omega + s.gA * eps * eps + s.gB * h).min(hMax);
        }
        srt.copy_from_slice(&simX);
        srt.sort_unstable_by(|a, b| a.total_cmp(b));
        for (j, lvl) in [0.05, 0.25, 0.50, 0.75, 0.95].into_iter().enumerate() {
            qa[j][t] = ta::q_sorted(&srt, lvl);
        }
        if steps.contains(&(t + 1)) {
            let n = effS as f64;
            let mean = srt.iter().sum::<f64>() / n;
            let var = srt.iter().map(|x| (x - mean) * (x - mean)).sum::<f64>() / (n - 1.0);
            let mut q = [0.0; N_Q];
            for (i, lvl) in QGRID.iter().enumerate() {
                q[i] = ta::q_sorted(&srt, *lvl);
            }
            summaries.push(StepSummary {
                h: t + 1,
                mean,
                std: var.sqrt(),
                p_up: srt.iter().filter(|x| **x > 0.0).count() as f64 / n,
                mode: half_sample_mode(&srt),
                q,
            });
        }
        if t == H - 1 {
            qTlo = ta::q_sorted(&srt, p.i_tailQ);
            qThi = ta::q_sorted(&srt, 1.0 - p.i_tailQ);
            let n = effS as f64;
            pUp = srt.iter().filter(|x| **x > 0.0).count() as f64 / n;
            evPct = srt.iter().map(|x| x.exp() - 1.0).sum::<f64>() / n * 100.0;
            let nTail = 1usize.max((n * 0.05).ceil() as usize);
            cvarPct = srt[..nTail].iter().map(|x| x.exp() - 1.0).sum::<f64>() / nTail as f64 * 100.0;
            // inclinaison exponentielle de l'histogramme terminal lissé
            let hlo = ta::q_sorted(&srt, 0.005);
            let hhi = ta::q_sorted(&srt, 0.995);
            let nB = p.i_bins;
            let bw = ((hhi - hlo) / nB as f64).max(1e-9);
            let mut cnt = vec![0.0; nB];
            for xv in srt.iter() {
                if *xv >= hlo && *xv <= hhi {
                    let bix = (nB as i64 - 1).min(0i64.max(((xv - hlo) / bw) as i64)) as usize;
                    cnt[bix] += 1.0;
                }
            }
            let sigHrMC = ((qa[3][t] - qa[1][t]) / 1.349).max(1e-9);
            let mut bestI = 0usize;
            let mut bestW = NEG;
            let mut lwArr = vec![NEG; nB];
            for i in 0..nB as i64 {
                let (mut acc, mut wsm) = (0.0, 0.0);
                for j in -2i64..=2 {
                    let ii = i + j;
                    if ii >= 0 && ii < nB as i64 {
                        let wk = 3.0 - (j as f64).abs();
                        acc += wk * cnt[ii as usize];
                        wsm += wk;
                    }
                }
                let pdens = acc / wsm / n;
                let ctr = hlo + (i as f64 + 0.5) * bw;
                let pen = if hasZones { p.i_zoneTarget * zone_pen(ctr, &aXs, &aCs, &dXs, &dCs) } else { 0.0 };
                let lwv = (pdens + 1e-6).ln() + bsT * ctr / sigHrMC - pen;
                lwArr[i as usize] = lwv;
                if lwv > bestW {
                    bestW = lwv;
                    bestI = i as usize;
                }
            }
            let mut off = 0.0;
            if bestI > 0 && bestI < nB - 1 {
                let (y0, y1, y2) = (lwArr[bestI - 1], lwArr[bestI], lwArr[bestI + 1]);
                let den = y0 - 2.0 * y1 + y2;
                off = if den < 0.0 { clamp(0.5 * (y0 - y2) / den, -0.5, 0.5) } else { 0.0 };
            }
            let tMC = hlo + (bestI as f64 + 0.5 + off) * bw;
            corr = tMC - phase_target(s.cMu, kd, sigHa, bsNow, H, rngOn, remR, xMidR, kapR, p.i_postDir);
        }
    }

    // ---------- cible directionnelle déterministe
    let sigHr = ((qa[3][H - 1] - qa[1][H - 1]) / 1.349).max(1e-9);
    let mut finalR = clamp(s.Rstab + corr, qTlo, qThi);
    if rngOn {
        finalR = clamp(phase_target(s.cMu, kd, sigHa, bsNow, H, true, remR, xMidR, kapR, p.i_postDir) + corr, qTlo, qThi);
    }

    // ---------- squelette du scénario : points de passage, interpolation
    let mut wpT: Vec<i64> = vec![0];
    let mut wpX: Vec<f64> = vec![0.0];
    let phActive = rngOn || coilOn;
    let mut coilDir = 0;
    let Hi = H as i64;
    if rngOn {
        for j in 1..=(2 * p.i_rangeSwings + 2) as i64 {
            let tj = s.rgStart + j * swL - B0;
            if tj > *wpT.last().unwrap() && tj < remR {
                let aj = p.i_rangeAmp * 0.72f64.powf((j - 1) as f64);
                let sgJ = if j % 2 == 1 { -s.impDir } else { s.impDir };
                let bnd = if sgJ > 0 { xTop - 0.08 * (xTop - xBot) } else { xBot + 0.08 * (xTop - xBot) };
                wpT.push(tj);
                wpX.push(xMidR + (bnd - xMidR) * aj);
            }
        }
        if remR > *wpT.last().unwrap() {
            wpT.push(remR);
            wpX.push(xMidR);
        }
        if Hi > remR {
            wpT.push(Hi);
            wpX.push(finalR);
        }
    } else if coilOn {
        let lHi = (s.coilHi / P0).ln();
        let lLo = (s.coilLo / P0).ln();
        let hgt = (lHi - lLo).max(1e-6);
        coilDir = if s.cDState >= 0.1 {
            1
        } else if s.cDState <= -0.1 {
            -1
        } else if supSum >= resSum {
            1
        } else {
            -1
        };
        let tS1 = 1i64.max((0.35 * s.trapBars as f64 + 0.5).floor() as i64);
        let tS2 = 2i64.max(s.trapBars as i64);
        if coilDir > 0 {
            if !s.sweptLo {
                if !s.sweptHi && tS1 < Hi {
                    wpT.push(tS1);
                    wpX.push(lHi + p.i_trapSweep * hgt);
                }
                let mut flushX = lLo - 0.15 * hgt;
                let mut bestC = 0.0;
                for z in &zPickS {
                    if z.hi < 0.0 && z.lo >= lLo - hgt && z.strength > bestC {
                        bestC = z.strength;
                        flushX = 0.5 * (z.lo + z.hi);
                    }
                }
                let tF = if s.sweptHi { tS1 } else { tS2 };
                if tF < Hi && tF > *wpT.last().unwrap() {
                    wpT.push(tF);
                    wpX.push(flushX);
                }
            }
            finalR = finalR.max(lHi + p.i_expMult * hgt);
        } else {
            if !s.sweptHi {
                if !s.sweptLo && tS1 < Hi {
                    wpT.push(tS1);
                    wpX.push(lLo - p.i_trapSweep * hgt);
                }
                let mut flushX = lHi + 0.15 * hgt;
                let mut bestC = 0.0;
                for z in &zPickR {
                    if z.lo > 0.0 && z.hi <= lHi + hgt && z.strength > bestC {
                        bestC = z.strength;
                        flushX = 0.5 * (z.lo + z.hi);
                    }
                }
                let tF = if s.sweptLo { tS1 } else { tS2 };
                if tF < Hi && tF > *wpT.last().unwrap() {
                    wpT.push(tF);
                    wpX.push(flushX);
                }
            }
            finalR = finalR.min(lLo - p.i_expMult * hgt);
        }
        finalR = clamp(finalR, 1.5 * qTlo, 1.5 * qThi);
        wpT.push(Hi);
        wpX.push(finalR);
    } else {
        wpT.push(Hi);
        wpX.push(finalR);
    }
    let nWp = wpT.len();
    let Tmx = Hi.max(wpT[nWp - 1]) as usize;
    let mut bbx = vec![0.0; Tmx + 1];
    for w in 0..nWp - 1 {
        let (ta0, ta1) = (wpT[w], wpT[w + 1]);
        let (xa0, xa1) = (wpX[w], wpX[w + 1]);
        if ta1 > ta0 {
            for tt in ta0..=ta1 {
                let u = (tt - ta0) as f64 / (ta1 - ta0) as f64;
                let ease = if phActive { 0.5 - 0.5 * (std::f64::consts::PI * u).cos() } else { u };
                bbx[tt as usize] = xa0 + (xa1 - xa0) * ease;
            }
        }
    }
    if rngOn && remR >= Hi {
        finalR = bbx[H];
    }

    // ---------- Viterbi en écarts au squelette (grille de prix × 3 états de Markov)
    let G = p.i_G;
    let i0 = (G - 1) / 2;
    let stp = 3.0 * sigHr / (G as f64 - 1.0);
    let lo = -(i0 as f64) * stp;
    let tb = i0 as i64;
    let sdMax = Eh.iter().fold(0.0f64, |m, e| m.max(e.sqrt()));
    let smMax = smN[0].max(smN[1]).max(smN[2]);
    let W = 1usize.max(p.i_Wmax.min((3.0 * sdMax * smMax / stp).ceil() as usize));
    let W2 = 2 * W + 1;
    let nS = if mkOn { 3 } else { 1 };
    let G3 = G * 3;
    let mut logT = [0.0f64; 9];
    if mkOn {
        for q in 0..9 {
            logT[q] = pr[q].max(1e-9).ln();
        }
    }
    let mut prevSc = vec![NEG; G3];
    let mut prevD = vec![0i64; G3];
    let sInit = if mkOn { s0 } else { 0 };
    prevSc[i0 * 3 + sInit] = 0.0;
    let mut bp = vec![-1i32; H * G3];
    let mut lg = vec![0.0f64; 3 * W2];
    let (mut CsP, mut CaP, mut CdP) = (vec![0.0; G], vec![0.0; G], vec![0.0; G]);
    let (mut CsC, mut CaC, mut CdC) = (vec![0.0; G], vec![0.0; G], vec![0.0; G]);
    cum_sorted(&sXs, &sCs, lo, stp, &mut CsP);
    cum_sorted(&aXs, &aCs, lo, stp, &mut CaP);
    cum_sorted(&dXs, &dCs, lo, stp, &mut CdP);
    let mut curSc = vec![NEG; G3];
    let mut curD = vec![0i64; G3];
    for t in 0..H {
        let sdt = Eh[t].sqrt();
        let dBb = bbx[t + 1] - bbx[t];
        let muDir = if phActive { 0.0 } else { s.cMu + kd * sdt - dBb };
        for s2 in 0..nS {
            let ps2 = if nS == 1 { 2 } else { s2 };
            let sdS = (sdt * smN[ps2]).max(1e-12);
            let mS = muDir + kc[ps2] * sdt;
            for d in -(W as i64)..=W as i64 {
                let zz = (d as f64 * stp - mS) / sdS;
                lg[s2 * W2 + (d + W as i64) as usize] = -0.5 * zz * zz - sdS.ln();
            }
        }
        let baseT = lo + bbx[t + 1];
        cum_sorted(&sXs, &sCs, baseT, stp, &mut CsC);
        cum_sorted(&aXs, &aCs, baseT, stp, &mut CaC);
        cum_sorted(&dXs, &dCs, baseT, stp, &mut CdC);
        let cs = stp / sdt.max(1e-12);
        curSc.fill(NEG);
        curD.fill(0);
        for j in 0..G {
            let iLo = j.saturating_sub(W);
            let iHi = (G - 1).min(j + W);
            let (cj, caj, cdj) = (CsC[j], CaC[j], CdC[j]);
            for s2 in 0..nS {
                let mut best = NEG;
                let mut bIdx: i32 = -1;
                let mut bD = 0i64;
                for i in iLo..=iHi {
                    let dlt = j as i64 - i as i64;
                    let crossC = (cj - CsP[i]).abs() + p.i_zoneCross * (0f64.max(CaP[i] - caj) + 0f64.max(cdj - CdP[i]));
                    let baseSc = lg[s2 * W2 + (dlt + W as i64) as usize] - crossC;
                    for s1 in 0..nS {
                        let k1 = i * 3 + s1;
                        let psc = prevSc[k1];
                        if psc > -1.0e17 {
                            let dp = prevD[k1];
                            let dd = (dlt - dp) as f64 * cs;
                            let rev = if dlt * dp < 0 { 1.0 } else { 0.0 };
                            let sc = psc + baseSc + logT[s1 * 3 + s2] - p.i_lamSmooth * dd * dd - p.i_lamTurn * rev;
                            if sc > best {
                                best = sc;
                                bIdx = k1 as i32;
                                bD = dlt;
                            }
                        }
                    }
                }
                curSc[j * 3 + s2] = best;
                curD[j * 3 + s2] = bD;
                bp[t * G3 + j * 3 + s2] = bIdx;
            }
        }
        std::mem::swap(&mut prevSc, &mut curSc);
        std::mem::swap(&mut prevD, &mut curD);
        CsP.copy_from_slice(&CsC);
        CaP.copy_from_slice(&CaC);
        CdP.copy_from_slice(&CdC);
    }
    let mut bestK: i64 = -1;
    let mut bestScore = NEG;
    for j in 0..G {
        for st in 0..nS {
            let scv = prevSc[j * 3 + st];
            if scv > -1.0e17 {
                let adj = scv - 1.0e6 * 0f64.max(((j as i64 - tb).abs() - p.i_termWin) as f64);
                if adj > bestScore {
                    bestScore = adj;
                    bestK = (j * 3 + st) as i64;
                }
            }
        }
    }
    // écarts -> chemin en log-rendement, lissage léger, épinglage exact aux deux bouts
    let mut dev = vec![0.0; H + 1];
    if bestK >= 0 {
        let mut kk = bestK;
        for q in 0..H {
            let tt = H - 1 - q;
            if kk >= 0 {
                dev[tt + 1] = lo + (kk / 3) as f64 * stp;
                kk = bp[tt * G3 + kk as usize] as i64;
            }
        }
    }
    for _ in 0..2 {
        let tmp = dev.clone();
        for tt in 1..H {
            dev[tt] = 0.25 * tmp[tt - 1] + 0.5 * tmp[tt] + 0.25 * tmp[tt + 1];
        }
    }
    let devEnd = dev[H];
    let mut pth = vec![0.0; H + 1];
    for tt in 1..=H {
        pth[tt] = bbx[tt] + dev[tt] - devEnd * tt as f64 / Hf;
    }

    // ---------- texture du chemin typique : k plus proches contextes historiques
    let mut tex = vec![0.0; H + 1];
    let mut tUW = vec![0.3; H + 1];
    let mut tLW = vec![0.3; H + 1];
    let Lc = p.i_anL as i64;
    let anMin = Hi;
    let anMax = s.anCount as i64 - Lc;
    let (mut anaDist, mut anaUsed, mut anaK) = (f64::NAN, -1i64, 0usize);
    if p.i_show_candles && s.anHead >= 0 && anMax >= anMin {
        let head = s.anHead;
        let mut wts = vec![0.0; Lc as usize];
        let mut zNow = vec![0.0; Lc as usize];
        let mut wsum = 0.0;
        for j in 0..Lc {
            let wj = (-(j as f64) / (0.5 * Lc as f64)).exp();
            wts[j as usize] = wj;
            wsum += wj;
            zNow[j as usize] = ring(&s.anZ, head - j);
        }
        let sNow = ring(&s.anS, head);
        let vNow = ring(&s.anV, head);
        let dist = |a: i64| -> f64 {
            let mut d2 = 0.0;
            for j in 0..Lc {
                let dz = zNow[j as usize] - ring(&s.anZ, head - a - j);
                d2 += wts[j as usize] * dz * dz;
            }
            let dsS = sNow - ring(&s.anS, head - a);
            let dsV = vNow - ring(&s.anV, head - a);
            d2 / wsum + p.i_anWS * dsS * dsS + p.i_anWV * dsV * dsV
        };
        let span = (anMax - anMin + 1) as usize;
        let kReq = p.i_anK.min(span);
        let kTop = (2 * kReq).min(span);
        let sepA = if p.i_anSep > 0 { p.i_anSep as i64 } else { 1i64.max(Lc / 2) };

        // 1) recherche des meilleurs candidats, un seul par épisode
        let mut topA: Vec<i64> = Vec::new();
        let mut topD: Vec<f64> = Vec::new();
        for a in anMin..=anMax {
            let dA = dist(a);
            let nT = topD.len();
            if nT < kTop || dA < topD[nT - 1] {
                let mut cfT: Option<usize> = None;
                for m in 0..nT {
                    if a - topA[m] < sepA {
                        cfT = Some(m);
                    }
                }
                let mut takeA = true;
                if let Some(m) = cfT {
                    if dA < topD[m] {
                        topA.remove(m);
                        topD.remove(m);
                    } else {
                        takeA = false;
                    }
                }
                if takeA {
                    ins_sorted(&mut topA, &mut topD, a, dA);
                    if topD.len() > kTop {
                        topD.pop();
                        topA.pop();
                    }
                }
            }
        }
        // 2) panier : au chargement du graphique, aucun analogue précédent à conserver
        let mut bkA: Vec<i64> = Vec::new();
        let mut bkD: Vec<f64> = Vec::new();
        for c in 0..topA.len() {
            let (aCn, dCn) = (topA[c], topD[c]);
            let nB = bkA.len();
            let mut sameA = false;
            let mut nCf = 0;
            let mut minCf = 1.0e18f64;
            for m in 0..nB {
                let df = (bkA[m] - aCn).abs();
                if df == 0 {
                    sameA = true;
                } else if df < sepA {
                    nCf += 1;
                    minCf = minCf.min(bkD[m]);
                }
            }
            if !sameA {
                if nCf > 0 {
                    if dCn < minCf * (1.0 - p.i_anHyst) {
                        for m in (0..nB).rev() {
                            let dfR = (bkA[m] - aCn).abs();
                            if dfR > 0 && dfR < sepA {
                                bkA.remove(m);
                                bkD.remove(m);
                            }
                        }
                        ins_sorted(&mut bkA, &mut bkD, aCn, dCn);
                    }
                } else if nB < kReq {
                    ins_sorted(&mut bkA, &mut bkD, aCn, dCn);
                } else if dCn < bkD[nB - 1] * (1.0 - p.i_anHyst) {
                    bkA.pop();
                    bkD.pop();
                    ins_sorted(&mut bkA, &mut bkD, aCn, dCn);
                }
            }
        }
        let kEff = bkA.len();
        if kEff >= 1 {
            // 3) poids exponentiels sur (d - dMin)
            let dMin = bkD[0];
            let tauA = p.i_anTau.max(1e-6);
            let mut wK: Vec<f64> = bkD.iter().map(|d| (-(d - dMin) / tauA).exp()).collect();
            let wSumK: f64 = wK.iter().sum();
            let unifW = wSumK < 1e-12 || bkD[kEff - 1] - dMin < 1e-12;
            let (mut w2, mut dMean) = (0.0, 0.0);
            for m in 0..kEff {
                let wm = if unifW { 1.0 / kEff as f64 } else { wK[m] / wSumK };
                wK[m] = wm;
                w2 += wm * wm;
                dMean += wm * bkD[m];
            }
            let volFix = if p.i_anKeepVol { 1.0 / w2.max(1e-12).sqrt() } else { 1.0 };
            // 4) suite pondérée, lue strictement après le contexte de chaque analogue
            let mut cum = 0.0;
            for t in 1..=H {
                let (mut zAcc, mut uAcc, mut lAcc) = (0.0, 0.0, 0.0);
                for m in 0..kEff {
                    let ix = head - (bkA[m] - t as i64);
                    zAcc += wK[m] * ring(&s.anZ, ix);
                    uAcc += wK[m] * ring(&s.anU, ix);
                    lAcc += wK[m] * ring(&s.anW, ix);
                }
                let sdt = Eh[t - 1].sqrt();
                cum += p.i_texAmp * sdt * zAcc * volFix;
                tex[t] = cum;
                tUW[t] = clamp(uAcc, 0.0, 8.0);
                tLW[t] = clamp(lAcc, 0.0, 8.0);
            }
            let cEnd = tex[H];
            for t in 1..=H {
                tex[t] -= cEnd * t as f64 / Hf;
            }
            anaUsed = bkA[0];
            anaDist = dMean;
            anaK = kEff;
        }
    }
    let typical: Vec<f64> = (0..=H).map(|tt| pth[tt] + tex[tt]).collect();
    let wk = p.i_texAmp.max(0.35);
    let mut wick_up = vec![0.0; H + 1];
    let mut wick_dn = vec![0.0; H + 1];
    for tt in 1..=H {
        let sdc = Eh[tt - 1].sqrt();
        wick_up[tt] = wk * sdc * tUW[tt];
        wick_dn[tt] = wk * sdc * tLW[tt];
    }

    // ---------- confiance
    let dirSign = ta::sign(s.cDState);
    let sep = 0f64.max((ta::nz(pUp, 0.5) - 0.5) * 2.0 * dirSign);
    let iqrT = (qa[3][H - 1] - qa[1][H - 1]).max(1e-9);
    let conc = finalR.abs() / (finalR.abs() + 0.5 * iqrT);
    let pers = 1.0 - (-(s.regimeAge as f64) / 10.0).exp();
    let mut confid = 0.35 * s.stableScore.abs() + 0.25 * sep + 0.20 * conc + 0.20 * pers;
    confid = clamp(if s.dirRegime == 0 { 0.6 * confid } else { confid }, 0.0, 0.95);

    Some(Projection {
        h: H,
        p0: P0,
        qa,
        p_up: pUp,
        ev_pct: evPct,
        cvar_pct: cvarPct,
        q_tlo: qTlo,
        q_thi: qThi,
        corr,
        final_r: finalR,
        sig_hr: sigHr,
        backbone: pth,
        typical,
        wick_up,
        wick_dn,
        eh: Eh,
        scenario: if rngOn {
            1
        } else if coilOn {
            2
        } else {
            0
        },
        coil_dir: coilDir,
        confidence: confid,
        ana_k: anaK,
        ana_dist: anaDist,
        ana_best_age: anaUsed,
        zones_sup: zPickS,
        zones_res: zPickR,
        used_fhs: usedFHS,
        eff_s: effS,
        viterbi_w: W,
        steps: summaries,
    })
}
