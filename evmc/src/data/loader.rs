//! Chargement CSV de barres OHLCV.

use std::path::Path;

use crate::config::timeframe_secs;
use crate::data::bars::{hash_bars, Bar, BarSeries};
use crate::data::integrity;
use crate::error::{Error, Result};

fn find_col(headers: &csv::StringRecord, names: &[&str]) -> Option<usize> {
    headers.iter().position(|h| {
        let h = h.trim().trim_start_matches('\u{feff}').to_ascii_lowercase();
        names.iter().any(|n| h == *n)
    })
}

/// Nombre de jours depuis 1970-01-01 pour une date civile (calendrier grégorien proleptique).
pub fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Date civile (année, mois, jour) à partir d'un nombre de jours depuis 1970-01-01.
pub fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Formate des millisecondes UTC en ISO 8601.
pub fn format_utc_ms(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, m, d, rem / 3600, (rem % 3600) / 60, rem % 60)
}

/// Lit une date ISO 8601 : "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM[:SS]", suivie de "Z",
/// d'un décalage "+HH:MM" / "-HH:MM", ou de rien (UTC supposé). Renvoie des millisecondes UTC.
pub fn parse_iso_utc_ms(s: &str) -> Option<i64> {
    let s = s.trim();
    let (date, rest) = match s.find(['T', ' ']) {
        Some(i) => (&s[..i], Some(&s[i + 1..])),
        None => (s, None),
    };
    let mut dp = date.split('-');
    let y: i64 = dp.next()?.parse().ok()?;
    let m: i64 = dp.next()?.parse().ok()?;
    let d: i64 = dp.next()?.parse().ok()?;
    if dp.next().is_some() || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let mut secs = days_from_civil(y, m, d) * 86_400;
    if let Some(rest) = rest {
        // Sépare l'heure du décalage horaire éventuel.
        let (time, offset) = if let Some(t) = rest.strip_suffix('Z') {
            (t, 0i64)
        } else if let Some(i) = rest.rfind(['+', '-']) {
            let (t, o) = rest.split_at(i);
            let sign = if o.starts_with('-') { -1 } else { 1 };
            let mut op = o[1..].split(':');
            let oh: i64 = op.next()?.parse().ok()?;
            let om: i64 = op.next().map(|x| x.parse().ok()).unwrap_or(Some(0))?;
            (t, sign * (oh * 3600 + om * 60))
        } else {
            (rest, 0)
        };
        let mut tp = time.split(':');
        let hh: i64 = tp.next()?.parse().ok()?;
        let mm: i64 = tp.next()?.parse().ok()?;
        let ss: f64 = tp.next().map(|x| x.parse().ok()).unwrap_or(Some(0.0))?;
        if !(0..24).contains(&hh) || !(0..60).contains(&mm) {
            return None;
        }
        secs += hh * 3600 + mm * 60 + ss as i64 - offset;
    }
    Some(secs * 1000)
}

/// Lit un CSV avec en-tête et passe chaque ligne, dans l'ordre du fichier, à `f`.
/// Colonnes reconnues (insensible à la casse) :
/// time|ts|timestamp|date|open_time, open, high, low, close, volume|vol.
/// Lecture en flux : le fichier n'est jamais chargé en entier.
pub fn read_rows(
    path: &Path,
    timeframe_secs: u32,
    ts_convention: &str,
    mut f: impl FnMut(Bar) -> Result<()>,
) -> Result<()> {
    let step = timeframe_secs as i64 * 1000;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .trim(csv::Trim::All)
        .from_path(path)
        .map_err(|e| Error::Data(format!("ouverture de {} impossible : {e}", path.display())))?;
    let headers = rdr.headers()?.clone();
    let need = |names: &[&str]| -> Result<usize> {
        find_col(&headers, names).ok_or_else(|| {
            Error::Data(format!("colonne manquante dans {} : {}", path.display(), names[0]))
        })
    };
    let c_ts = need(&["time", "ts", "timestamp", "date", "open_time"])?;
    let c_o = need(&["open"])?;
    let c_h = need(&["high"])?;
    let c_l = need(&["low"])?;
    let c_c = need(&["close"])?;
    let c_v = need(&["volume", "vol"])?;

    let mut rec = csv::StringRecord::new();
    let mut line = 1usize;
    while rdr.read_record(&mut rec)? {
        line += 1;
        let get = |c: usize| -> Result<f64> {
            rec.get(c)
                .ok_or_else(|| Error::Data(format!("ligne {line} : champ absent")))?
                .parse::<f64>()
                .map_err(|_| Error::Data(format!("ligne {line} : nombre illisible")))
        };
        let raw = rec.get(c_ts).unwrap_or("");
        let bad_ts = || Error::Data(format!("ligne {line} : horodatage illisible « {raw} »"));
        let ts_open = match ts_convention {
            "open_utc_ms" => raw.parse::<f64>().map_err(|_| bad_ts())? as i64,
            "open_utc_s" => raw.parse::<f64>().map_err(|_| bad_ts())? as i64 * 1000,
            "close_utc_ms" => raw.parse::<f64>().map_err(|_| bad_ts())? as i64 - step,
            "open_iso" => parse_iso_utc_ms(raw).ok_or_else(bad_ts)?,
            other => return Err(Error::Config(format!("ts_convention inconnue : {other}"))),
        };
        f(Bar {
            ts_open,
            ts_close: ts_open + step,
            open: get(c_o)?,
            high: get(c_h)?,
            low: get(c_l)?,
            close: get(c_c)?,
            volume: get(c_v)?,
        })?;
    }
    Ok(())
}

/// Charge un CSV de barres et le valide.
pub fn load_csv(
    path: &Path,
    symbol: &str,
    timeframe: &str,
    ts_convention: &str,
) -> Result<BarSeries> {
    let tf_secs = timeframe_secs(timeframe)?;
    let mut bars = Vec::new();
    read_rows(path, tf_secs, ts_convention, |b| {
        bars.push(b);
        Ok(())
    })?;
    from_bars(symbol, timeframe, bars)
}

/// Construit une série validée à partir de barres en mémoire.
pub fn from_bars(symbol: &str, timeframe: &str, bars: Vec<Bar>) -> Result<BarSeries> {
    let tf_secs = timeframe_secs(timeframe)?;
    let (_rep, gap_prefix) = integrity::check_strict(&bars, tf_secs)?;
    let logical_hash = hash_bars(symbol, timeframe, &bars);
    Ok(BarSeries {
        symbol: symbol.to_string(),
        timeframe: timeframe.to_string(),
        timeframe_secs: tf_secs,
        bars,
        gap_prefix,
        logical_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_round_trip() {
        for days in [-1000i64, 0, 1, 365, 19_000, 20_729] {
            let (y, m, d) = civil_from_days(days);
            assert_eq!(days_from_civil(y, m, d), days);
        }
        assert_eq!(format_utc_ms(0), "1970-01-01T00:00:00Z");
        assert_eq!(parse_iso_utc_ms("2024-03-01T12:30:00Z"), Some(1_709_296_200_000));
        assert_eq!(format_utc_ms(1_709_296_200_000), "2024-03-01T12:30:00Z");
        assert_eq!(parse_iso_utc_ms("2024-03-01"), Some(1_709_251_200_000));
        assert_eq!(parse_iso_utc_ms("2024-03-01 12:30"), Some(1_709_296_200_000));
        assert_eq!(parse_iso_utc_ms("2024-03-01T13:30:00+01:00"), Some(1_709_296_200_000));
        assert_eq!(parse_iso_utc_ms("2024-03-01T07:30:00-05:00"), Some(1_709_296_200_000));
        assert_eq!(parse_iso_utc_ms("pas une date"), None);
    }
}
