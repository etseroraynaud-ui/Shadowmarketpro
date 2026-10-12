// Rapport de l'étude de capacité, phases P0 et P1 (données gratuites) : HTML avec graphiques et
// Markdown, à partir des résultats écrits par budget.ts, pilot.ts, pilot-random.ts et capacity.ts.
// Aucun horodatage de trade n'est écrit : seulement des agrégats.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/report.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { OUT, SEED, q } from './lib.ts'
import { DATA } from './binance.ts'
import type { Event } from './events.ts'

const J = (f: string) => JSON.parse(readFileSync(join(OUT, f), 'utf8'))
const B = J('p0-budget.json'), C = J('p1-capacity.json'), PI = J('p1-pilot.json'), PR = J('p1-pilot-random.json'), DI = J('p1-data-integrity.json')
const events: Event[] = JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8'))

// ---------------------------------------------------------------- formats
const fr = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('-', '−').replace('.', ',') : '—')
const pct = (x: number, d = 1) => `${fr(x * 100, d)} %`
const pb = (x: number, d = 1) => (Number.isFinite(x) ? `${fr(x, d)} pb` : 'au-delà de la grille')
const usd = (A: number) => (!Number.isFinite(A) || A === null ? '> 100 M$' : A >= 1e6 ? `${fr(A / 1e6, A >= 1e7 ? 0 : 2)} M$` : `${Math.round(A / 1e3)} k$`)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const NAMED = [100e3, 250e3, 500e3, 1e6, 5e6]
const SC = ['optimistic', 'central', 'prudent'] as const
const SC_FR: Record<string, string> = { optimistic: 'Optimiste (Y = 0,5)', central: 'Central (Y = 1)', prudent: 'Prudent (Y = 2)' }
const bin = B.results.find((r: { window: { name: string } }) => r.window.name === 'binance')
const off = B.results.find((r: { window: { name: string } }) => r.window.name === 'official')

// ---------------------------------------------------------------- dérive après les événements (échantillon complet)
const rngB = P.rng(SEED + 5)
function ci(xs: number[]) {
  xs = xs.filter(Number.isFinite)
  const m: number[] = []
  for (let k = 0; k < 2000; k++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(rngB() * xs.length)]; m.push(s / xs.length) }
  return { mean: P.mean(xs) * 1e4, lo: q(m, 0.025) * 1e4, hi: q(m, 0.975) * 1e4, n: xs.length }
}
const H = [1, 3, 5, 15]
const decay = Object.fromEntries(['entry', 'close', 'stop'].map(f => [f, Object.fromEntries(['btc', 'ethusdt'].map(k => {
  const xs = events.filter(e => e.family === f && e.key === k && e.located)
  return [k, { last: H.map((_, j) => ci(xs.map(e => e.drift[j]))), vwap: H.map((_, j) => ci(xs.map(e => e.driftVwap[j]))) }]
}))]))
const gross = P.mean(events.filter(e => e.family === 'entry').map(e => e.pnlPct + 0.0009)) * 1e4

// ---------------------------------------------------------------- graphique XY (SVG statique)
interface S { name: string; color: string; x: number[]; y: number[]; lo?: number[]; hi?: number[]; dash?: boolean }
function xy(o: { title: string; series: S[]; logX?: boolean; xFmt: (v: number) => string; yFmt: (v: number) => string; xTicks: number[]; refs?: { y: number; label: string }[]; yMin?: number; yMax?: number; xLabel: string; yLabel: string; h?: number }) {
  const W = 820, Hh = o.h ?? 300, m = { l: 58, r: 200, t: 16, b: 44 }
  const pw = W - m.l - m.r, ph = Hh - m.t - m.b
  const allY = o.series.flatMap(s => [...s.y, ...(s.lo ?? []), ...(s.hi ?? [])]).filter(Number.isFinite)
  let lo = o.yMin ?? Math.min(...allY, ...(o.refs ?? []).map(r => r.y)), hi = o.yMax ?? Math.max(...allY, ...(o.refs ?? []).map(r => r.y))
  const pad = (hi - lo) * 0.05; if (o.yMin === undefined) lo -= pad; if (o.yMax === undefined) hi += pad
  const xs = o.series.flatMap(s => s.x)
  const tx = (v: number) => (o.logX ? Math.log(v) : v)
  const x0 = tx(Math.min(...xs)), x1 = tx(Math.max(...xs))
  const X = (v: number) => m.l + ((tx(v) - x0) / (x1 - x0)) * pw, Y = (v: number) => m.t + ph - ((v - lo) / (hi - lo)) * ph
  const step = (() => { const r = (hi - lo) / 5, p = 10 ** Math.floor(Math.log10(r)), k = r / p; return (k < 1.5 ? 1 : k < 3 ? 2 : k < 7 ? 5 : 10) * p })()
  const parts = [`<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="${esc(o.title)}">`]
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) parts.push(`<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="tick" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${o.yFmt(v)}</text>`)
  for (const v of o.xTicks) parts.push(`<line class="grid" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${m.t}" y2="${m.t + ph}"/><text class="tick" x="${X(v).toFixed(1)}" y="${Hh - 24}" text-anchor="middle">${o.xFmt(v)}</text>`)
  parts.push(`<text class="axis" x="${m.l + pw / 2}" y="${Hh - 6}" text-anchor="middle">${esc(o.xLabel)}</text><text class="axis" transform="translate(14 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">${esc(o.yLabel)}</text>`)
  for (const r of o.refs ?? []) parts.push(`<line class="ref" x1="${m.l}" x2="${m.l + pw}" y1="${Y(r.y).toFixed(1)}" y2="${Y(r.y).toFixed(1)}"/><text class="reflabel" x="${m.l + pw - 4}" y="${(Y(r.y) - 5).toFixed(1)}" text-anchor="end">${esc(r.label)}</text>`)
  for (const s of o.series) if (s.lo && s.hi) parts.push(`<path class="band" style="fill:${s.color}" d="M${s.x.map((v, i) => `${X(v).toFixed(1)},${Y(s.hi![i]).toFixed(1)}`).join('L')}L${[...s.x].reverse().map((v, i) => `${X(v).toFixed(1)},${Y(s.lo![s.x.length - 1 - i]).toFixed(1)}`).join('L')}Z"/>`)
  o.series.forEach((s, k) => {
    parts.push(`<path class="line${s.dash ? ' dash' : ''}" style="stroke:${s.color}" d="M${s.x.map((v, i) => `${X(v).toFixed(1)},${Y(s.y[i]).toFixed(1)}`).join('L')}"/>`)
    for (let i = 0; i < s.x.length; i++) if (s.x.length <= 8) parts.push(`<circle cx="${X(s.x[i]).toFixed(1)}" cy="${Y(s.y[i]).toFixed(1)}" r="3" style="fill:${s.color}"/>`)
    parts.push(`<line x1="${W - m.r + 14}" x2="${W - m.r + 34}" y1="${m.t + 10 + k * 18}" y2="${m.t + 10 + k * 18}" class="line${s.dash ? ' dash' : ''}" style="stroke:${s.color}"/><text class="leg" x="${W - m.r + 40}" y="${m.t + 14 + k * 18}">${esc(s.name)}</text>`)
  })
  parts.push('</svg>')
  return `<figure><figcaption>${esc(o.title)}</figcaption>${parts.join('')}</figure>`
}
const COL = { opt: 'var(--c1)', cen: 'var(--c2)', pru: 'var(--c3)', a: 'var(--c4)', b: 'var(--c5)', c: 'var(--c6)', d: 'var(--c7)' }
const usdTicks = [50e3, 100e3, 250e3, 500e3, 1e6, 5e6, 10e6, 50e6, 100e6]
const usdTick = (A: number) => (A >= 1e6 ? `${A / 1e6} M$` : `${A / 1e3} k$`)

// ---------------------------------------------------------------- graphiques
const catCurve = (cat: string) => bin.byCat[cat].curve.filter((p: { bps: number }) => p.bps <= 40)
const allBand = bin.byCat.all.band.filter((p: { bps: number }) => p.bps <= 40)
const chartBudget = xy({
  title: 'P0 · Sharpe du portefeuille selon le coût ajouté par exécution (fenêtre Binance 2020-01 → 2026-09, hors commission déjà payée)',
  series: [
    { name: 'Toutes exécutions', color: COL.cen, x: catCurve('all').map((p: { bps: number }) => p.bps), y: catCurve('all').map((p: { sharpe: number }) => p.sharpe) },
    { name: 'Bootstrap, 90 %', color: COL.cen, x: allBand.map((p: { bps: number }) => p.bps), y: allBand.map((p: { p50: number }) => p.p50), lo: allBand.map((p: { p5: number }) => p.p5), hi: allBand.map((p: { p95: number }) => p.p95), dash: true },
    { name: 'Entrées seules', color: COL.a, x: catCurve('entry').map((p: { bps: number }) => p.bps), y: catCurve('entry').map((p: { sharpe: number }) => p.sharpe) },
    { name: 'Stops seuls', color: COL.b, x: catCurve('stop').map((p: { bps: number }) => p.bps), y: catCurve('stop').map((p: { sharpe: number }) => p.sharpe) },
    { name: 'Sorties clôture', color: COL.c, x: catCurve('close').map((p: { bps: number }) => p.bps), y: catCurve('close').map((p: { sharpe: number }) => p.sharpe) },
    { name: '5 % meilleurs', color: COL.d, x: catCurve('top5').map((p: { bps: number }) => p.bps), y: catCurve('top5').map((p: { sharpe: number }) => p.sharpe) },
  ],
  xTicks: [0, 5, 10, 15, 20, 25, 30, 35, 40], xFmt: v => `${v}`, yFmt: v => fr(v, 1), refs: [{ y: 1.5, label: 'Sharpe 1,5' }, { y: 1, label: 'Sharpe 1,0' }, { y: 0, label: '0' }],
  xLabel: 'coût ajouté par exécution (pb)', yLabel: 'Sharpe net', h: 340,
})
const curve = (sc: string) => C.curves[sc] as { A: number; sharpe: number; sharpeP5: number; sharpeP95: number; cagr: number; costBps: { all: number } }[]
const chartCap = xy({
  title: 'P1 · Courbe de capacité : Sharpe net selon le capital (exécution POV 10 %, intervalles à 90 % par bootstrap mensuel)',
  series: [
    { name: SC_FR.optimistic, color: COL.opt, x: curve('optimistic').map(p => p.A), y: curve('optimistic').map(p => p.sharpe) },
    { name: SC_FR.central, color: COL.cen, x: curve('central').map(p => p.A), y: curve('central').map(p => p.sharpe), lo: curve('central').map(p => p.sharpeP5), hi: curve('central').map(p => p.sharpeP95) },
    { name: SC_FR.prudent, color: COL.pru, x: curve('prudent').map(p => p.A), y: curve('prudent').map(p => p.sharpe), lo: curve('prudent').map(p => p.sharpeP5), hi: curve('prudent').map(p => p.sharpeP95) },
    { name: 'Central, délai 2 s *', color: COL.a, x: (C.exploratory.latency2s.central as { A: number }[]).map(p => p.A), y: (C.exploratory.latency2s.central as { sharpe: number }[]).map(p => p.sharpe), dash: true },
  ],
  logX: true, xTicks: usdTicks, xFmt: usdTick, yFmt: v => fr(v, 1), refs: [{ y: 1.5, label: 'Sharpe 1,5' }, { y: 1, label: 'Sharpe 1,0' }, { y: 0, label: '0' }, { y: C.baseline.sharpe, label: 'sans coût ajouté' }],
  xLabel: 'capital (échelle log) · * variante exploratoire', yLabel: 'Sharpe net', h: 360,
})
const chartCagr = xy({
  title: 'P1 · CAGR net selon le capital',
  series: SC.map((sc, k) => ({ name: SC_FR[sc], color: [COL.opt, COL.cen, COL.pru][k], x: curve(sc).map(p => p.A), y: curve(sc).map(p => p.cagr * 100) })),
  logX: true, xTicks: usdTicks, xFmt: usdTick, yFmt: v => `${fr(v, 0)} %`, refs: [{ y: C.baseline.cagr * 100, label: 'sans coût ajouté' }, { y: 0, label: '0' }], xLabel: 'capital (échelle log)', yLabel: 'CAGR net',
})
const chartCost = xy({
  title: 'P1 · Coût moyen estimé par exécution (pondéré par la taille, hors commission)',
  series: SC.map((sc, k) => ({ name: SC_FR[sc], color: [COL.opt, COL.cen, COL.pru][k], x: curve(sc).map(p => p.A), y: curve(sc).map(p => p.costBps.all) })),
  logX: true, xTicks: usdTicks, xFmt: usdTick, yFmt: v => `${fr(v, 0)}`, refs: [{ y: bin.byCat.all.threshold.sharpe15.point, label: 'budget Sharpe 1,5' }, { y: bin.byCat.all.threshold.sharpe10.point, label: 'budget Sharpe 1,0' }],
  xLabel: 'capital (échelle log)', yLabel: 'pb par exécution', yMin: 0,
})
const rs = PR.results
const secX = [1, 2, 5, 10, 30, 60, 180, 300, 900]
const decaySeries = (k: 'btc' | 'ethusdt', name: string, color: string) => {
  const r = rs[name]
  const x = [1, 2, 5, 10, 30, 60], y = x.map(s => r[`${s}s`].last.meanBps), lo = x.map(s => r[`${s}s`].last.loBps), hi = x.map(s => r[`${s}s`].last.hiBps)
  const full = decay.entry[k].last
  return [{ name: `${name}, échantillon 1–60 s`, color, x, y, lo, hi }, { name: `${name}, toutes entrées`, color, x: H.map(m => m * 60), y: full.map((c: { mean: number }) => c.mean), lo: full.map((c: { lo: number }) => c.lo), hi: full.map((c: { hi: number }) => c.hi), dash: true }]
}
const chartDecay = xy({
  title: 'P1 · Dérive du perpétuel après la décision d\'entrée, dans le sens du trade (dernier prix ; intervalles à 95 %)',
  series: [...decaySeries('btc', 'BTC', COL.a), ...decaySeries('ethusdt', 'ETH', COL.pru)], logX: true, xTicks: secX, xFmt: v => (v < 60 ? `${v} s` : `${v / 60} min`), yFmt: v => fr(v, 0), refs: [{ y: 0, label: '' }],
  xLabel: 'temps après la décision (échelle log)', yLabel: 'pb', h: 320,
})
const L = C.liquidity as { A: number; stops: { triggerMinuteOver10: number; triggerMinuteOver25: number; triggerMinuteOver100: number }; entries: { participation1mOver10: number; participation5mOver10: number; pov10Over15min: number; pov10Over60min: number } }[]
const chartLiq = xy({
  title: 'P1 · Limites de liquidité observées (volume réel du perpétuel ; aucune hypothèse d\'impact)',
  series: [
    { name: 'Stops > 10 % minute', color: COL.pru, x: L.map(l => l.A), y: L.map(l => l.stops.triggerMinuteOver10 * 100) },
    { name: 'Stops > 100 % minute', color: COL.b, x: L.map(l => l.A), y: L.map(l => l.stops.triggerMinuteOver100 * 100) },
    { name: 'Entrées > 10 % vol. 1 min', color: COL.cen, x: L.map(l => l.A), y: L.map(l => l.entries.participation1mOver10 * 100) },
    { name: 'Entrées POV 10 % > 15 min', color: COL.a, x: L.map(l => l.A), y: L.map(l => l.entries.pov10Over15min * 100) },
  ],
  logX: true, xTicks: NAMED, xFmt: usdTick, yFmt: v => `${fr(v, 0)} %`, xLabel: 'capital (échelle log)', yLabel: 'part des exécutions', yMin: 0,
})

// ---------------------------------------------------------------- tableaux
type Row = (string | number)[]
const table = (head: string[], rows: Row[], cap?: string) => `<div class="tw"><table>${cap ? `<caption>${esc(cap)}</caption>` : ''}<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const isNum = (c: string | number) => /^[\d−\-[(]/.test(String(c).replace(/<[^>]+>/g, '').trim())
const mdTable = (head: string[], rows: Row[]) => [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i && rows.every(r => isNum(r[i])) ? '---:' : '---')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ').replace(/<[^>]+>/g, '')} |`)].join('\n')

const named = (sc: string) => (C.named[sc] as { A: number; sharpe: number; sharpeP5: number; sharpeP95: number; cagr: number; cagrP5: number; cagrP95: number; costBps: { all: number; entry: number; stop: number; close: number; tp1: number }; dragPctYr: number; maxDD: number; sortino: number }[])
const capHead = ['Capital', 'Coût moyen / exécution', 'dont entrées · stops', 'Frein annuel', 'Sharpe net [90 %]', 'CAGR net [90 %]', 'Sortino', 'Drawdown max']
const capRows = (sc: string): Row[] => named(sc).map(p => [usd(p.A), pb(p.costBps.all), `${fr(p.costBps.entry)} · ${fr(p.costBps.stop)}`, pct(p.dragPctYr), `<b>${fr(p.sharpe, 2)}</b> [${fr(p.sharpeP5, 2)} ; ${fr(p.sharpeP95, 2)}]`, `${pct(p.cagr)} [${pct(p.cagrP5, 0)} ; ${pct(p.cagrP95, 0)}]`, fr(p.sortino, 2), pct(p.maxDD)])
const T = C.thresholds
const thrRows: Row[] = SC.map(sc => [SC_FR[sc], `${usd(T[sc].C1_sharpe15.point)} [${usd(T[sc].C1_sharpe15.fromLowerBound)} ; ${usd(T[sc].C1_sharpe15.fromUpperBound)}]`, `${usd(T[sc].C2_sharpe10.point)} [${usd(T[sc].C2_sharpe10.fromLowerBound)} ; ${usd(T[sc].C2_sharpe10.fromUpperBound)}]`, usd(T[sc].C3_edgeLost.lowerBoundAtZero)])
const XT = C.exploratory.thresholds
const thrExpRows: Row[] = [['Central, délai 2 s', usd(XT.latency2s_central.C1_sharpe15), usd(XT.latency2s_central.C2_sharpe10), usd(XT.latency2s_central.C3_lowerBoundAtZero)], ['Optimiste, délai 2 s', usd(XT.latency2s_optimistic.C1_sharpe15), usd(XT.latency2s_optimistic.C2_sharpe10), usd(XT.latency2s_optimistic.C3_lowerBoundAtZero)], ['Prudent, poursuite après stop mesurée trade par trade', usd(XT.prudentPerTradeChase.C1_sharpe15), usd(XT.prudentPerTradeChase.C2_sharpe10), usd(XT.prudentPerTradeChase.C3_lowerBoundAtZero)]]
const famRows: Row[] = ['all', 'market', 'entry', 'stop', 'close', 'tp1', 'top5', 'rest95'].map(cat => {
  const c = bin.byCat[cat], o = off.byCat[cat]
  const lbl: Record<string, string> = { all: 'Toutes les exécutions', market: 'Ordres au marché et stops (sans TP1)', entry: 'Entrées seules', stop: 'Stops et stops suiveurs seuls', close: 'Sorties à la clôture seules', tp1: 'TP1 seuls', top5: '5 % meilleurs trades seuls', rest95: '95 % autres trades seuls' }
  return [lbl[cat], `${fr(c.slopePerBp.point, 3)} [${fr(c.slopePerBp.p5, 3)} ; ${fr(c.slopePerBp.p95, 3)}]`, `${pb(c.threshold.sharpe15.point)} [${pb(c.threshold.sharpe15.p5)} ; ${pb(c.threshold.sharpe15.p95)}]`, `${pb(c.threshold.sharpe10.point)} [${pb(c.threshold.sharpe10.p5)} ; ${pb(c.threshold.sharpe10.p95)}]`, pb(c.threshold.sharpe0.point), `${pb(o.threshold.sharpe15.point)} · ${pb(o.threshold.sharpe10.point)}`]
})
const decRows: Row[] = (C.decomposition as Record<string, { spread: number; impact: number; drift: number; total: number }>[] & { A: number }[]).map((d: Record<string, any>) => [usd(d.A), `${fr(d.entry.drift)} + ${fr(d.entry.impact)} = <b>${fr(d.entry.total)}</b>`, `${fr(d.close.drift)} + ${fr(d.close.impact)} = ${fr(d.close.total)}`, `${fr(d.stop.impact)}`, fr(d.tp1.total)])
const liqRows: Row[] = (C.liquidity as Record<string, any>[]).map(l => [usd(l.A), pct(l.entries.participation1mOver10), pct(l.entries.participation5mOver10), `${pct(l.entries.pov10Over15min)} · ${pct(l.entries.pov10Over60min)}`, `${pct(l.stops.triggerMinuteOver10)} · ${pct(l.stops.triggerMinuteOver25)} · ${pct(l.stops.triggerMinuteOver100)}`, `${pct(l.depth.over10)} (méd. ${fr(l.depth.medianRatio * 100, 2)} %)`])
const decRowsDrift: Row[] = (['entry', 'close', 'stop'] as const).flatMap(f => (['btc', 'ethusdt'] as const).map(k => {
  const d = decay[f][k]
  const lbl: Record<string, string> = { entry: 'Entrées', close: 'Sorties à la clôture', stop: 'Stops (après déclenchement)' }
  return [`${lbl[f]} · ${k === 'btc' ? 'BTC' : 'ETH'} (n = ${d.last[0].n})`, ...d.last.map((c: { mean: number; lo: number; hi: number }) => `${fr(c.mean)} [${fr(c.lo)} ; ${fr(c.hi)}]`), `${fr(d.vwap[0].mean)}`]
}))
const pilotRows: Row[] = Object.entries(PI.byStratum as Record<string, Record<string, { mean: number; lo: number; hi: number }>>).map(([st, v]) => [({ top5: '5 % meilleurs', worst20: '20 % plus mauvais', highVol: 'Forte volatilité 60 min', other: 'Autres' } as Record<string, string>)[st], ...['10s', '30s', '60s', '300s', '900s'].map(h => `${fr(v[h].mean)} [${fr(v[h].lo)} ; ${fr(v[h].hi)}]`)])
const shockRows: Row[] = Object.entries(C.shockCost as Record<string, any>).map(([A, v]) => [usd(+A), `${fr(v.entry.shock.meanBps)} (n = ${v.entry.shock.n}) · ${fr(v.entry.normal.meanBps)}`, `${fr(v.stop.shock.meanBps)} (n = ${v.stop.shock.n}) · ${fr(v.stop.normal.meanBps)}`])
const lowDays = Object.entries(C.lowDepthDays as Record<string, { day: string; ratio: number }[]>).map(([a, rows]) => `<li><b>${a}</b> : ${rows.slice(0, 8).map(r => `${r.day} (${pct(r.ratio, 0)})`).join(', ')}</li>`).join('')
const di = (s: string) => DI[s]
const t5 = bin.top5

// ---------------------------------------------------------------- textes
const XT0 = C.exploratory.thresholds
const lead = [
  `Fenêtre ${C.window.from} → ${C.window.to} (${C.window.days} jours), là où les perpétuels Binance existent. Sharpe du portefeuille sans coût ajouté : ${fr(C.baseline.sharpe, 2)}, CAGR ${pct(C.baseline.cagr)}. Commission de 0,045 % par exécution déjà dans le backtest et jamais comptée deux fois.`,
  `Budget de coûts : le Sharpe reste ≥ 1,5 tant que le coût ajouté moyen ne dépasse pas ${pb(bin.byCat.all.threshold.sharpe15.point)} par exécution, et ≥ 1,0 jusqu'à ${pb(bin.byCat.all.threshold.sharpe10.point)}. L'histoire elle-même est incertaine : même sans coût, ${pct(bin.byCat.all.zeroCostShareBelow.sharpe15, 0)} des historiques rééchantillonnés ont un Sharpe < 1,5.`,
  `Coût du délai, indépendant de la taille (mesuré) : dans les 2 secondes qui suivent la clôture du signal, le perpétuel a déjà bougé de ${fr(rs.BTC['2s'].last.meanBps)} pb (BTC) et ${fr(rs.ETH['2s'].last.meanBps)} pb (ETH) dans le sens du trade, en moyenne. Le backtest, qui exécute au prix de clôture, ne le paie pas.`,
  `Capacité (estimée par modèle, impact non calibré) : à 1 M$, Sharpe net ${fr(named('central')[3].sharpe, 2)} dans le scénario central, ${fr(named('optimistic')[3].sharpe, 2)} en optimiste, ${fr(named('prudent')[3].sharpe, 2)} en prudent. À 5 M$ : ${fr(named('central')[4].sharpe, 2)}, ${fr(named('optimistic')[4].sharpe, 2)} et ${fr(named('prudent')[4].sharpe, 2)}.`,
  `L'avantage statistique (borne basse à 90 % du Sharpe au-dessus de 0) se perd vers ${usd(T.central.C3_edgeLost.lowerBoundAtZero)} dans le scénario central, ${usd(T.optimistic.C3_edgeLost.lowerBoundAtZero)} en optimiste et ${usd(T.prudent.C3_edgeLost.lowerBoundAtZero)} en prudent. Le seuil de Sharpe 1,5 est franchi bien plus tôt : ${usd(T.central.C1_sharpe15.point)} (central), avec un intervalle très large ; ce seuil dépend surtout de l'hypothèse de délai : ${usd(XT0.latency2s_central.C1_sharpe15)} si l'ordre part 2 s après la clôture au lieu d'être étalé sur la première minute (variante exploratoire).`,
  `Limite de liquidité la plus contraignante (observée) : les stops. À 5 M$, l'ordre de stop dépasse 10 % du volume de la minute du déclenchement dans ${pct(L[4].stops.triggerMinuteOver10, 0)} des cas, et tout le volume de cette minute dans ${pct(L[4].stops.triggerMinuteOver100, 0)} des cas.`,
]

const statusRows: Row[] = [
  ['<b>Démontré</b> (données, reproductible)', 'Budget de coûts et sensibilité de la performance à chaque famille d\'exécutions ; poids des 5 % meilleurs trades. Volume réel du perpétuel autour de chaque exécution, participation, durée d\'exécution en POV, part des stops plus gros que le volume d\'une minute. Dérive du prix après la décision, de 1 s à 15 min. Demi-spread effectif (≈ 0,01 à 0,03 pb). Jours où la profondeur à ±1 % s\'effondre.'],
  ['<b>Estimé par modèle</b>', 'Impact de marché (loi en racine carrée, Y = 0,5 / 1 / 2 non calibré sur ce marché), donc coût total, CAGR et Sharpe nets par capital, et capitaux seuils. Coût d\'une exécution étalée sur plusieurs minutes. Poursuite après stop au-delà du pilote.'],
  ['<b>À valider en réel</b>', 'Impact réel des ordres de 250 k$ à 2,5 M$, réaction des teneurs de marché à un flux régulier, glissement des stops dans les vrais chocs, latence réelle du bot, écart entre marché de signal et marché d\'exécution sur la performance nette, et performance hors échantillon.'],
]

const l2Rows: Row[] = [
  ['Carnet L2 incrémental complet (Binance USDⓈ-M, BTCUSDT et ETHUSDT)', 'Coût exact d\'un ordre au marché de 50 k$ à 2,5 M$ au moment de chaque signal ; demi-spread et profondeur 0–20 pb', '±30 min autour de chaque exécution, 2020–2026 (≈ 2 500 fenêtres)', 'Tardis (payant ; premier jour du mois gratuit, accès bloqué ici)'],
  ['Carnet L2 Hyperliquid (20 niveaux puis 5, instantanés)', 'Même mesure sur la plateforme du bot, profondeur visible très courte (≈ 2 à 8 pb)', 'Depuis 2024-10-29', 'Tardis (payant) ; enregistrement propre gratuit dès maintenant'],
  ['Trades Hyperliquid avec adresses', 'Calibrer Y sur de vrais metaordres (Donier & Bonart, 2015) au lieu de le supposer', 'Depuis 2024-12-01', 'Tardis (payant) ou archive S3 Hyperliquid (frais de transfert)'],
  ['Exécutions réelles du bot (mainnet, petit capital)', 'Latence, taux de remplissage, glissement des stops, coût par rapport au prix de décision : calibre le modèle à petite taille', '6 à 12 mois', 'Journal du bot (existant)'],
  ['Cotations de gré à gré (RFQ) pour 0,5 à 2,5 M$', 'Prix réel de l\'immédiateté pour les grandes tailles', 'Ponctuel', 'Desks de gré à gré'],
]

const limits = [
  'L\'impact n\'est pas mesuré : Y est un scénario. Les capitaux seuils changent d\'un ordre de grandeur entre scénarios ; c\'est l\'incertitude principale au-delà de 500 k$.',
  'Signal et exécution sur deux marchés : le rendement net = rendement du backtest (Bitstamp BTC/USD, Binance ETH/USDT spot) − coûts mesurés sur le perpétuel. L\'écart de base à l\'entrée est faible (médiane ≈ −2 à −3 pb) mais son effet sur la performance n\'est pas modélisé.',
  'Dérive des petits ordres : l\'exécution principale (POV 10 %) utilise le VWAP de la première minute, qui surestime le coût d\'un ordre exécuté en quelques secondes (dérive VWAP 1 min ' + fr(C.driftVwapVsLast1m.BTC.vwapBps) + ' pb BTC et ' + fr(C.driftVwapVsLast1m.ETH.vwapBps) + ' pb ETH, contre ' + fr(rs.BTC['2s'].last.meanBps) + ' et ' + fr(rs.ETH['2s'].last.meanBps) + ' pb à 2 s). La variante « délai 2 s » est exploratoire.',
  'La poursuite après stop du scénario prudent vient du pilote stratifié (' + fr(PI.stopChase['10s'].mean) + ' pb à 10 s, intervalle [' + fr(PI.stopChase['10s'].lo) + ' ; ' + fr(PI.stopChase['10s'].hi) + '], n = ' + PI.stopChase['10s'].n + '), qui surreprésente les périodes agitées ; mesurée trade par trade sur tout l\'échantillon (fin de la minute du déclenchement), elle est plus faible. Variante exploratoire rapportée.',
  'Volume et profondeur visibles surestiment la liquidité disponible pour un preneur dans les chocs (annulations rapides). La profondeur agrégée à ±1 % n\'est jamais convertie en coût.',
  'Données bookDepth de Binance : ' + di('BTCUSDT').bookDepth.stuckSnapshots + ' (BTC) et ' + di('ETHUSDT').bookDepth.stuckSnapshots + ' (ETH) instantanés figés plus de 30 min, exclus ; jours absents : ' + di('BTCUSDT').bookDepth.missingDays.length + ' et ' + di('ETHUSDT').bookDepth.missingDays.length + '.',
  'Stratégie en échantillon : la fenêtre 2020–2026 recouvre les données sur lesquelles les règles ont été conçues. Les coûts sont mesurés hors échantillon de calibration, pas l\'avantage.',
  '5 % meilleurs trades : classement ex post, descriptif.',
]
const deviations = [...(B.deviations as string[]), 'Ajouts exploratoires, décidés après lecture du pilote pré-enregistré : échantillon aléatoire non stratifié d\'entrées (dérive à 1, 2, 5 s) ; variante d\'exécution « délai 2 s » ; scénario prudent avec poursuite mesurée trade par trade ; masque des valeurs figées de bookDepth (anomalie de l\'archive constatée en cours d\'étude) ; pente du Sharpe par point de base.']

// ---------------------------------------------------------------- HTML
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Capacité du Shock Engine</title>
<style>
:root{--bg:#ffffff;--fg:#14171c;--mut:#5b6472;--line:#e3e6eb;--panel:#f6f7f9;--c1:#2f8f5b;--c2:#2563c9;--c3:#c2410c;--c4:#7c3aed;--c5:#b91c1c;--c6:#0e7490;--c7:#a16207}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1116;--fg:#e8ebf0;--mut:#9aa3b2;--line:#262c36;--panel:#151a22;--c1:#4ade80;--c2:#60a5fa;--c3:#fb923c;--c4:#a78bfa;--c5:#f87171;--c6:#22d3ee;--c7:#facc15}}
:root[data-theme="dark"]{--bg:#0e1116;--fg:#e8ebf0;--mut:#9aa3b2;--line:#262c36;--panel:#151a22;--c1:#4ade80;--c2:#60a5fa;--c3:#fb923c;--c4:#a78bfa;--c5:#f87171;--c6:#22d3ee;--c7:#facc15}
body{background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0}
main{max-width:980px;margin:0 auto;padding:28px 16px 64px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:36px 0 10px;padding-top:12px;border-top:1px solid var(--line)}h3{font-size:16px;margin:22px 0 8px}
.sub{color:var(--mut)}.lead li{margin:6px 0}.note{color:var(--mut);font-size:13px}.box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:14px 0}
.tw{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--mut);font-weight:600}td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}caption{text-align:left;color:var(--mut);padding:4px 0}
figure{margin:18px 0}figcaption{font-size:13.5px;color:var(--mut);margin-bottom:6px}.chart{width:100%;height:auto}.chart .grid{stroke:var(--line)}.chart .tick,.chart .axis,.chart .leg,.chart .reflabel{fill:var(--mut);font-size:11px}.chart .ref{stroke:var(--mut);stroke-dasharray:3 4}.chart .line{fill:none;stroke-width:2}.chart .dash{stroke-dasharray:6 4}.chart .band{opacity:.13}
code{font-size:13px}
</style></head><body><main>
<h1>Capacité institutionnelle du Shock Engine</h1>
<p class="sub">Étude P0 + P1 sur données gratuites (Binance USDⓈ-M) · protocole pré-enregistré <code>research/preregistration/capacity-p0p1.md</code> · généré le ${new Date().toISOString().slice(0, 10)} · simulation historique, aucune exécution réelle.</p>
<div class="box"><ul class="lead">${lead.map(l => `<li>${l}</li>`).join('')}</ul></div>
<h2>Ce qui est démontré, estimé, ou à valider</h2>${table(['Statut', 'Contenu'], statusRows)}
<h2>1. Courbe de capacité</h2>
<p>Coût d'une exécution = demi-spread mesuré + impact (loi en racine carrée, I = Y·σ·√(Q/V), σ et V sur les 24 h précédentes) + dérive mesurée trade par trade pendant l'exécution (entrées et sorties à la clôture en participation de 10 % au volume réel ; stops exécutés immédiatement). Capital fixe par niveau : chaque ordre d'entrée vaut la moitié du capital (une sleeve, 100 %, sans levier).</p>
${chartCap}${chartCagr}${chartCost}
${SC.map(sc => `<h3>${SC_FR[sc]}</h3>${table(capHead, capRows(sc))}`).join('')}
<h3>Capital à partir duquel chaque critère est atteint</h3>
${table(['Scénario', 'Sharpe < 1,5 [intervalle 90 %]', 'Sharpe < 1,0 [intervalle 90 %]', 'Avantage statistique perdu (borne basse à 90 % ≤ 0)'], thrRows, 'Grille de 50 k$ à 100 M$, interpolation log-linéaire. Intervalle : capital où la borne basse, puis la borne haute, du Sharpe franchit le seuil.')}
${table(['Variante exploratoire', 'Sharpe < 1,5', 'Sharpe < 1,0', 'Avantage perdu'], thrExpRows, 'Ajoutées après lecture du pilote ; non pré-enregistrées.')}
<h3>Décomposition du coût (scénario central, pb par exécution)</h3>
${table(['Capital', 'Entrées : dérive + impact', 'Sorties à la clôture', 'Stops : impact', 'TP1'], decRows, 'Demi-spread ≈ 0,02 pb, négligeable. La dérive (délai) domine jusqu\'à 1 M$ ; l\'impact (modèle) prend le dessus ensuite.')}
<h2>2. Budget de coûts (P0)</h2>
${chartBudget}
${table(['Coût appliqué à…', 'Perte de Sharpe par pb [90 %]', 'Sharpe 1,5 si coût ≤ [90 %]', 'Sharpe 1,0 si coût ≤ [90 %]', 'Sharpe 0', 'Période officielle : 1,5 · 1,0'], famRows, `Fenêtre Binance ; dernière colonne : période officielle ${off.window.from} → ${off.window.to}. Exécutions par an : entrées ${fr(bin.fills.entry.perYear, 0)}, stops ${fr(bin.fills.stop.perYear, 0)}, TP1 ${fr(bin.fills.tp1.perYear, 0)}, sorties à la clôture ${fr(bin.fills.close.perYear, 0)}.`)}
<p>Les 5 % meilleurs trades (${t5.n} sur ${t5.of}, ${pct(t5.shareOfLogGrowth, 0)} de la croissance) supportent un coût énorme pris isolément : il faudrait en moyenne ${pb(t5.breakEvenPerFill.median * 1e4, 0)} par exécution pour annuler l'un d'eux (minimum ${pb(t5.breakEvenPerFill.min * 1e4, 0)}). Le budget se joue sur les 95 % autres, nombreux et proches de zéro : un coût appliqué à eux seuls a presque le même effet qu'un coût appliqué partout.</p>
<p class="note">Validation de la correction après coup contre une relance du moteur avec glissement : identique à 1 et 2 pb ; à 5 pb, écart de ${fr(Math.abs(B.validation[2].postHoc - B.validation[2].engine), 4)} (tolérance 0,002 dépassée) parce que ${B.validation[2].tradesChangedByRerun} trades changent de sortie quand les niveaux de sortie partent du prix d'entrée glissé. La correction après coup garde les trades fixes : c'est le pur surcoût que mesure l'étude.</p>
<h2>3. Disparition de l'avantage après le signal</h2>
${chartDecay}
${table(['Exécutions (fenêtre Binance)', '1 min', '3 min', '5 min', '15 min', 'VWAP 1 min'], decRowsDrift, 'Dérive du perpétuel, en pb, dans le sens du coût (positif = défavorable à l\'ordre) ; intervalles à 95 % par bootstrap des exécutions. Stops : depuis le niveau de déclenchement.')}
<p>Rendement brut moyen d'un trade : ${pb(gross, 0)}. Attendre 15 minutes coûte ${fr(decay.entry.btc.last[3].mean)} pb (BTC) et ${fr(decay.entry.ethusdt.last[3].mean)} pb (ETH) en moyenne, cohérent avec l'ancien test d'entrée retardée d'une bougie. L'essentiel de la dérive de la première minute arrive dans les premières secondes.</p>
${table(['Pilote stratifié (6 trades par actif et par strate)', '10 s', '30 s', '1 min', '5 min', '15 min'], pilotRows, 'Pilote pré-enregistré : la stratification surreprésente les gagnants et les périodes agitées, sa moyenne n\'est pas celle de la population. Les entrées en forte volatilité dérivent fortement et immédiatement.')}
<h2>4. Limites de liquidité observées</h2>
${chartLiq}
${table(['Capital', 'Entrées > 10 % du volume 1 min', 'Entrées > 10 % du volume 5 min', 'POV 10 % : > 15 min · > 60 min', 'Stops : > 10 % · > 25 % · > 100 % de la minute', 'Ordre > 10 % de la profondeur ±1 % (2023+)'], liqRows, 'Volume réel du perpétuel après l\'instant (pas de modèle). La profondeur agrégée à ±1 % est un indicateur de liquidité, jamais un coût.')}
<h3>Périodes de choc</h3>
<p>${C.counts.shockEvents} exécutions sur ${C.counts.events} tombent en période de choc (volatilité 60 min dans les 5 % les plus hautes, ou profondeur à ±1 % sous la moitié de sa médiane des 7 jours). Coût moyen, scénario central :</p>
${table(['Capital', 'Entrées : choc · normal (pb)', 'Stops : choc · normal (pb)'], shockRows, 'En choc, le volume des 24 h est plus élevé, ce qui réduit l\'impact modélisé des entrées ; la volatilité renchérit les stops.')}
<p>Jours où la profondeur à ±1 % a le plus chuté (minimum du jour / médiane des 7 jours précédents) :</p><ul>${lowDays}</ul>
<h2>5. Données L2 et calibrations nécessaires pour passer de l'estimation à la mesure</h2>
${table(['Donnée', 'Ce qu\'elle permet', 'Étendue', 'Source'], l2Rows)}
<p><b>Tardis, premier jour de chaque mois</b> : l'accès est bloqué par la politique réseau de l'environnement de calcul (domaine non autorisé). Une fois autorisé, test de représentativité pré-enregistré avant toute calibration (§ 10 du protocole). Les premiers jours du mois ne sont pas des jours de choc : la couverture des conditions de signal est le point à vérifier.</p>
<h2>6. Données et intégrité</h2>
<ul><li>Bougies 1 min BTCUSDT et ETHUSDT : ${di('BTCUSDT').klines.files} et ${di('ETHUSDT').klines.files} archives vérifiées (SHA-256), ${di('BTCUSDT').klines.rows} lignes chacune, aucune minute manquante ni doublon.</li>
<li>bookDepth : ${di('BTCUSDT').bookDepth.snapshots} et ${di('ETHUSDT').bookDepth.snapshots} instantanés (pas médian ${di('BTCUSDT').bookDepth.medianStepS} s), ${di('BTCUSDT').bookDepth.gapsOver5min} et ${di('ETHUSDT').bookDepth.gapsOver5min} trous de plus de 5 min, valeurs figées exclues.</li>
<li>aggTrades (pilote) : ${PI.integrity.days} jours, ${PI.integrity.rows} trades, ${PI.integrity.idGaps} trou d'identifiant ; prix identiques aux bougies 1 min (écart maximal ${fr(PI.consistency.maxAbsGapBps, 2)} pb).</li>
<li>${C.counts.events} exécutions placées sur le perpétuel ; ${C.counts.unlocated} stops ou TP1 non localisés (coût imputé par la médiane de leur famille).</li></ul>
<h2>7. Écarts au protocole et limites</h2>
<h3>Écarts</h3><ul>${deviations.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
<h3>Limites</h3><ul>${limits.map(l => `<li>${l}</li>`).join('')}</ul>
<h2>Références</h2>
<p class="note">Almgren, Thum, Hauptmann &amp; Li (2005), <i>Risk</i> · Tóth et al. (2011), <i>PRX</i> · Bouchaud, Bonart, Donier &amp; Gould (2018), <i>Trades, Quotes and Prices</i> · Donier &amp; Bonart (2015), <i>Market Microstructure and Liquidity</i> · Kyle &amp; Obizhaeva (2016), <i>Econometrica</i> · Korajczyk &amp; Sadka (2004), <i>JF</i> · Frazzini, Israel &amp; Moskowitz (2018), SSRN · Perold (1988), <i>JPM</i> · Bailey &amp; López de Prado (2014), <i>JPM</i>.</p>
<h2>Reproduction</h2><p class="note"><code>research/capacity/</code> : budget.ts (P0), data.ts, events.ts, pilot.ts, pilot-random.ts, capacity.ts, report.ts. Données brutes Binance téléchargées et vérifiées dans <code>research/data/binance/</code> (hors git).</p>
</main></body></html>`
writeFileSync(join(OUT, 'capacity-report.html'), html)

// ---------------------------------------------------------------- Markdown
const md = `# Capacité institutionnelle du Shock Engine — P0 et P1 (données gratuites)

Protocole pré-enregistré : \`research/preregistration/capacity-p0p1.md\`. Simulation historique, aucune
exécution réelle. Rapport complet avec graphiques : \`capacity-report.html\`.

## En bref

${lead.map(l => `- ${l}`).join('\n')}

## Statut des résultats

${mdTable(['Statut', 'Contenu'], statusRows)}

## Courbe de capacité (exécution POV 10 %)

${SC.map(sc => `### ${SC_FR[sc]}\n\n${mdTable(capHead, capRows(sc))}`).join('\n\n')}

### Capital à partir duquel chaque critère est atteint

${mdTable(['Scénario', 'Sharpe < 1,5', 'Sharpe < 1,0', 'Avantage perdu'], thrRows)}

Variantes exploratoires (non pré-enregistrées) :

${mdTable(['Variante', 'Sharpe < 1,5', 'Sharpe < 1,0', 'Avantage perdu'], thrExpRows)}

## Budget de coûts (P0)

${mdTable(['Coût appliqué à…', 'Perte de Sharpe par pb', 'Sharpe 1,5', 'Sharpe 1,0', 'Sharpe 0', 'Période officielle'], famRows)}

## Disparition de l'avantage

${mdTable(['Exécutions', '1 min', '3 min', '5 min', '15 min', 'VWAP 1 min'], decRowsDrift)}

## Limites de liquidité observées

${mdTable(['Capital', 'Entrées > 10 % 1 min', 'Entrées > 10 % 5 min', 'POV 10 % > 15 · > 60 min', 'Stops > 10 · 25 · 100 % de la minute', 'Ordre > 10 % profondeur ±1 %'], liqRows)}

## Données L2 et calibrations nécessaires

${mdTable(['Donnée', 'Ce qu\'elle permet', 'Étendue', 'Source'], l2Rows)}

## Écarts au protocole

${deviations.map(d => `- ${d}`).join('\n')}

## Limites

${limits.map(l => `- ${l.replace(/<[^>]+>/g, '')}`).join('\n')}
`
writeFileSync(join(OUT, 'capacity-report.md'), md)
process.stderr.write(`écrit ${join(OUT, 'capacity-report.html')} et capacity-report.md\n`)
