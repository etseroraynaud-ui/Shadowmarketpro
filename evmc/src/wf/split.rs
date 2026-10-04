//! Découpage temporel : warm-up, amorçage, zone notée en plis, holdout verrouillé.
//! Calculé une fois par `split plan`, écrit dans un lock, vérifié par hash ensuite.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::error::{Error, Result};
use crate::io::table::hex;
use crate::types::{BarIdx, Horizon, Zone};

/// Warm-up déclaré par composant (spécification, section 12).
pub const COMPONENT_WARMUP: [(&str, u32); 6] = [
    ("ewma", 100),
    ("variance_long_terme", 750),
    ("rms_et_rangs", 250),
    ("pool_fhs", 250),
    ("sr_placebo", 250),
    ("profil_zones", 500),
];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Fold {
    pub id: u16,
    pub test_start: BarIdx,
    pub test_end: BarIdx,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Split {
    pub symbol: String,
    pub timeframe: String,
    pub data_hash: String,
    pub n_bars: u32,
    /// W : fin du warm-up des features.
    pub warm_end: BarIdx,
    /// E : première origine notée.
    pub eval_start: BarIdx,
    /// D : début du holdout.
    pub holdout_start: BarIdx,
    /// N : fin des données.
    pub data_end: BarIdx,
    pub grid: Vec<Horizon>,
    pub h_star_requested: Horizon,
    /// H* effectif : plus grand horizon concluant en holdout.
    pub h_star: Horizon,
    pub m_target: u32,
    pub holdout_bars: u32,
    pub warmup_min_bars: u32,
    pub min_train_bars: u32,
    pub test_fold_bars: u32,
    pub holdout_max_frac: f64,
    pub min_dev_folds: u32,
    pub folds: Vec<Fold>,
    pub created_utc: String,
    pub lock_hash: String,
}

impl Split {
    /// Calcule le découpage à partir de la configuration et de la taille réelle des données.
    pub fn plan(cfg: &Config, n_bars: u32, data_hash: &str) -> Result<Split> {
        let grid = cfg.grid()?;
        let s = &cfg.split;
        let comp_max = COMPONENT_WARMUP.iter().map(|(_, w)| *w).max().unwrap_or(0);
        let w = cfg.warmup.min_bars.max(comp_max);
        let e = w + s.min_train_bars;
        if e >= n_bars {
            return Err(Error::Split(format!(
                "données trop courtes : {n_bars} barres, il en faut plus de {e} (warm-up {w} + amorçage {})",
                s.min_train_bars
            )));
        }
        let after_seed = n_bars - e;
        let mut chosen: Option<(Horizon, u32)> = None;
        let mut reasons = Vec::new();
        for &h in grid.as_slice().iter().rev() {
            if h > s.holdout_h_star {
                continue;
            }
            let hb = (s.holdout_m_target + 1) * h as u32;
            let cap = (s.holdout_max_frac * after_seed as f64).floor() as u32;
            if hb > cap {
                reasons.push(format!("H*={h} : holdout {hb} > plafond {cap}"));
                continue;
            }
            let folds = (after_seed - hb) / s.test_fold_bars;
            if folds < s.min_dev_folds {
                reasons.push(format!("H*={h} : {folds} plis dev < {}", s.min_dev_folds));
                continue;
            }
            chosen = Some((h, hb));
            break;
        }
        let (h_star, holdout_bars) = chosen.ok_or_else(|| {
            Error::Split(format!(
                "aucun H* admissible avec {after_seed} barres après amorçage : {}",
                reasons.join(" ; ")
            ))
        })?;
        let d = n_bars - holdout_bars;
        let k = (d - e) / s.test_fold_bars;
        let mut folds = Vec::with_capacity(k as usize);
        for i in 0..k {
            let start = e + i * s.test_fold_bars;
            let end = if i + 1 == k { d } else { start + s.test_fold_bars };
            folds.push(Fold { id: i as u16, test_start: start, test_end: end });
        }
        let mut split = Split {
            symbol: cfg.data.symbol.clone(),
            timeframe: cfg.data.timeframe.clone(),
            data_hash: data_hash.to_string(),
            n_bars,
            warm_end: w,
            eval_start: e,
            holdout_start: d,
            data_end: n_bars,
            grid: grid.as_slice().to_vec(),
            h_star_requested: s.holdout_h_star,
            h_star,
            m_target: s.holdout_m_target,
            holdout_bars,
            warmup_min_bars: cfg.warmup.min_bars,
            min_train_bars: s.min_train_bars,
            test_fold_bars: s.test_fold_bars,
            holdout_max_frac: s.holdout_max_frac,
            min_dev_folds: s.min_dev_folds,
            folds,
            created_utc: String::new(),
            lock_hash: String::new(),
        };
        split.lock_hash = split.compute_hash();
        Ok(split)
    }

    fn compute_hash(&self) -> String {
        let mut c = self.clone();
        c.created_utc = String::new();
        c.lock_hash = String::new();
        let json = serde_json::to_string(&c).expect("split sérialisable");
        hex(blake3::hash(json.as_bytes()).as_bytes())
    }

    pub fn zone_of(&self, t: BarIdx) -> Zone {
        if t < self.warm_end {
            Zone::Warmup
        } else if t < self.eval_start {
            Zone::Seed
        } else if t < self.holdout_start {
            Zone::Dev
        } else {
            Zone::Holdout
        }
    }

    pub fn fold_of(&self, t: BarIdx) -> Option<u16> {
        if t < self.eval_start || t >= self.holdout_start {
            return None;
        }
        self.folds.iter().find(|f| t >= f.test_start && t < f.test_end).map(|f| f.id)
    }

    /// Un horizon supérieur à H* est rapporté en holdout mais jamais concluant.
    pub fn exploratory(&self, h: Horizon) -> bool {
        h > self.h_star
    }

    /// Refuse toute origine du holdout tant qu'il n'est pas ouvert.
    pub fn guard_origin(&self, t: BarIdx, holdout_opened: bool) -> Result<()> {
        if t >= self.holdout_start && !holdout_opened {
            return Err(Error::Locked(format!(
                "origine {t} >= début du holdout {}",
                self.holdout_start
            )));
        }
        Ok(())
    }

    /// Écrit le lock. Refuse d'écraser un lock existant.
    pub fn write_lock(&self, path: &Path, created_utc: &str) -> Result<()> {
        if path.exists() {
            return Err(Error::Split(format!(
                "le lock {} existe déjà : le découpage est figé",
                path.display()
            )));
        }
        if let Some(dir) = path.parent() {
            if !dir.as_os_str().is_empty() {
                std::fs::create_dir_all(dir)?;
            }
        }
        let mut c = self.clone();
        c.created_utc = created_utc.to_string();
        std::fs::write(path, toml::to_string_pretty(&c)?)?;
        Ok(())
    }

    /// Charge le lock et vérifie son hash, puis sa cohérence avec les données et la config.
    pub fn load_lock(path: &Path, cfg: &Config, n_bars: u32, data_hash: &str) -> Result<Split> {
        let txt = std::fs::read_to_string(path).map_err(|e| {
            Error::Split(format!(
                "lock {} illisible ({e}) : lancer `evmc split plan` d'abord",
                path.display()
            ))
        })?;
        let s: Split = toml::from_str(&txt)?;
        if s.compute_hash() != s.lock_hash {
            return Err(Error::Split("le lock a été modifié : hash invalide".into()));
        }
        if s.data_hash != data_hash || s.n_bars != n_bars {
            return Err(Error::Split(
                "le lock ne correspond pas aux données chargées (hash ou nombre de barres)".into(),
            ));
        }
        let c = &cfg.split;
        let same = s.grid == cfg.horizons.grid
            && s.warmup_min_bars == cfg.warmup.min_bars
            && s.min_train_bars == c.min_train_bars
            && s.test_fold_bars == c.test_fold_bars
            && s.h_star_requested == c.holdout_h_star
            && s.m_target == c.holdout_m_target
            && s.holdout_max_frac == c.holdout_max_frac
            && s.min_dev_folds == c.min_dev_folds
            && s.symbol == cfg.data.symbol
            && s.timeframe == cfg.data.timeframe;
        if !same {
            return Err(Error::Split(
                "la configuration ne correspond plus au lock : le découpage est figé".into(),
            ));
        }
        Ok(s)
    }

    /// Résumé lisible du plan.
    pub fn describe(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!(
            "barres {} | warm-up [0, {}) | amorçage [{}, {}) | zone notée [{}, {}) | holdout [{}, {})\n",
            self.n_bars,
            self.warm_end,
            self.warm_end,
            self.eval_start,
            self.eval_start,
            self.holdout_start,
            self.holdout_start,
            self.data_end
        ));
        out.push_str(&format!(
            "H* demandé {} -> effectif {} | m = {} | holdout = {} barres | {} plis de test\n",
            self.h_star_requested,
            self.h_star,
            self.m_target,
            self.holdout_bars,
            self.folds.len()
        ));
        let expl: Vec<String> =
            self.grid.iter().filter(|h| self.exploratory(**h)).map(|h| h.to_string()).collect();
        if !expl.is_empty() {
            out.push_str(&format!("horizons exploratoires en holdout : {}\n", expl.join(", ")));
        }
        out.push_str(&format!("lock_hash {}\n", self.lock_hash));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_matches_spec_example() {
        // 4 000 barres daily, W = 750, amorçage 750, H* = 30, m = 20 -> 630 barres de holdout.
        let cfg = Config::default_mvp();
        let s = Split::plan(&cfg, 4000, "x").unwrap();
        assert_eq!(s.warm_end, 750);
        assert_eq!(s.eval_start, 1500);
        assert_eq!(s.holdout_bars, 630);
        assert_eq!(s.holdout_start, 3370);
        assert_eq!(s.h_star, 30);
        assert_eq!(s.folds.len(), 7);
        assert_eq!(s.folds.last().unwrap().test_end, 3370);
    }

    #[test]
    fn caps_lower_h_star_not_m() {
        let mut cfg = Config::default_mvp();
        cfg.split.holdout_h_star = 120;
        let s = Split::plan(&cfg, 4000, "x").unwrap();
        assert!(s.h_star < 120);
        assert_eq!(s.m_target, 20);
        assert_eq!(s.holdout_bars, 21 * s.h_star as u32);
        assert!(s.holdout_bars as f64 <= 0.35 * 2500.0);
    }

    #[test]
    fn too_short_is_rejected() {
        let cfg = Config::default_mvp();
        assert!(Split::plan(&cfg, 1400, "x").is_err());
    }
}
