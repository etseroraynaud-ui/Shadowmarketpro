//! Interface en ligne de commande.

use std::path::{Path, PathBuf};
use std::time::Instant;

use clap::{Args, Parser, Subcommand};

use evmc::config::Config;
use evmc::data::resample::Resampler;
use evmc::data::synth::{self, SynthSpec};
use evmc::data::{integrity, loader};
use evmc::error::{Error, Result};
use evmc::eval;
use evmc::features::FeatureFrame;
use evmc::forecast::engine::snapshot;
use evmc::io::manifest::{self, Manifest};
use evmc::io::table::hex;
use evmc::models::Plan;
use evmc::pipeline::{self, Ctx};
use evmc::report;
use evmc::sim::{simulate, ResidSpec, SimInput, Workspace};
use evmc::vol::term::cum_var;
use evmc::wf::split::Split;

#[derive(Parser)]
#[command(name = "evmc", version, about = "EVMC : prévisions probabilistes multi-horizon, notées contre des baselines")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Args, Clone)]
struct Common {
    /// Fichier de configuration TOML.
    #[arg(long, default_value = "configs/mvp.toml")]
    config: PathBuf,
    /// Profil de simulation : fast, normal ou validation.
    #[arg(long)]
    profile: Option<String>,
    /// Modèles à activer, séparés par des virgules.
    #[arg(long)]
    models: Option<String>,
    /// Nombre de threads (0 = tous les coeurs).
    #[arg(long)]
    threads: Option<usize>,
    /// Dossier de sortie.
    #[arg(long)]
    out: Option<String>,
}

#[derive(Subcommand)]
enum DataCmd {
    /// Contrôle d'intégrité et hash logique des données.
    Check(Common),
    /// Agrège des barres fines (à la minute, par exemple) vers un timeframe plus long.
    Resample {
        /// Fichier(s) CSV source, dans l'ordre chronologique. Répéter l'option pour en chaîner.
        #[arg(long, required = true)]
        input: Vec<PathBuf>,
        /// Fichier CSV à écrire (horodatage d'ouverture en millisecondes UTC).
        #[arg(long)]
        out: PathBuf,
        /// Timeframe de sortie : 1d, 4h, 1h, 15m…
        #[arg(long, default_value = "1d")]
        timeframe: String,
        /// Timeframe des barres source.
        #[arg(long, default_value = "1m")]
        source_timeframe: String,
        /// Convention d'horodatage de la source.
        #[arg(long, default_value = "open_utc_s")]
        ts_convention: String,
        /// Première date gardée, en UTC (AAAA-MM-JJ).
        #[arg(long)]
        from: Option<String>,
    },
}

#[derive(Subcommand)]
enum SplitCmd {
    /// Calcule le découpage et écrit le lock (une seule fois par jeu de données).
    Plan(Common),
    /// Affiche le découpage figé.
    Show(Common),
}

#[derive(Subcommand)]
enum Cmd {
    /// Données : contrôle d'intégrité.
    Data {
        #[command(subcommand)]
        cmd: DataCmd,
    },
    /// Découpage temporel.
    Split {
        #[command(subcommand)]
        cmd: SplitCmd,
    },
    /// Étape 2 : features causales.
    Features(Common),
    /// Étape 3 : outcomes multi-horizon.
    Outcomes(Common),
    /// Étape 5 : prévisions de tous les modèles.
    Forecast(Common),
    /// Étape 6 : scores, métriques, fiabilité.
    Evaluate(Common),
    /// Étape 7 : tables du rapport.
    Report(Common),
    /// Enchaîne toutes les étapes, écrit le manifest et le rapport.
    Run(Common),
    /// Exporte le tableau de bord du run en une page HTML autonome.
    Dashboard {
        #[command(flatten)]
        common: Common,
        /// Écrit aussi la variante sans squelette de document (publication).
        #[arg(long)]
        fragment: bool,
    },
    /// Débit du noyau et convergence par profil, sur la machine courante.
    Bench {
        #[command(flatten)]
        common: Common,
        /// Nombre d'origines échantillonnées.
        #[arg(long, default_value_t = 40)]
        origins: usize,
    },
    /// Recalcule les hash logiques d'un run et les compare au manifest.
    Verify {
        /// Dossier du run.
        #[arg(long)]
        run: PathBuf,
    },
    /// Génère une série synthétique GARCH (fixture de test).
    Synth {
        #[arg(long)]
        out: PathBuf,
        #[arg(long, default_value_t = 4000)]
        n: usize,
        #[arg(long, default_value_t = 1)]
        seed: u64,
        #[arg(long, default_value = "1d")]
        timeframe: String,
        #[arg(long, default_value_t = 0.03)]
        sigma: f64,
        #[arg(long, default_value_t = 0.0)]
        drift: f64,
        /// Degrés de liberté de Student pour les innovations (>= 3).
        #[arg(long)]
        t_df: Option<u32>,
    },
}

fn load_cfg(c: &Common) -> Result<Config> {
    let mut cfg = Config::load(&c.config)?;
    if let Some(p) = &c.profile {
        cfg.run.profile = p.clone();
    }
    if let Some(m) = &c.models {
        cfg.models.enabled = m.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    }
    if let Some(t) = c.threads {
        cfg.run.threads = t;
    }
    if let Some(o) = &c.out {
        cfg.output.dir = o.clone();
    }
    cfg.validate()?;
    Ok(cfg)
}

fn with_pool<T: Send>(threads: usize, f: impl FnOnce() -> Result<T> + Send) -> Result<T> {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| Error::Other(format!("pool de threads : {e}")))?;
    pool.install(f)
}

fn ctx(c: &Common) -> Result<Ctx> {
    let mut ctx = Ctx::load(load_cfg(c)?)?;
    ctx.verbose = true;
    Ok(ctx)
}

fn do_report(
    ctx: &Ctx,
    manifest: &Manifest,
    metrics: &evmc::io::Table,
    rel: &evmc::io::Table,
    fragment: bool,
) -> Result<()> {
    let m = eval::metrics_from_table(metrics)?;
    let r = eval::reliability_from_table(rel)?;
    let files = report::write_report(&ctx.run_dir, manifest, &ctx.split, &m, &r)?;
    for f in files {
        println!("rapport : {}", f.display());
    }
    for f in report::dashboard::export(ctx, manifest, fragment)? {
        println!("tableau de bord : {}", f.display());
    }
    Ok(())
}

fn main() {
    if let Err(e) = real_main() {
        eprintln!("erreur : {e}");
        std::process::exit(1);
    }
}

fn real_main() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Data { cmd: DataCmd::Check(c) } => {
            let cfg = load_cfg(&c)?;
            let tf = evmc::config::timeframe_secs(&cfg.data.timeframe)?;
            // Lecture tolérante : le rapport liste les erreurs au lieu de s'arrêter à la première.
            let series = pipeline::load_series(&cfg);
            match series {
                Ok(s) => {
                    let (rep, _) = integrity::check(&s.bars, tf);
                    println!("fichier      : {}", cfg.data.path);
                    println!("barres       : {}", rep.n_bars);
                    println!("première     : {}", loader::format_utc_ms(rep.first_ts_close));
                    println!("dernière     : {}", loader::format_utc_ms(rep.last_ts_close));
                    println!("trous        : {}", rep.gaps.len());
                    for (i, miss) in rep.gaps.iter().take(10) {
                        println!("  avant la barre {i} : {miss} barre(s) manquante(s)");
                    }
                    println!("hash logique : {}", hex(&s.logical_hash));
                    println!("verdict      : conforme");
                    Ok(())
                }
                Err(e) => {
                    println!("verdict      : rejeté");
                    Err(e)
                }
            }
        }
        Cmd::Split { cmd: SplitCmd::Plan(c) } => {
            let cfg = load_cfg(&c)?;
            let series = pipeline::load_series(&cfg)?;
            let split = Split::plan(&cfg, series.len() as u32, &hex(&series.logical_hash))?;
            split.write_lock(Path::new(&cfg.split.lock_file), &manifest::now_utc())?;
            print!("{}", split.describe());
            println!("lock écrit : {}", cfg.split.lock_file);
            Ok(())
        }
        Cmd::Split { cmd: SplitCmd::Show(c) } => {
            let ctx = ctx(&c)?;
            print!("{}", ctx.split.describe());
            Ok(())
        }
        Cmd::Features(c) => {
            let ctx = ctx(&c)?;
            let f = ctx.step_features()?;
            ctx.write_manifest(&[f.info], vec![])?;
            Ok(())
        }
        Cmd::Outcomes(c) => {
            let ctx = ctx(&c)?;
            with_pool(ctx.threads, || {
                let f = ctx.step_features()?;
                let o = ctx.step_outcomes(&f)?;
                ctx.write_manifest(&[f.info, o.info], vec![])?;
                Ok(())
            })
        }
        Cmd::Forecast(c) => {
            let ctx = ctx(&c)?;
            with_pool(ctx.threads, || {
                let f = ctx.step_features()?;
                let legacy = ctx.step_legacy()?;
                let (fc, stats) = ctx.step_forecast(&f, legacy.as_ref().map(|l| &l[2]))?;
                if let Some(s) = stats {
                    println!(
                        "simulation : {} origines, {} simulations, {} trajectoires, {} non convergées",
                        s.n_origins, s.n_sim_jobs, s.total_paths, s.n_not_converged
                    );
                }
                ctx.write_manifest(&[f.info, fc.info], vec![])?;
                Ok(())
            })
        }
        Cmd::Evaluate(c) => {
            let ctx = ctx(&c)?;
            with_pool(ctx.threads, || {
                let out = pipeline::run_all(&ctx)?;
                println!("run {} : {} tables", out.manifest.run_id, out.manifest.tables.len());
                Ok(())
            })
        }
        Cmd::Report(c) | Cmd::Run(c) => {
            let ctx = ctx(&c)?;
            let t0 = Instant::now();
            with_pool(ctx.threads, || {
                let out = pipeline::run_all(&ctx)?;
                do_report(&ctx, &out.manifest, &out.metrics, &out.reliability, false)?;
                pipeline::registry_append(Path::new(&ctx.cfg.output.dir), "run", &ctx.run_id)?;
                println!("run {} terminé en {:.1} s : {}", ctx.run_id, t0.elapsed().as_secs_f64(), ctx.run_dir.display());
                Ok(())
            })
        }
        Cmd::Dashboard { common, fragment } => {
            let ctx = ctx(&common)?;
            with_pool(ctx.threads, || {
                let out = pipeline::run_all(&ctx)?;
                for f in report::dashboard::export(&ctx, &out.manifest, fragment)? {
                    println!("tableau de bord : {}", f.display());
                }
                Ok(())
            })
        }
        Cmd::Bench { common, origins } => {
            let ctx = ctx(&common)?;
            with_pool(ctx.threads, || bench(&ctx, origins))
        }
        Cmd::Verify { run } => {
            let res = pipeline::verify(&run)?;
            let mut all = true;
            for (name, ok) in &res {
                println!("{:<12} {}", name, if *ok { "conforme" } else { "DIFFÉRENT" });
                all &= *ok;
            }
            if all {
                println!("run vérifié : {} table(s) conformes au manifest", res.len());
                Ok(())
            } else {
                Err(Error::Other("au moins une table ne correspond plus au manifest".into()))
            }
        }
        Cmd::Data { cmd: DataCmd::Resample { input, out, timeframe, source_timeframe, ts_convention, from } } => {
            let src = evmc::config::timeframe_secs(&source_timeframe)?;
            let tf = evmc::config::timeframe_secs(&timeframe)?;
            let from_ms = match &from {
                Some(d) => Some(loader::parse_iso_utc_ms(d).ok_or_else(|| Error::Config(format!("date illisible : {d}")))?),
                None => None,
            };
            let mut rs = Resampler::new(src, tf, from_ms)?;
            for f in &input {
                loader::read_rows(f, src, &ts_convention, |b| rs.push(&b))?;
            }
            let (bars, rep) = rs.finish();
            // Le fichier écrit doit passer le contrôle du moteur : mieux vaut échouer ici qu'au run.
            let (ir, _) = integrity::check_strict(&bars, tf)?;
            synth::write_csv(&out, &bars)?;
            println!("barres source : {}", rep.rows_in);
            println!("barres {timeframe:<6} : {}", rep.bars_out);
            println!("première      : {}", loader::format_utc_ms(bars[0].ts_open));
            println!("dernière      : {}", loader::format_utc_ms(bars[bars.len() - 1].ts_open));
            println!("écartées      : {} incomplète(s), {} sans volume, {} avant la date de départ", rep.dropped_partial, rep.dropped_empty, rep.dropped_before);
            println!("trous         : {}", ir.gaps.len());
            for (i, miss) in ir.gaps.iter().take(10) {
                println!("  avant {} : {miss} barre(s) manquante(s)", loader::format_utc_ms(bars[*i].ts_open));
            }
            println!("écrit dans    : {} (ts_convention = \"open_utc_ms\")", out.display());
            Ok(())
        }
        Cmd::Synth { out, n, seed, timeframe, sigma, drift, t_df } => {
            let spec = SynthSpec {
                n,
                seed,
                timeframe_secs: evmc::config::timeframe_secs(&timeframe)?,
                sigma,
                drift,
                t_df,
                ..Default::default()
            };
            let (bars, _) = synth::generate(&spec);
            synth::write_csv(&out, &bars)?;
            println!("{} barres synthétiques écrites dans {}", bars.len(), out.display());
            Ok(())
        }
    }
}

/// Mesure le débit du noyau et la convergence de chaque profil sur un échantillon d'origines.
fn bench(ctx: &Ctx, origins: usize) -> Result<()> {
    let grid = ctx.cfg.grid()?;
    let feats = FeatureFrame::build(&ctx.series, &ctx.cfg, &ctx.split);
    let (e, d) = (ctx.split.eval_start as usize, ctx.split.holdout_start as usize);
    let n_or = origins.clamp(1, d - e);
    let ts: Vec<usize> = (0..n_or).map(|i| e + i * (d - e) / n_or).collect();
    let v = &ctx.cfg.vol;
    let h_max = grid.h_max() as u64;
    println!("machine : {} thread(s) rayon ; {} origines échantillonnées ; Hmax = {}", rayon::current_num_threads(), n_or, h_max);
    println!("{:<12} {:<9} {:>10} {:>11} {:>12} {:>14} {:>16}", "profil", "résidus", "n moyen", "convergé", "ms/origine", "Mpas/s (1 fil)", "zone notée (est.)");
    let model = evmc::models::registry::build(&{
        let mut c = ctx.cfg.clone();
        c.models.enabled = vec!["b7_garch_fhs".into()];
        c
    })?;
    for (name, profile) in &ctx.cfg.sim {
        for gaussian in [false, true] {
            let mut ws = Workspace::new(&grid, profile.n_max);
            let t0 = Instant::now();
            let (mut paths, mut conv) = (0u64, 0usize);
            for &t in &ts {
                let snap = snapshot(&feats, t);
                let Plan::Simulate(spec) = model[0].plan(&snap, &grid) else { continue };
                let phi = spec.g_alpha + spec.g_beta;
                let sigma_h: Vec<f64> = grid.as_slice().iter().map(|&h| cum_var(spec.h0, spec.h_lr, phi, h as u32).sqrt()).collect();
                let input = SimInput {
                    bar_idx: snap.bar_idx,
                    h0: spec.h0,
                    h_lr: spec.h_lr,
                    g_alpha: v.garch_alpha,
                    g_beta: v.garch_beta,
                    h_cap: spec.h_cap,
                    resid: if gaussian { ResidSpec::Gaussian } else { spec.resid },
                    drift_steps: None,
                    sigma_h: &sigma_h,
                };
                let out = simulate(&input, &feats.z_garch, &grid, profile, ctx.cfg.run.seed, &mut ws);
                paths += out.n_sims as u64;
                conv += out.converged as usize;
            }
            let dt = t0.elapsed().as_secs_f64();
            let per_origin = dt / n_or as f64;
            let total = per_origin * (d - e) as f64 / rayon::current_num_threads() as f64;
            println!(
                "{:<12} {:<9} {:>10.0} {:>10.0}% {:>12.2} {:>14.1} {:>14.1} s",
                name,
                if gaussian { "gaussien" } else { "FHS" },
                paths as f64 / n_or as f64,
                100.0 * conv as f64 / n_or as f64,
                1000.0 * per_origin,
                (paths * h_max) as f64 / dt / 1e6,
                total
            );
        }
    }
    Ok(())
}
