// Validation forward de E2 : règle de décision et bootstrap (research/preregistration/e2-forward.md, § 3).
// Fonctions pures, testées dans research/tests/e2-forward.test.ts ; research/shock/e2-forward.ts les
// applique aux shorts de la v1.

import { mean, rng } from './portfolio.ts'

/** Short fermé de la fenêtre forward. */
export interface FwdTrade {
  asset: string
  /** Ouverture de la bougie d'entrée et de la bougie de sortie, ms UTC. */
  entryT: number
  exitT: number
  /** Mois civil de l'entrée (année × 12 + mois). */
  month: number
  /** 1 si le régime E2 était baissier à l'entrée. */
  e2: 0 | 1
  R: number
  /** PnL net / equity à l'entrée. */
  net: number
}

export interface Look {
  kind: 'interim' | 'final'
  /** Seuil de N1 atteint (regard intermédiaire), null pour le regard final. */
  threshold: number | null
  cutoff: string
  n1: number
  n0: number
  d: number
  p: number
  alpha: number
  rejected: boolean
}

export type Status = 'en cours' | 'H1 confirmée' | 'H1 non confirmée'

export interface State {
  looks: Look[]
  status: Status
  /** Regard final non concluant avec D < 0. */
  reverse: boolean
}

export const PLAN = {
  start: Date.parse('2026-10-12T00:00:00Z'),
  interim: [25, 50, 75],
  alphaInterim: 0.001,
  finalN: 100,
  alphaFinal: 0.047,
  capCutoff: Date.parse('2031-10-01T00:00:00Z'),
  nBoot: 10000,
  seed: 20261012,
} as const

export const emptyState = (): State => ({ looks: [], status: 'en cours', reverse: false })

/** Regard dû à l'évaluation dont la coupure est `cutoff`, ou null. Un seul regard par évaluation. */
export function dueLook(state: State, n1: number, n0: number, cutoff: number): { kind: 'interim' | 'final'; threshold: number | null; alpha: number } | null {
  if (state.status !== 'en cours') return null
  if ((n1 >= PLAN.finalN && n0 >= PLAN.finalN) || cutoff >= PLAN.capCutoff) return { kind: 'final', threshold: null, alpha: PLAN.alphaFinal }
  const done = state.looks.filter(l => l.kind === 'interim').map(l => l.threshold ?? 0)
  const last = done.length ? Math.max(...done) : 0
  const crossed = PLAN.interim.filter(th => th > last && n1 >= th)
  return crossed.length ? { kind: 'interim', threshold: Math.max(...crossed), alpha: PLAN.alphaInterim } : null
}

/** État après un regard. */
export function applyLook(state: State, look: Look): State {
  const looks = [...state.looks, look]
  if (look.rejected) return { looks, status: 'H1 confirmée', reverse: false }
  if (look.kind === 'final') return { looks, status: 'H1 non confirmée', reverse: look.d < 0 }
  return { looks, status: 'en cours', reverse: false }
}

/** D = moyenne de R (E2 baissier) − moyenne de R (E2 non baissier). */
export function diff(ts: FwdTrade[]) {
  const a = ts.filter(x => x.e2 === 1).map(x => x.R), b = ts.filter(x => x.e2 === 0).map(x => x.R)
  const m1 = a.length ? mean(a) : NaN, m0 = b.length ? mean(b) : NaN
  return { n1: a.length, n0: b.length, m1, m0, d: m1 - m0 }
}

/**
 * Bootstrap par mois civils : `months` liste les mois de la fenêtre ; chaque réplication tire autant
 * de mois, avec remise, les mêmes pour les deux groupes. p = part des réplications valides où D* ≤ 0.
 */
export function bootP(ts: FwdTrade[], months: number[], nBoot: number = PLAN.nBoot, seed: number = PLAN.seed) {
  const M = months.length
  const at = new Map(months.map((m, j) => [m, j]))
  const s1 = new Float64Array(M), c1 = new Float64Array(M), s0 = new Float64Array(M), c0 = new Float64Array(M)
  for (const x of ts) {
    const j = at.get(x.month)
    if (j === undefined) throw new Error(`short hors des mois de la fenêtre : ${x.asset} ${new Date(x.entryT).toISOString()}`)
    if (x.e2 === 1) { s1[j] += x.R; c1[j]++ } else { s0[j] += x.R; c0[j]++ }
  }
  const rand = rng(seed)
  const ds: number[] = []
  let dropped = 0
  for (let b = 0; b < nBoot; b++) {
    let S1 = 0, C1 = 0, S0 = 0, C0 = 0
    for (let k = 0; k < M; k++) { const j = Math.floor(rand() * M); S1 += s1[j]; C1 += c1[j]; S0 += s0[j]; C0 += c0[j] }
    if (C1 === 0 || C0 === 0) { dropped++; continue }
    ds.push(S1 / C1 - S0 / C0)
  }
  const sorted = [...ds].sort((x, y) => x - y)
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * (sorted.length - 1))))]
  return { p: ds.length ? ds.filter(x => x <= 0).length / ds.length : NaN, valid: ds.length, dropped, ci90: ds.length ? [q(0.05), q(0.95)] : [NaN, NaN] }
}
