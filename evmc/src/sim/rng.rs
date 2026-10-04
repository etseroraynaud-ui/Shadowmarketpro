//! RNG reproductible : un seed maître, des flux dérivés par hachage, jamais de
//! générateur partagé. Le résultat ne dépend ni du nombre de threads ni de l'ordre.

use rand_chacha::ChaCha8Rng;
use rand_core::{Rng, SeedableRng};

/// Version de l'algorithme de dérivation, consignée au manifest.
pub const DERIVATION_VERSION: &str = "blake3(seed|domain|parts)->chacha8;stream=index;v1";

/// Clé ChaCha8 dérivée de (seed, domaine, parties).
pub fn derive_key(seed: u64, domain: &str, parts: &[u64]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"evmc.rng.v1");
    h.update(&seed.to_le_bytes());
    h.update(&(domain.len() as u32).to_le_bytes());
    h.update(domain.as_bytes());
    for p in parts {
        h.update(&p.to_le_bytes());
    }
    *h.finalize().as_bytes()
}

/// Générateur à flux indexés : un flux par trajectoire, réplique ou série.
pub struct StreamRng {
    rng: ChaCha8Rng,
}

impl StreamRng {
    pub fn new(key: [u8; 32]) -> Self {
        Self { rng: ChaCha8Rng::from_seed(key) }
    }
    /// Positionne le générateur au début du flux `stream`.
    #[inline]
    pub fn seek(&mut self, stream: u64) {
        self.rng.set_stream(stream);
        self.rng.set_word_pos(0);
    }
    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        self.rng.next_u64()
    }
    /// Remplit `buf` avec les premiers mots du flux `stream`.
    #[inline]
    pub fn fill_stream(&mut self, stream: u64, buf: &mut [u64]) {
        self.seek(stream);
        for b in buf.iter_mut() {
            *b = self.rng.next_u64();
        }
    }
    /// Remplit `buf` avec les premiers octets du flux `stream` : lecture en bloc,
    /// plus rapide que mot à mot. Chaque u64 se lit ensuite par `word`.
    #[inline]
    pub fn fill_stream_bytes(&mut self, stream: u64, buf: &mut [u8]) {
        self.seek(stream);
        self.rng.fill_bytes(buf);
    }
}

/// Lit le k-ième u64 (little-endian) d'un tampon d'octets.
#[inline]
pub fn word(buf: &[u8], k: usize) -> u64 {
    let mut b = [0u8; 8];
    b.copy_from_slice(&buf[8 * k..8 * k + 8]);
    u64::from_le_bytes(b)
}

/// Uniforme sur ]0, 1[ à partir d'un u64 : 52 bits, centré sur la maille.
/// Les bornes 0 et 1 sont exclues, ce qui garde le quantile normal fini.
#[inline]
pub fn u01(u: u64) -> f64 {
    ((u >> 12) as f64 + 0.5) * (1.0 / 4_503_599_627_370_496.0)
}

/// Indice uniforme dans [0, n) par multiplication-décalage : aucun rejet.
#[inline]
pub fn index(u: u64, n: usize) -> usize {
    ((u as u128 * n as u128) >> 64) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streams_are_reproducible_and_distinct() {
        let key = derive_key(42, "sim", &[7]);
        let mut a = StreamRng::new(key);
        let mut b = StreamRng::new(key);
        let mut x = [0u64; 8];
        let mut y = [0u64; 8];
        a.fill_stream(3, &mut x);
        b.fill_stream(9, &mut y);
        assert_ne!(x, y);
        b.fill_stream(3, &mut y);
        assert_eq!(x, y);
        // L'ordre de visite des flux ne change rien.
        a.fill_stream(9, &mut x);
        a.fill_stream(3, &mut x);
        assert_eq!(x, y);
        assert_ne!(derive_key(42, "sim", &[7]), derive_key(42, "boot", &[7]));
        assert_ne!(derive_key(42, "sim", &[7]), derive_key(43, "sim", &[7]));
    }

    #[test]
    fn uniform_and_index_bounds() {
        assert!(u01(0) > 0.0 && u01(u64::MAX) < 1.0);
        assert_eq!(index(0, 750), 0);
        assert_eq!(index(u64::MAX, 750), 749);
    }
}
