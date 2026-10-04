//! Rapport : tables finales en CSV et en Markdown. Aucune statistique n'est calculée ici.

pub mod dashboard;

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use crate::error::Result;
use crate::eval::{MetricRow, ReliabilityRow};
use crate::io::manifest::Manifest;
use crate::wf::split::Split;

type Key<'a> = (&'a str, Option<&'a str>, u16, &'a str, &'a str, Option<&'a str>);

struct Index<'a> {
    map: BTreeMap<Key<'a>, &'a MetricRow>,
}

impl<'a> Index<'a> {
    fn new(rows: &'a [MetricRow]) -> Self {
        let mut map = BTreeMap::new();
        for r in rows {
            map.insert(
                (
                    r.model_id.as_str(),
                    r.baseline_id.as_deref(),
                    r.horizon,
                    r.scope.as_str(),
                    r.metric.as_str(),
                    r.point_kind.as_deref(),
                ),
                r,
            );
        }
        Self { map }
    }
    fn get<'b>(
        &'b self,
        model: &'b str,
        base: Option<&'b str>,
        h: u16,
        scope: &'b str,
        metric: &'b str,
        pk: Option<&'b str>,
    ) -> Option<&'b MetricRow>
    where
        'a: 'b,
    {
        let map: &'b BTreeMap<Key<'b>, &'b MetricRow> = &self.map;
        map.get(&(model, base, h, scope, metric, pk)).copied()
    }
}

fn opt(v: Option<f64>) -> String {
    v.map(|x| format!("{x:?}")).unwrap_or_default()
}

fn write_metrics_csv(path: &Path, rows: &[MetricRow], scope_filter: impl Fn(&str) -> bool) -> Result<()> {
    let mut w = csv::Writer::from_path(path)?;
    w.write_record([
        "model_id", "baseline_id", "horizon", "scope", "support", "metric", "point_kind", "value",
        "ci_lo", "ci_hi", "block_len", "hac_se", "significant", "n_obs", "n_over_h", "ess_acf",
        "warn_low_n",
    ])?;
    for r in rows.iter().filter(|r| scope_filter(&r.scope)) {
        w.write_record([
            r.model_id.clone(),
            r.baseline_id.clone().unwrap_or_default(),
            r.horizon.to_string(),
            r.scope.clone(),
            r.support.clone(),
            r.metric.clone(),
            r.point_kind.clone().unwrap_or_default(),
            format!("{:?}", r.value),
            opt(r.ci_lo),
            opt(r.ci_hi),
            r.block_len.map(|x| x.to_string()).unwrap_or_default(),
            opt(r.hac_se),
            r.significant.map(|x| x.to_string()).unwrap_or_default(),
            r.n_obs.to_string(),
            r.n_over_h.to_string(),
            opt(r.ess_acf),
            r.warn_low_n.to_string(),
        ])?;
    }
    w.flush()?;
    Ok(())
}

/// Tableau Markdown modèles x horizons pour une métrique.
fn pivot(
    out: &mut String,
    ix: &Index,
    models: &[&str],
    horizons: &[u16],
    metric: &str,
    base: Option<&str>,
    pk: Option<&str>,
    fmt: &dyn Fn(&MetricRow) -> String,
) {
    let _ = write!(out, "| Modèle |");
    for h in horizons {
        let _ = write!(out, " H={h} |");
    }
    let _ = writeln!(out);
    let _ = write!(out, "| --- |");
    for _ in horizons {
        let _ = write!(out, " ---: |");
    }
    let _ = writeln!(out);
    for m in models {
        let cells: Vec<Option<&MetricRow>> =
            horizons.iter().map(|h| ix.get(m, base, *h, "dev", metric, pk)).collect();
        if cells.iter().all(|c| c.is_none()) {
            continue;
        }
        let _ = write!(out, "| `{m}` |");
        for c in cells {
            let _ = write!(out, " {} |", c.map(fmt).unwrap_or_else(|| "—".into()));
        }
        let _ = writeln!(out);
    }
    let _ = writeln!(out);
}

fn pct(r: &MetricRow) -> String {
    let star = if r.significant == Some(true) { "\\*" } else { "" };
    format!("{:+.1} %{star}", 100.0 * r.value)
}

/// Écrit le rapport dans `<run_dir>/report/` et renvoie les fichiers produits.
pub fn write_report(
    run_dir: &Path,
    manifest: &Manifest,
    split: &Split,
    metrics: &[MetricRow],
    reliability: &[ReliabilityRow],
) -> Result<Vec<PathBuf>> {
    let dir = run_dir.join("report");
    std::fs::create_dir_all(&dir)?;
    let mut files = Vec::new();

    let p = dir.join("metrics_dev.csv");
    write_metrics_csv(&p, metrics, |s| s == "dev")?;
    files.push(p);
    let p = dir.join("metrics_folds.csv");
    write_metrics_csv(&p, metrics, |s| s.starts_with("fold_"))?;
    files.push(p);

    let p = dir.join("reliability.csv");
    {
        let mut w = csv::Writer::from_path(&p)?;
        w.write_record(["model_id", "horizon", "scope", "bin", "p_mean", "y_freq", "n", "ci_lo", "ci_hi"])?;
        for r in reliability {
            w.write_record([
                r.model_id.clone(),
                r.horizon.to_string(),
                r.scope.clone(),
                r.bin.to_string(),
                format!("{:?}", r.p_mean),
                format!("{:?}", r.y_freq),
                r.n.to_string(),
                format!("{:?}", r.ci_lo),
                format!("{:?}", r.ci_hi),
            ])?;
        }
        w.flush()?;
    }
    files.push(p);

    // --- synthèse Markdown
    let ix = Index::new(metrics);
    let horizons: Vec<u16> =
        metrics.iter().map(|r| r.horizon).collect::<BTreeSet<_>>().into_iter().collect();
    let models: Vec<&str> = manifest.models.iter().map(|s| s.as_str()).collect();
    let mut s = String::new();
    let _ = writeln!(s, "# EVMC : rapport du run {}\n", manifest.run_id);
    let _ = writeln!(
        s,
        "- Données : {} {}, {} barres, du {} au {}, {} trou(s).",
        manifest.symbol,
        manifest.timeframe,
        manifest.data.rows,
        manifest.data.first_utc,
        manifest.data.last_utc,
        manifest.data.n_gaps
    );
    let _ = writeln!(
        s,
        "- Découpage : warm-up [0, {}), amorçage [{}, {}), zone notée [{}, {}) en {} plis, holdout [{}, {}) {}.",
        split.warm_end,
        split.warm_end,
        split.eval_start,
        split.eval_start,
        split.holdout_start,
        split.folds.len(),
        split.holdout_start,
        split.data_end,
        if manifest.holdout_opened { "ouvert" } else { "verrouillé" }
    );
    let _ = writeln!(
        s,
        "- Profil de simulation : {} ; seed {} ; code {}.",
        manifest.profile, manifest.seed, manifest.code_version
    );
    for n in &manifest.notes {
        let _ = writeln!(s, "- {n}.");
    }
    let _ = writeln!(
        s,
        "\nLecture : un skill positif signifie que le modèle bat la baseline. L'astérisque marque une \
         différence appariée dont l'intervalle par blocs exclut 0 aux trois longueurs de bloc. \
         Les intervalles complets sont dans `metrics_dev.csv`.\n"
    );

    let _ = writeln!(s, "## Lignes notées par horizon\n");
    let _ = writeln!(s, "| Horizon | Lignes | n / H (diagnostic) | Avertissement |");
    let _ = writeln!(s, "| ---: | ---: | ---: | --- |");
    for h in &horizons {
        if let Some(r) = metrics.iter().find(|r| r.horizon == *h && r.scope == "dev") {
            let _ = writeln!(
                s,
                "| {} | {} | {} | {} |",
                h,
                r.n_obs,
                r.n_over_h,
                if r.warn_low_n { "peu de fenêtres disjointes" } else { "" }
            );
        }
    }
    let _ = writeln!(s);

    let has = |id: &str| models.contains(&id);
    if has("b2_clim") {
        let _ = writeln!(s, "## CRPS : skill contre la climatologie (`b2_clim`)\n");
        pivot(&mut s, &ix, &models, &horizons, "crps_skill", Some("b2_clim"), None, &pct);
    }
    if has("b7_garch_fhs") {
        let _ = writeln!(s, "## CRPS : skill contre le moteur neutre (`b7_garch_fhs`)\n");
        pivot(&mut s, &ix, &models, &horizons, "crps_skill", Some("b7_garch_fhs"), None, &pct);
    }
    if has("b1_coin") {
        let _ = writeln!(s, "## Brier : skill contre pile ou face (`b1_coin`)\n");
        pivot(&mut s, &ix, &models, &horizons, "brier_skill", Some("b1_coin"), None, &pct);
    }
    let _ = writeln!(s, "## Couverture de l'intervalle à 90 % (nominal : 90 %)\n");
    pivot(&mut s, &ix, &models, &horizons, "cov90", None, None, &|r| {
        format!("{:.1} %", 100.0 * r.value)
    });
    let _ = writeln!(s, "## Largeur moyenne de l'intervalle à 90 % (log-rendement, en %)\n");
    pivot(&mut s, &ix, &models, &horizons, "width90", None, None, &|r| {
        format!("{:.2}", 100.0 * r.value)
    });
    let _ = writeln!(s, "## Écart-type de l'erreur normalisée z (attendu : 1)\n");
    pivot(&mut s, &ix, &models, &horizons, "z_std", None, None, &|r| format!("{:.3}", r.value));
    let _ = writeln!(s, "## Biais de la moyenne prédite (log-rendement, en %)\n");
    pivot(&mut s, &ix, &models, &horizons, "bias", None, Some("mean"), &|r| {
        format!("{:+.3}", 100.0 * r.value)
    });

    if has("b2_clim") {
        let _ = writeln!(
            s,
            "## Stabilité : plis où le skill CRPS contre `b2_clim` est positif\n"
        );
        let _ = write!(s, "| Modèle |");
        for h in &horizons {
            let _ = write!(s, " H={h} |");
        }
        let _ = writeln!(s);
        let _ = write!(s, "| --- |");
        for _ in &horizons {
            let _ = write!(s, " ---: |");
        }
        let _ = writeln!(s);
        for m in &models {
            let mut line = format!("| `{m}` |");
            let mut any = false;
            for h in &horizons {
                let (mut pos, mut tot) = (0, 0);
                for f in &split.folds {
                    let scope = format!("fold_{}", f.id);
                    if let Some(r) = metrics.iter().find(|r| {
                        r.model_id == *m
                            && r.horizon == *h
                            && r.scope == scope
                            && r.metric == "crps_skill"
                            && r.baseline_id.as_deref() == Some("b2_clim")
                    }) {
                        tot += 1;
                        pos += (r.value > 0.0) as usize;
                    }
                }
                if tot > 0 {
                    any = true;
                    let _ = write!(line, " {pos}/{tot} |");
                } else {
                    let _ = write!(line, " — |");
                }
            }
            if any {
                let _ = writeln!(s, "{line}");
            }
        }
        let _ = writeln!(s);
    }

    let _ = writeln!(
        s,
        "## Excursions d'une position longue, en unités de sigma_H (quantiles 50 / 75 / 90)\n"
    );
    let _ = writeln!(s, "| Horizon | MFE | MAE | MAE avant le MFE (borne stricte) | MAE avant le MFE (borne inclusive) |");
    let _ = writeln!(s, "| ---: | --- | --- | --- | --- |");
    for h in &horizons {
        let tri = |name: &str| -> String {
            let q: Vec<String> = ["q50", "q75", "q90"]
                .iter()
                .map(|t| {
                    let metric = format!("{name}_{t}");
                    metrics
                        .iter()
                        .find(|r| {
                            r.model_id == "_outcomes"
                                && r.horizon == *h
                                && r.scope == "dev"
                                && r.metric == metric
                        })
                        .map(|r| format!("{:.2}", r.value))
                        .unwrap_or_else(|| "—".into())
                })
                .collect();
            q.join(" / ")
        };
        let _ = writeln!(
            s,
            "| {} | {} | {} | {} | {} |",
            h,
            tri("long_mfe_sig_h"),
            tri("long_mae_sig_h"),
            tri("long_mae_pre_strict_sig_h"),
            tri("long_mae_pre_incl_sig_h")
        );
    }
    let _ = writeln!(s);

    let p = dir.join("summary.md");
    std::fs::write(&p, s)?;
    files.push(p);
    Ok(files)
}
