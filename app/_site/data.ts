// Résultats publiés du Shock Engine (portefeuille BTC/ETH et preuves), écrits par
// research/shock/publish-portfolio.ts. À importer seulement depuis des composants serveur : le
// fichier pèse ~300 Ko et ne doit pas partir dans le JavaScript du navigateur.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
/** Dossier institutionnel (PDF), composé par research/dossier/build-dossier.ts. */
export const DOSSIER = '/research/dossier/shock-engine-institutional-dossier.pdf'
if (!existsSync(join(process.cwd(), 'public', DOSSIER))) throw new Error('dossier institutionnel absent de public/research/dossier')
/**
 * Coûts d'exécution mesurés (bot livré, entrées à T + 0,5 s), repris de research/reports/execution/fills-500k-1m.json
 * et fills-2m-5m.json, que le site ne lit pas (research/ est exclu du déploiement) ; détails dans le dossier.
 */
export const CAPACITY_FINDING = 'All 1,150 executions since 2020 were replayed on real Binance perpetual-futures trades. With the bot as now coded, execution costs average about 2.3 bps per execution at $1M of capital, for a net Sharpe of 1.92 over 2020–2026 (resampled 90 %: 1.40 to 2.41, funding excluded), still 1.83 at $5M, the largest capital tested, in the central estimate. Capacity on Hyperliquid, the intended venue, and our own market impact are not yet measured.'
/**
 * Risque de sélection de la restriction au régime calme (research/reports/calm-only/calm-only.json, que le site
 * ne lit pas) : CSCV sur les 16 configurations de règles réellement essayées, 16 blocs (12 870 découpages), et
 * Sharpe dégonflé du gain sur les règles précédentes.
 */
export const SELECTION = { variants: 16, splits: 12870, pbo: 0.192, gainDsr: 0.18, gainPsr: 0.937 }
/** Nombre d'exécutions rejouées sur les transactions Binance (fills-500k-1m.json, results[…].executions.all.n). */
export const EXECUTIONS = '1,150'

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

/**
 * Bot testnet suivi sur /live (argent fictif) : début du suivi. Il applique encore les règles d'avant le
 * 2026-10-13 (entrées aussi en régime agité) tant qu'il n'est pas relancé avec la restriction au régime calme.
 */
export const TESTNET_RULES_PENDING = true
export const TESTNET = LIVE_ACCOUNTS.find(a => a.network === 'testnet' && a.version !== 'v1')
export const TESTNET_SINCE = TESTNET?.since?.slice(0, 10)

/** Phrase de comparaison avec le buy & hold BTC/ETH 50/50 (même période, sans rebalancement ni frais). */
export const BH = P.buyHold
