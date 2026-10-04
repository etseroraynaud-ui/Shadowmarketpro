//! Enchaînement des étapes. Chaque étape lit des tables figées et en écrit une seule ;
//! elle est idempotente et mise en cache par hash de ses entrées, de la section de
//! configuration concernée et de la version du code.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::data::{loader, BarSeries};
use crate::error::{Error, Result};
use crate::eval;
use crate::features::FeatureFrame;
use crate::forecast::engine::{self, EngineStats};
use crate::forecast::record as frecord;
use crate::io::manifest::{self, DataInfo, Manifest, TableInfo};
use crate::io::parquet::{read_table, write_table, SCHEMA_VERSION};
use crate::io::table::{hex, Table};
use crate::legacy::{self, LegacyParams, Market};
use crate::outcome;
use crate::sim::rng::DERIVATION_VERSION;
use crate::wf::split::Split;

/// Contexte d'un run : configuration résolue, données validées, découpage figé.
pub struct Ctx {
    pub cfg: Config,
    pub series: BarSeries,
    pub split: Split,
    pub run_id: String,
    pub run_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub holdout_opened: bool,
    pub threads: usize,
    pub verbose: bool,
    /// Entrées du port du script Pine, si le modèle `legacy_full` est activé.
    pub legacy: Option<LegacyInputs>,
}

/// Réglages du script et barres de 4 heures servant à l'ancre de VWAP « 4h ».
pub struct LegacyInputs {
    pub params: LegacyParams,
    pub aux_4h: Option<BarSeries>,
}

impl LegacyInputs {
    /// Empreinte de ce qui détermine la sortie du port, en plus des barres du graphique.
    fn fingerprint(&self) -> String {
        format!(
            "{}|{}",
            Config::section_json(&self.params),
            self.aux_4h.as_ref().map(|a| hex(&a.logical_hash)).unwrap_or_default()
        )
    }
}

fn legacy_enabled(cfg: &Config) -> bool {
    cfg.models.enabled.iter().any(|m| m == legacy::MODEL_ID)
}

#[derive(Serialize, Deserialize)]
struct CacheMeta {
    rows: u64,
    logical_hash: String,
}

/// Résultat d'une étape : table, description pour le manifest, et indicateur de cache.
pub struct StepOut {
    pub table: Table,
    pub info: TableInfo,
    pub cached: bool,
}

pub fn load_series(cfg: &Config) -> Result<BarSeries> {
    loader::load_csv(
        Path::new(&cfg.data.path),
        &cfg.data.symbol,
        &cfg.data.timeframe,
        &cfg.data.ts_convention,
    )
}

fn step_key(step: &str, parts: &[String]) -> String {
    let mut h = blake3::Hasher::new();
    h.update(b"evmc.step.v1");
    for p in std::iter::once(&manifest::code_version())
        .chain(std::iter::once(&step.to_string()))
        .chain(parts.iter())
    {
        h.update(&(p.len() as u64).to_le_bytes());
        h.update(p.as_bytes());
    }
    hex(&h.finalize().as_bytes()[..12])
}

impl Ctx {
    /// Charge la configuration, les données et le lock de découpage.
    pub fn load(cfg: Config) -> Result<Ctx> {
        cfg.validate()?;
        let series = load_series(&cfg)?;
        let data_hash = hex(&series.logical_hash);
        let split =
            Split::load_lock(Path::new(&cfg.split.lock_file), &cfg, series.len() as u32, &data_hash)?;
        let legacy = if legacy_enabled(&cfg) {
            let params = LegacyParams::load(Path::new(&cfg.models.legacy_defaults))?;
            let aux_4h = match cfg.data.aux.iter().find(|a| matches!(crate::config::timeframe_secs(&a.timeframe), Ok(14_400))) {
                Some(a) => Some(loader::load_csv(Path::new(&a.path), &cfg.data.symbol, &a.timeframe, &cfg.data.ts_convention)?),
                None => None,
            };
            Some(LegacyInputs { params, aux_4h })
        } else {
            None
        };
        Ok(Self::assemble(cfg, series, split, legacy))
    }

    /// Construit un contexte à partir d'éléments déjà en mémoire (tests, fixtures).
    /// Si le port du Pine est activé, ses réglages sont ceux du fichier de la configuration
    /// quand il existe, sinon les valeurs par défaut du script.
    pub fn from_parts(cfg: Config, series: BarSeries, split: Split) -> Ctx {
        let legacy = legacy_enabled(&cfg).then(|| LegacyInputs {
            params: LegacyParams::load(Path::new(&cfg.models.legacy_defaults))
                .unwrap_or_else(|_| LegacyParams::pine_defaults()),
            aux_4h: None,
        });
        Self::assemble(cfg, series, split, legacy)
    }

    fn assemble(cfg: Config, series: BarSeries, split: Split, legacy: Option<LegacyInputs>) -> Ctx {
        let data_hash = match &legacy {
            Some(l) => format!("{}|{}", hex(&series.logical_hash), l.fingerprint()),
            None => hex(&series.logical_hash),
        };
        let run_id = manifest::run_id(&cfg, &data_hash, &split.lock_hash);
        let out = PathBuf::from(&cfg.output.dir);
        let threads = cfg.run.threads;
        Ctx {
            run_dir: out.join(&run_id),
            cache_dir: out.join("cache"),
            cfg,
            series,
            split,
            run_id,
            holdout_opened: false,
            threads,
            verbose: false,
            legacy,
        }
    }

    fn log(&self, msg: &str) {
        if self.verbose {
            eprintln!("{msg}");
        }
    }

    fn data_hash(&self) -> String {
        hex(&self.series.logical_hash)
    }

    /// Exécute `compute` sauf si le résultat de même clé est déjà en cache,
    /// puis relie la table au dossier du run.
    fn cached(
        &self,
        step: &str,
        name: &str,
        parts: &[String],
        compute: impl FnOnce() -> Result<Table>,
    ) -> Result<StepOut> {
        let key = step_key(step, parts);
        let file = self.cache_dir.join(format!("{name}-{key}.parquet"));
        let meta_file = self.cache_dir.join(format!("{name}-{key}.json"));
        let t0 = std::time::Instant::now();
        let (table, meta, hit) = if file.exists() && meta_file.exists() {
            let meta: CacheMeta = serde_json::from_str(&std::fs::read_to_string(&meta_file)?)?;
            (read_table(&file, name)?, meta, true)
        } else {
            let table = compute()?;
            table.validate()?;
            let meta = CacheMeta {
                rows: table.n_rows() as u64,
                logical_hash: hex(&table.logical_hash()),
            };
            write_table(
                &file,
                &table,
                &self.cfg.output.compression,
                &[("evmc.step_key", key.clone()), ("evmc.logical_hash", meta.logical_hash.clone())],
            )?;
            std::fs::write(&meta_file, serde_json::to_string(&meta)?)?;
            (table, meta, false)
        };
        std::fs::create_dir_all(&self.run_dir)?;
        let dest = self.run_dir.join(format!("{name}.parquet"));
        if dest.exists() {
            std::fs::remove_file(&dest)?;
        }
        if std::fs::hard_link(&file, &dest).is_err() {
            std::fs::copy(&file, &dest)?;
        }
        self.log(&format!(
            "[{step}] {name} : {} lignes, {} ({:.1} s)",
            meta.rows,
            if hit { "cache" } else { "calculé" },
            t0.elapsed().as_secs_f64()
        ));
        Ok(StepOut {
            table,
            info: TableInfo {
                name: name.to_string(),
                file: format!("{name}.parquet"),
                rows: meta.rows,
                logical_hash: meta.logical_hash,
                step_key: key,
            },
            cached: hit,
        })
    }

    pub fn step_features(&self) -> Result<StepOut> {
        let parts = vec![
            self.data_hash(),
            Config::section_json(&self.cfg.vol),
            self.split.lock_hash.clone(),
        ];
        self.cached("features", "features", &parts, || {
            Ok(FeatureFrame::build(&self.series, &self.cfg, &self.split).to_table())
        })
    }

    pub fn step_outcomes(&self, features: &StepOut) -> Result<StepOut> {
        let parts = vec![
            self.data_hash(),
            features.info.logical_hash.clone(),
            self.split.lock_hash.clone(),
            Config::section_json(&self.cfg.horizons),
            self.holdout_opened.to_string(),
        ];
        self.cached("outcomes", "outcomes", &parts, || {
            let feats = FeatureFrame::from_table(&features.table)?;
            let grid = self.cfg.grid()?;
            let rows = outcome::build(&self.series, &feats, &self.split, &grid, self.holdout_opened)?;
            Ok(outcome::to_table(&rows))
        })
    }

    pub fn step_forecast(
        &self,
        features: &StepOut,
        legacy_dist: Option<&StepOut>,
    ) -> Result<(StepOut, Option<EngineStats>)> {
        let parts = vec![
            legacy_dist.map(|l| l.info.logical_hash.clone()).unwrap_or_default(),
            self.data_hash(),
            features.info.logical_hash.clone(),
            self.split.lock_hash.clone(),
            Config::section_json(&self.cfg.horizons),
            self.cfg.run.seed.to_string(),
            Config::section_json(&self.cfg.profile()?),
            Config::section_json(&self.cfg.models),
            Config::section_json(&self.cfg.vol),
            Config::section_json(&self.cfg.alpha),
            self.holdout_opened.to_string(),
        ];
        let mut stats = None;
        let out = self.cached("forecast", "forecasts", &parts, || {
            let feats = FeatureFrame::from_table(&features.table)?;
            let mut res = engine::run(&self.series, &feats, &self.split, &self.cfg, self.holdout_opened)?;
            stats = Some(res.stats.clone());
            if let Some(l) = legacy_dist {
                let rows = frecord::legacy_records(&l.table)?;
                for r in &rows {
                    crate::forecast::invariants::check(r)?;
                }
                res.records.extend(rows);
            }
            Ok(frecord::to_table(res.records))
        })?;
        Ok((out, stats))
    }

    /// Port du script Pine : chemins, état par origine et loi simulée, issus d'un même calcul.
    pub fn step_legacy(&self) -> Result<Option<[StepOut; 3]>> {
        let Some(inp) = &self.legacy else { return Ok(None) };
        let parts = vec![
            self.data_hash(),
            inp.fingerprint(),
            Config::section_json(&self.cfg.legacy),
            self.cfg.data.timeframe.clone(),
            self.split.lock_hash.clone(),
            Config::section_json(&self.cfg.horizons),
            self.holdout_opened.to_string(),
        ];
        let names = ["legacy_paths", "legacy_state", "legacy_dist"];
        let key = step_key("legacy", &parts);
        let all_cached = names.iter().all(|n| self.cache_dir.join(format!("{n}-{key}.parquet")).exists());
        let mut tables: [Option<Table>; 3] = [None, None, None];
        if !all_cached {
            let t0 = std::time::Instant::now();
            let end = if self.holdout_opened { self.split.data_end } else { self.split.holdout_start } as usize;
            let start = self.split.eval_start as usize;
            let h = inp.params.i_H;
            let steps: Vec<usize> =
                self.cfg.horizons.grid.iter().map(|g| *g as usize).filter(|g| *g <= h).collect();
            let market = Market {
                tf_secs: self.series.timeframe_secs,
                h24: self.cfg.legacy.h24,
                mintick: self.cfg.legacy.mintick,
            };
            // Les barres de 4 heures postérieures à la dernière barre parcourue ne sont pas lues.
            let last_close = self.series.bars[end - 1].ts_close;
            let aux: Option<&[crate::data::Bar]> = inp.aux_4h.as_ref().map(|a| {
                let n = a.bars.partition_point(|b| b.ts_close <= last_close);
                &a.bars[..n]
            });
            let run = legacy::run(&self.series.bars, aux, market, &inp.params, start, end, &steps);
            self.log(&format!(
                "[legacy] {} origines projetées, {} non prêtes : {:.1} s",
                run.origins.len(),
                run.n_not_ready,
                t0.elapsed().as_secs_f64()
            ));
            if run.n_not_ready > 0 {
                return Err(Error::Other(format!(
                    "port legacy : {} origine(s) sans projection, le warm-up est trop court",
                    run.n_not_ready
                )));
            }
            tables = [Some(legacy::paths_table(&run)), Some(legacy::state_table(&run)), Some(legacy::dist_table(&run))];
        }
        let missing = || Error::Other("cache legacy incomplet".into());
        let [a, b, c] = tables;
        let p = self.cached("legacy", names[0], &parts, || a.ok_or_else(missing))?;
        let s = self.cached("legacy", names[1], &parts, || b.ok_or_else(missing))?;
        let d = self.cached("legacy", names[2], &parts, || c.ok_or_else(missing))?;
        Ok(Some([p, s, d]))
    }

    /// Évaluation du chemin typique, pas par pas et par régime.
    pub fn step_paths(&self, legacy: &[StepOut; 3]) -> Result<[StepOut; 2]> {
        let parts = vec![
            legacy[0].info.logical_hash.clone(),
            legacy[1].info.logical_hash.clone(),
            self.data_hash(),
            self.split.lock_hash.clone(),
            Config::section_json(&self.cfg.eval),
            Config::section_json(&self.cfg.horizons),
            self.cfg.run.seed.to_string(),
            self.holdout_opened.to_string(),
        ];
        let names = ["path_metrics", "path_select"];
        let key = step_key("paths", &parts);
        let all_cached = names.iter().all(|n| self.cache_dir.join(format!("{n}-{key}.parquet")).exists());
        let mut tables: [Option<Table>; 2] = [None, None];
        if !all_cached {
            let t0 = std::time::Instant::now();
            let ev = eval::paths::evaluate(
                &legacy[0].table,
                &legacy[1].table,
                &self.series,
                &self.split,
                &self.cfg.eval,
                &self.cfg.horizons.grid,
                self.cfg.run.seed,
                self.holdout_opened,
            )?;
            self.log(&format!("[paths] calcul : {:.1} s", t0.elapsed().as_secs_f64()));
            tables = [Some(eval::paths::metrics_table(&ev.metrics)), Some(eval::paths::select_table(&ev.select))];
        }
        let missing = || Error::Other("cache des chemins incomplet".into());
        let [a, b] = tables;
        let m = self.cached("paths", names[0], &parts, || a.ok_or_else(missing))?;
        let s = self.cached("paths", names[1], &parts, || b.ok_or_else(missing))?;
        Ok([m, s])
    }

    /// Évaluation : trois tables issues d'un même calcul.
    pub fn step_evaluate(&self, forecasts: &StepOut, outcomes: &StepOut) -> Result<[StepOut; 3]> {
        let parts = vec![
            forecasts.info.logical_hash.clone(),
            outcomes.info.logical_hash.clone(),
            self.split.lock_hash.clone(),
            Config::section_json(&self.cfg.eval),
            Config::section_json(&self.cfg.horizons),
            self.cfg.run.seed.to_string(),
            self.holdout_opened.to_string(),
        ];
        let key = step_key("evaluate", &parts);
        let all_cached = ["scores", "metrics", "reliability"]
            .iter()
            .all(|n| self.cache_dir.join(format!("{n}-{key}.parquet")).exists());
        let mut computed: Option<eval::EvalOutput> = None;
        let t0 = std::time::Instant::now();
        if !all_cached {
            let outs = outcome::from_table(&outcomes.table)?;
            computed = Some(eval::evaluate(
                &forecasts.table,
                &outs,
                &self.split,
                &self.cfg,
                self.holdout_opened,
            )?);
        }
        if computed.is_some() {
            self.log(&format!("[evaluate] calcul : {:.1} s", t0.elapsed().as_secs_f64()));
        }
        let mut scores_t = None;
        let mut metrics_t = None;
        let mut rel_t = None;
        if let Some(c) = computed {
            scores_t = Some(c.scores);
            metrics_t = Some(eval::metrics_to_table(&c.metrics));
            rel_t = Some(eval::reliability_to_table(&c.reliability));
        }
        let missing = || Error::Other("cache d'évaluation incomplet".into());
        let s = self.cached("evaluate", "scores", &parts, || scores_t.ok_or_else(missing))?;
        let m = self.cached("evaluate", "metrics", &parts, || metrics_t.ok_or_else(missing))?;
        let r = self.cached("evaluate", "reliability", &parts, || rel_t.ok_or_else(missing))?;
        Ok([s, m, r])
    }

    /// Écrit le manifest du run, en fusionnant avec les tables déjà consignées.
    pub fn write_manifest(&self, tables: &[TableInfo], notes: Vec<String>) -> Result<Manifest> {
        let path = self.run_dir.join("manifest.json");
        let mut all: Vec<TableInfo> = if path.exists() {
            Manifest::read(&path).map(|m| m.tables).unwrap_or_default()
        } else {
            Vec::new()
        };
        for t in tables {
            all.retain(|x| x.name != t.name);
            all.push(t.clone());
        }
        all.sort_by(|a, b| a.name.cmp(&b.name));
        let bars = &self.series.bars;
        let first = bars.first().map(|b| b.ts_close).unwrap_or(0);
        let last = bars.last().map(|b| b.ts_close).unwrap_or(0);
        let m = Manifest {
            run_id: self.run_id.clone(),
            created_utc: manifest::now_utc(),
            code_version: manifest::code_version(),
            cargo_lock_hash: manifest::cargo_lock_hash(),
            rustc: manifest::rustc_version().to_string(),
            target: manifest::target_triple().to_string(),
            schema_version: SCHEMA_VERSION,
            seed: self.cfg.run.seed,
            rng_derivation: DERIVATION_VERSION.to_string(),
            symbol: self.cfg.data.symbol.clone(),
            timeframe: self.cfg.data.timeframe.clone(),
            profile: self.cfg.run.profile.clone(),
            threads: self.threads,
            data: DataInfo {
                path: self.cfg.data.path.clone(),
                rows: bars.len() as u64,
                first_ts_close: first,
                last_ts_close: last,
                first_utc: loader::format_utc_ms(first),
                last_utc: loader::format_utc_ms(last),
                n_gaps: self.series.n_gaps(),
                logical_hash: self.data_hash(),
            },
            split_lock_hash: self.split.lock_hash.clone(),
            holdout_opened: self.holdout_opened,
            models: self.cfg.models.enabled.clone(),
            notes,
            tables: all,
            config: self.cfg.clone(),
        };
        m.write(&path)?;
        Ok(m)
    }
}

/// Résultat d'un run complet.
pub struct RunOutput {
    pub manifest: Manifest,
    pub stats: Option<EngineStats>,
    pub metrics: Table,
    pub reliability: Table,
}

/// Étapes 2 à 6 : features, outcomes, prévisions, évaluation. Le rapport est produit à part.
pub fn run_all(ctx: &Ctx) -> Result<RunOutput> {
    let features = ctx.step_features()?;
    let outcomes = ctx.step_outcomes(&features)?;
    let legacy = ctx.step_legacy()?;
    let (forecasts, stats) = ctx.step_forecast(&features, legacy.as_ref().map(|l| &l[2]))?;
    let [scores, metrics, reliability] = ctx.step_evaluate(&forecasts, &outcomes)?;
    let mut extra: Vec<TableInfo> = Vec::new();
    if let Some(l) = &legacy {
        let paths = ctx.step_paths(l)?;
        extra.extend(l.iter().map(|t| t.info.clone()));
        extra.extend(paths.iter().map(|t| t.info.clone()));
    }
    let mut notes = Vec::new();
    if let Some(s) = &stats {
        notes.push(format!(
            "simulation : {} origines, {} simulations, {} trajectoires, {} non convergées",
            s.n_origins, s.n_sim_jobs, s.total_paths, s.n_not_converged
        ));
    }
    let mut infos = vec![
        features.info,
        outcomes.info,
        forecasts.info,
        scores.info,
        metrics.info.clone(),
        reliability.info.clone(),
    ];
    infos.extend(extra);
    let manifest = ctx.write_manifest(&infos, notes)?;
    Ok(RunOutput { manifest, stats, metrics: metrics.table, reliability: reliability.table })
}

/// Ajoute un événement au registre des runs.
pub fn registry_append(out_dir: &Path, event: &str, run_id: &str) -> Result<()> {
    use std::io::Write;
    std::fs::create_dir_all(out_dir)?;
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(out_dir.join("registry.jsonl"))?;
    writeln!(
        f,
        "{}",
        serde_json::json!({"event": event, "run_id": run_id, "utc": manifest::now_utc()})
    )?;
    Ok(())
}

/// Recalcule les hash logiques des tables d'un run et les compare au manifest.
pub fn verify(run_dir: &Path) -> Result<Vec<(String, bool)>> {
    let m = Manifest::read(&run_dir.join("manifest.json"))?;
    let mut out = Vec::new();
    for t in &m.tables {
        let table = read_table(&run_dir.join(&t.file), &t.name)?;
        let ok = hex(&table.logical_hash()) == t.logical_hash && table.n_rows() as u64 == t.rows;
        out.push((t.name.clone(), ok));
    }
    Ok(out)
}
