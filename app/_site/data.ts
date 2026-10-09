// Résultats publiés du Shock Engine (portefeuille BTC/ETH et preuves), écrits par
// research/shock/publish-portfolio.ts. À importer seulement depuis des composants serveur : le
// fichier pèse ~300 Ko et ne doit pas partir dans le JavaScript du navigateur.

import data from '../../lib/research/btc-eth-portfolio.json'

export const P = data
export type Portfolio = typeof data

/** Mention obligatoire, mot pour mot. */
export const SIM = 'Historical simulation after modeled transaction costs. Not live performance.'
if (!P.disclaimers.includes(SIM)) throw new Error('la mention de simulation historique manque dans les données publiées')

/** Dossier public des fichiers téléchargeables, et manifeste publié. */
export const DOWNLOADS = '/research/btc-eth-portfolio'
export const MANIFEST = 'shock-engine-manifest.json'
if (!P.downloads.some(d => d.file === MANIFEST)) throw new Error('manifeste absent des téléchargements publiés')

/** Série du graphique : jours sans valeur (fenêtres glissantes incomplètes) en NaN. */
export const series = (values: (number | null)[]) => values.map(v => (v === null ? NaN : v))

/** Un point tous les `step` jours, aligné sur le dernier jour (gardé). */
export const sample = (values: number[], step: number) => values.filter((_, i) => (values.length - 1 - i) % step === 0)
/** Date du premier point gardé par `sample`. */
export const sampleStart = (start: string, n: number, step: number) => new Date(Date.parse(start + 'T00:00:00Z') + ((n - 1) % step) * 864e5).toISOString().slice(0, 10)

/** Adresse de contact institutionnelle (variable d'environnement publique, lue au build). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_INSTITUTIONAL_EMAIL ?? ''

export const COLORS = { btc: 'var(--s-btc)', eth: 'var(--s-eth)', portfolio: 'var(--s-pf)' }

type Zs = typeof data.evidence.btc
/**
 * Verdict d'une étude par marché, à partir des critères fixés d'avance du rapport (étude d'événement
 * des signaux et des chocs dans la tendance ; profit factor, Sharpe, entrées au hasard, entrée décalée).
 */
export function verdictOf(z: Zs): { kind: 'pass' | 'partial' | 'fail'; label: string } {
  const v = z.verdict, strat = v.preset.pf && v.preset.sharpe && v.preset.random && v.preset.delay
  if (strat && v.eventsPreset && v.eventsShockTrend) return { kind: 'pass', label: 'pass' }
  if (strat || (v.preset.sharpe && v.preset.random)) return { kind: 'partial', label: 'partial' }
  return { kind: 'fail', label: 'did not pass' }
}

/** Marchés testés avec les mêmes règles, sans calibration. */
export const MARKETS = [
  { key: 'btc', name: 'Bitcoin', data: 'BTC/USD · Bitstamp', role: 'calibration market' },
  { key: 'eth', name: 'Ethereum', data: 'ETH/USDT · Binance', role: 'no ETH calibration' },
  { key: 'ethDukascopy', name: 'Ethereum (replication)', data: 'ETH/USD · Dukascopy', role: 'independent price feed' },
  { key: 'sol', name: 'Solana', data: 'SOL/USDT · Binance', role: 'transfer' },
  { key: 'gold', name: 'Gold', data: 'XAU/USD · Dukascopy', role: 'transfer' },
  { key: 'tao', name: 'Bittensor (TAO)', data: 'TAO/USDT · Binance', role: 'transfer, short sample' },
] as const

/** Plus longue période sous un précédent sommet (jours), parmi les épisodes publiés du portefeuille. */
export const longestDrawdown = () => P.drawdowns.top10.portfolio.reduce((a, x) => (x.days > a.days ? x : a))
