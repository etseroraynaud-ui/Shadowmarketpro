// Meilleur prix acheteur / vendeur (BBO) : dernier connu, fraîcheur, statistiques de spread par
// bougie. Alimenté par le WebSocket (abonnement bbo), complété par l'API REST (l2Book) quand le
// flux est trop ancien : sur le testnet, le BBO n'est envoyé qu'à chaque changement et peut rester
// muet plusieurs minutes.

export interface Quote {
  bid: number
  ask: number
  bidSz: number
  askSz: number
  /** Heure de l'exchange (ms). */
  time: number
  /** Heure locale de réception (ms). */
  recv: number
  source: 'ws' | 'rest' | 'paper'
}

export const midOf = (q: Quote): number => (q.bid + q.ask) / 2

/** Spread en points de base du prix moyen. */
export const spreadBps = (q: Quote): number => ((q.ask - q.bid) / midOf(q)) * 1e4

export function validQuote(q: Quote): boolean {
  return q.bid > 0 && q.ask > 0 && q.ask >= q.bid && Number.isFinite(q.bid) && Number.isFinite(q.ask)
}

export interface SpreadStats {
  /** Nombre de mises à jour du BBO pendant la bougie. */
  updates: number
  minBps: number | null
  meanBps: number | null
  maxBps: number | null
  lastBps: number | null
}

export class QuoteBook {
  last: Quote | null = null
  rejected = 0
  private n = 0
  private sum = 0
  private min = Infinity
  private max = -Infinity

  /** Nouveau BBO ; ignoré s'il est invalide (carnet croisé, prix nul) ou plus ancien que le dernier. */
  update(q: Quote): boolean {
    if (!validQuote(q) || (this.last && q.time < this.last.time)) {
      this.rejected++
      return false
    }
    this.last = q
    const s = spreadBps(q)
    this.n++
    this.sum += s
    this.min = Math.min(this.min, s)
    this.max = Math.max(this.max, s)
    return true
  }

  /** Dernier BBO reçu il y a moins de maxAgeMs, sinon null. */
  fresh(now: number, maxAgeMs: number): Quote | null {
    return this.last && now - this.last.recv <= maxAgeMs ? this.last : null
  }

  /** Statistiques de spread depuis l'appel précédent (une bougie), puis remise à zéro. */
  roll(): SpreadStats {
    const out: SpreadStats = {
      updates: this.n,
      minBps: this.n ? this.min : null,
      meanBps: this.n ? this.sum / this.n : null,
      maxBps: this.n ? this.max : null,
      lastBps: this.last ? spreadBps(this.last) : null,
    }
    this.n = 0
    this.sum = 0
    this.min = Infinity
    this.max = -Infinity
    return out
  }
}
