// Copie pour le site (public/backtest/data) des barres BTC intraday, compressées :
// 30 et 15 min depuis juillet 2016 (préchauffage des indicateurs compris), 5 min sur deux ans.
//
//   node research/data/publish-site.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', '..', 'public', 'backtest', 'data')
mkdirSync(out, { recursive: true })
const plan: [number, string][] = [[30, '2016-07-01'], [15, '2016-07-01'], [5, '2024-07-01']]
for (const [tf, from] of plan) {
  const lines = gunzipSync(readFileSync(join(here, `btcusd_${tf}m.csv.gz`))).toString('latin1').split('\n')
  const t0 = Date.parse(from + 'T00:00:00Z')
  const kept = [lines[0], ...lines.slice(1).filter(l => l && Number(l.slice(0, l.indexOf(','))) >= t0)]
  const gz = gzipSync(kept.join('\n') + '\n', { level: 9 })
  writeFileSync(join(out, `btcusd_${tf}m.csv.gz`), gz)
  console.log(`${tf}m : ${kept.length - 1} barres, ${(gz.length / 1e6).toFixed(1)} Mo`)
}
