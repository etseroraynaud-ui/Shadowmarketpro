//! Excursions : valeurs connues sur des séries artificielles, symétrie long / short,
//! bornes stricte et inclusive, référence brownienne.

mod common;

use evmc::data::loader::from_bars;
use evmc::data::synth::SynthSpec;
use evmc::data::Bar;
use evmc::math::{norm_inv, quantile_sorted, sort_f64};
use evmc::outcome::{origin_outcomes, OutcomeRow};
use evmc::types::HorizonGrid;

const DAY: i64 = 86_400_000;

/// Série construite à partir de (open, high, low, close) par barre.
fn series(ohlc: &[(f64, f64, f64, f64)]) -> evmc::data::BarSeries {
    let bars: Vec<Bar> = ohlc
        .iter()
        .enumerate()
        .map(|(i, (o, h, l, c))| Bar {
            ts_open: i as i64 * DAY,
            ts_close: (i as i64 + 1) * DAY,
            open: *o,
            high: *h,
            low: *l,
            close: *c,
            volume: 1.0,
        })
        .collect();
    from_bars("X", "1d", bars).unwrap()
}

fn outcomes(s: &evmc::data::BarSeries, t: usize, grid: &[u16]) -> Vec<OutcomeRow> {
    let g = HorizonGrid::new(grid.to_vec()).unwrap();
    // sigma de référence artificiel : 1 % par racine de barre.
    origin_outcomes(s, t, &g, s.len(), |k| 0.01 * (k as f64).sqrt(), 2, Some(0))
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-12
}

#[test]
fn monotone_rise() {
    // Chaque barre ouvre sur la clôture précédente et ne revient jamais sous l'origine.
    let s = series(&[
        (100.0, 100.0, 100.0, 100.0),
        (100.0, 102.0, 100.0, 101.0),
        (101.0, 104.0, 101.0, 103.0),
        (103.0, 106.0, 103.0, 105.0),
    ]);
    let o = outcomes(&s, 0, &[1, 3]);
    assert_eq!(o.len(), 2);
    let r = &o[1];
    assert!(close(r.ret, (105.0f64 / 100.0).ln()));
    assert!(close(r.max_up, (106.0f64 / 100.0).ln()));
    assert_eq!(r.t_up, 3);
    assert_eq!(r.max_dn, 0.0);
    assert_eq!(r.t_dn, 0);
    assert_eq!(r.dn_before_up_strict, 0.0);
    assert_eq!(r.dn_before_up_incl, 0.0);
    assert_eq!(r.sigma_ref_at_dn, None);
    assert_eq!(r.max_dn_sig_tau, 0.0);
    assert!(close(r.sigma_ref_at_up.unwrap(), 0.01 * 3f64.sqrt()));
    assert!(close(r.max_up_sig_tau, r.max_up / (0.01 * 3f64.sqrt())));
    assert!(close(r.max_up_sig_h, r.max_up / r.sigma_ref_h));
    assert!(close(r.open_next, 100.0));
    assert!(close(o[0].max_up, (102.0f64 / 100.0).ln()));
    assert_eq!(o[0].t_up, 1);
}

#[test]
fn v_shape_orders_the_adverse_move_before_the_top() {
    // Creux à la barre 2, sommet à la barre 4.
    let s = series(&[
        (100.0, 100.0, 100.0, 100.0),
        (100.0, 100.5, 97.0, 98.0),
        (98.0, 98.5, 94.0, 95.0),
        (95.0, 101.0, 95.0, 100.0),
        (100.0, 108.0, 99.0, 107.0),
        (107.0, 107.5, 104.0, 105.0),
    ]);
    let r = &outcomes(&s, 0, &[5])[0];
    assert!(close(r.max_up, (108.0f64 / 100.0).ln()));
    assert_eq!(r.t_up, 4);
    assert!(close(r.max_dn, (94.0f64 / 100.0).ln()));
    assert_eq!(r.t_dn, 2);
    // Adverse d'une position longue avant le sommet : le creux de la barre 2.
    assert!(close(r.dn_before_up_strict, (94.0f64 / 100.0).ln()));
    assert!(close(r.dn_before_up_incl, (94.0f64 / 100.0).ln()));
    // Adverse d'une position courte avant le creux : le plus haut de la barre 1 (strict),
    // ou celui de la barre du creux lui-même (inclusif).
    assert!(close(r.up_before_dn_strict, (100.5f64 / 100.0).ln()));
    assert!(close(r.up_before_dn_incl, (100.5f64 / 100.0).ln()));
    assert!(close(r.rv_realized, {
        let c = [100.0f64, 98.0, 95.0, 100.0, 107.0, 105.0];
        c.windows(2).map(|w| (w[1] / w[0]).ln().powi(2)).sum::<f64>().sqrt()
    }));
}

#[test]
fn intrabar_ambiguity_is_bracketed() {
    // La barre 1 porte à la fois le sommet et un creux : l'ordre est inconnu en OHLC.
    let s = series(&[(100.0, 100.0, 100.0, 100.0), (100.0, 105.0, 96.0, 101.0), (101.0, 102.0, 99.0, 100.0)]);
    let r = &outcomes(&s, 0, &[2])[0];
    assert_eq!(r.t_up, 1);
    assert_eq!(r.dn_before_up_strict, 0.0);
    assert!(close(r.dn_before_up_incl, (96.0f64 / 100.0).ln()));
    assert_eq!(r.t_dn, 1);
    assert_eq!(r.up_before_dn_strict, 0.0);
    assert!(close(r.up_before_dn_incl, (105.0f64 / 100.0).ln()));
}

#[test]
fn flat_series_and_first_tie_wins() {
    let s = series(&[(100.0, 100.0, 100.0, 100.0); 6]);
    let r = &outcomes(&s, 1, &[4])[0];
    assert_eq!((r.ret, r.max_up, r.max_dn, r.t_up, r.t_dn), (0.0, 0.0, 0.0, 0, 0));
    assert_eq!(r.rv_realized, 0.0);
    // Deux sommets égaux : le premier l'emporte.
    let s = series(&[
        (100.0, 100.0, 100.0, 100.0),
        (100.0, 103.0, 100.0, 101.0),
        (101.0, 101.0, 98.0, 99.0),
        (99.0, 103.0, 99.0, 102.0),
    ]);
    let r = &outcomes(&s, 0, &[3])[0];
    assert_eq!(r.t_up, 1);
    assert_eq!(r.dn_before_up_strict, 0.0);
}

#[test]
fn windows_stop_at_the_limit_and_at_gaps() {
    let mut ohlc = vec![(100.0, 100.0, 100.0, 100.0)];
    for i in 1..12 {
        let p = 100.0 + i as f64;
        ohlc.push((p - 1.0, p + 0.5, p - 1.5, p));
    }
    let s = series(&ohlc);
    let g = HorizonGrid::new(vec![1, 3, 5]).unwrap();
    // limite = 4 : seule la fenêtre t + H < 4 est émise.
    let rows = origin_outcomes(&s, 0, &g, 4, |k| 0.01 * (k as f64).sqrt(), 2, None);
    assert_eq!(rows.iter().map(|r| r.horizon).collect::<Vec<_>>(), vec![1, 3]);
    // Un trou entre les barres 2 et 3 coupe toutes les fenêtres qui le traversent.
    let mut bars = s.bars.clone();
    for b in bars.iter_mut().skip(3) {
        b.ts_open += 2 * DAY;
        b.ts_close += 2 * DAY;
    }
    let gapped = from_bars("X", "1d", bars).unwrap();
    assert_eq!(gapped.n_gaps(), 1);
    let rows = origin_outcomes(&gapped, 0, &g, gapped.len(), |k| 0.01 * (k as f64).sqrt(), 2, None);
    assert_eq!(rows.iter().map(|r| r.horizon).collect::<Vec<_>>(), vec![1]);
    let rows = origin_outcomes(&gapped, 3, &g, gapped.len(), |k| 0.01 * (k as f64).sqrt(), 2, None);
    assert_eq!(rows.len(), 3);
}

#[test]
fn long_and_short_are_symmetric_on_synthetic_data() {
    let s = common::synth_series(&SynthSpec { n: 1500, seed: 4, t_df: Some(5), ..Default::default() });
    let g = HorizonGrid::new(vec![1, 5, 20, 60]).unwrap();
    for t in (100..1400).step_by(7) {
        for r in origin_outcomes(&s, t, &g, s.len(), |k| 0.03 * (k as f64).sqrt(), 2, None) {
            assert!(r.max_up >= 0.0 && r.max_dn <= 0.0);
            assert!(r.max_up >= r.ret && r.max_dn <= r.ret);
            assert!(r.t_up <= r.horizon && r.t_dn <= r.horizon);
            // Borne stricte <= borne inclusive en magnitude, toutes deux bornées par l'excursion totale.
            assert!(r.dn_before_up_strict <= 0.0 && r.dn_before_up_incl <= r.dn_before_up_strict);
            assert!(r.dn_before_up_incl >= r.max_dn);
            assert!(r.up_before_dn_strict >= 0.0 && r.up_before_dn_incl >= r.up_before_dn_strict);
            assert!(r.up_before_dn_incl <= r.max_up);
            assert_eq!(r.t_up == 0, r.max_up == 0.0);
            assert_eq!(r.sigma_ref_at_up.is_none(), r.t_up == 0);
            // MFE short = -max_dn = MAE long ; MAE short = max_up = MFE long.
            let (mfe_long, mae_long) = (r.max_up, -r.max_dn);
            let (mfe_short, mae_short) = (-r.max_dn, r.max_up);
            assert_eq!(mfe_long, mae_short);
            assert_eq!(mae_long, mfe_short);
            assert!((r.ret_z - r.ret / r.sigma_ref_h).abs() < 1e-15);
        }
    }
}

#[test]
fn brownian_maximum_follows_the_half_normal_law() {
    // Volatilité constante, pas fin : max_up / sigma_H suit la loi de |N(0, 1)|.
    let sigma = 0.02;
    let s = common::synth_series(&SynthSpec {
        n: 30_001,
        seed: 9,
        sigma,
        alpha: 0.0,
        beta: 0.0,
        sub_steps: 96,
        ..Default::default()
    });
    let h = 20u16;
    let g = HorizonGrid::new(vec![h]).unwrap();
    let mut v = Vec::new();
    // Fenêtres disjointes : observations indépendantes.
    for t in (0..30_000 - h as usize).step_by(h as usize) {
        let r = &origin_outcomes(&s, t, &g, s.len(), |k| sigma * (k as f64).sqrt(), 2, None)[0];
        v.push(r.max_up_sig_h);
    }
    assert!(v.len() >= 1400);
    sort_f64(&mut v);
    for p in [0.25, 0.5, 0.75, 0.9] {
        let exact = norm_inv(0.5 + p / 2.0);
        let emp = quantile_sorted(&v, p);
        // Le pas discret biaise légèrement le maximum vers le bas.
        assert!((emp - exact).abs() < 0.09, "p={p} : {emp:.3} contre {exact:.3}");
    }
}
