// Publie les rapports de recherche pour la page /backtest/recherche du site :
// copie des Markdown dans public/backtest/reports et index des rapports.
//
//   node research/publish-reports.ts

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'reports')
const out = join(here, '..', 'public', 'backtest', 'reports')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const groupOf = (f: string) =>
  f === 'SYNTHESE.md' ? 'synthese' : f.includes('diagnostic') ? 'diagnostic' : f.includes('regimes') ? 'regimes' : f.includes('walkforward') ? 'walkforward' : 'autre'
const tfOf = (f: string) => Number(f.match(/shock-(\d+)m/)?.[1] ?? 0)

const files = readdirSync(src).filter(f => f.endsWith('.md'))
const index = files.map(f => {
  const text = readFileSync(join(src, f), 'utf8')
  writeFileSync(join(out, f), text)
  const title = text.split('\n').find(l => l.startsWith('# '))?.slice(2).trim() ?? f
  return { file: f, title, group: groupOf(f), tf: tfOf(f) }
})
const order = ['synthese', 'diagnostic', 'walkforward', 'regimes', 'autre']
index.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.tf - b.tf || a.file.localeCompare(b.file))
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1))
console.log(`${index.length} rapports publiés dans public/backtest/reports`)
