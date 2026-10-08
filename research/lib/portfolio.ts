// Calculs du portefeuille de sleeves : rendements journaliers, métriques, corrélations, drawdowns,
// contributions au risque, bootstrap par blocs de mois. Fonctions pures, sans lecture de fichier.
//
// Conventions : jours UTC (marché ouvert en continu), annualisation par 365,25 jours, taux sans
// risque nul, écart type de population. Un rendement journalier est le rapport de deux valeurs
// de clôture (dernière bougie du jour), jamais interpolé.

export const DAY = 864e5
export const ANN = 365.25

// ---------------------------------------------------------------- statistiques de base
export const sum = (xs: ArrayLike<number>) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return s }
export const mean = (xs: ArrayLike<number>) => (xs.length ? sum(xs) / xs.length : NaN)
export function sd(xs: ArrayLike<number>): number {
  const mu = mean(xs)
  let s = 0
  for (let i = 0; i < xs.length; i++) s += (xs[i] - mu) ** 2
  return xs.length ? Math.sqrt(s / xs.length) : NaN
}
export function quantile(xs: ArrayLike<number>, q: number): number {
  const s = Array.from(xs).filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return NaN
  const p = (s.length - 1) * q, k = Math.floor(p), f = p - k
  return k + 1 < s.length ? s[k] + f * (s[k + 1] - s[k]) : s[k]
}
export function moments(xs: ArrayLike<number>) {
  const mu = mean(xs), s = sd(xs)
  let m3 = 0, m4 = 0
  for (let i = 0; i < xs.length; i++) { const z = (xs[i] - mu) / s; m3 += z ** 3; m4 += z ** 4 }
  return { mean: mu, sd: s, skew: s > 0 ? m3 / xs.length : NaN, kurt: s > 0 ? m4 / xs.length : NaN }
}
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return NaN
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i] }
  const mx = sx / n, my = sy / n
  let sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxx += a * a; syy += b * b; sxy += a * b }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN
}
/** Rangs moyens (ex aequo : rang moyen), base 1. */
export function ranks(x: ArrayLike<number>): Float64Array {
  const n = x.length
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b])
  const r = new Float64Array(n)
  for (let i = 0; i < n;) {
    let j = i
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) r[idx[k]] = avg
    i = j + 1
  }
  return r
}
export const spearman = (x: ArrayLike<number>, y: ArrayLike<number>) => pearson(ranks(x), ranks(y))

/** Générateur pseudo-aléatoire de zero-shot.ts (graine fixe : résultats reproductibles). */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
}
export function gauss(rand: () => number) {
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let u = 0
    while (u <= 1e-300) u = rand()
    const v = rand(), r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
}

// ---------------------------------------------------------------- dates
export const isoDay = (d: number) => new Date(d * DAY).toISOString().slice(0, 10)
export const monthKey = (d: number) => { const x = new Date(d * DAY); return x.getUTCFullYear() * 12 + x.getUTCMonth() }
export const yearOf = (d: number) => new Date(d * DAY).getUTCFullYear()
export const monthLabel = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`
/** Semaine ISO (lundi → dimanche, UTC) : numéro du lundi. */
export const weekKey = (d: number) => d - ((new Date(d * DAY).getUTCDay() + 6) % 7)

/**
 * Valeur de clôture de chaque jour : equity de la dernière barre du jour (barres horodatées à
 * l'ouverture : la barre 23 h 45 clôt à minuit). Un jour sans barre garde la valeur de la veille
 * (rendement nul) et est compté dans `missing`.
 */
export function dayCloses(t: Float64Array, eq: Float64Array, a: number, b: number, days: number[], base: number) {
  const out = new Array<number>(days.length)
  let i = a, prev = base, missing = 0
  for (let k = 0; k < days.length; k++) {
    const endMs = (days[k] + 1) * DAY
    let last = -1
    while (i <= b && t[i] < endMs) { last = i; i++ }
    if (last >= 0) prev = eq[last]
    else missing++
    out[k] = prev
  }
  return { eq: out, missing }
}
export function returnsOf(eq: number[], base: number): number[] {
  const r = new Array<number>(eq.length)
  let prev = base
  for (let k = 0; k < eq.length; k++) { r[k] = eq[k] / prev - 1; prev = eq[k] }
  return r
}
export function compound(r: ArrayLike<number>, base = 1): number[] {
  const out = new Array<number>(r.length)
  let v = base
  for (let k = 0; k < r.length; k++) { v *= 1 + r[k]; out[k] = v }
  return out
}

/** Rendements composés par période (semaine, mois, année) ; `full` : période complète dans l'échantillon. */
export function periodReturns(r: number[], days: number[], key: (d: number) => number, full?: (k: number, n: number) => boolean) {
  const out: { key: number; ret: number; n: number; from: number; to: number; full: boolean }[] = []
  for (let i = 0; i < r.length; i++) {
    const k = key(days[i])
    const last = out[out.length - 1]
    if (last && last.key === k) { last.ret = (1 + last.ret) * (1 + r[i]) - 1; last.n++; last.to = days[i] }
    else out.push({ key: k, ret: r[i], n: 1, from: days[i], to: days[i], full: true })
  }
  if (full) for (const p of out) p.full = full(p.key, p.n)
  return out
}

// ---------------------------------------------------------------- drawdowns
export function underwater(eq: number[], base: number): number[] {
  let peak = base
  return eq.map(v => { if (v > peak) peak = v; return v / peak - 1 })
}
export function maxDrawdown(eq: ArrayLike<number>, base: number): number {
  let peak = base, dd = 0
  for (let i = 0; i < eq.length; i++) { const v = eq[i]; if (v > peak) peak = v; else dd = Math.min(dd, v / peak - 1) }
  return dd
}
export interface Episode {
  /** Indices de jour : sommet (dernier jour au plus haut avant la baisse), creux, retour au sommet (null : pas encore). */
  peak: number
  trough: number
  recovery: number | null
  depth: number
  /** Jours du sommet au retour (ou à la fin de l'échantillon), du creux au retour. */
  days: number
  recoveryDays: number | null
}
/** Épisodes de baisse : du sommet au retour au sommet. Indice -1 = valeur de départ (avant le 1er jour). */
export function episodes(eq: number[], base: number): Episode[] {
  const out: Episode[] = []
  let peak = base, peakIdx = -1, cur: Episode | null = null
  for (let i = 0; i < eq.length; i++) {
    const v = eq[i]
    if (v >= peak) {
      if (cur) { cur.recovery = i; cur.days = i - cur.peak; cur.recoveryDays = i - cur.trough; out.push(cur); cur = null }
      peak = v; peakIdx = i
    } else {
      const dd = v / peak - 1
      if (!cur) cur = { peak: peakIdx, trough: i, recovery: null, depth: dd, days: 0, recoveryDays: null }
      else if (dd < cur.depth) { cur.depth = dd; cur.trough = i }
    }
  }
  if (cur) { cur.days = eq.length - 1 - cur.peak; out.push(cur) }
  return out
}

// ---------------------------------------------------------------- métriques journalières
export function dailyMetrics(r: number[], days: number[]) {
  const n = r.length
  const years = n / ANN
  const eq = compound(r)
  const total = eq[n - 1] - 1
  const mo = moments(r)
  let down = 0
  for (const x of r) if (x < 0) down += x * x
  const downDev = Math.sqrt(down / n)
  const dd = maxDrawdown(eq, 1)
  const cagr = Math.pow(1 + total, 1 / years) - 1
  const months = periodReturns(r, days, monthKey)
  const yrs = periodReturns(r, days, yearOf)
  let bi = 0, wi = 0
  for (let i = 1; i < n; i++) { if (r[i] > r[bi]) bi = i; if (r[i] < r[wi]) wi = i }
  const ext = <T extends { ret: number }>(xs: T[], best: boolean) => xs.reduce((a, b) => ((best ? b.ret > a.ret : b.ret < a.ret) ? b : a))
  let gp = 0, gl = 0
  for (const x of r) { if (x > 0) gp += x; else gl += x }
  return {
    days: n, years, totalReturn: total, cagr,
    vol: mo.sd * Math.sqrt(ANN), sharpe: mo.sd > 0 ? (mo.mean / mo.sd) * Math.sqrt(ANN) : NaN,
    sortino: downDev > 0 ? (mo.mean / downDev) * Math.sqrt(ANN) : NaN, downsideDev: downDev * Math.sqrt(ANN),
    maxDD: dd, calmar: dd < 0 ? cagr / -dd : NaN, skew: mo.skew, kurt: mo.kurt,
    bestDay: { day: days[bi], ret: r[bi] }, worstDay: { day: days[wi], ret: r[wi] },
    bestMonth: ext(months, true), worstMonth: ext(months, false), bestYear: ext(yrs, true), worstYear: ext(yrs, false),
    positiveDays: r.filter(x => x > 0).length / n, flatDays: r.filter(x => x === 0).length / n,
    /** Somme des rendements journaliers positifs sur celle des négatifs (proxy de profit factor). */
    dailyPF: gl < 0 ? gp / -gl : NaN,
  }
}

// ---------------------------------------------------------------- portefeuilles
export interface Book {
  /** Valeur de chaque sleeve et du total à la clôture de chaque jour (après rebalancement). */
  vA: number[]
  vB: number[]
  v: number[]
  r: number[]
  /** Poids de A à la clôture (avant rebalancement du jour). */
  wA: number[]
  /** Coût de rebalancement cumulé et nominal échangé, en monnaie du portefeuille. */
  cost: number
  traded: number
  rebalances: number
}

/**
 * Deux sleeves indépendantes : chacune compose son propre capital (wA0 × base et (1 − wA0) × base)
 * avec ses propres rendements. Valeur du portefeuille = somme des deux. `rebalance[k]` : à la
 * clôture du jour k, retour aux poids `target(k)` ; les positions ouvertes sont redimensionnées
 * (nominal échangé = |transfert| × exposition brute de la sleeve), commission `comm` par unité.
 */
export function book(rA: number[], rB: number[], opt: {
  wA0?: number; base?: number; rebalance?: boolean[]; target?: (k: number) => number; xA?: number[]; xB?: number[]; comm?: number
} = {}): Book {
  const base = opt.base ?? 100, w0 = opt.wA0 ?? 0.5, comm = opt.comm ?? 0
  let a = base * w0, b = base * (1 - w0), prev = base
  const out: Book = { vA: [], vB: [], v: [], r: [], wA: [], cost: 0, traded: 0, rebalances: 0 }
  for (let k = 0; k < rA.length; k++) {
    a *= 1 + rA[k]
    b *= 1 + rB[k]
    out.wA.push(a / (a + b))
    if (opt.rebalance?.[k] && opt.target) {
      const v = a + b, w = opt.target(k)
      const dA = w * v - a, dB = (1 - w) * v - b
      const tA = Math.abs(dA) * (opt.xA?.[k] ?? 0), tB = Math.abs(dB) * (opt.xB?.[k] ?? 0)
      a += dA - tA * comm
      b += dB - tB * comm
      out.cost += (tA + tB) * comm
      out.traded += tA + tB
      out.rebalances++
    }
    out.vA.push(a); out.vB.push(b); out.v.push(a + b)
    out.r.push((a + b) / prev - 1)
    prev = a + b
  }
  return out
}

/** Dernier jour de chaque mois civil. */
export const monthEnds = (days: number[]) => days.map((d, k) => k === days.length - 1 || monthKey(days[k + 1]) !== monthKey(d))

/**
 * Poids « risque égal » causal : wA ∝ 1/σA sur les `win` jours qui finissent au jour k inclus
 * (connus à la clôture où l'on rebalance). Moins de `win` jours, ou σ nul : 50/50.
 */
export function equalRiskTarget(rA: number[], rB: number[], win: number) {
  return (k: number) => {
    if (k + 1 < win) return 0.5
    const sa = sd(rA.slice(k + 1 - win, k + 1)), sb = sd(rB.slice(k + 1 - win, k + 1))
    if (!(sa > 0) || !(sb > 0)) return 0.5
    return (1 / sa) / (1 / sa + 1 / sb)
  }
}

// ---------------------------------------------------------------- corrélations
export function rollingCorr(x: number[], y: number[], win: number): number[] {
  const out = new Array<number>(x.length).fill(NaN)
  for (let k = win - 1; k < x.length; k++) out[k] = pearson(x.slice(k + 1 - win, k + 1), y.slice(k + 1 - win, k + 1))
  return out
}
export function distribution(xs: number[]) {
  const f = xs.filter(Number.isFinite)
  return { n: f.length, median: quantile(f, 0.5), p10: quantile(f, 0.1), p90: quantile(f, 0.9), min: Math.min(...f), max: Math.max(...f), mean: mean(f) }
}
export function subsetCorr(x: number[], y: number[], mask: boolean[]) {
  const a: number[] = [], b: number[] = []
  for (let i = 0; i < x.length; i++) if (mask[i]) { a.push(x[i]); b.push(y[i]) }
  return { n: a.length, pearson: pearson(a, b), spearman: spearman(a, b) }
}

/**
 * Référence « dépendance constante » pour les corrélations conditionnelles : copule gaussienne
 * avec les marges observées (chaque série simulée est une permutation des rendements réels),
 * calibrée pour redonner la corrélation de Pearson observée sur tous les jours. Conditionner sur
 * des jours de baisse change mécaniquement la corrélation (biais de troncature) : la référence
 * dit ce que la même règle donnerait sans contagion. `stats` : mesures calculées sur chaque tirage.
 */
export function copulaNull(x: number[], y: number[], stats: ((a: number[], b: number[]) => number)[], nSim: number, seed: number) {
  const n = x.length
  const sx = [...x].sort((p, q) => p - q), sy = [...y].sort((p, q) => p - q)
  const target = pearson(x, y)
  const draw = (rho: number, sim: number) => {
    const g = gauss(rng(seed + sim * 7919))
    const z1 = new Float64Array(n), z2 = new Float64Array(n)
    for (let i = 0; i < n; i++) { const u = g(), v = g(); z1[i] = u; z2[i] = rho * u + Math.sqrt(1 - rho * rho) * v }
    const r1 = ranks(z1), r2 = ranks(z2)
    const a = new Array<number>(n), b = new Array<number>(n)
    for (let i = 0; i < n; i++) { a[i] = sx[r1[i] - 1]; b[i] = sy[r2[i] - 1] }
    return { a, b }
  }
  // Calibration du paramètre de la copule (bisection, 20 tirages fixes par essai).
  let lo = -0.99, hi = 0.99
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2
    let c = 0
    for (let s = 0; s < 20; s++) { const { a, b } = draw(mid, s); c += pearson(a, b) }
    if (c / 20 < target) lo = mid; else hi = mid
  }
  const rho = (lo + hi) / 2
  const res = stats.map(() => [] as number[])
  for (let s = 0; s < nSim; s++) {
    const { a, b } = draw(rho, 1000 + s)
    stats.forEach((f, j) => res[j].push(f(a, b)))
  }
  return { rho, stats: res.map(v => ({ mean: mean(v.filter(Number.isFinite)), p5: quantile(v, 0.05), p95: quantile(v, 0.95) })) }
}

// ---------------------------------------------------------------- risque
/** Contributions au risque d'un portefeuille à deux actifs, poids w = [wA, wB], rendements journaliers. */
export function riskContrib(rA: number[], rB: number[], w: [number, number]) {
  const ma = mean(rA), mb = mean(rB)
  let caa = 0, cbb = 0, cab = 0
  for (let i = 0; i < rA.length; i++) { const a = rA[i] - ma, b = rB[i] - mb; caa += a * a; cbb += b * b; cab += a * b }
  caa /= rA.length; cbb /= rA.length; cab /= rA.length
  const S = [[caa, cab], [cab, cbb]]
  const Sw = [S[0][0] * w[0] + S[0][1] * w[1], S[1][0] * w[0] + S[1][1] * w[1]]
  const varP = w[0] * Sw[0] + w[1] * Sw[1]
  const sigP = Math.sqrt(varP)
  const sig = [Math.sqrt(caa), Math.sqrt(cbb)]
  const mrc = [Sw[0] / sigP, Sw[1] / sigP]
  const crc = [w[0] * mrc[0], w[1] * mrc[1]]
  const dr = (w[0] * sig[0] + w[1] * sig[1]) / sigP
  // Nombre effectif de paris : DR² (Choueifaty) et entropie des contributions des composantes principales (Meucci).
  const tr = caa + cbb, det = caa * cbb - cab * cab
  const l1 = tr / 2 + Math.sqrt(Math.max(tr * tr / 4 - det, 0)), l2 = tr / 2 - Math.sqrt(Math.max(tr * tr / 4 - det, 0))
  const e1 = Math.abs(cab) > 1e-18 ? [l1 - cbb, cab] : caa >= cbb ? [1, 0] : [0, 1]
  const nrm = Math.hypot(e1[0], e1[1]); e1[0] /= nrm; e1[1] /= nrm
  const e2 = [-e1[1], e1[0]]
  const p1 = (w[0] * e1[0] + w[1] * e1[1]) ** 2 * l1, p2 = (w[0] * e2[0] + w[1] * e2[1]) ** 2 * l2
  const ps = [p1 / (p1 + p2), p2 / (p1 + p2)].filter(p => p > 0)
  const enbPca = Math.exp(-ps.reduce((s, p) => s + p * Math.log(p), 0))
  return {
    cov: S, corr: cab / Math.sqrt(caa * cbb), sigma: sig.map(s => s * Math.sqrt(ANN)), sigmaP: sigP * Math.sqrt(ANN),
    mrc: mrc.map(x => x * Math.sqrt(ANN)), crc: crc.map(x => x * Math.sqrt(ANN)), pct: [crc[0] / sigP, crc[1] / sigP],
    dr, enbDR2: dr * dr, enbPca,
  }
}

// ---------------------------------------------------------------- bootstrap
/**
 * Bootstrap par blocs de mois civils, tirés avec remise et **conjointement** pour les deux sleeves
 * (le même mois pour BTC et ETH : la dépendance entre eux est conservée). Chaque réplication
 * rejoue le portefeuille 50/50 sans rebalancement sur le chemin tiré.
 */
export function blockBootstrap(rA: number[], rB: number[], days: number[], nRep: number, seed: number) {
  const blocks: number[][] = []
  for (let i = 0; i < days.length; i++) {
    const k = monthKey(days[i])
    if (!blocks.length || monthKey(days[blocks[blocks.length - 1][0]]) !== k) blocks.push([])
    blocks[blocks.length - 1].push(i)
  }
  const rand = rng(seed)
  const out = { sharpeA: [] as number[], sharpeB: [] as number[], sharpeP: [] as number[], cagrP: [] as number[], ddP: [] as number[], cagrA: [] as number[], cagrB: [] as number[], ddA: [] as number[], ddB: [] as number[] }
  const sharpe = (xs: number[]) => { const s = sd(xs); return s > 0 ? (mean(xs) / s) * Math.sqrt(ANN) : 0 }
  for (let rep = 0; rep < nRep; rep++) {
    const a: number[] = [], b: number[] = []
    for (let j = 0; j < blocks.length; j++) { const blk = blocks[Math.floor(rand() * blocks.length)]; for (const i of blk) { a.push(rA[i]); b.push(rB[i]) } }
    const p = book(a, b)
    const yrs = a.length / ANN
    const ea = compound(a), eb = compound(b)
    out.sharpeA.push(sharpe(a)); out.sharpeB.push(sharpe(b)); out.sharpeP.push(sharpe(p.r))
    out.cagrP.push(Math.pow(p.v[p.v.length - 1] / 100, 1 / yrs) - 1)
    out.cagrA.push(Math.pow(ea[ea.length - 1], 1 / yrs) - 1); out.cagrB.push(Math.pow(eb[eb.length - 1], 1 / yrs) - 1)
    out.ddP.push(maxDrawdown(p.v, 100)); out.ddA.push(maxDrawdown(ea, 1)); out.ddB.push(maxDrawdown(eb, 1))
  }
  return { blocks: blocks.length, ...out }
}

// ---------------------------------------------------------------- recouvrement des trades
/** Part des événements de `xs` qui ont un événement de `ys` de même sens à moins de `w` ms. */
export function matchShare(xs: { t: number; dir: number }[], ys: { t: number; dir: number }[], w: number) {
  const byDir = new Map<number, number[]>()
  for (const y of ys) { if (!byDir.has(y.dir)) byDir.set(y.dir, []); byDir.get(y.dir)!.push(y.t) }
  for (const v of byDir.values()) v.sort((a, b) => a - b)
  let hit = 0
  for (const x of xs) {
    const arr = byDir.get(x.dir)
    if (!arr) continue
    let lo = 0, hi = arr.length
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x.t - w) lo = m + 1; else hi = m }
    if (lo < arr.length && arr[lo] <= x.t + w) hit++
  }
  return xs.length ? hit / xs.length : NaN
}

/** Part des `q` plus grandes valeurs dans la somme. */
export function topShare(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => b - a)
  const k = Math.max(1, Math.round(q * s.length))
  const top = s.slice(0, k).reduce((a, b) => a + b, 0)
  const tot = s.reduce((a, b) => a + b, 0)
  return { k, top, total: tot, share: tot !== 0 ? top / tot : NaN }
}
