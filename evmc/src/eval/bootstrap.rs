//! Bootstrap par blocs mobiles circulaires, apparié entre modèles et métriques :
//! les mêmes tirages de blocs servent à tout un horizon.

use crate::sim::rng::{derive_key, index, StreamRng};

/// Tirages de blocs pour un horizon et une longueur de bloc.
pub struct BlockPlan {
    pub n: usize,
    pub l: usize,
    /// Nombre de blocs par réplique.
    pub b: usize,
    /// Longueur du dernier bloc, tronqué pour que la réplique compte exactement n lignes.
    pub l_last: usize,
    pub reps: usize,
    /// Débuts de blocs : `starts[rep * b + j]`.
    pub starts: Vec<u32>,
}

impl BlockPlan {
    /// Clé du flux : blake3(seed, "boot", horizon, longueur de bloc) ; un flux par réplique.
    pub fn new(n: usize, l: usize, reps: usize, seed: u64, horizon: u16) -> Self {
        let l = l.clamp(1, n);
        let b = n.div_ceil(l);
        let l_last = n - (b - 1) * l;
        let mut rng = StreamRng::new(derive_key(seed, "boot", &[horizon as u64, l as u64]));
        let mut starts = Vec::with_capacity(reps * b);
        for rep in 0..reps {
            rng.seek(rep as u64);
            for _ in 0..b {
                starts.push(index(rng.next_u64(), n) as u32);
            }
        }
        Self { n, l, b, l_last, reps, starts }
    }

    #[inline]
    pub fn rep_starts(&self, rep: usize) -> &[u32] {
        &self.starts[rep * self.b..(rep + 1) * self.b]
    }

    /// Sommes de blocs circulaires de longueur `len` : `out[s] = somme de x[(s + j) % n], j < len`.
    pub fn block_sums(x: &[f64], len: usize) -> Vec<f64> {
        let n = x.len();
        let mut pre = vec![0.0f64; 2 * n + 1];
        for i in 0..2 * n {
            pre[i + 1] = pre[i] + x[i % n];
        }
        (0..n).map(|s| pre[s + len] - pre[s]).collect()
    }

    /// Somme de la série sur chaque réplique.
    pub fn replicate_sums(&self, x: &[f64]) -> Vec<f64> {
        let full = Self::block_sums(x, self.l);
        let last = if self.l_last == self.l { None } else { Some(Self::block_sums(x, self.l_last)) };
        (0..self.reps)
            .map(|rep| {
                let st = self.rep_starts(rep);
                let mut s = 0.0;
                for &a in &st[..self.b - 1] {
                    s += full[a as usize];
                }
                let a = st[self.b - 1] as usize;
                s + last.as_ref().map(|v| v[a]).unwrap_or(full[a])
            })
            .collect()
    }

    /// Multiplicité de chaque ligne dans la réplique `rep`.
    pub fn counts(&self, rep: usize, counts: &mut [u32], diff: &mut [i32]) {
        let n = self.n;
        diff[..n + 1].iter_mut().for_each(|d| *d = 0);
        let st = self.rep_starts(rep);
        for (j, &a) in st.iter().enumerate() {
            let len = if j + 1 == self.b { self.l_last } else { self.l };
            let a = a as usize;
            let end = a + len;
            if end <= n {
                diff[a] += 1;
                diff[end] -= 1;
            } else {
                diff[a] += 1;
                diff[n] -= 1;
                diff[0] += 1;
                diff[end - n] -= 1;
            }
        }
        let mut c = 0i32;
        for i in 0..n {
            c += diff[i];
            counts[i] = c as u32;
        }
    }
}

/// Quantile de type 7 d'une réplique définie par ses multiplicités.
/// `order` liste les indices des lignes par valeur croissante ; la réplique compte `n` lignes.
pub fn weighted_quantile(values: &[f64], order: &[u32], counts: &[u32], n: usize, p: f64) -> f64 {
    let pos = p * (n - 1) as f64;
    let i0 = pos.floor() as usize;
    let fr = pos - i0 as f64;
    let mut cum = 0usize;
    let mut a = f64::NAN;
    for &ix in order {
        let c = counts[ix as usize] as usize;
        if c == 0 {
            continue;
        }
        let v = values[ix as usize];
        if a.is_nan() {
            if cum + c > i0 {
                a = v;
                if fr == 0.0 || cum + c > i0 + 1 {
                    return a + fr * (v - a);
                }
            }
        } else {
            return a + fr * (v - a);
        }
        cum += c;
    }
    a
}

/// Plusieurs quantiles de type 7 d'une même série en un seul parcours.
/// `ps` doit être strictement croissant et compter au plus 8 niveaux.
pub fn weighted_quantiles(
    values: &[f64],
    order: &[u32],
    counts: &[u32],
    n: usize,
    ps: &[f64],
    out: &mut [f64],
) {
    // Rangs nécessaires : pour chaque p, floor(p (n - 1)) et le rang suivant.
    let mut need = [0usize; 16];
    let mut got = [f64::NAN; 16];
    let m = ps.len();
    assert!(2 * m <= need.len(), "trop de niveaux pour un seul parcours");
    debug_assert!(ps.windows(2).all(|w| w[0] < w[1]), "niveaux non strictement croissants");
    for (k, p) in ps.iter().enumerate() {
        let i0 = (p * (n - 1) as f64).floor() as usize;
        need[2 * k] = i0;
        need[2 * k + 1] = (i0 + 1).min(n - 1);
    }
    // `need` est croissant au sens large : un seul curseur suffit.
    let mut cur = 0usize;
    let mut cum = 0usize;
    for &ix in order {
        let c = counts[ix as usize] as usize;
        if c == 0 {
            continue;
        }
        let end = cum + c;
        while cur < 2 * m && need[cur] < end {
            got[cur] = values[ix as usize];
            cur += 1;
        }
        if cur == 2 * m {
            break;
        }
        cum = end;
    }
    for (k, p) in ps.iter().enumerate() {
        let pos = p * (n - 1) as f64;
        let fr = pos - pos.floor();
        out[k] = got[2 * k] + fr * (got[2 * k + 1] - got[2 * k]);
    }
}

/// Intervalle percentile au niveau `level` ; les répliques non finies sont ignorées.
pub fn percentile_ci(reps: &mut Vec<f64>, level: f64) -> Option<(f64, f64)> {
    reps.retain(|x| x.is_finite());
    if reps.len() < 20 {
        return None;
    }
    crate::math::sort_f64(reps);
    let a = (1.0 - level) / 2.0;
    Some((
        crate::math::quantile_sorted(reps, a),
        crate::math::quantile_sorted(reps, 1.0 - a),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::{quantile_sorted, sort_f64};

    #[test]
    fn sums_and_counts_agree_with_explicit_resample() {
        let n = 97;
        let x: Vec<f64> = (0..n).map(|i| ((i * 31 % 17) as f64) - 8.0 + 0.01 * i as f64).collect();
        let mut order: Vec<u32> = (0..n as u32).collect();
        order.sort_by(|a, b| x[*a as usize].total_cmp(&x[*b as usize]));
        for l in [1usize, 5, 10, 33, 97] {
            let plan = BlockPlan::new(n, l, 50, 7, 3);
            let sums = plan.replicate_sums(&x);
            let mut counts = vec![0u32; n];
            let mut diff = vec![0i32; n + 1];
            for rep in 0..plan.reps {
                // Rééchantillon explicite.
                let mut res = Vec::with_capacity(n);
                for (j, &a) in plan.rep_starts(rep).iter().enumerate() {
                    let len = if j + 1 == plan.b { plan.l_last } else { plan.l };
                    for k in 0..len {
                        res.push(x[(a as usize + k) % n]);
                    }
                }
                assert_eq!(res.len(), n);
                let s: f64 = res.iter().sum();
                assert!((s - sums[rep]).abs() < 1e-9);
                plan.counts(rep, &mut counts, &mut diff);
                assert_eq!(counts.iter().sum::<u32>() as usize, n);
                sort_f64(&mut res);
                let ps = [0.05, 0.5, 0.75, 0.9, 1.0];
                let mut multi = [0.0; 5];
                weighted_quantiles(&x, &order, &counts, n, &ps, &mut multi);
                for (k, p) in ps.iter().enumerate() {
                    let w = weighted_quantile(&x, &order, &counts, n, *p);
                    assert!((w - quantile_sorted(&res, *p)).abs() < 1e-12, "l={l} p={p}");
                    assert!((multi[k] - quantile_sorted(&res, *p)).abs() < 1e-12, "l={l} p={p}");
                }
            }
        }
    }
}
