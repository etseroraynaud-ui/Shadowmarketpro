//! Lecture et écriture Parquet des tables.

use std::fs::File;
use std::path::Path;
use std::sync::Arc;

use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::ArrowWriter;
use parquet::basic::{Compression, ZstdLevel};
use parquet::file::metadata::KeyValue;
use parquet::file::properties::WriterProperties;

use crate::error::{Error, Result};
use crate::io::table::Table;

/// Version du schéma des tables.
pub const SCHEMA_VERSION: u32 = 1;

/// Écrit une table. `meta` est ajouté aux métadonnées du fichier.
pub fn write_table(path: &Path, table: &Table, compression: &str, meta: &[(&str, String)]) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let batch = table.to_batch()?;
    let comp = match compression {
        "zstd" => Compression::ZSTD(ZstdLevel::default()),
        "none" => Compression::UNCOMPRESSED,
        other => return Err(Error::Config(format!("compression inconnue : {other}"))),
    };
    let mut kv = vec![
        KeyValue::new("evmc.schema_version".to_string(), SCHEMA_VERSION.to_string()),
        KeyValue::new("evmc.table".to_string(), table.name.clone()),
    ];
    for (k, v) in meta {
        kv.push(KeyValue::new(k.to_string(), v.clone()));
    }
    let props = WriterProperties::builder()
        .set_compression(comp)
        .set_created_by("evmc".to_string())
        .set_key_value_metadata(Some(kv))
        .build();
    // Écriture atomique : fichier temporaire puis renommage.
    let tmp = path.with_extension("parquet.tmp");
    let file = File::create(&tmp)?;
    let mut w = ArrowWriter::try_new(file, Arc::new(table.schema()), Some(props))?;
    w.write(&batch)?;
    w.close()?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Lit une table entière.
pub fn read_table(path: &Path, name: &str) -> Result<Table> {
    let file = File::open(path)
        .map_err(|e| Error::Other(format!("ouverture de {} impossible : {e}", path.display())))?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file)?;
    let schema = builder.schema().clone();
    let reader = builder.with_batch_size(65_536).build()?;
    let mut batches = Vec::new();
    for b in reader {
        batches.push(b?);
    }
    Table::from_batches(name, &schema, &batches)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::table::Col;

    #[test]
    fn parquet_round_trip_keeps_logical_hash() {
        let t = Table::new("demo")
            .with("ts", Col::I64((0..1000).collect()))
            .with("x", Col::F64((0..1000).map(|i| (i as f64).sin()).collect()))
            .with("m", Col::Str((0..1000).map(|i| format!("m{}", i % 3)).collect()))
            .with("o", Col::NF64((0..1000).map(|i| if i % 7 == 0 { None } else { Some(i as f64) }).collect()))
            .with("h", Col::U16((0..1000).map(|i| (i % 120) as u16).collect()));
        let dir = std::env::temp_dir().join(format!("evmc_pq_{}", std::process::id()));
        let p1 = dir.join("a.parquet");
        let p2 = dir.join("b.parquet");
        write_table(&p1, &t, "zstd", &[("evmc.note", "x".into())]).unwrap();
        write_table(&p2, &t, "none", &[]).unwrap();
        let a = read_table(&p1, "demo").unwrap();
        let b = read_table(&p2, "demo").unwrap();
        assert_eq!(a, t);
        assert_eq!(a.logical_hash(), b.logical_hash());
        assert_eq!(a.logical_hash(), t.logical_hash());
        std::fs::remove_dir_all(&dir).ok();
    }
}
