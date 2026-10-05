// État persistant du bot live : variables du script, position et ordres, dernière bougie traitée,
// ordre en cours d'envoi. Écrit de façon atomique après chaque changement ; relu et comparé à
// Hyperliquid au démarrage. Un verrou empêche deux instances de piloter le même compte.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { StrategyState, EntryTag } from '../../../lib/strategies/shock/strategy.ts'
import type { OrderKind, Side } from '../exec/exchange.ts'

/** Position ouverte par le bot, telle qu'il la suit. */
export interface LivePosition {
  dir: 1 | -1
  /** Taille attendue (unités de l'actif), confirmée par l'exchange. */
  size: number
  /** Prix moyen d'entrée (position_avg_price). */
  avg: number
  set: number
  tag: EntryTag
  /** Ouverture de la barre du signal d'entrée (l'entrée a lieu à sa clôture). */
  entryBar: number
  /** Clôture de la barre du signal : prix d'entrée du backtest, référence de l'écart d'exécution. */
  refEntry: number
  atrAtEntry: number
  context: { regime: number; z: number; volZ: number; lamPct: number }
  // Ordres de sortie du script (posés à la clôture qui suit l'entrée).
  exitsActive: boolean
  stop: number
  tp: number
  trailDist: number
  useTP1: boolean
  tp1QtyPct: number
  tp1Filled: boolean
  trailActive: boolean
  best: number
  /** Niveau et taille du stop actuellement posé chez l'exchange. */
  stopTrigger: number | null
  stopSz?: number
  stopOid: number | null
  stopCloid?: string | null
  tp1Oid: number | null
  tp1Cloid?: string | null
  emergencyOid: number | null
  /** Ordres de la position (entrée, sorties) : leurs fills sont comptés dans ce trade. */
  oids: number[]
  /** Identifiants client de ces ordres (un fill est reconnu par l'un ou l'autre). */
  cloids: string[]
  // Suivi
  hi: number
  lo: number
  fees: number
  funding: number
  closedPnl: number
  slippage: number
  exitValue: number
  exitQty: number
  exits: string[]
  /** Spread à l'envoi de l'ordre d'entrée et de la fermeture au marché, en points de base. */
  spreadEntryBps?: number
  spreadExitBps?: number
}

export interface BotState {
  version: 1
  network: 'testnet' | 'mainnet'
  coin: string
  account: string
  /** Première bougie de l'historique du moteur : les indices de barre en dépendent. */
  anchor: number
  /** Dernière bougie close traitée. */
  lastBarTime: number
  /** Variables du script ; lastTradeBar est remplacé par l'heure de cette barre. */
  strategy: Omit<StrategyState, 'lastTradeBar'> & { lastTradeTime: number | null }
  position: LivePosition | null
  /** Fills et financement déjà comptés. */
  seenFills: number[]
  lastFillTime: number
  lastFundingTime: number
  /** Raison de l'arrêt des ordres, ou null. Effacé seulement à la main (BOT_RESET_STATE=1). */
  halted: string | null
  /**
   * Ordre en cours d'envoi, écrit avant l'envoi et effacé avec l'état qui suit sa réponse : au
   * redémarrage, un ordre encore là a pu partir sans que le bot connaisse son issue ; il est
   * retrouvé chez l'exchange par son cloid, jamais renvoyé.
   */
  pending: PendingOrder | null
}

export interface PendingOrder {
  cloid: string
  kind: OrderKind
  side: Side
  sz: number
  /** Heure locale de l'envoi. */
  at: number
}

/** JSON ne connaît pas NaN : les variables du script en contiennent. */
const encode = (_k: string, v: unknown) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v)
const decode = (_k: string, v: unknown) => (v === '__NaN__' ? NaN : v)

export class StateStore {
  readonly file: string

  constructor(file: string) {
    this.file = file
  }

  load(): BotState | null {
    if (!existsSync(this.file)) return null
    const s = JSON.parse(readFileSync(this.file, 'utf8'), decode) as BotState
    if (s.version !== 1) throw new Error(`${this.file} : version d'état inconnue`)
    // Champs ajoutés depuis la première version de l'état.
    s.pending ??= null
    if (s.position) s.position.cloids ??= []
    return s
  }

  /**
   * Verrou d'instance : un seul processus par fichier d'état. Un verrou laissé par un processus
   * qui n'existe plus est repris. Renvoie la fonction qui le libère.
   */
  lock(): () => void {
    const file = `${this.file}.lock`
    mkdirSync(dirname(file), { recursive: true })
    for (let k = 0; k < 2; k++) {
      try {
        writeFileSync(file, String(process.pid), { flag: 'wx' })
        let held = true
        return () => {
          if (held) { held = false; try { unlinkSync(file) } catch { /* déjà libéré */ } }
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
        const pid = Number(readFileSync(file, 'utf8'))
        if (Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid && alive(pid)) {
          throw new Error(`une autre instance du bot (pid ${pid}) utilise ${this.file} : arrêt pour éviter les ordres en double`)
        }
        unlinkSync(file)
      }
    }
    throw new Error(`verrou ${file} impossible à prendre`)
  }

  save(s: BotState): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(s, encode, 1))
    renameSync(tmp, this.file)
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Indice d'une barre à partir de son heure d'ouverture (recherche dichotomique), -1 si absente. */
export function indexOfTime(t: Float64Array, time: number): number {
  let lo = 0
  let hi = t.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t[mid] === time) return mid
    if (t[mid] < time) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

export function saveStrategy(s: StrategyState, t: Float64Array): BotState['strategy'] {
  const { lastTradeBar, ...rest } = s
  return { ...rest, lastTradeTime: Number.isNaN(lastTradeBar) ? null : t[lastTradeBar] }
}

export function loadStrategy(s: BotState['strategy'], t: Float64Array): StrategyState {
  const { lastTradeTime, ...rest } = s
  let lastTradeBar = NaN
  if (lastTradeTime != null) {
    lastTradeBar = indexOfTime(t, lastTradeTime)
    if (lastTradeBar < 0) throw new Error(`barre du dernier trade (${new Date(lastTradeTime).toISOString()}) absente de l'historique`)
  }
  return { ...rest, lastTradeBar }
}
