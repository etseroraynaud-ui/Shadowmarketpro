//! Tableau de bord : exporte un run en une page HTML autonome, sans dépendance réseau.
//! Aucune statistique n'est calculée ici : la page affiche les tables du run.

use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::error::{Error, Result};
use crate::eval::{metrics_from_table, reliability_from_table};
use crate::io::manifest::Manifest;
use crate::io::parquet::read_table;
use crate::io::table::hex;
use crate::models::registry;
use crate::pipeline::Ctx;

/// Gabarit de la page, embarqué dans le binaire.
const TEMPLATE: &str = include_str!("../../assets/dashboard.html");
const MARKER: &str = "{{EVMC_DATA}}";

/// Plafond du nombre de valeurs de prévision exportées : au-delà, les origines sont sous-échantillonnées.
const MAX_FORECAST_VALUES: usize = 4_000_000;

/// Pas de quantification des log-rendements exportés (un point de base) et des mèches.
const RET_SCALE: f64 = 1e-4;
const WICK_SCALE: f64 = 1e-3;

/// Quantiles affichés par l'éventail : 5, 25, 50, 75 et 95 %.
const FAN_Q: [&str; 5] = ["q0500", "q2500", "q5000", "q7500", "q9500"];

/// Métriques par pli exportées pour la vue de stabilité.
const FOLD_METRICS: [&str; 10] = [
    "crps", "crps_skill", "brier", "brier_skill", "cov50", "cov80", "cov90", "cov95", "z_std", "hit_rate",
];

fn b64(bytes: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for c in bytes.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        out.push(A[(n >> 18) as usize & 63] as char);
        out.push(A[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { A[n as usize & 63] as char } else { '=' });
    }
    out
}

/// Log-rendements en entiers 16 bits : `valeur / RET_SCALE`, bornés à ±3,2767.
fn b64_i16(v: impl Iterator<Item = f64>, scale: f64) -> String {
    let mut bytes = Vec::new();
    for x in v {
        let q = (x / scale).round().clamp(i16::MIN as f64, i16::MAX as f64) as i16;
        bytes.extend_from_slice(&q.to_le_bytes());
    }
    b64(&bytes)
}

/// Valeurs positives en entiers 16 bits non signés.
fn b64_u16(v: impl Iterator<Item = f64>, scale: f64) -> String {
    let mut bytes = Vec::new();
    for x in v {
        let q = (x / scale).round().clamp(0.0, u16::MAX as f64) as u16;
        bytes.extend_from_slice(&q.to_le_bytes());
    }
    b64(&bytes)
}

fn b64_u8(v: impl Iterator<Item = f64>, scale: f64) -> String {
    let bytes: Vec<u8> = v.map(|x| (x / scale).round().clamp(0.0, 255.0) as u8).collect();
    b64(&bytes)
}

/// Arrondi à 5 chiffres significatifs, pour les séries denses.
fn r5(x: f64) -> Value {
    if !x.is_finite() {
        return Value::Null;
    }
    json!(format!("{:.4e}", x).parse::<f64>().unwrap_or(x))
}

fn b64_f64(v: &[f64]) -> String {
    let mut bytes = Vec::with_capacity(v.len() * 8);
    for x in v {
        bytes.extend_from_slice(&x.to_le_bytes());
    }
    b64(&bytes)
}

/// Arrondi à 7 chiffres significatifs : assez pour l'affichage, plus compact en JSON.
fn r7(x: f64) -> Value {
    if !x.is_finite() {
        return Value::Null;
    }
    let s = format!("{:.6e}", x);
    json!(s.parse::<f64>().unwrap_or(x))
}

fn opt(x: Option<f64>) -> Value {
    x.map(r7).unwrap_or(Value::Null)
}

/// Construit les données de la page à partir des tables du run.
pub fn build_data(ctx: &Ctx, manifest: &Manifest) -> Result<Value> {
    let grid = ctx.cfg.grid()?;
    let gh = grid.as_slice();
    let split = &ctx.split;
    // Tant que le holdout est verrouillé, ses prix ne sont pas exportés.
    let n_vis = if manifest.holdout_opened { split.data_end } else { split.holdout_start } as usize;
    let bars = &ctx.series.bars[..n_vis.min(ctx.series.len())];

    // --- modèles, dans l'ordre de la configuration
    let model_ids: Vec<String> = manifest.models.clone();
    let m_of = |id: &str| model_ids.iter().position(|m| m == id);

    // --- prévisions : quantiles de l'éventail et P(hausse), par modèle, origine puis horizon
    let fc = read_table(&ctx.run_dir.join("forecasts.parquet"), "forecasts")?;
    let ids = fc.str("model_id")?;
    let bar_idx = fc.u32("bar_idx")?;
    let p_up = fc.nf64("raw_p_up")?;
    let mut qcols = Vec::new();
    for name in FAN_Q {
        qcols.push(fc.nf64(name)?);
    }
    let n_h = gh.len();
    let mut fc_models = serde_json::Map::new();
    let mut origins_ref: Option<Vec<u32>> = None;
    let mut stride = 1usize;
    let mut has_dist = vec![false; model_ids.len()];
    let mut has_p = vec![false; model_ids.len()];
    // Les lignes sont triées par (model_id, ts, horizon) : chaque modèle occupe un bloc contigu.
    let mut start = 0usize;
    let n_rows = fc.n_rows();
    let n_dist_models = {
        let mut seen: Vec<&str> = Vec::new();
        for i in 0..n_rows {
            if qcols[2][i].is_some() && !seen.contains(&ids[i].as_str()) {
                seen.push(ids[i].as_str());
            }
        }
        seen.len().max(1)
    };
    while start < n_rows {
        let id = &ids[start];
        let mut end = start;
        while end < n_rows && &ids[end] == id {
            end += 1;
        }
        let rows = end - start;
        if !rows.is_multiple_of(n_h) {
            return Err(Error::Schema(format!("prévisions de {id} : nombre de lignes incohérent")));
        }
        let n_or = rows / n_h;
        let origins: Vec<u32> = (0..n_or).map(|o| bar_idx[start + o * n_h]).collect();
        match &origins_ref {
            None => {
                let total = n_or * n_h * 6 * n_dist_models;
                stride = total.div_ceil(MAX_FORECAST_VALUES).max(1);
                origins_ref = Some(origins.clone());
            }
            Some(r) if *r != origins => {
                return Err(Error::Schema("les modèles n'ont pas les mêmes origines".into()));
            }
            _ => {}
        }
        let mi = m_of(id);
        let dist = (start..end).all(|i| qcols.iter().all(|c| c[i].is_some()));
        let prob = (start..end).all(|i| p_up[i].is_some());
        if let Some(mi) = mi {
            has_dist[mi] = dist;
            has_p[mi] = prob;
        }
        if dist {
            let kept: Vec<usize> = (0..n_or).filter(|o| o % stride == 0).collect();
            let mut q = Vec::with_capacity(kept.len() * n_h * 5);
            let mut p = Vec::with_capacity(kept.len() * n_h);
            for &o in &kept {
                for g in 0..n_h {
                    let i = start + o * n_h + g;
                    for c in &qcols {
                        q.push(c[i].unwrap_or(0.0));
                    }
                    p.push(p_up[i].unwrap_or(0.5));
                }
            }
            fc_models.insert(
                id.clone(),
                json!({ "q": b64_i16(q.into_iter(), RET_SCALE), "p": b64_u16(p.into_iter(), 1.0 / 65535.0) }),
            );
        }
        start = end;
    }
    let origins: Vec<u32> = origins_ref
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .filter(|(o, _)| o % stride == 0)
        .map(|(_, b)| b)
        .collect();

    // --- métriques de la zone notée, en colonnes, avec dictionnaires
    let metrics = metrics_from_table(&read_table(&ctx.run_dir.join("metrics.parquet"), "metrics")?)?;
    let rel = reliability_from_table(&read_table(&ctx.run_dir.join("reliability.parquet"), "reliability")?)?;
    let mut metric_names: Vec<String> = Vec::new();
    let mut pk_names: Vec<String> = Vec::new();
    let dict = |v: &mut Vec<String>, s: &str| -> usize {
        match v.iter().position(|x| x == s) {
            Some(i) => i,
            None => {
                v.push(s.to_string());
                v.len() - 1
            }
        }
    };
    let h_of = |h: u16| gh.iter().position(|x| *x == h).unwrap_or(0);
    let mut dev: [Vec<Value>; 12] = Default::default();
    let mut exc: [Vec<Value>; 5] = Default::default();
    let mut exc_names: Vec<String> = Vec::new();
    let mut fold: [Vec<Value>; 6] = Default::default();
    let mut warn_h = vec![false; n_h];
    let mut n_h_rows = vec![0u32; n_h];
    for r in &metrics {
        let hi = h_of(r.horizon);
        if r.model_id == "_outcomes" {
            if r.scope == "dev" {
                let k = dict(&mut exc_names, &r.metric);
                exc[0].push(json!(hi));
                exc[1].push(json!(k));
                exc[2].push(r7(r.value));
                exc[3].push(opt(r.ci_lo));
                exc[4].push(opt(r.ci_hi));
            }
            continue;
        }
        let Some(mi) = m_of(&r.model_id) else { continue };
        let bi = r.baseline_id.as_deref().and_then(m_of).map(|x| x as i64).unwrap_or(-1);
        if r.scope == "dev" {
            warn_h[hi] = r.warn_low_n;
            n_h_rows[hi] = r.n_obs;
            let k = dict(&mut metric_names, &r.metric);
            let pk = r.point_kind.as_deref().map(|s| dict(&mut pk_names, s) as i64).unwrap_or(-1);
            dev[0].push(json!(mi));
            dev[1].push(json!(bi));
            dev[2].push(json!(hi));
            dev[3].push(json!(k));
            dev[4].push(json!(pk));
            dev[5].push(r7(r.value));
            dev[6].push(opt(r.ci_lo));
            dev[7].push(opt(r.ci_hi));
            dev[8].push(match r.significant {
                Some(true) => json!(1),
                Some(false) => json!(0),
                None => Value::Null,
            });
            dev[9].push(r.block_len.map(|x| json!(x)).unwrap_or(Value::Null));
            dev[10].push(opt(r.hac_se));
            dev[11].push(json!(r.n_obs));
        } else if let Some(f) = r.scope.strip_prefix("fold_") {
            if FOLD_METRICS.contains(&r.metric.as_str()) && r.point_kind.is_none() {
                let k = dict(&mut metric_names, &r.metric);
                fold[0].push(json!(mi));
                fold[1].push(json!(bi));
                fold[2].push(json!(hi));
                fold[3].push(json!(k));
                fold[4].push(json!(f.parse::<u32>().unwrap_or(0)));
                fold[5].push(r7(r.value));
            }
        }
    }
    let mut relc: [Vec<Value>; 8] = Default::default();
    for r in &rel {
        let Some(mi) = m_of(&r.model_id) else { continue };
        relc[0].push(json!(mi));
        relc[1].push(json!(h_of(r.horizon)));
        relc[2].push(json!(r.bin));
        relc[3].push(r7(r.p_mean));
        relc[4].push(r7(r.y_freq));
        relc[5].push(json!(r.n));
        relc[6].push(r7(r.ci_lo));
        relc[7].push(r7(r.ci_hi));
    }

    let models: Vec<Value> = model_ids
        .iter()
        .enumerate()
        .map(|(i, id)| {
            let family = registry::lookup(id).map(|m| m.family.as_str()).unwrap_or("BASELINE");
            json!({ "id": id, "family": family, "dist": has_dist[i], "p": has_p[i] })
        })
        .collect();
    let ts: Vec<f64> = bars.iter().map(|b| b.ts_close as f64).collect();
    let open: Vec<f64> = bars.iter().map(|b| b.open).collect();
    let high: Vec<f64> = bars.iter().map(|b| b.high).collect();
    let low: Vec<f64> = bars.iter().map(|b| b.low).collect();
    let close: Vec<f64> = bars.iter().map(|b| b.close).collect();
    let e = &ctx.cfg.eval;
    let legacy = legacy_block(ctx, &origins, stride)?;
    Ok(json!({
        "meta": {
            "run_id": manifest.run_id,
            "created_utc": manifest.created_utc,
            "code_version": manifest.code_version,
            "symbol": manifest.symbol,
            "timeframe": manifest.timeframe,
            "profile": manifest.profile,
            "seed": manifest.seed,
            "n_bars": manifest.data.rows,
            "first_utc": manifest.data.first_utc,
            "last_utc": manifest.data.last_utc,
            "n_gaps": manifest.data.n_gaps,
            "holdout_opened": manifest.holdout_opened,
            "notes": manifest.notes,
            "data_hash": manifest.data.logical_hash,
            "split_lock_hash": manifest.split_lock_hash,
            "schema_version": manifest.schema_version,
            "support": e.support,
            "ci_level": e.ci_level,
            "block_mult": e.block_mult,
            "block_min": e.block_min,
            "bootstrap_reps": e.bootstrap_reps,
            "warn_n_over_h": e.warn_n_over_h,
            "tables": manifest.tables.iter().map(|t| json!({
                "name": t.name, "rows": t.rows, "hash": t.logical_hash
            })).collect::<Vec<_>>(),
        },
        "split": {
            "warm_end": split.warm_end,
            "eval_start": split.eval_start,
            "holdout_start": split.holdout_start,
            "data_end": split.data_end,
            "h_star": split.h_star,
            "h_star_requested": split.h_star_requested,
            "m_target": split.m_target,
            "folds": split.folds.iter().map(|f| json!([f.test_start, f.test_end])).collect::<Vec<_>>(),
        },
        "grid": gh,
        "models": models,
        "horizons": { "n": n_h_rows, "warn": warn_h },
        "bars": {
            "n": bars.len(),
            "tf_secs": ctx.series.timeframe_secs,
            "ts": b64_f64(&ts),
            "open": b64_f64(&open),
            "high": b64_f64(&high),
            "low": b64_f64(&low),
            "close": b64_f64(&close),
        },
        "fc": { "origins": origins, "stride": stride, "ret_scale": RET_SCALE, "models": Value::Object(fc_models) },
        "legacy": legacy,
        "metrics": {
            "names": metric_names,
            "pk": pk_names,
            "m": dev[0], "b": dev[1], "h": dev[2], "k": dev[3], "p": dev[4], "v": dev[5],
            "lo": dev[6], "hi": dev[7], "sig": dev[8], "bl": dev[9], "hac": dev[10], "n": dev[11],
        },
        "folds": { "m": fold[0], "b": fold[1], "h": fold[2], "k": fold[3], "f": fold[4], "v": fold[5] },
        "exc": { "names": exc_names, "h": exc[0], "k": exc[1], "v": exc[2], "lo": exc[3], "hi": exc[4] },
        "rel": {
            "m": relc[0], "h": relc[1], "bin": relc[2], "p": relc[3], "y": relc[4], "n": relc[5],
            "lo": relc[6], "hi": relc[7],
        },
    }))
}

/// Bloc du script Pine porté : chemins typiques, état par origine, mesures par pas.
/// `Null` si le run n'a pas de modèle legacy.
fn legacy_block(ctx: &Ctx, origins: &[u32], stride: usize) -> Result<Value> {
    use crate::eval::paths::{PATH_MODELS, SLICES};
    let (pp, sp) = (ctx.run_dir.join("legacy_paths.parquet"), ctx.run_dir.join("legacy_state.parquet"));
    let (mp, lp) = (ctx.run_dir.join("path_metrics.parquet"), ctx.run_dir.join("path_select.parquet"));
    if !(pp.exists() && sp.exists() && mp.exists() && lp.exists()) {
        return Ok(Value::Null);
    }
    let paths = read_table(&pp, "legacy_paths")?;
    let state = read_table(&sp, "legacy_state")?;
    let s_bar = state.u32("bar_idx")?;
    let n_all = s_bar.len();
    if n_all == 0 {
        return Ok(Value::Null);
    }
    let h = paths.n_rows() / n_all;
    let kept: Vec<usize> = (0..n_all).filter(|o| o % stride == 0).collect();
    if kept.iter().map(|o| s_bar[*o]).ne(origins.iter().copied()) {
        return Err(Error::Schema("les origines legacy ne sont pas celles des prévisions".into()));
    }
    let col = |name: &str| -> Result<Vec<f64>> {
        let c = paths.f64(name)?;
        Ok(kept.iter().flat_map(|o| c[o * h..(o + 1) * h].iter().copied()).collect())
    };
    let st = |name: &str| -> Result<Vec<Value>> {
        let c = state.f64(name)?;
        Ok(kept.iter().map(|o| r5(c[*o])).collect())
    };
    let st_opt = |name: &str| -> Result<Vec<Value>> {
        let c = state.nf64(name)?;
        Ok(kept.iter().map(|o| c[*o].map(r5).unwrap_or(Value::Null)).collect())
    };
    let dir = state.i8("dir_regime")?;
    let scen = state.u8("scenario")?;
    let mk = state.u8("mk_state")?;
    let age = state.u32("regime_age")?;
    let mut factors = Vec::new();
    for f in ["f_d", "f_v", "f_r", "f_a", "f_m", "f_z"] {
        factors.push(Value::Array(st(f)?));
    }

    // --- mesures par pas : tableaux denses, un par (métrique, chemin, tranche)
    let pm = read_table(&mp, "path_metrics")?;
    let (m_id, sl, scope) = (pm.str("model_id")?, pm.str("slice")?, pm.str("scope")?);
    let (step, metric, value) = (pm.u16("step")?, pm.str("metric")?, pm.f64("value")?);
    let (lo, hi, sig, n_obs) = (pm.nf64("ci_lo")?, pm.nf64("ci_hi")?, pm.nbool("significant")?, pm.u32("n_obs")?);
    const SHOWN: [&str; 5] = ["hit", "hit_edge", "ic", "mae_skill", "mae_gain"];
    let mut v_map = serde_json::Map::new();
    let mut lo_map = serde_json::Map::new();
    let mut hi_map = serde_json::Map::new();
    let mut sig_map = serde_json::Map::new();
    let mut n_map = serde_json::Map::new();
    let mut fold_map = serde_json::Map::new();
    let grid = &ctx.cfg.horizons.grid;
    let n_folds = ctx.split.folds.len();
    let dense = |map: &mut serde_json::Map<String, Value>, key: &str, k: usize, val: Value| {
        let e = map.entry(key.to_string()).or_insert_with(|| Value::Array(vec![Value::Null; h]));
        if let Value::Array(a) = e {
            a[k - 1] = val;
        }
    };
    for i in 0..pm.n_rows() {
        if !SHOWN.contains(&metric[i].as_str()) {
            continue;
        }
        let k = step[i] as usize;
        let key = format!("{}|{}|{}", metric[i], m_id[i], sl[i]);
        if scope[i] == "dev" {
            dense(&mut v_map, &key, k, r5(value[i]));
            if let (Some(a), Some(b)) = (lo[i], hi[i]) {
                dense(&mut lo_map, &key, k, r5(a));
                dense(&mut hi_map, &key, k, r5(b));
            }
            if let Some(sg) = sig[i] {
                dense(&mut sig_map, &key, k, json!(sg as u8));
            }
            if metric[i] == "hit" && m_id[i] == PATH_MODELS[0] {
                dense(&mut n_map, &sl[i], k, json!(n_obs[i]));
            }
        } else if let Some(f) = scope[i].strip_prefix("fold_") {
            // par pli : seulement aux pas de la grille, pour la carte de stabilité
            if let (Ok(f), Some(g)) = (f.parse::<usize>(), grid.iter().position(|x| *x as usize == k)) {
                if ["hit", "hit_edge", "ic"].contains(&metric[i].as_str()) && f < n_folds {
                    let key = format!("{}|{}", metric[i], m_id[i]);
                    let e = fold_map
                        .entry(key)
                        .or_insert_with(|| Value::Array(vec![Value::Array(vec![Value::Null; grid.len()]); n_folds]));
                    if let Value::Array(rows) = e {
                        if let Value::Array(r) = &mut rows[f] {
                            r[g] = r5(value[i]);
                        }
                    }
                }
            }
        }
    }
    let ps = read_table(&lp, "path_select")?;
    let sel: Vec<Value> = (0..ps.n_rows())
        .map(|i| {
            Ok(json!({
                "model": ps.str("model_id")?[i], "crit": ps.str("criterion")?[i], "fold": ps.u16("fold")?[i],
                "step": ps.u16("step_star")?[i], "ins": r5(ps.f64("in_sample")?[i]), "hit": r5(ps.f64("hit_oos")?[i]),
                "ref": r5(ps.f64("ref_hit_oos")?[i]), "n": ps.u32("n_oos")?[i],
            }))
        })
        .collect::<Result<_>>()?;

    Ok(json!({
        "model": crate::legacy::MODEL_ID,
        "h": h,
        "ret_scale": RET_SCALE,
        "wick_scale": WICK_SCALE,
        "typ": b64_i16(col("typical")?.into_iter(), RET_SCALE),
        "bb": b64_i16(col("backbone")?.into_iter(), RET_SCALE),
        "sig": b64_u16(col("sigma_path")?.into_iter(), RET_SCALE),
        "wu": b64_u8(col("wick_up")?.into_iter(), WICK_SCALE),
        "wd": b64_u8(col("wick_dn")?.into_iter(), WICK_SCALE),
        "state": {
            "dir": kept.iter().map(|o| dir[*o]).collect::<Vec<_>>(),
            "age": kept.iter().map(|o| age[*o]).collect::<Vec<_>>(),
            "scen": kept.iter().map(|o| scen[*o]).collect::<Vec<_>>(),
            "mk": kept.iter().map(|o| mk[*o]).collect::<Vec<_>>(),
            "vol": st("vol_ratio")?,
            "stable": st("stable_score")?,
            "raw": st("raw_score")?,
            "dstate": st("d_state")?,
            "f": factors,
            "comp": st("compression")?,
            "final_r": st("final_r")?,
            "p_up": st("p_up")?,
            "conf": st("confidence")?,
            "sup_lo": st_opt("sup_lo")?, "sup_hi": st_opt("sup_hi")?,
            "res_lo": st_opt("res_lo")?, "res_hi": st_opt("res_hi")?,
        },
        "pm": {
            "models": PATH_MODELS, "slices": SLICES, "metrics": SHOWN,
            "v": v_map, "lo": lo_map, "hi": hi_map, "sig": sig_map, "n": n_map, "folds": fold_map,
            "vol_low": crate::eval::paths::VOL_LOW, "vol_high": crate::eval::paths::VOL_HIGH,
        },
        "select": sel,
    }))
}

/// Page sans squelette de document : titre, styles, contenu et script.
pub fn render_fragment(data: &Value) -> Result<String> {
    if !TEMPLATE.contains(MARKER) {
        return Err(Error::Other("gabarit du tableau de bord sans emplacement de données".into()));
    }
    // « </ » ne doit pas apparaître dans un bloc <script> : il le fermerait.
    let payload = serde_json::to_string(data)?.replace("</", "<\\/");
    Ok(TEMPLATE.replacen(MARKER, &payload, 1))
}

/// Page autonome, lisible hors ligne dans un navigateur.
pub fn render_standalone(data: &Value) -> Result<String> {
    Ok(format!(
        "<!doctype html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n</head>\n<body>\n{}\n</body>\n</html>\n",
        render_fragment(data)?
    ))
}

/// Écrit `report/dashboard.html` dans le dossier du run, et sa variante sans squelette si demandée.
pub fn export(ctx: &Ctx, manifest: &Manifest, fragment: bool) -> Result<Vec<PathBuf>> {
    let data = build_data(ctx, manifest)?;
    let dir = ctx.run_dir.join("report");
    std::fs::create_dir_all(&dir)?;
    let mut out = Vec::new();
    let p = dir.join("dashboard.html");
    std::fs::write(&p, render_standalone(&data)?)?;
    out.push(p);
    if fragment {
        let p = dir.join("dashboard.fragment.html");
        std::fs::write(&p, render_fragment(&data)?)?;
        out.push(p);
    }
    Ok(out)
}

/// Empreinte courte des données d'une page, pour les tests.
pub fn data_fingerprint(data: &Value) -> String {
    hex(&blake3::hash(data.to_string().as_bytes()).as_bytes()[..8])
}

/// Chemin du tableau de bord d'un run.
pub fn path_in(run_dir: &Path) -> PathBuf {
    run_dir.join("report").join("dashboard.html")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_known_vectors() {
        assert_eq!(b64(b""), "");
        assert_eq!(b64(b"f"), "Zg==");
        assert_eq!(b64(b"fo"), "Zm8=");
        assert_eq!(b64(b"foo"), "Zm9v");
        assert_eq!(b64(b"foobar"), "Zm9vYmFy");
        assert_eq!(b64_i16([1.0, -0.0002].into_iter(), 1e-4), b64(&[0x10, 0x27, 0xfe, 0xff]));
        assert_eq!(b64_u8([0.0105, 9.0].into_iter(), 1e-3), b64(&[11, 255]));
    }

    #[test]
    fn rounding_keeps_seven_digits() {
        assert_eq!(r7(0.123456789), json!(0.1234568));
        assert_eq!(r7(-1234.56789), json!(-1234.568));
        assert_eq!(r7(f64::NAN), Value::Null);
    }
}
