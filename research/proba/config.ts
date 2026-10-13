// Couche probabiliste du Shock Engine : configuration figée de l'étude
// (research/preregistration/probabilistic-layer.md). Toute modification après le premier calcul est
// un écart à consigner dans le rapport.

export const PROBA_VERSION = 'shock-proba-1.0.0'
export const PREREG = 'research/preregistration/probabilistic-layer.md'

export const DAY = 864e5
export const M15 = 15 * 60000

/** Portefeuille de référence : bougies d'entrée ouvertes dans [start, end[ (UTC). */
export const REFERENCE = {
  start: '2018-09-01',
  end: '2026-10-01',
  commissionPct: 0.045,
  /** Comptes publiés (research/reports/btc-eth-portfolio-e2/portfolio_summary.json). */
  trades: { btc: 644, ethusdt: 667 },
} as const

/** Horizons de continuation, en bougies de 15 min. */
export const HORIZONS = [1, 4, 16, 64] as const
export type Horizon = (typeof HORIZONS)[number]

/** Événements sur R : R > 0, R ≥ 1, R ≥ 2, R ≥ 3. */
export const R_EVENTS = [
  { key: 'win', label: 'R > 0', test: (r: number) => r > 0 },
  { key: 'r1', label: 'R ≥ 1', test: (r: number) => r >= 1 },
  { key: 'r2', label: 'R ≥ 2', test: (r: number) => r >= 2 },
  { key: 'r3', label: 'R ≥ 3', test: (r: number) => r >= 3 },
] as const
export type EventKey = (typeof R_EVENTS)[number]['key']

/** Caractéristiques des modèles (§ 3) et leur transformation. */
export const FEATURE_SPECS = {
  absZ: { transform: 'log', continuous: true },
  volZ: { transform: 'none', continuous: true },
  breakAtr: { transform: 'log1p', continuous: true },
  closeQ: { transform: 'none', continuous: true },
  lamPct: { transform: 'none', continuous: true },
  rv: { transform: 'log', continuous: true },
  volPct: { transform: 'none', continuous: true },
  htfDist: { transform: 'none', continuous: true },
  isShort: { transform: 'none', continuous: false },
  isEth: { transform: 'none', continuous: false },
  agitated: { transform: 'none', continuous: false },
} as const
export type FeatureName = keyof typeof FEATURE_SPECS

/** Jeux de variables des modèles logistiques (§ 5). */
export const MODEL_FEATURES: Record<'context' | 'reduced' | 'full', FeatureName[]> = {
  context: ['isShort', 'isEth', 'agitated'],
  reduced: ['absZ', 'volZ', 'breakAtr'],
  full: ['absZ', 'volZ', 'breakAtr', 'closeQ', 'lamPct', 'rv', 'volPct', 'htfDist', 'isShort', 'isEth', 'agitated'],
}
export type LogitModel = keyof typeof MODEL_FEATURES

/** Ordre de préférence des probabilités affichées pour une cible (complet, sinon réduit, sinon naïf). */
export const DISPLAY_ORDER: (LogitModel | 'naive')[] = ['full', 'reduced', 'naive']

export const WALK = {
  /** Début du premier trimestre de test. */
  firstTest: '2021-01-01',
  /** Longueur d'un pli de test, en mois civils. */
  stepMonths: 3,
  /** Un label entre dans l'entraînement s'il est connu au plus tard à T_k − embargo. */
  embargoMs: DAY,
  /** Validation interne : blocs chronologiques d'effectifs égaux (blocs − 1 plis). */
  innerBlocks: 4,
}

export const LAMBDAS = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000]
export const WINSOR = [0.01, 0.99] as const
/** Événements par variable minimum (règle de complexité, § 5). */
export const EPV_MIN = 10

export const CALIBRATION = { minObs: 200, minPos: 30, minNeg: 30 }

export const BOOT = { reps: 2000, seed: 20261012, level: 0.95 }
export const FROZEN_BOOT = { reps: 300, seed: 20261013, level: 0.9 }

/** Seuils de décision (§ 8). */
export const ALPHA = 0.05
/** Normalisation ambiguë : commissions supérieures à cette part du risque initial. */
export const AMBIGUOUS_FEES_R = 0.5
/** Test prospectif : nombre minimal de signaux prospectifs fermés (§ 9). */
export const PROSPECTIVE_MIN = 300
