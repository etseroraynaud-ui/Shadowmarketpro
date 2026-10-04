// Paramètres du Shock Engine : les inputs du script Pine, avec leurs valeurs par défaut, plus
// quelques réglages de recherche dont la valeur par défaut reproduit le script tel quel.

export interface ShockParams {
  // Mode d'activité
  highActivityMode: boolean
  // Détection des chocs
  volWin: number
  kMain: number
  useMicroShock: boolean
  kMicro: number
  rangeWin: number
  wickThr: number
  // Cooldown
  cooldownBars: number
  // Régime lambda
  lamEmaWin: number
  lamNormWin: number
  lamPctThr: number
  onlyHighLam: boolean
  // Filtre de tendance 60 min
  useHTF: boolean
  /** HTF Timeframe, en minutes (60 = « 60 », 4320 = « 3 jours »). */
  htfMinutes: number
  htfEmaLen: number
  // Volume
  useVolFilter: boolean
  volZWin: number
  volZThr: number
  volFadeMax: number
  // Compression
  useCompression: boolean
  atrZWin: number
  compThr: number
  // Mode de trade
  directionalOnly: boolean
  fadeOnlyLowLam: boolean
  // Risque
  atrLen: number
  atrStopMult: number
  atrTrailMult: number
  // Prise de profit partielle
  useTP1: boolean
  tp1AtrMult: number
  tp1QtyPct: number
  // Sortie VWAP (fade)
  useVWAPExit: boolean
  vwapLen: number
  // Flip exit
  useFlipExit: boolean
  flipMainOnly: boolean
  flipIncludeFade: boolean
  flipMinLifeATR: number

  // ---- Réglages de recherche (défaut = comportement du script) ----
  /** Seuil de lambda codé en dur dans longRegimeOK (55 dans le script). */
  longLamPct: number
  /** Pente du filtre 60 min : comparaison avec la valeur d'il y a N barres… */
  htfSlopeBars: number
  /** …du graphique (« chart », comme le script) ou du timeframe 60 min (« htf »). */
  htfSlopeMode: 'chart' | 'htf'
  /** Autoriser les longs, les shorts. */
  allowLong: boolean
  allowShort: boolean
  /** Entrées « impulse » (continuation) ; false = seulement les entrées « fade ». */
  useImpulse: boolean
}

export const DEFAULT_PARAMS: ShockParams = {
  highActivityMode: true,
  volWin: 80,
  kMain: 2.2,
  useMicroShock: true,
  kMicro: 1.3,
  rangeWin: 20,
  wickThr: 0.5,
  cooldownBars: 6,
  lamEmaWin: 150,
  lamNormWin: 300,
  lamPctThr: 50,
  onlyHighLam: false,
  useHTF: true,
  htfMinutes: 60,
  htfEmaLen: 50,
  useVolFilter: true,
  volZWin: 30,
  volZThr: 0.2,
  volFadeMax: 1.0,
  useCompression: false,
  atrZWin: 30,
  compThr: 0.0,
  directionalOnly: true,
  fadeOnlyLowLam: true,
  atrLen: 14,
  atrStopMult: 1.5,
  atrTrailMult: 1.8,
  useTP1: true,
  tp1AtrMult: 1.2,
  tp1QtyPct: 50,
  useVWAPExit: true,
  vwapLen: 30,
  useFlipExit: true,
  flipMainOnly: false,
  flipIncludeFade: true,
  flipMinLifeATR: 0.0,
  longLamPct: 55,
  htfSlopeBars: 3,
  htfSlopeMode: 'chart',
  allowLong: true,
  allowShort: true,
  useImpulse: true,
}

/** Coûts et exécution, repris de strategy() : capital, taille, commission, glissement. */
export interface Costs {
  capital: number
  /** Taille en % du capital (default_qty_value). */
  qtyPct: number
  /** Commission en % de la valeur échangée, par ordre. */
  commissionPct: number
  /** Glissement en ticks sur les ordres au marché et les stops. */
  slippageTicks: number
  /** Glissement supplémentaire en % (écart acheteur-vendeur, impact), pour les tests de coûts. */
  slippagePct: number
  /** Pas de cotation (syminfo.mintick). */
  mintick: number
}

export const SCRIPT_COSTS: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.02, slippageTicks: 1, slippagePct: 0, mintick: 0.01 }

/** Coûts réalistes pour un compte taker sur un exchange crypto courant. */
export const REALISTIC_COSTS: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.05, slippageTicks: 0, slippagePct: 0.01, mintick: 0.01 }

/** Espace de recherche des paramètres qui comptent, avec leurs bornes (inputs du script). */
export interface Range {
  key: keyof ShockParams
  min: number
  max: number
  step: number
}

export const SEARCH_SPACE: Range[] = [
  { key: 'kMain', min: 1.6, max: 3.4, step: 0.1 },
  { key: 'kMicro', min: 1.0, max: 2.0, step: 0.1 },
  { key: 'volWin', min: 30, max: 200, step: 10 },
  { key: 'rangeWin', min: 5, max: 60, step: 5 },
  { key: 'wickThr', min: 0.3, max: 0.7, step: 0.05 },
  { key: 'cooldownBars', min: 2, max: 24, step: 1 },
  { key: 'volZThr', min: -0.5, max: 1.5, step: 0.1 },
  { key: 'htfEmaLen', min: 10, max: 100, step: 5 },
  { key: 'atrStopMult', min: 0.8, max: 3.5, step: 0.1 },
  { key: 'atrTrailMult', min: 0.8, max: 4.0, step: 0.1 },
  { key: 'tp1AtrMult', min: 0.5, max: 3.0, step: 0.1 },
  { key: 'tp1QtyPct', min: 20, max: 80, step: 10 },
]

export function withParams(base: ShockParams, over: Partial<Record<keyof ShockParams, unknown>>): ShockParams {
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(over)) {
    if (!(k in base)) throw new Error(`paramètre inconnu : ${k}`)
    const cur = (base as unknown as Record<string, unknown>)[k]
    if (typeof cur === 'boolean') out[k] = v === true || v === 'true' || v === 1 || v === '1'
    else if (typeof cur === 'number') out[k] = Number(v)
    else out[k] = v
  }
  return out as unknown as ShockParams
}

/**
 * Réglages utilisés sur TradingView en octobre 2026 (captures d'écran) : 30 min,
 * High Activity désactivé, filtre HTF en 3 jours, compression activée, stop 2 ATR, trailing
 * 1,5 ATR, TP1 2 ATR sur 70 %, flip seulement sur choc principal.
 */
export const USER_2026: Partial<Record<keyof ShockParams, unknown>> = {
  highActivityMode: false,
  volWin: 80, kMain: 2.2, useMicroShock: true, kMicro: 1.3, rangeWin: 20, wickThr: 0.5,
  cooldownBars: 6,
  lamEmaWin: 150, lamNormWin: 300, lamPctThr: 50, onlyHighLam: false,
  useHTF: true, htfMinutes: 4320, htfEmaLen: 50,
  useVolFilter: true, volZWin: 55, volZThr: 0.2, volFadeMax: 1,
  useCompression: true, atrZWin: 30, compThr: 0,
  directionalOnly: true, fadeOnlyLowLam: false,
  atrLen: 18, atrStopMult: 2, atrTrailMult: 1.5,
  useTP1: true, tp1AtrMult: 2, tp1QtyPct: 70,
  useVWAPExit: true, vwapLen: 30,
  useFlipExit: true, flipMainOnly: true, flipIncludeFade: true, flipMinLifeATR: 0,
}
