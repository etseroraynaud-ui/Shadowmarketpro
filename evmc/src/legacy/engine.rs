//! Moteur par barre du Pine (`f_engine`) : séries de base, supports et résistances, six
//! facteurs, phases, chaîne de Markov sur états observés discrétisés, hystérésis, cible
//! stabilisée, pools de résidus et d'analogues.
//!
//! Chaque barre est traitée comme une barre confirmée, dans l'ordre du script. L'état après
//! la barre t ne dépend que des barres 0..=t.

#![allow(non_snake_case)]

use std::collections::HashMap;

use crate::data::bars::Bar;
use crate::legacy::htf::{self, Anchor, RefBar, RefCursor};
use crate::legacy::params::LegacyParams;
use crate::legacy::ta::{self, clamp, nz, Rma};
use crate::vol::PineEma;

/// Niveau de support ou de résistance (ligne de la matrice `lv` du script).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Level {
    pub price: f64,
    pub touches: f64,
    pub rej: f64,
    pub brk: f64,
    pub ctrl: bool,
    /// Barre du test en attente, -1 s'il n'y en a pas.
    pub pend: f64,
    pub side: f64,
    pub contact: bool,
    pub last: f64,
}

/// Case du profil de prix (cartes `zmV`, `zmN`, `zmA`, `zmT`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ZoneBin {
    pub v: f64,
    pub n: f64,
    pub a: f64,
    pub t: i64,
}

/// Contexte de marché que le Pine lit dans `timeframe.*` et `syminfo.*`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Market {
    /// Durée d'une barre, en secondes.
    pub tf_secs: u32,
    /// Marché ouvert en continu (crypto, change).
    pub h24: bool,
    pub mintick: f64,
}

/// Valeurs engagées à la clôture de la barre : ce que la projection lit, et ce que
/// l'évaluation utilise pour classer les origines par régime.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BarState {
    pub dir_regime: i8,
    pub regime_age: u32,
    pub stable: f64,
    pub raw: f64,
    pub d_state: f64,
    /// Facteurs D, V, R, A, M, Z.
    pub f: [f64; 6],
    pub comp: f64,
    pub amp: f64,
    /// 0 normal, 1 range après impulsion, 2 compression.
    pub phase: u8,
    /// 0 haussier, 1 baissier, 2 neutre.
    pub mk: u8,
    /// sqrt(variance EWMA / variance longue).
    pub v_ratio: f64,
    pub rstab: f64,
    pub sig_h: f64,
    pub mu_base: f64,
    pub atr: f64,
}

/// Fenêtre `f_zProfile` : profil décoté puis lissé par un noyau triangulaire.
pub fn z_profile(
    zones: &HashMap<i64, ZoneBin>,
    k_a: i64,
    k_b: i64,
    now: i64,
    tau: f64,
    hw: i64,
) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let n = (k_b - k_a + 1) as usize;
    let (mut rv, mut rn, mut ra) = (vec![0.0; n], vec![0.0; n], vec![0.0; n]);
    for i in 0..n {
        if let Some(z) = zones.get(&(k_a + i as i64)) {
            let dec = (-((now - z.t) as f64) / tau).exp();
            rv[i] = z.v * dec;
            rn[i] = z.n * dec;
            ra[i] = z.a * dec;
        }
    }
    let (mut sv, mut sn, mut sa) = (vec![0.0; n], vec![0.0; n], vec![0.0; n]);
    for i in 0..n as i64 {
        let (mut av, mut an, mut aa, mut ws) = (0.0, 0.0, 0.0, 0.0);
        for j in -hw..=hw {
            let ii = i + j;
            if ii >= 0 && ii < n as i64 {
                let wj = hw as f64 + 1.0 - (j as f64).abs();
                av += wj * rv[ii as usize];
                an += wj * rn[ii as usize];
                aa += wj * ra[ii as usize];
                ws += wj;
            }
        }
        sv[i as usize] = av / ws;
        sn[i as usize] = an / ws;
        sa[i as usize] = aa / ws;
    }
    (sv, sn, sa)
}

#[derive(Clone, Debug)]
pub struct Engine {
    pub p: LegacyParams,
    pub mk_t: Market,
    // --- constantes dérivées
    pub n_ew: u32,
    pub tf_min: f64,
    pub Wi: usize,
    pub coil_bars: usize,
    pub trap_bars: usize,
    pub w_bin: f64,
    pub shares: Vec<f64>,
    pub flip_thr: f64,
    pub gA: f64,
    pub gB: f64,
    pub gPhi: f64,
    k_w: usize,
    k_d: usize,
    k_4: usize,
    // --- historiques
    ts: Vec<i64>,
    open: Vec<f64>,
    high: Vec<f64>,
    low: Vec<f64>,
    close: Vec<f64>,
    vol: Vec<f64>,
    r: Vec<f64>,
    abs_r: Vec<f64>,
    ewv: Vec<f64>,
    vw_w: Vec<f64>,
    vw_d: Vec<f64>,
    vw_4: Vec<f64>,
    d_w: Vec<f64>,
    d_d: Vec<f64>,
    d_4: Vec<f64>,
    sl_w: Vec<f64>,
    sl_d: Vec<f64>,
    sl_4: Vec<f64>,
    body_a: Vec<f64>,
    a_ema: Vec<f64>,
    mom: Vec<f64>,
    d_mom: Vec<f64>,
    rv20: Vec<f64>,
    atr_rel: Vec<f64>,
    bbw: Vec<f64>,
    rng_n: Vec<f64>,
    // --- lissages en ligne
    ema_ew: PineEma,
    ema_lr: PineEma,
    rma_atr: Rma,
    ema_abar: PineEma,
    ema_r10: PineEma,
    rma_up: Rma,
    rma_dn: Rma,
    // --- supports et résistances
    pub levels: Vec<Level>,
    ctrl_rej: f64,
    ctrl_n: f64,
    ctrl_sgn: f64,
    pub pRefG: f64,
    pub sr_field: f64,
    pub sr_near: f64,
    pub sr_reflect: f64,
    // --- VWAP ancrés
    cum_pv: f64,
    cum_v: f64,
    cpv_before: Vec<f64>,
    cv_before: Vec<f64>,
    cur_w: RefCursor,
    cur_4: RefCursor,
    anchors_d: Vec<Anchor>,
    pub vwW: f64,
    pub vwD: f64,
    pub vw4h: f64,
    // --- zones
    pub zones: HashMap<i64, ZoneBin>,
    pub gFV: f64,
    pub gFA: f64,
    zone_field: f64,
    pub zSupLvl: f64,
    pub zResLvl: f64,
    pub momZ: f64,
    // --- phases
    pub phase: u8,
    pub impDir: i32,
    pub rgExt: f64,
    rgBase: f64,
    pub rgFar: f64,
    pub rgStart: i64,
    pub rgDur: i64,
    pub compAge: i64,
    pub coilHi: f64,
    pub coilLo: f64,
    pub coilStart: i64,
    pub sweptHi: bool,
    pub sweptLo: bool,
    rgFarReal: f64,
    // --- Markov
    mk_states: std::collections::VecDeque<u8>,
    mk_counts: [[f64; 3]; 3],
    pub mk_probs: [f64; 9],
    pub mk_state: u8,
    // --- état persistant
    pub stableScore: f64,
    pub dirRegime: i32,
    pub regimeAge: u32,
    pendDir: i32,
    pendCount: u32,
    pub Rstab: f64,
    prevLogSig: f64,
    prevLogC: f64,
    pub nConf: u64,
    // --- instantané engagé
    pub cClose: f64,
    pub cBar: i64,
    pub cMu: f64,
    pub cH0: f64,
    pub cLrv: f64,
    pub cHLR: f64,
    pub cComp: f64,
    pub cAmp: f64,
    pub cBeta: f64,
    pub cDState: f64,
    pub cRaw: f64,
    pub cF: [f64; 6],
    pub cMk: u8,
    pub atrS: f64,
    // --- pools
    pub zPool: Vec<f64>,
    zHead: usize,
    pub zCount: usize,
    pub anZ: Vec<f64>,
    pub anU: Vec<f64>,
    pub anW: Vec<f64>,
    pub anS: Vec<f64>,
    pub anV: Vec<f64>,
    pub anHead: i64,
    pub anCount: usize,
    pub anTot: u64,
}

fn round_i(x: f64) -> i64 {
    // `math.round` du Pine : au plus proche, les demis vers l'infini positif.
    (x + 0.5).floor() as i64
}

impl Engine {
    /// `bars` : toutes les barres du graphique que le moteur parcourra, dans l'ordre.
    /// `aux_4h` : barres de 4 heures si le graphique est plus long que 4 heures ; sans
    /// elles, l'ancre « 4h » est calculée sur les barres du graphique.
    pub fn new(p: LegacyParams, mk_t: Market, bars: &[Bar], aux_4h: Option<&[Bar]>) -> Self {
        let tf_sec = mk_t.tf_secs as f64;
        let tf_min = tf_sec / 60.0;
        let n_ew = (round_i(2.0 / (1.0 - p.i_ewma_lambda) - 1.0)).max(2) as u32;
        let Wi = clamp(round_i(p.i_impDays * 86400.0 / tf_sec) as f64, 8.0, 400.0) as usize;
        let coil_bars = clamp(round_i(p.i_coilDays * 86400.0 / tf_sec) as f64, 5.0, 1000.0) as usize;
        let trap_bars = clamp(round_i(p.i_trapDays * 86400.0 / tf_sec) as f64, 3.0, 300.0) as usize;
        let w_bin = if p.i_zoneBinPct > 0.0 { p.i_zoneBinPct / 100.0 } else { 0.00015 * tf_min.max(1.0).sqrt() };
        let shares = ta::cap_shares(&[p.i_wD, p.i_wV, p.i_wR, p.i_wA, p.i_wM, p.i_wZ], p.i_maxShare);
        let flip_thr = p.i_flipThr.max(p.i_enterThr + 0.05);
        let gA = p.i_gAlpha;
        let gB = 0f64.max(p.i_gBeta.min(0.998 - p.i_gAlpha));
        // retards (en barres du graphique) des pentes des VWAP ancrés
        let sec_w = if mk_t.h24 { 604_800.0 } else { 432_000.0 };
        let n4c = round_i(14_400.0 / tf_sec).max(1) as usize;
        let nDc = round_i(86_400.0 / tf_sec).max(1) as usize;
        let nWc = round_i(sec_w / tf_sec).max(1) as usize;

        // Séries de référence. La semaine commence le lundi ; le jour à minuit UTC.
        const DAY: i64 = 86_400_000;
        let tf_ms = mk_t.tf_secs as i64 * 1000;
        let same: Vec<RefBar> = bars.iter().map(RefBar::from).collect();
        let weekly = if tf_ms < 7 * DAY { htf::group(bars, 7 * DAY, 4 * DAY) } else { same.clone() };
        let daily = if tf_ms < DAY { htf::group(bars, DAY, 0) } else { same.clone() };
        let aw = htf::piv_anchor(&weekly, p.i_avL, p.i_avR, &p.i_avMode);
        let cur_w = RefCursor::new(&weekly, aw);
        // Le « D » : sur un graphique journalier, c'est la barre elle-même.
        let ad = htf::piv_anchor(&daily, p.i_avL, p.i_avR, &p.i_avMode);
        let anchors_d = if tf_ms < DAY {
            let mut c = RefCursor::new(&daily, ad);
            bars.iter().map(|b| c.at(b.ts_close)).collect()
        } else {
            ad
        };
        // Le « 240 » : barres de 4 heures fournies à part si le graphique est plus long ;
        // sans elles, l'ancre est calculée sur les barres du graphique.
        const H4: i64 = 4 * 3_600_000;
        let ref_4: Vec<RefBar> = if tf_ms > H4 {
            match aux_4h {
                Some(a) => a.iter().map(RefBar::from).collect(),
                None => same.clone(),
            }
        } else if tf_ms < H4 {
            htf::group(bars, H4, 0)
        } else {
            same.clone()
        };
        let a4 = htf::piv_anchor(&ref_4, p.i_avL, p.i_avR, &p.i_avMode);
        let cur_4 = RefCursor::new(&ref_4, a4);

        Self {
            n_ew,
            tf_min,
            Wi,
            coil_bars,
            trap_bars,
            w_bin,
            shares,
            flip_thr,
            gA,
            gB,
            gPhi: gA + gB,
            k_w: (nWc / 4).max(1),
            k_d: (nDc / 4).max(1),
            k_4: (n4c / 4).max(1),
            ts: Vec::new(),
            open: Vec::new(),
            high: Vec::new(),
            low: Vec::new(),
            close: Vec::new(),
            vol: Vec::new(),
            r: Vec::new(),
            abs_r: Vec::new(),
            ewv: Vec::new(),
            vw_w: Vec::new(),
            vw_d: Vec::new(),
            vw_4: Vec::new(),
            d_w: Vec::new(),
            d_d: Vec::new(),
            d_4: Vec::new(),
            sl_w: Vec::new(),
            sl_d: Vec::new(),
            sl_4: Vec::new(),
            body_a: Vec::new(),
            a_ema: Vec::new(),
            mom: Vec::new(),
            d_mom: Vec::new(),
            rv20: Vec::new(),
            atr_rel: Vec::new(),
            bbw: Vec::new(),
            rng_n: Vec::new(),
            ema_ew: PineEma::new(n_ew),
            ema_lr: PineEma::new(p.i_lrLen),
            rma_atr: Rma::new(p.i_atrLen),
            ema_abar: PineEma::new(5),
            ema_r10: PineEma::new(10),
            rma_up: Rma::new(14),
            rma_dn: Rma::new(14),
            levels: Vec::new(),
            ctrl_rej: 0.0,
            ctrl_n: 0.0,
            ctrl_sgn: 1.0,
            pRefG: 0.5,
            sr_field: 0.0,
            sr_near: 0.0,
            sr_reflect: f64::NAN,
            cum_pv: 0.0,
            cum_v: 0.0,
            cpv_before: Vec::new(),
            cv_before: Vec::new(),
            cur_w,
            cur_4,
            anchors_d,
            vwW: f64::NAN,
            vwD: f64::NAN,
            vw4h: f64::NAN,
            zones: HashMap::new(),
            gFV: 0.0,
            gFA: 0.0,
            zone_field: 0.0,
            zSupLvl: f64::NAN,
            zResLvl: f64::NAN,
            momZ: 0.0,
            phase: 0,
            impDir: 0,
            rgExt: f64::NAN,
            rgBase: f64::NAN,
            rgFar: f64::NAN,
            rgStart: 0,
            rgDur: 0,
            compAge: 0,
            coilHi: f64::NAN,
            coilLo: f64::NAN,
            coilStart: 0,
            sweptHi: false,
            sweptLo: false,
            rgFarReal: f64::NAN,
            mk_states: std::collections::VecDeque::new(),
            mk_counts: [[0.0; 3]; 3],
            mk_probs: [1.0 / 3.0; 9],
            mk_state: 2,
            stableScore: 0.0,
            dirRegime: 0,
            regimeAge: 0,
            pendDir: 0,
            pendCount: 0,
            Rstab: f64::NAN,
            prevLogSig: f64::NAN,
            prevLogC: f64::NAN,
            nConf: 0,
            cClose: f64::NAN,
            cBar: 0,
            cMu: 0.0,
            cH0: f64::NAN,
            cLrv: f64::NAN,
            cHLR: f64::NAN,
            cComp: 0.0,
            cAmp: 1.0,
            cBeta: 0.0,
            cDState: 0.0,
            cRaw: 0.0,
            cF: [0.0; 6],
            cMk: 2,
            atrS: f64::NAN,
            zPool: vec![0.0; p.i_poolN],
            zHead: 0,
            zCount: 0,
            anZ: vec![0.0; p.i_anBuf],
            anU: vec![0.0; p.i_anBuf],
            anW: vec![0.0; p.i_anBuf],
            anS: vec![0.0; p.i_anBuf],
            anV: vec![0.0; p.i_anBuf],
            anHead: -1,
            anCount: 0,
            anTot: 0,
            p,
            mk_t,
        }
    }

    /// Nombre de barres déjà intégrées.
    pub fn len(&self) -> usize {
        self.close.len()
    }
    pub fn is_empty(&self) -> bool {
        self.close.is_empty()
    }

    /// `f_avwap` : VWAP cumulé sur les barres du graphique depuis la barre d'ancrage si
    /// celle-ci est une barre déjà confirmée du graphique, sinon la valeur de repli.
    fn avwap(&self, a: Anchor, pv_now: f64, v_now: f64) -> f64 {
        let mut res = a.avwap;
        if let Some(ta_) = a.t_anchor {
            // seules les barres déjà confirmées (avant la barre courante) sont dans la carte
            let known = &self.ts[..self.ts.len() - 1];
            if let Ok(i) = known.binary_search(&ta_) {
                let dv = self.cum_v + v_now - self.cv_before[i];
                res = if dv > 0.0 { (self.cum_pv + pv_now - self.cpv_before[i]) / dv } else { a.avwap };
            }
        }
        res
    }

    /// Intègre la barre suivante et renvoie l'état engagé à sa clôture.
    pub fn step(&mut self, b: &Bar) -> BarState {
        let p = self.p.clone();
        let t = self.close.len();
        let ti = t as i64;
        let (open, high, low, close) = (b.open, b.high, b.low, b.close);
        let vv = nz(b.volume, 0.0);
        let hlc3 = (high + low + close) / 3.0;
        let c1 = if t > 0 { self.close[t - 1] } else { f64::NAN };

        // ---------------------------------------------------------------- séries de base
        let r = if close > 0.0 && nz(c1, 0.0) > 0.0 { (close / c1).ln() } else { 0.0 };
        let r2 = r * r;
        let ewv = self.ema_ew.update(r2).unwrap_or(r2).max(1e-12);
        let lrv = self.ema_lr.update(r2).unwrap_or(ewv).max(1e-12);
        let sigLR = lrv.sqrt();
        let ewv_prev = if t > 0 { self.ewv[t - 1] } else { f64::NAN };
        let sigPrev = nz(ewv_prev, ewv).max(1e-12).sqrt();
        let zRes = r / sigPrev;
        let uwS = clamp((high / open.max(close).max(1e-12)).ln() / sigPrev, 0.0, 8.0);
        let lwS = clamp((open.min(close).max(1e-12) / low.max(1e-12)).ln() / sigPrev, 0.0, 8.0);
        let tr = if t == 0 { high - low } else { (high - low).max((high - c1).abs()).max((low - c1).abs()) };
        let atrS = nz(self.rma_atr.update(tr), high - low).max(close * 1e-5);

        self.ts.push(b.ts_open);
        self.open.push(open);
        self.high.push(high);
        self.low.push(low);
        self.close.push(close);
        self.vol.push(vv);
        self.r.push(r);
        self.abs_r.push(r.abs());
        self.ewv.push(ewv);

        // ------------------------------------------------- supports et résistances
        let ph = ta::pivot_high(&self.high, p.i_pvL, p.i_pvR);
        let pl = ta::pivot_low(&self.low, p.i_pvL, p.i_pvR);
        {
            let tolC = p.i_clusterTol * atrS;
            let tolT = p.i_testTol * atrS;
            for lv in self.levels.iter_mut() {
                let touch = high >= lv.price - tolT && low <= lv.price + tolT;
                if lv.pend >= 0.0 {
                    if ti as f64 - lv.pend >= p.i_resolveBars as f64 {
                        let broke = (close - lv.price) * lv.side < -tolT;
                        if broke {
                            lv.brk += 1.0;
                        } else {
                            lv.rej += 1.0;
                        }
                        if lv.ctrl {
                            self.ctrl_n += 1.0;
                            self.ctrl_rej += if broke { 0.0 } else { 1.0 };
                        }
                        lv.pend = -1.0;
                    }
                } else if touch && !lv.contact {
                    let pc = nz(c1, close);
                    lv.side = if pc >= lv.price { 1.0 } else { -1.0 };
                    lv.pend = ti as f64;
                }
                lv.contact = touch;
            }
            for pv in [ph, pl].into_iter().filter(|x| !x.is_nan()) {
                let mut bi: Option<usize> = None;
                let mut bd = tolC;
                for (i, lv) in self.levels.iter().enumerate() {
                    if !lv.ctrl {
                        let dd = (lv.price - pv).abs();
                        if dd <= bd {
                            bd = dd;
                            bi = Some(i);
                        }
                    }
                }
                if let Some(i) = bi {
                    let lv = &mut self.levels[i];
                    let tc = lv.touches;
                    lv.price = (lv.price * tc + pv) / (tc + 1.0);
                    lv.touches = tc + 1.0;
                    lv.last = ti as f64;
                } else {
                    self.levels.push(Level {
                        price: pv,
                        touches: 1.0,
                        rej: 0.0,
                        brk: 0.0,
                        ctrl: false,
                        pend: -1.0,
                        side: 0.0,
                        contact: false,
                        last: ti as f64,
                    });
                }
                let cp = pv + self.ctrl_sgn * p.i_ctrlOff * atrS;
                if cp > 0.0 {
                    self.levels.push(Level {
                        price: cp,
                        touches: 0.0,
                        rej: 0.0,
                        brk: 0.0,
                        ctrl: true,
                        pend: -1.0,
                        side: 0.0,
                        contact: false,
                        last: ti as f64,
                    });
                }
                self.ctrl_sgn = -self.ctrl_sgn;
                while self.levels.len() > p.i_maxLevels {
                    let mut oi = 0;
                    let mut ob = self.levels[0].last;
                    for (i, lv) in self.levels.iter().enumerate().skip(1) {
                        if lv.last < ob {
                            ob = lv.last;
                            oi = i;
                        }
                    }
                    self.levels.remove(oi);
                }
            }
            self.pRefG = (self.ctrl_rej + 1.0) / (self.ctrl_n + 2.0);
            let pRefG = self.pRefG;
            let (mut fld, mut refW, mut refAcc, mut nearMax) = (0.0, 0.0, 0.0, 0.0f64);
            for lv in self.levels.iter().filter(|l| !l.ctrl) {
                let rej = lv.rej;
                let nT = rej + lv.brk;
                let tf = 1.0 - (-lv.touches / 3.0).exp();
                let dz = (lv.price - close) / atrS / p.i_srDecay;
                let prox = (-0.5 * dz * dz).exp();
                let pRj = (rej + p.i_srPrior * pRefG) / (nT + p.i_srPrior);
                if nT > 0.0 {
                    let zb = (rej - nT * pRefG) / (nT * pRefG * (1.0 - pRefG)).max(1e-9).sqrt();
                    let sgf = zb * zb / (zb * zb + 4.0);
                    let edge = (pRj - pRefG) / pRefG.max(1.0 - pRefG);
                    let sideF = if lv.price < close { 1.0 } else { -1.0 };
                    fld += sideF * edge * tf * sgf * prox;
                    nearMax = nearMax.max(prox * sgf * edge.max(0.0));
                }
                let wr = tf * prox;
                refW += wr;
                refAcc += wr * pRj;
            }
            self.sr_field = ta::tanh(2.0 * p.i_srGain * fld);
            self.sr_near = clamp(2.0 * nearMax, 0.0, 1.0);
            self.sr_reflect = if refW > 1e-9 { refAcc / refW } else { pRefG };
        }

        // ------------------------------------------------------------------- facteur D
        let tstat = |h: &[f64], len: usize| -> (f64, f64) {
            let m = ta::sma(h, len);
            let s = ta::stdev(h, len);
            let tt = if nz(s, 0.0) > 0.0 && !m.is_nan() { m / (s / (len as f64).sqrt()) } else { 0.0 };
            (nz(m, 0.0), tt)
        };
        let (m1, t1) = tstat(&self.r, p.i_dL1);
        let (m2, t2) = tstat(&self.r, p.i_dL2);
        let (m3, t3) = tstat(&self.r, p.i_dL3);
        let t0sq = p.i_t0 * p.i_t0;
        let cf1 = t1 * t1 / (t1 * t1 + t0sq);
        let cf2 = t2 * t2 / (t2 * t2 + t0sq);
        let cf3 = t3 * t3 / (t3 * t3 + t0sq);
        let dws = (p.i_dW1 + p.i_dW2 + p.i_dW3).max(1e-9);
        let driftRaw = (p.i_dW1 * m1 * cf1 + p.i_dW2 * m2 * cf2 + p.i_dW3 * m3 * cf3) / dws;
        let capBar = p.i_driftCap * sigLR;
        let muBase = clamp(driftRaw, -capBar, capBar);
        let tShr = (p.i_dW1 * t1 * cf1 + p.i_dW2 * t2 * cf2 + p.i_dW3 * t3 * cf3) / dws;
        let fD = ta::tanh(tShr / 2.0);

        // ----------------------------------------------------------------- VWAP ancrés
        let aW = self.cur_w.at(b.ts_close);
        let aD = self.anchors_d[t];
        let a4 = self.cur_4.at(b.ts_close);
        let pvNow = hlc3 * vv;
        let vwW = nz(self.avwap(aW, pvNow, vv), hlc3);
        let vwD = nz(self.avwap(aD, pvNow, vv), hlc3);
        let vw4h = nz(self.avwap(a4, pvNow, vv), hlc3);
        self.cpv_before.push(self.cum_pv);
        self.cv_before.push(self.cum_v);
        self.cum_pv += pvNow;
        self.cum_v += vv;
        self.vw_w.push(vwW);
        self.vw_d.push(vwD);
        self.vw_4.push(vw4h);
        self.vwW = vwW;
        self.vwD = vwD;
        self.vw4h = vw4h;

        // ------------------------------------------------------------------- facteur V
        let dW = (close / vwW.max(1e-12)).ln();
        let dDv = (close / vwD.max(1e-12)).ln();
        let d4v = (close / vw4h.max(1e-12)).ln();
        self.d_w.push(dW);
        self.d_d.push(dDv);
        self.d_4.push(d4v);
        let zW = clamp(nz(dW / ta::rms(&self.d_w, 200), 0.0), -3.0, 3.0);
        let zDv = clamp(nz(dDv / ta::rms(&self.d_d, 200), 0.0), -3.0, 3.0);
        let z4v = clamp(nz(d4v / ta::rms(&self.d_4, 200), 0.0), -3.0, 3.0);
        let slW = (vwW / nz(ta::back(&self.vw_w, self.k_w), vwW).max(1e-12)).ln();
        let slD = (vwD / nz(ta::back(&self.vw_d, self.k_d), vwD).max(1e-12)).ln();
        let sl4 = (vw4h / nz(ta::back(&self.vw_4, self.k_4), vw4h).max(1e-12)).ln();
        self.sl_w.push(slW);
        self.sl_d.push(slD);
        self.sl_4.push(sl4);
        let zSlW = clamp(nz(slW / ta::rms(&self.sl_w, 200), 0.0), -3.0, 3.0);
        let zSlD = clamp(nz(slD / ta::rms(&self.sl_d, 200), 0.0), -3.0, 3.0);
        let zSl4 = clamp(nz(sl4 / ta::rms(&self.sl_4, 200), 0.0), -3.0, 3.0);
        let trendPos = 0.5 * zW + 0.3 * zDv + 0.2 * z4v;
        let trendSlope = 0.5 * zSlW + 0.3 * zSlD + 0.2 * zSl4;
        let fV = ta::tanh(0.5 * (0.4 * trendPos + 0.6 * trendSlope));

        // ------------------------------------------------------------------- facteur A
        let rngB = (high - low).max(self.mk_t.mintick);
        let volMa = ta::sma(&self.vol, 50);
        let effort = if nz(volMa, 0.0) > 0.0 { vv / volMa } else { 1.0 };
        let bodyA = (close - open).abs() / atrS;
        self.body_a.push(bodyA);
        let bodyBase = nz(ta::sma(&self.body_a, 50), bodyA).max(1e-6);
        let effScore = clamp((effort - 1.0) / 1.5, 0.0, 1.0);
        let ineff = clamp(1.0 - bodyA / (bodyBase * effort.max(1e-6).sqrt()), 0.0, 1.0);
        let wickAsym = ((open.min(close) - low) - (high - open.max(close))) / rngB;
        let clv = ((close - low) - (high - close)) / rngB;
        let rangeFac = 1f64.min((high - low) / atrS);
        let aBar = effScore * ineff * (0.5 * wickAsym + 0.5 * clv) * rangeFac * (1.0 + 0.5 * self.sr_near);
        let aEma = self.ema_abar.update(aBar).unwrap_or(0.0);
        self.a_ema.push(aEma);
        let zA = aEma / ta::rms(&self.a_ema, 200);
        let fA = ta::tanh(zA / 2.0) * zA * zA / (zA * zA + 1.0);

        // ------------------------------------------------------------------- facteur M
        let sgnExt = ta::sign(trendPos);
        let mom = self.ema_r10.update(r).unwrap_or(0.0) / sigLR;
        self.mom.push(mom);
        let dMom = mom - nz(ta::back(&self.mom, 5), mom);
        self.d_mom.push(dMom);
        let dMomZ = nz(dMom / ta::rms(&self.d_mom, 200), 0.0);
        let decel = clamp(-sgnExt * dMomZ / 1.5, 0.0, 1.0);
        let extW = clamp((trendPos.abs() - p.i_extThr) / p.i_extWidth, 0.0, 1.0);
        let (up, dn) = if t == 0 { (f64::NAN, f64::NAN) } else { ((close - c1).max(0.0), (c1 - close).max(0.0)) };
        let rsiV = if t == 0 {
            f64::NAN
        } else {
            let (u, d) = (self.rma_up.update(up), self.rma_dn.update(dn));
            if u.is_nan() || d.is_nan() {
                f64::NAN
            } else if d == 0.0 {
                100.0
            } else if u == 0.0 {
                0.0
            } else {
                100.0 - 100.0 / (1.0 + u / d)
            }
        };
        let rsiV = nz(rsiV, 50.0);
        let rsiAux = if p.i_useRsi && ta::sign(rsiV - 50.0) == sgnExt {
            clamp(((rsiV - 50.0).abs() - 20.0) / 15.0, 0.0, 1.0)
        } else {
            0.0
        };
        let trendPersist = 0f64.max(fD * sgnExt) * (1.0 - decel);
        let fM = -sgnExt * extW * (0.5 + 0.5 * decel) * (0.85 + 0.15 * rsiAux) * (1.0 - 0.3 * trendPersist);

        // ----------------------------------------------------------------- compression
        let rv20 = nz(ta::stdev(&self.r, 20), 0.0);
        let bbw = nz(ta::stdev(&self.close, 20), 0.0) / nz(ta::sma(&self.close, 20), close).max(1e-12);
        let rngN = nz(ta::highest(&self.high, 20).0 - ta::lowest(&self.low, 20).0, 0.0) / close;
        self.rv20.push(rv20);
        self.atr_rel.push(atrS / close);
        self.bbw.push(bbw);
        self.rng_n.push(rngN);
        let pr1 = nz(ta::percentrank(&self.rv20, p.i_compLen), 50.0);
        let pr2 = nz(ta::percentrank(&self.atr_rel, p.i_compLen), 50.0);
        let pr3 = nz(ta::percentrank(&self.bbw, p.i_compLen), 50.0);
        let pr4 = nz(ta::percentrank(&self.rng_n, p.i_compLen), 50.0);
        let compScore = clamp(1.0 - (pr1 + pr2 + pr3 + pr4) / 400.0, 0.0, 1.0);

        // ------------------------------------------------------------------- facteur Z
        let flowBar = clamp(0.6 * clv + 0.4 * wickAsym, -1.0, 1.0);
        let c10 = nz(ta::back(&self.close, 10), close);
        let momZ = nz((close.ln() - c10.ln()) / (sigLR * 10f64.sqrt()), 0.0);
        self.momZ = momZ;
        let wBin = self.w_bin;
        {
            let dGF = (-1.0 / p.i_zoneTau).exp();
            self.gFV = self.gFV * dGF + vv;
            self.gFA = self.gFA * dGF + vv * flowBar;
            if vv > 0.0 && low > 0.0 {
                let mut kLo = (low.ln() / wBin).floor() as i64;
                let mut kHi = (high.ln() / wBin).floor() as i64;
                if kHi - kLo > 59 {
                    let kMid = (hlc3.ln() / wBin).floor() as i64;
                    kLo = kMid - 29;
                    kHi = kMid + 30;
                }
                let vPer = vv / (kHi - kLo + 1) as f64;
                for k in kLo..=kHi {
                    let (mut oV, mut oN, mut oA) = (0.0, 0.0, 0.0);
                    if let Some(z) = self.zones.get(&k) {
                        let dec = (-((ti - z.t) as f64) / p.i_zoneTau).exp();
                        oV = z.v * dec;
                        oN = z.n * dec;
                        oA = z.a * dec;
                    }
                    self.zones.insert(k, ZoneBin { v: oV + vPer, n: oN + 1.0, a: oA + vPer * flowBar, t: ti });
                }
            }
            let flowMean = if self.gFV > 0.0 { self.gFA / self.gFV } else { 0.0 };
            let kNow = (close.ln() / wBin).floor() as i64;
            let atrB = (atrS / close / wBin).max(1.0);
            let R = 200f64.min((p.i_zoneWin * atrB).ceil()) as i64;
            let hw = 1f64.max(round_i(p.i_zoneSmooth * atrB) as f64) as i64;
            let (pV, pN, pA) = z_profile(&self.zones, kNow - R, kNow + R, ti, p.i_zoneTau, hw);
            let refV = ta::pos_median(&pV);
            let refN = ta::pos_median(&pN);
            let mut fldZ = 0.0;
            let (mut bestSup, mut bestRes) = (0.0, 0.0);
            let (mut supLvl, mut resLvl) = (f64::NAN, f64::NAN);
            for i in 0..=(2 * R) as usize {
                let svI = pV[i];
                if svI > 0.0 {
                    let st = clamp((1.0 - p.i_zoneTPO) * svI / refV + p.i_zoneTPO * pN[i] / refN - 1.0, 0.0, 6.0);
                    if st > 0.0 {
                        let dA = (i as i64 - R) as f64 / atrB;
                        let side = if dA < -0.5 {
                            1.0
                        } else if dA > 0.5 {
                            -1.0
                        } else if momZ <= 0.0 {
                            1.0
                        } else {
                            -1.0
                        };
                        let role = 1.0 + p.i_zoneFlowW * clamp(side * (pA[i] / svI - flowMean) / 0.15, -0.8, 2.0);
                        let dz = dA / p.i_zoneDecay;
                        let contra = 1.0 + p.i_zoneContra * 0f64.max(-side * momZ);
                        fldZ += (-0.5 * dz * dz).exp() * st * side * role * contra;
                        let wallSc = st * role;
                        let lvl = ((kNow - R + i as i64) as f64 + 0.5) * wBin;
                        if dA < 0.0 && wallSc > bestSup {
                            bestSup = wallSc;
                            supLvl = lvl.exp();
                        }
                        if dA > 0.0 && wallSc > bestRes {
                            bestRes = wallSc;
                            resLvl = lvl.exp();
                        }
                    }
                }
            }
            fldZ /= atrB * p.i_zoneDecay * 2.5;
            let atrL = atrS / close;
            for (vq, wq) in [(vwW, p.i_rvWW), (vwD, p.i_rvWD), (vw4h, p.i_rvW4)] {
                if !vq.is_nan() && vq > 0.0 {
                    let dV = (vq / close).ln() / atrL;
                    let sideV = if dV < -0.3 {
                        1.0
                    } else if dV > 0.3 {
                        -1.0
                    } else if momZ <= 0.0 {
                        1.0
                    } else {
                        -1.0
                    };
                    let dzV = dV / p.i_zoneDecay;
                    fldZ += p.i_rvZ * wq * (-0.5 * dzV * dzV).exp() * sideV * (1.0 + p.i_zoneContra * 0f64.max(-sideV * momZ));
                }
            }
            self.zone_field = fldZ;
            self.zSupLvl = supLvl;
            self.zResLvl = resLvl;
        }
        let fZ = ta::tanh(p.i_zoneGain * self.zone_field);

        // ----------------------------------------------------- phases : séries d'entrée
        let Wi = self.Wi;
        let cWi = nz(ta::back(&self.close, Wi), close);
        let netImp = (close / cWi).ln();
        let sumAbsR = ta::sum(&self.abs_r, Wi);
        let erImp = if nz(sumAbsR, 0.0) > 0.0 { netImp.abs() / sumAbsR } else { 0.0 };
        let netZ = netImp / (sigLR * (Wi as f64).sqrt());
        let (hiW, hiOff) = ta::highest(&self.high, Wi);
        let (loW, loOff) = ta::lowest(&self.low, Wi);
        let impStr = clamp(netZ.abs() - p.i_impZ, 0.0, 1.0) * clamp((erImp - p.i_impER) / 0.2, 0.0, 1.0);
        let hiCoil = ta::highest(&self.high, self.coil_bars).0;
        let loCoil = ta::lowest(&self.low, self.coil_bars).0;

        // ------------------------------------------------------------- score de direction
        let fR = self.sr_field;
        let w = &self.shares;
        let rawScore = p.i_scoreGain
            * (w[0] * nz(fD, 0.0) + w[1] * nz(fV, 0.0) + w[2] * nz(fR, 0.0) + w[3] * nz(fA, 0.0) + w[4] * nz(fM, 0.0) + w[5] * nz(fZ, 0.0));
        let dirScore = nz(ta::tanh(rawScore), 0.0);

        // ------------------------------------------------------------ détecteur de Markov
        let mk_m = ta::sma(&self.r, p.i_mk_len);
        let mk_s = ta::stdev(&self.r, p.i_mk_len);
        let mkZr = if nz(mk_s, 0.0) > 0.0 && !mk_m.is_nan() { (r - mk_m) / mk_s } else { 0.0 };
        let mkDetect: u8 = if mkZr > p.i_mk_z_thr {
            0
        } else if mkZr < -p.i_mk_z_thr {
            1
        } else {
            2
        };

        // =========================================================== barre confirmée
        // --- comptages de Markov
        if p.i_mk_enable {
            let szM = self.mk_states.len();
            let evict = szM > p.i_mk_len;
            let old = if evict && szM >= 2 { Some((self.mk_states[0], self.mk_states[1])) } else { None };
            let prevSt = self.mk_states.back().copied();
            self.mk_states.push_back(mkDetect);
            let row = |cnt: &[[f64; 3]; 3], pr: &mut [f64; 9], row: usize, alpha: f64| {
                let rsum: f64 = (0..3).map(|j| cnt[row][j] + alpha).sum();
                for j in 0..3 {
                    pr[row * 3 + j] = (cnt[row][j] + alpha) / rsum;
                }
            };
            if let Some(ps) = prevSt {
                self.mk_counts[ps as usize][mkDetect as usize] += 1.0;
                row(&self.mk_counts, &mut self.mk_probs, ps as usize, p.i_mk_alpha);
            }
            if evict {
                self.mk_states.pop_front();
                if let Some((of, ot)) = old {
                    let c = &mut self.mk_counts[of as usize][ot as usize];
                    *c = (*c - 1.0).max(0.0);
                    row(&self.mk_counts, &mut self.mk_probs, of as usize, p.i_mk_alpha);
                }
            }
            self.mk_state = mkDetect;
        } else {
            self.mk_state = 2;
        }

        // --- score lissé, hystérésis à deux seuils, confirmation sur N barres
        let prevStable = self.stableScore;
        self.stableScore = p.i_alphaStable * self.stableScore + (1.0 - p.i_alphaStable) * dirScore;
        let s = self.stableScore;
        let desired = if self.dirRegime == 0 {
            if s > p.i_enterThr {
                1
            } else if s < -p.i_enterThr {
                -1
            } else {
                0
            }
        } else if self.dirRegime == 1 {
            if s < -self.flip_thr { -1 } else { 1 }
        } else if s > self.flip_thr {
            1
        } else {
            -1
        };
        let mut flipped = false;
        if desired != self.dirRegime {
            if desired == self.pendDir {
                self.pendCount += 1;
            } else {
                self.pendDir = desired;
                self.pendCount = 1;
            }
            if self.pendCount >= p.i_confirmN {
                self.dirRegime = desired;
                self.regimeAge = 0;
                self.pendDir = 0;
                self.pendCount = 0;
                flipped = true;
            }
        } else {
            self.pendDir = 0;
            self.pendCount = 0;
        }
        self.regimeAge += 1;

        // --- machine d'états des phases
        let mut phaseChg = false;
        if p.i_phEnable {
            if impStr > 0.0 {
                let dImp = if netImp > 0.0 { 1 } else { -1 };
                let ext = if dImp > 0 { hiW } else { loW };
                let extBar = ti - if dImp > 0 { hiOff } else { loOff } as i64;
                let sameLeg = self.phase == 1 && dImp == self.impDir;
                if !sameLeg {
                    phaseChg = true;
                    self.phase = 1;
                    self.impDir = dImp;
                    self.rgBase = if dImp > 0 { loW } else { hiW };
                    self.rgExt = ext;
                    self.rgStart = extBar;
                    self.rgFarReal = f64::NAN;
                } else if (dImp > 0 && ext > self.rgExt) || (dImp < 0 && ext < self.rgExt) {
                    self.rgExt = ext;
                    self.rgStart = extBar;
                    self.rgFarReal = f64::NAN;
                }
                self.rgDur = (p.i_rangeMult * Wi as f64) as i64;
            }
            if self.phase == 1 {
                if self.impDir > 0 && high > self.rgExt {
                    self.rgExt = high;
                }
                if self.impDir < 0 && low < self.rgExt {
                    self.rgExt = low;
                }
                if ti > self.rgStart {
                    self.rgFarReal = if self.impDir > 0 {
                        nz(self.rgFarReal, low).min(low)
                    } else {
                        nz(self.rgFarReal, high).max(high)
                    };
                }
                let imp = self.impDir as f64;
                let lExt = self.rgExt.ln();
                let legL = (lExt - self.rgBase.ln()).abs();
                let mut lFar = lExt - imp * p.i_rangeRetr * legL;
                let wallP = if self.impDir > 0 { self.zSupLvl } else { self.zResLvl };
                if !wallP.is_nan() {
                    let lw = wallP.ln();
                    let r38 = lExt - imp * 0.382 * legL;
                    let r79 = lExt - imp * 0.786 * legL;
                    if lw <= r38.max(r79) && lw >= r38.min(r79) {
                        lFar = lw;
                    }
                }
                let dExp = (lExt - lFar).abs();
                let dReal = if self.rgFarReal.is_nan() { 0.0 } else { (lExt - self.rgFarReal.ln()).abs() };
                let swLc2 = 2i64.max((self.rgDur as f64 / (p.i_rangeSwings as f64 + 0.5)) as i64);
                let dEff = if ti - self.rgStart >= swLc2 { dReal.max(0.75 * dExp) } else { dReal.max(dExp) };
                self.rgFar = (lExt - imp * dEff).exp();
                let expired = ti > self.rgStart + self.rgDur;
                let brokeFar = if self.impDir > 0 { close < self.rgFar - atrS } else { close > self.rgFar + atrS };
                if expired || brokeFar {
                    self.phase = 0;
                    phaseChg = true;
                }
            }
            self.compAge = if compScore > p.i_coilThr { self.compAge + 1 } else { 0.max(self.compAge - 2) };
            if self.phase != 1 {
                if self.phase != 2 && self.compAge >= self.coil_bars as i64 {
                    self.phase = 2;
                    phaseChg = true;
                    self.coilHi = hiCoil;
                    self.coilLo = loCoil;
                    self.coilStart = ti - self.coil_bars as i64;
                    self.sweptHi = false;
                    self.sweptLo = false;
                }
                if self.phase == 2 {
                    if high > self.coilHi && close <= self.coilHi {
                        self.sweptHi = true;
                    }
                    if low < self.coilLo && close >= self.coilLo {
                        self.sweptLo = true;
                    }
                    if close > self.coilHi + atrS || close < self.coilLo - atrS {
                        self.phase = 0;
                        phaseChg = true;
                        self.compAge = 0;
                    }
                }
            }
        } else {
            self.phase = 0;
        }

        let dr = self.dirRegime as f64;
        let mut dState = if self.dirRegime == 0 { s } else { dr * p.i_floorStr.max(dr * s) };
        dState = clamp(dState, -1.0, 1.0);

        // --- loi analytique à l'horizon H et cible inclinée brute
        let H = p.i_H;
        let amp = (1.0 + p.i_lambdaComp * compScore) * if self.phase == 2 { 1.0 + p.i_coilAmp } else { 1.0 };
        let betaEff = p.i_beta * amp;
        let hLRx = lrv * (1.0 + p.i_compVol * compScore).powi(2);
        let sigH = ta::var_h(ewv, hLRx, self.gPhi, H).max(1e-12).sqrt();
        let kdC = if p.i_dirInFan { clamp(p.i_kDir * amp * dState, -p.i_dirCapSig, p.i_dirCapSig) } else { 0.0 };
        let bs = clamp(betaEff * dState, -3.5, 3.5);
        let rngOnC = self.phase == 1;
        let remRC = self.rgStart + self.rgDur - ti;
        let xMidC = if rngOnC { 0.5 * ((self.rgExt / close).ln() + (self.rgFar / close).ln()) } else { 0.0 };
        let swLC = 2i64.max((self.rgDur as f64 / (p.i_rangeSwings as f64 + 0.5)) as i64);
        let kapC = p.i_rangeKappa * 2f64.ln() / (swLC as f64 / 2.0).max(1.0);
        let Rraw = phase_target(muBase, kdC, sigH, bs, H, rngOnC, remRC, xMidC, kapC, p.i_postDir);

        // --- stabilisation de la cible selon l'information nouvelle
        let logSig = 0.5 * ewv.ln();
        let volShock = if self.prevLogSig.is_nan() { 0.0 } else { (logSig - self.prevLogSig).abs() };
        self.prevLogSig = logSig;
        let chg = flipped || phaseChg;
        let info = 6.0 * (s - prevStable).abs() + 3.0 * volShock + if chg { 3.0 } else { 0.0 };
        let gain = if chg { p.i_maxGain } else { p.i_minGain + (p.i_maxGain - p.i_minGain) * (1.0 - (-info).exp()) };
        self.Rstab = if self.Rstab.is_nan() { Rraw } else { self.Rstab + gain * (Rraw - self.Rstab) };
        self.prevLogC = close.ln();
        self.nConf += 1;

        // --- pool de résidus et anneaux d'analogues
        if t as u32 > self.n_ew {
            let zc = clamp(zRes, -8.0, 8.0);
            self.zPool[self.zHead] = zc;
            self.zHead = (self.zHead + 1) % p.i_poolN;
            self.zCount = (self.zCount + 1).min(p.i_poolN);

            self.anHead = (self.anHead + 1) % p.i_anBuf as i64;
            let ah = self.anHead as usize;
            self.anZ[ah] = zc;
            self.anU[ah] = uwS;
            self.anW[ah] = lwS;
            self.anS[ah] = self.stableScore;
            self.anV[ah] = 0.5 * (ewv / lrv).ln();
            self.anCount = (self.anCount + 1).min(p.i_anBuf);
            self.anTot += 1;
        }

        // --- instantané engagé, lu par la projection
        self.cClose = close;
        self.cBar = ti;
        self.cMu = muBase;
        self.cH0 = ewv;
        self.cLrv = lrv;
        self.cHLR = hLRx;
        self.cComp = compScore;
        self.cAmp = amp;
        self.cBeta = betaEff;
        self.cDState = dState;
        self.cRaw = dirScore;
        self.cF = [fD, fV, fR, fA, fM, fZ];
        self.cMk = self.mk_state;
        self.atrS = atrS;

        BarState {
            dir_regime: self.dirRegime as i8,
            regime_age: self.regimeAge,
            stable: self.stableScore,
            raw: dirScore,
            d_state: dState,
            f: self.cF,
            comp: compScore,
            amp,
            phase: self.phase,
            mk: self.mk_state,
            v_ratio: (ewv / lrv.max(1e-14)).sqrt(),
            rstab: self.Rstab,
            sig_h: sigH,
            mu_base: muBase,
            atr: atrS,
        }
    }
}

/// `f_phaseTarget` : log-rendement visé à l'horizon `hh`, libre ou contraint par un range.
#[allow(clippy::too_many_arguments)]
pub fn phase_target(
    mu_b: f64,
    kdx: f64,
    sig_hx: f64,
    bsx: f64,
    hh: usize,
    rng_on: bool,
    rem_rx: i64,
    x_midx: f64,
    kapx: f64,
    post_w: f64,
) -> f64 {
    let hf = hh as f64;
    let free = mu_b * hf + kdx * hf.sqrt() * sig_hx + bsx * sig_hx;
    if rng_on && rem_rx > 0 {
        let h_r = (hh as i64).min(rem_rx) as f64;
        let fr = (hf - h_r) / hf;
        x_midx * (1.0 - (-kapx * h_r).exp()) + fr * post_w * free
    } else {
        free
    }
}
