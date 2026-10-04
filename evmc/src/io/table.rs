//! Table colonne typée : format pivot entre les modules et Parquet.
//! Le hash logique ne dépend ni du writer, ni de la compression, ni des métadonnées.

use std::sync::Arc;

use arrow::array::{
    Array, ArrayRef, BooleanArray, Float64Array, Int32Array, Int64Array, Int8Array, StringArray,
    UInt16Array, UInt32Array, UInt8Array,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;

use crate::error::{Error, Result};

#[derive(Clone, Debug, PartialEq)]
pub enum Col {
    I64(Vec<i64>),
    I32(Vec<i32>),
    I8(Vec<i8>),
    U32(Vec<u32>),
    U16(Vec<u16>),
    U8(Vec<u8>),
    F64(Vec<f64>),
    Bool(Vec<bool>),
    Str(Vec<String>),
    NF64(Vec<Option<f64>>),
    NU32(Vec<Option<u32>>),
    NU16(Vec<Option<u16>>),
    NU8(Vec<Option<u8>>),
    NI32(Vec<Option<i32>>),
    NBool(Vec<Option<bool>>),
    NStr(Vec<Option<String>>),
}

impl Col {
    pub fn len(&self) -> usize {
        match self {
            Col::I64(v) => v.len(),
            Col::I32(v) => v.len(),
            Col::I8(v) => v.len(),
            Col::U32(v) => v.len(),
            Col::U16(v) => v.len(),
            Col::U8(v) => v.len(),
            Col::F64(v) => v.len(),
            Col::Bool(v) => v.len(),
            Col::Str(v) => v.len(),
            Col::NF64(v) => v.len(),
            Col::NU32(v) => v.len(),
            Col::NU16(v) => v.len(),
            Col::NU8(v) => v.len(),
            Col::NI32(v) => v.len(),
            Col::NBool(v) => v.len(),
            Col::NStr(v) => v.len(),
        }
    }
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
    fn tag(&self) -> u8 {
        match self {
            Col::I64(_) => 1,
            Col::I32(_) => 2,
            Col::I8(_) => 3,
            Col::U32(_) => 4,
            Col::U16(_) => 5,
            Col::U8(_) => 6,
            Col::F64(_) => 7,
            Col::Bool(_) => 8,
            Col::Str(_) => 9,
            Col::NF64(_) => 17,
            Col::NU32(_) => 14,
            Col::NU16(_) => 15,
            Col::NU8(_) => 16,
            Col::NI32(_) => 12,
            Col::NBool(_) => 18,
            Col::NStr(_) => 19,
        }
    }
    fn data_type(&self) -> (DataType, bool) {
        match self {
            Col::I64(_) => (DataType::Int64, false),
            Col::I32(_) => (DataType::Int32, false),
            Col::I8(_) => (DataType::Int8, false),
            Col::U32(_) => (DataType::UInt32, false),
            Col::U16(_) => (DataType::UInt16, false),
            Col::U8(_) => (DataType::UInt8, false),
            Col::F64(_) => (DataType::Float64, false),
            Col::Bool(_) => (DataType::Boolean, false),
            Col::Str(_) => (DataType::Utf8, false),
            Col::NF64(_) => (DataType::Float64, true),
            Col::NU32(_) => (DataType::UInt32, true),
            Col::NU16(_) => (DataType::UInt16, true),
            Col::NU8(_) => (DataType::UInt8, true),
            Col::NI32(_) => (DataType::Int32, true),
            Col::NBool(_) => (DataType::Boolean, true),
            Col::NStr(_) => (DataType::Utf8, true),
        }
    }
    fn to_array(&self) -> ArrayRef {
        match self {
            Col::I64(v) => Arc::new(Int64Array::from(v.clone())),
            Col::I32(v) => Arc::new(Int32Array::from(v.clone())),
            Col::I8(v) => Arc::new(Int8Array::from(v.clone())),
            Col::U32(v) => Arc::new(UInt32Array::from(v.clone())),
            Col::U16(v) => Arc::new(UInt16Array::from(v.clone())),
            Col::U8(v) => Arc::new(UInt8Array::from(v.clone())),
            Col::F64(v) => Arc::new(Float64Array::from(v.clone())),
            Col::Bool(v) => Arc::new(BooleanArray::from(v.clone())),
            Col::Str(v) => Arc::new(StringArray::from_iter_values(v.iter())),
            Col::NF64(v) => Arc::new(Float64Array::from(v.clone())),
            Col::NU32(v) => Arc::new(UInt32Array::from(v.clone())),
            Col::NU16(v) => Arc::new(UInt16Array::from(v.clone())),
            Col::NU8(v) => Arc::new(UInt8Array::from(v.clone())),
            Col::NI32(v) => Arc::new(Int32Array::from(v.clone())),
            Col::NBool(v) => Arc::new(BooleanArray::from(v.clone())),
            Col::NStr(v) => Arc::new(StringArray::from_iter(v.iter().map(|s| s.as_deref()))),
        }
    }
    /// Écrit la valeur de la ligne `i` dans le hasher (octets little-endian, marqueur de nul).
    fn hash_cell(&self, i: usize, h: &mut blake3::Hasher) {
        fn opt<T, F: Fn(&T, &mut blake3::Hasher)>(v: &Option<T>, h: &mut blake3::Hasher, f: F) {
            match v {
                None => {
                    h.update(&[0u8]);
                }
                Some(x) => {
                    h.update(&[1u8]);
                    f(x, h);
                }
            }
        }
        fn s(x: &str, h: &mut blake3::Hasher) {
            h.update(&(x.len() as u32).to_le_bytes());
            h.update(x.as_bytes());
        }
        match self {
            Col::I64(v) => {
                h.update(&v[i].to_le_bytes());
            }
            Col::I32(v) => {
                h.update(&v[i].to_le_bytes());
            }
            Col::I8(v) => {
                h.update(&v[i].to_le_bytes());
            }
            Col::U32(v) => {
                h.update(&v[i].to_le_bytes());
            }
            Col::U16(v) => {
                h.update(&v[i].to_le_bytes());
            }
            Col::U8(v) => {
                h.update(&[v[i]]);
            }
            Col::F64(v) => {
                h.update(&v[i].to_bits().to_le_bytes());
            }
            Col::Bool(v) => {
                h.update(&[v[i] as u8]);
            }
            Col::Str(v) => s(&v[i], h),
            Col::NF64(v) => opt(&v[i], h, |x, h| {
                h.update(&x.to_bits().to_le_bytes());
            }),
            Col::NU32(v) => opt(&v[i], h, |x, h| {
                h.update(&x.to_le_bytes());
            }),
            Col::NU16(v) => opt(&v[i], h, |x, h| {
                h.update(&x.to_le_bytes());
            }),
            Col::NU8(v) => opt(&v[i], h, |x, h| {
                h.update(&[*x]);
            }),
            Col::NI32(v) => opt(&v[i], h, |x, h| {
                h.update(&x.to_le_bytes());
            }),
            Col::NBool(v) => opt(&v[i], h, |x, h| {
                h.update(&[*x as u8]);
            }),
            Col::NStr(v) => opt(&v[i], h, |x, h| s(x, h)),
        }
    }
    /// Première valeur non finie, s'il y en a une.
    fn first_non_finite(&self) -> Option<usize> {
        match self {
            Col::F64(v) => v.iter().position(|x| !x.is_finite()),
            Col::NF64(v) => v.iter().position(|x| matches!(x, Some(y) if !y.is_finite())),
            _ => None,
        }
    }
}

/// Table nommée : colonnes dans l'ordre du schéma, lignes dans l'ordre de la clé.
#[derive(Clone, Debug, PartialEq)]
pub struct Table {
    pub name: String,
    cols: Vec<(String, Col)>,
}

macro_rules! getter {
    ($fn:ident, $variant:ident, $ty:ty) => {
        pub fn $fn(&self, name: &str) -> Result<&[$ty]> {
            match self.col(name)? {
                Col::$variant(v) => Ok(v),
                _ => Err(Error::Schema(format!(
                    "table {} : colonne {} d'un type inattendu",
                    self.name, name
                ))),
            }
        }
    };
}

impl Table {
    pub fn new(name: &str) -> Self {
        Self { name: name.to_string(), cols: Vec::new() }
    }
    pub fn push(&mut self, name: &str, col: Col) {
        debug_assert!(self.cols.iter().all(|(n, _)| n != name), "colonne en double : {name}");
        self.cols.push((name.to_string(), col));
    }
    pub fn with(mut self, name: &str, col: Col) -> Self {
        self.push(name, col);
        self
    }
    pub fn n_rows(&self) -> usize {
        self.cols.first().map(|(_, c)| c.len()).unwrap_or(0)
    }
    pub fn n_cols(&self) -> usize {
        self.cols.len()
    }
    pub fn col_names(&self) -> Vec<&str> {
        self.cols.iter().map(|(n, _)| n.as_str()).collect()
    }
    pub fn has(&self, name: &str) -> bool {
        self.cols.iter().any(|(n, _)| n == name)
    }
    pub fn col(&self, name: &str) -> Result<&Col> {
        self.cols
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, c)| c)
            .ok_or_else(|| Error::Schema(format!("table {} : colonne absente {}", self.name, name)))
    }
    getter!(i64, I64, i64);
    getter!(i32, I32, i32);
    getter!(i8, I8, i8);
    getter!(u32, U32, u32);
    getter!(u16, U16, u16);
    getter!(u8, U8, u8);
    getter!(f64, F64, f64);
    getter!(bool, Bool, bool);
    getter!(str, Str, String);
    getter!(nf64, NF64, Option<f64>);
    getter!(nu32, NU32, Option<u32>);
    getter!(nu16, NU16, Option<u16>);
    getter!(nu8, NU8, Option<u8>);
    getter!(ni32, NI32, Option<i32>);
    getter!(nbool, NBool, Option<bool>);
    getter!(nstr, NStr, Option<String>);

    /// Vérifie la cohérence : colonnes de même longueur, aucun NaN ni infini.
    pub fn validate(&self) -> Result<()> {
        let n = self.n_rows();
        for (name, c) in &self.cols {
            if c.len() != n {
                return Err(Error::Schema(format!(
                    "table {} : colonne {} de longueur {} au lieu de {}",
                    self.name,
                    name,
                    c.len(),
                    n
                )));
            }
            if let Some(i) = c.first_non_finite() {
                return Err(Error::Invariant(format!(
                    "table {} : valeur non finie dans {} à la ligne {}",
                    self.name, name, i
                )));
            }
        }
        Ok(())
    }

    /// Hash logique : schéma, puis lignes dans l'ordre, colonnes dans l'ordre du schéma.
    pub fn logical_hash(&self) -> [u8; 32] {
        let mut h = blake3::Hasher::new();
        h.update(b"evmc.table.v1");
        h.update(&(self.cols.len() as u32).to_le_bytes());
        for (name, c) in &self.cols {
            h.update(&(name.len() as u32).to_le_bytes());
            h.update(name.as_bytes());
            h.update(&[c.tag()]);
        }
        let n = self.n_rows();
        h.update(&(n as u64).to_le_bytes());
        for i in 0..n {
            for (_, c) in &self.cols {
                c.hash_cell(i, &mut h);
            }
        }
        *h.finalize().as_bytes()
    }

    pub fn schema(&self) -> Schema {
        Schema::new(
            self.cols
                .iter()
                .map(|(n, c)| {
                    let (dt, nullable) = c.data_type();
                    Field::new(n, dt, nullable)
                })
                .collect::<Vec<_>>(),
        )
    }

    pub fn to_batch(&self) -> Result<RecordBatch> {
        self.validate()?;
        let schema = Arc::new(self.schema());
        let arrays: Vec<ArrayRef> = self.cols.iter().map(|(_, c)| c.to_array()).collect();
        Ok(RecordBatch::try_new(schema, arrays)?)
    }

    /// Reconstruit une table à partir de lots Arrow (concaténés dans l'ordre).
    pub fn from_batches(name: &str, schema: &Schema, batches: &[RecordBatch]) -> Result<Self> {
        let mut t = Table::new(name);
        for (ci, field) in schema.fields().iter().enumerate() {
            let nullable = field.is_nullable();
            macro_rules! plain {
                ($arr:ty, $variant:ident) => {{
                    let mut out = Vec::new();
                    for b in batches {
                        let a = b.column(ci).as_any().downcast_ref::<$arr>().ok_or_else(|| {
                            Error::Schema(format!("colonne {} : type Arrow inattendu", field.name()))
                        })?;
                        if a.null_count() > 0 {
                            return Err(Error::Schema(format!(
                                "colonne {} : nul dans une colonne non nullable",
                                field.name()
                            )));
                        }
                        out.extend(a.values().iter().copied());
                    }
                    Col::$variant(out)
                }};
            }
            macro_rules! optional {
                ($arr:ty, $variant:ident) => {{
                    let mut out = Vec::new();
                    for b in batches {
                        let a = b.column(ci).as_any().downcast_ref::<$arr>().ok_or_else(|| {
                            Error::Schema(format!("colonne {} : type Arrow inattendu", field.name()))
                        })?;
                        out.extend(a.iter());
                    }
                    Col::$variant(out)
                }};
            }
            let col = match (field.data_type(), nullable) {
                (DataType::Int64, false) => plain!(Int64Array, I64),
                (DataType::Int32, false) => plain!(Int32Array, I32),
                (DataType::Int32, true) => optional!(Int32Array, NI32),
                (DataType::Int8, false) => plain!(Int8Array, I8),
                (DataType::UInt32, false) => plain!(UInt32Array, U32),
                (DataType::UInt32, true) => optional!(UInt32Array, NU32),
                (DataType::UInt16, false) => plain!(UInt16Array, U16),
                (DataType::UInt16, true) => optional!(UInt16Array, NU16),
                (DataType::UInt8, false) => plain!(UInt8Array, U8),
                (DataType::UInt8, true) => optional!(UInt8Array, NU8),
                (DataType::Float64, false) => plain!(Float64Array, F64),
                (DataType::Float64, true) => optional!(Float64Array, NF64),
                (DataType::Boolean, _) => {
                    let mut plain = Vec::new();
                    let mut opt = Vec::new();
                    for b in batches {
                        let a = b.column(ci).as_any().downcast_ref::<BooleanArray>().ok_or_else(
                            || Error::Schema(format!("colonne {} : type Arrow inattendu", field.name())),
                        )?;
                        if nullable {
                            opt.extend(a.iter());
                        } else {
                            plain.extend(a.iter().map(|x| x.unwrap_or(false)));
                        }
                    }
                    if nullable { Col::NBool(opt) } else { Col::Bool(plain) }
                }
                (DataType::Utf8, _) => {
                    let mut plain = Vec::new();
                    let mut opt = Vec::new();
                    for b in batches {
                        let a = b.column(ci).as_any().downcast_ref::<StringArray>().ok_or_else(
                            || Error::Schema(format!("colonne {} : type Arrow inattendu", field.name())),
                        )?;
                        if nullable {
                            opt.extend(a.iter().map(|x| x.map(|s| s.to_string())));
                        } else {
                            plain.extend(a.iter().map(|x| x.unwrap_or("").to_string()));
                        }
                    }
                    if nullable { Col::NStr(opt) } else { Col::Str(plain) }
                }
                (other, _) => {
                    return Err(Error::Schema(format!(
                        "colonne {} : type non pris en charge {other:?}",
                        field.name()
                    )));
                }
            };
            t.push(field.name(), col);
        }
        Ok(t)
    }
}

/// Hash en hexadécimal.
pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Table {
        Table::new("t")
            .with("ts", Col::I64(vec![1, 2, 3]))
            .with("x", Col::F64(vec![0.5, -1.25, 3.0]))
            .with("m", Col::Str(vec!["a".into(), "b".into(), "a".into()]))
            .with("o", Col::NF64(vec![Some(1.0), None, Some(2.0)]))
            .with("b", Col::NBool(vec![None, Some(true), Some(false)]))
    }

    #[test]
    fn hash_depends_on_values_order_and_nulls() {
        let a = sample();
        let mut b = sample();
        assert_eq!(a.logical_hash(), b.logical_hash());
        b.cols[1].1 = Col::F64(vec![0.5, -1.25, 3.000_000_000_000_000_4]);
        assert_ne!(a.logical_hash(), b.logical_hash());
        let mut c = sample();
        c.cols[3].1 = Col::NF64(vec![Some(1.0), Some(0.0), Some(2.0)]);
        assert_ne!(a.logical_hash(), c.logical_hash());
    }

    #[test]
    fn arrow_round_trip() {
        let a = sample();
        let batch = a.to_batch().unwrap();
        let back = Table::from_batches("t", &a.schema(), &[batch]).unwrap();
        assert_eq!(a, back);
    }

    #[test]
    fn rejects_non_finite() {
        let t = Table::new("t").with("x", Col::F64(vec![1.0, f64::NAN]));
        assert!(t.validate().is_err());
    }
}
