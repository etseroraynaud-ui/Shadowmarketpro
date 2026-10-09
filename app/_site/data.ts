// Résultats publiés du Shock Engine (portefeuille BTC/ETH et preuves), écrits par
// research/shock/publish-portfolio.ts. À importer seulement depuis des composants serveur : le
// fichier pèse ~300 Ko et ne doit pas partir dans le JavaScript du navigateur.

import data from '../../lib/research/btc-eth-portfolio.json'
import { LIVE_ACCOUNTS } from '../live/accounts'

export const P = data
export type Portfolio = typeof data

/** Mention obligatoire, mot pour mot. */
export const SIM = 'Historical simulation after modeled transaction costs. Not live performance.'
if (!P.disclaimers.includes(SIM)) throw new Error('la mention de simulation historique manque dans les données publiées')

/** Dossier public des fichiers téléchargeables, et manifeste publié. */
export const DOWNLOADS = '/research/btc-eth-portfolio'
export const MANIFEST = 'shock-engine-manifest.json'
export const PAPER = 'shock-engine-research-paper.pdf'
if (!P.downloads.some(d => d.file === MANIFEST)) throw new Error('manifeste absent des téléchargements publiés')
if (!P.downloads.some(d => d.file === PAPER)) throw new Error('papier de recherche absent des téléchargements publiés')

/**
 * Série du graphique : jours sans valeur (fenêtres glissantes incomplètes) en NaN, valeurs arrondies à
 * 5 chiffres significatifs (affichage seulement : allège la page, les infobulles en montrent moins).
 */
export const series = (values: (number | null)[]) => values.map(v => (v === null ? NaN : +v.toPrecision(5)))

/** Un point tous les `step` jours, aligné sur le dernier jour (gardé). */
export const sample = (values: number[], step: number) => values.filter((_, i) => (values.length - 1 - i) % step === 0)
/** Date du premier point gardé par `sample`. */
export const sampleStart = (start: string, n: number, step: number) => new Date(Date.parse(start + 'T00:00:00Z') + ((n - 1) % step) * 864e5).toISOString().slice(0, 10)

/** Adresse de contact institutionnelle (variable d'environnement publique, lue au build). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_INSTITUTIONAL_EMAIL ?? ''

export const COLORS = { btc: 'var(--s-btc)', eth: 'var(--s-eth)', portfolio: 'var(--s-pf)', buyHold: 'var(--s-bh)' }
/** Nom de la référence buy & hold dans les graphiques. */
export const BH_NAME = 'Buy & hold'

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

/** Alpha résiduel face à des stratégies de tendance simples (research/reports/residual-alpha/). */
export const RA = P.residualAlpha
/** Noms publics des facteurs et des stratégies de référence. */
export const FACTOR_NAMES: Record<string, string> = {
  BH: 'Buy & hold BTC/ETH', 'BH BTC': 'Buy & hold BTC', 'BH ETH': 'Buy & hold ETH',
  TSMOM30: 'Momentum, 30 days', TSMOM90: 'Momentum, 90 days', TSMOM180: 'Momentum, 180 days',
  'DONCH55/20': 'Breakout, 55/20 days', 'EMA20/100': 'Moving averages, 20/100 days', 'DONCH15 96/48': 'Intraday breakout, 24 h / 12 h',
}
for (const f of [...RA.factors.map(x => x.name), ...RA.benchmarks.map(x => x.id)]) if (!FACTOR_NAMES[f]) throw new Error(`facteur sans nom public : ${f}`)
/** Verdict de l'étude, selon la règle fixée d'avance (t ≥ 3 et P(α ≤ 0) ≤ 1 %). */
export const raVerdict = (): { kind: 'pass' | 'partial' | 'fail'; label: string } =>
  RA.verdict === 'demonstrated' ? { kind: 'pass', label: 'demonstrated · in-sample' } : RA.verdict === 'indicative' ? { kind: 'partial', label: 'indicative' } : { kind: 'fail', label: 'not demonstrated' }

/** Bot testnet suivi sur /live (argent fictif) : début du suivi, version publique. */
export const TESTNET = LIVE_ACCOUNTS.find(a => a.network === 'testnet' && a.version !== 'v1')
export const TESTNET_SINCE = TESTNET?.since?.slice(0, 10)

/** Phrase de comparaison avec le buy & hold BTC/ETH 50/50 (même période, sans rebalancement ni frais). */
export const BH = P.buyHold
