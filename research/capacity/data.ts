// P1 de l'étude de capacité : données gratuites Binance USDⓈ-M et contrôles d'intégrité
// (research/preregistration/capacity-p0p1.md, § 9). Bougies 1 min de 2020-01-01 au 2026-10-02 (les
// minutes qui suivent la fin de la fenêtre servent aux dérives après les dernières exécutions),
// bookDepth de 2023-01-01 au 2026-10-01.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/data.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUT } from './lib.ts'
import { loadDepth, loadMinutes } from './binance.ts'
import type { Sym } from './binance.ts'

export const KLINES_TO = Date.UTC(2026, 9, 3)
export const DEPTH_FROM = Date.UTC(2023, 0, 1)
export const DEPTH_TO = Date.UTC(2026, 9, 1)

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now()
  const out: Record<string, unknown> = {}
  for (const sym of ['BTCUSDT', 'ETHUSDT'] as Sym[]) {
    const { integrity: k } = await loadMinutes(sym, KLINES_TO)
    process.stderr.write(`${sym} bougies 1 min : ${k.files} fichiers, ${k.rows} lignes, ${k.missingMinutes} minutes manquantes (plus long trou ${k.longestGapMin} min), doublons ${k.duplicates}, désordre ${k.outOfOrder} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
    const short = k.months.filter(m => m.rows !== m.expected)
    if (short.length) process.stderr.write(`  mois incomplets : ${short.map(m => `${m.month} ${m.rows}/${m.expected}`).join(', ')}\n`)
    const { integrity: d } = await loadDepth(sym, DEPTH_FROM, DEPTH_TO)
    process.stderr.write(`${sym} bookDepth : ${d.days} jours, ${d.missingDays.length} absents, ${d.snapshots} instantanés, pas médian ${d.medianStepS} s, ${d.gapsOver5min} trous > 5 min, ${d.incomplete} incomplets, ${d.stuckSnapshots} figés (${(d.stuckFrom ?? []).length} épisodes) (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
    out[sym] = { klines: k, bookDepth: d }
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'p1-data-integrity.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'https://data.binance.vision (futures/um), SHA-256 checked against Binance .CHECKSUM files', ...out }, null, 1))
}
