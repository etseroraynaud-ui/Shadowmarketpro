// Écrit lib/strategies/shock/presets.ts à partir des rapports de recherche : les jeux retenus par
// le walk-forward (meilleur jeu unique) et par la sélection selon la volatilité, pour le site.
//
//   node research/shock/export-presets.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'

const here = dirname(fileURLToPath(import.meta.url))
const reports = join(here, '..', 'reports')
const read = (f: string) => JSON.parse(readFileSync(join(reports, f), 'utf8'))

type P = Record<string, unknown>
const diff = (p: P | null): P | null => {
  if (!p) return null
  const out: P = {}
  for (const [k, v] of Object.entries(p)) if ((DEFAULT_PARAMS as unknown as P)[k] !== v) out[k] = v
  return out
}

const v30 = read('shock-30m-regimes-vol.json')
const v15 = read('shock-15m-regimes-vol.json')
const pick = (d: { final: { regime: string; params: P | null }[] }, name: string) => diff(d.final.find(x => x.regime === name)?.params ?? null)

const data = {
  wf30: diff(v30.finalGlobal.params),
  wf15: diff(v15.finalGlobal.params),
  adaptive30: { calm: pick(v30, 'calme'), agitated: pick(v30, 'agité'), sharpeOOS: v30.summary.regime.sharpe },
  adaptive15: { calm: pick(v15, 'calme'), agitated: pick(v15, 'agité'), sharpeOOS: v15.summary.regime.sharpe },
}

const body = `// Généré par research/shock/export-presets.ts depuis research/reports : ne pas modifier à la main.
// Écarts aux valeurs par défaut du script.

import type { ShockParams } from './params.ts'

type Over = Partial<ShockParams>

/** Meilleur jeu unique sur tout l'historique (walk-forward, 30 min et 15 min). */
export const WF30: Over = ${JSON.stringify(data.wf30)}
export const WF15: Over = ${JSON.stringify(data.wf15)}

/** Sélection selon la volatilité (calme / agitée) ; null = pas de trade dans ce régime. */
export const ADAPTIVE30: { calm: Over | null; agitated: Over | null } = ${JSON.stringify({ calm: data.adaptive30.calm, agitated: data.adaptive30.agitated })}
export const ADAPTIVE15: { calm: Over | null; agitated: Over | null } = ${JSON.stringify({ calm: data.adaptive15.calm, agitated: data.adaptive15.agitated })}
`
writeFileSync(join(here, '..', '..', 'lib', 'strategies', 'shock', 'presets.ts'), body)
console.log('lib/strategies/shock/presets.ts écrit', JSON.stringify(data).length, 'octets')
