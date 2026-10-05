// Journal du bot : chaque événement (signal, ordre, fill, erreur, état) en JSONL, et une ligne CSV
// par trade fermé, avec tout ce qu'il faut pour le comparer au backtest.

import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Mode } from './config.ts'

export interface TradeLog {
  mode: Mode
  side: 'long' | 'short'
  /** Clôture de la barre du signal d'entrée et de la barre de sortie, ISO UTC. */
  entryTime: string
  exitTime: string
  entry: number
  exit: number
  qty: number
  atr: number
  /** Régime du jeu qui a ouvert la position : calm ou agitated. */
  regime: string
  set: number
  tag: string
  shockZ: number
  volumeZ: number
  /** Percentile de l'intensité lambda. */
  lambdaPct: number
  /** Pire et meilleure excursion pendant le trade, en prix. */
  mae: number
  mfe: number
  fees: number
  funding: number
  /** Écart d'exécution total (entrée + sortie) par rapport aux prix de référence, en USDC. */
  slippage: number
  pnl: number
  pnlPct: number
  exits: string
  /** Spread au moment de l'ordre d'entrée et de la dernière sortie, en points de base (vide si inconnu). */
  spreadEntryBps?: number
  spreadExitBps?: number
}

const TRADE_COLS: (keyof TradeLog)[] = [
  'mode', 'side', 'entryTime', 'exitTime', 'entry', 'exit', 'qty', 'atr', 'regime', 'set', 'tag', 'shockZ', 'volumeZ', 'lambdaPct',
  'mae', 'mfe', 'fees', 'funding', 'slippage', 'pnl', 'pnlPct', 'exits', 'spreadEntryBps', 'spreadExitBps',
]

export class Journal {
  readonly dir: string
  readonly mode: Mode
  readonly quiet: boolean
  /** Moteur qui écrit (shadow mode : « paper » pour le moteur live sur l'exchange papier). */
  readonly engine: string | null

  constructor(dir: string, mode: Mode, quiet = false, engine: string | null = null) {
    this.dir = dir
    this.mode = mode
    this.quiet = quiet
    this.engine = engine
    mkdirSync(dir, { recursive: true })
  }

  /** Même journal pour un second moteur : événements marqués, trades dans leur propre fichier. */
  child(engine: string): Journal {
    return new Journal(this.dir, this.mode, this.quiet, engine)
  }

  event(type: string, data: Record<string, unknown> = {}): void {
    const now = new Date()
    const head = this.engine ? { time: now.toISOString(), mode: this.mode, engine: this.engine, type } : { time: now.toISOString(), mode: this.mode, type }
    const line = JSON.stringify({ ...head, ...data }, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))
    appendFileSync(join(this.dir, `events-${now.toISOString().slice(0, 7)}.jsonl`), line + '\n')
    if (!this.quiet) console.log(`${now.toISOString().slice(0, 19)}Z [${this.mode}${this.engine ? '/' + this.engine : ''}] ${type} ${summary(data)}`)
  }

  trade(t: TradeLog): void {
    const file = join(this.dir, `trades-${this.mode}${this.engine ? '-' + this.engine : ''}.csv`)
    if (!existsSync(file)) appendFileSync(file, TRADE_COLS.join(',') + '\n')
    appendFileSync(file, TRADE_COLS.map(k => csv(t[k])).join(',') + '\n')
    this.event('trade', t as unknown as Record<string, unknown>)
  }
}

function csv(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(+v.toPrecision(10)) : ''
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function summary(d: Record<string, unknown>): string {
  return Object.entries(d)
    .filter(([, v]) => v == null || typeof v !== 'object')
    .slice(0, 8)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toPrecision(8) : v}`)
    .join(' ')
}
