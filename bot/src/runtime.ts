// Boucle du bot, séparée du programme principal pour être testée sans réseau :
// - lecture des bougies closes par REST, une seule à la fois, à chaque clôture signalée par le
//   WebSocket (nouvelle bougie ouverte) ou par l'horloge de secours, et après chaque reconnexion ;
//   une bougie close pas encore confirmée par l'exchange est relue quelques secondes plus tard ;
// - chaque bougie ajoutée est passée au moteur une seule fois, dans l'ordre ;
// - contrôles journalisés à chaque bougie : spread pendant la bougie, bougie du WebSocket comparée à
//   celle de l'API REST, bougies révisées après lecture.

import type { Bars } from '../../lib/backtest/types.ts'
import type { Bar } from '../../lib/strategies/shock/live.ts'
import type { Revision } from './data/candles.ts'
import { INTERVAL_MS, barDiff } from './data/candles.ts'
import type { Quote } from './data/quotes.ts'
import { QuoteBook } from './data/quotes.ts'
import type { StreamCandle, StreamEvent } from './hl/client.ts'
import type { Journal } from './journal.ts'

const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z')

export interface Engine {
  onBar(bar: Bar, daily?: Bars): void | Promise<void>
  onQuote?(q: Quote): void
  syncFills?(): Promise<void>
}

export interface Feed {
  sync(now: number): Promise<{ added: Bar[]; dailyChanged: boolean; revised: Revision[] }>
  dailyBars(): Bars
  readonly chart: { readonly lastTime: number }
}

export interface LoopOptions {
  feed: Feed
  engine: Engine
  journal: Journal
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  /** Délai après une clôture avant la lecture REST (le temps que l'exchange ouvre la suivante). */
  settleMs?: number
  /** Relecture tant que la bougie close attendue n'est pas confirmée. */
  retryMs?: number
  retryFor?: number
}

const STEP = INTERVAL_MS['15m']

export class BotLoop {
  readonly o: LoopOptions
  readonly spreads = new QuoteBook()
  /** Dernier état de chaque bougie reçu par le WebSocket (les deux plus récentes). */
  private ws = new Map<number, StreamCandle>()
  private openT = -Infinity
  private busy: Promise<void> | null = null
  private again = false
  private retryTimer: NodeJS.Timeout | null = null
  stats = { ticks: 0, bars: 0, wsSame: 0, wsDiff: 0, wsMissing: 0, revisions: 0, reconnects: 0 }

  constructor(o: LoopOptions) {
    this.o = o
  }

  private now(): number {
    return this.o.now ? this.o.now() : Date.now()
  }

  private sleep(ms: number): Promise<void> {
    return this.o.sleep ? this.o.sleep(ms) : new Promise(r => setTimeout(r, ms))
  }

  /**
   * Lecture des bougies closes et passage au moteur. Une seule lecture à la fois ; une demande
   * pendant une lecture en provoque une autre juste après (rien n'est perdu, rien n'est doublé).
   */
  tick(reason: string): Promise<void> {
    if (this.busy) {
      this.again = true
      return this.busy
    }
    this.busy = this.run(reason).finally(() => {
      this.busy = null
      if (this.again) {
        this.again = false
        void this.tick('again')
      }
    })
    return this.busy
  }

  private async run(reason: string): Promise<void> {
    const { feed, engine, journal } = this.o
    this.stats.ticks++
    try {
      const { added, dailyChanged, revised } = await this.retry('candles', () => feed.sync(this.now()))
      for (const r of revised) {
        this.stats.revisions++
        journal.event('candle_revised', { interval: r.interval, bar: iso(r.t), diff: r.diff })
      }
      const daily = dailyChanged ? feed.dailyBars() : undefined
      for (const [k, b] of added.entries()) {
        const spread = k === added.length - 1 ? this.spreads.roll() : null
        const ws = this.compareWs(b)
        journal.event('market_bar', { bar: iso(b.t + STEP), reason, close: b.c, volume: b.v, ws, spread })
        this.stats.bars++
        await engine.onBar(b, k === 0 ? daily : undefined)
      }
      // La bougie close attendue n'est pas encore confirmée par l'exchange : relue un peu plus tard.
      const expected = Math.floor(this.now() / STEP) * STEP - STEP
      if (feed.chart.lastTime < expected) this.scheduleRetry(expected)
    } catch (e) {
      journal.event('error', { where: 'tick', reason, error: e instanceof Error ? e.stack ?? e.message : String(e) })
    }
  }

  private scheduleRetry(expected: number): void {
    if (this.retryTimer) return
    const until = expected + STEP + (this.o.retryFor ?? 120000)
    if (this.now() > until) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.tick('retry')
    }, this.o.retryMs ?? 5000)
  }

  private async retry<T>(what: string, f: () => Promise<T>, tries = 6): Promise<T> {
    let wait = 2000
    for (let k = 1; ; k++) {
      try {
        return await f()
      } catch (e) {
        if (k >= tries) throw e
        this.o.journal.event('retry', { what, attempt: k, error: e instanceof Error ? e.message : String(e) })
        await this.sleep(wait)
        wait = Math.min(wait * 2, 60000)
      }
    }
  }

  /** La bougie close lue par REST, comparée au dernier état reçu du WebSocket. */
  private compareWs(b: Bar): { same: boolean; diff?: Record<string, [number, number]> } | null {
    const w = this.ws.get(b.t)
    if (!w) {
      this.stats.wsMissing++
      return null
    }
    const diff = barDiff(b, w)
    const same = Object.keys(diff).length === 0
    if (same) this.stats.wsSame++
    else this.stats.wsDiff++
    return same ? { same } : { same, diff }
  }

  /** Mise à jour de la bougie en cours par le WebSocket ; une nouvelle ouverture = clôture de la précédente. */
  onCandle(c: StreamCandle): void {
    this.ws.set(c.t, c)
    for (const t of this.ws.keys()) if (t < c.t - STEP) this.ws.delete(t)
    if (c.t > this.openT) {
      const first = this.openT === -Infinity
      this.openT = c.t
      if (!first) setTimeout(() => void this.tick('ws_close'), this.o.settleMs ?? 3000)
    }
  }

  onQuote(q: Quote): void {
    this.spreads.update(q)
    this.o.engine.onQuote?.(q)
  }

  /** État de la connexion : à chaque reconnexion, ce qui a pu être manqué est relu par REST. */
  onStream(e: StreamEvent): void {
    const { journal, engine } = this.o
    if (e.type === 'open') {
      journal.event(e.reconnect ? 'ws_reconnected' : 'ws_open', { count: e.count })
      if (e.reconnect) {
        this.stats.reconnects++
        void this.tick('ws_reconnect')
        engine.syncFills?.().catch(err => journal.event('error', { where: 'fills', error: String(err) }))
      }
    } else if (e.type === 'close') {
      journal.event('ws_closed', { code: e.code, reason: e.reason })
    } else if (e.type === 'sub_error') {
      journal.event('ws_subscription_error', { channel: e.channel, error: e.error })
    } else {
      journal.event('ws_terminated', { reason: e.reason })
    }
  }

  stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
  }
}

/**
 * Appels coalescés : pendant qu'un appel est en cours, seul le dernier argument reçu est gardé et
 * joué ensuite (le prix moyen arrive plusieurs fois par seconde, seul le plus récent compte).
 */
export function coalesce<T>(f: (x: T) => Promise<void>, onError: (e: unknown) => void): (x: T) => void {
  let running = false
  let next: { x: T } | null = null
  const run = (x: T) => {
    running = true
    f(x).catch(onError).finally(() => {
      running = false
      if (next) {
        const n = next
        next = null
        run(n.x)
      }
    })
  }
  return (x: T) => {
    if (running) next = { x }
    else run(x)
  }
}
