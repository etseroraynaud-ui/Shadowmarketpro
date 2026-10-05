// Bilan d'une session du bot à partir de son journal : bougies lues (et à quel signal), contrôles
// WebSocket / REST, révisions, reconnexions, spread, parité backtest / moteur live en shadow mode,
// ordres envoyés (doublons de cloid), trades, erreurs et arrêts.
//
//   npm run shadow-report -- [--log-dir bot/logs] [--since 2026-10-05T04:00:00Z]

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const dir = resolve(opt('log-dir', join(import.meta.dirname, '../../logs')))
const since = opt('since', '')

type Ev = Record<string, any> & { time: string; type: string; engine?: string }
const evs: Ev[] = readdirSync(dir).filter(f => f.startsWith('events-')).sort()
  .flatMap(f => readFileSync(join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as Ev))
  .filter(e => !since || e.time >= since)
// Dernière session seulement (depuis le dernier « start »), sauf --since.
const lastStart = since ? 0 : evs.map(e => e.type).lastIndexOf('start')
const E = evs.slice(Math.max(0, lastStart))
const of = (type: string, engine?: string) => E.filter(e => e.type === type && (engine === undefined || (e.engine ?? null) === engine))
const sim = (type: string) => of(type, null as unknown as string).concat(E.filter(e => e.type === type && e.engine == null)).filter((e, i, a) => a.indexOf(e) === i)

const start = E[0]
const end = E[E.length - 1]
console.log(`Session : ${start?.time} → ${end?.time} (${start?.mode}, données ${start?.dataNetwork})`)

const mb = of('market_bar')
const reasons: Record<string, number> = {}
for (const b of mb) reasons[b.reason] = (reasons[b.reason] ?? 0) + 1
console.log(`\nBougies closes lues en direct : ${mb.length} (${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(', ')})`)
for (const b of mb) {
  const s = b.spread
  console.log(`  ${b.bar}  clôture ${b.close}  WS=REST ${b.ws == null ? 'non vu' : b.ws.same ? 'oui' : 'NON ' + JSON.stringify(b.ws.diff)}  spread ${s?.meanBps != null ? `moy ${s.meanBps.toFixed(3)} / max ${s.maxBps.toFixed(3)} pb (${s.updates} BBO)` : '—'}  lu à ${b.time.slice(11, 19)}`)
}
// Délai entre la clôture et la lecture.
const lags = mb.map(b => Date.parse(b.time) - Date.parse(b.bar)).filter(x => Number.isFinite(x))
if (lags.length) console.log(`  délai clôture → lecture : min ${(Math.min(...lags) / 1000).toFixed(1)} s, max ${(Math.max(...lags) / 1000).toFixed(1)} s`)
const rev = of('candle_revised')
console.log(`Bougies révisées après lecture : ${rev.length}${rev.length ? ' ' + JSON.stringify(rev.map(r => [r.bar, r.diff])) : ''}`)
console.log(`Trous signalés : ${of('gap').length}`)

const opens = of('ws_open').length
const rec = of('ws_reconnected')
console.log(`\nWebSocket : ${opens} ouverture(s), ${rec.length} reconnexion(s), ${of('ws_closed').length} fermeture(s), ${of('ws_forced_reconnect').length} coupure(s) forcée(s), ${of('ws_stale').length} silence(s), ${of('ws_subscription_error').length} erreur(s) d'abonnement`)
for (const r of rec) {
  const closed = [...of('ws_closed')].reverse().find(c => c.time <= r.time)
  console.log(`  reconnexion ${r.time.slice(11, 19)} ${closed ? `(coupé ${((Date.parse(r.time) - Date.parse(closed.time)) / 1000).toFixed(1)} s)` : ''}`)
}

const par = of('parity')
const diffs = par.filter(p => !p.same)
console.log(`\nParité backtest / moteur live (exchange papier) : ${par.length} clôtures comparées, ${par.length - diffs.length} identiques, ${diffs.length} différentes`)
for (const d of diffs.slice(0, 10)) console.log(`  ${d.bar} backtest ${JSON.stringify(d.sim)} / live ${JSON.stringify(d.paper)}`)

const simSignals = E.filter(e => e.type === 'signal' && e.engine == null)
const paperSignals = of('signal', 'paper')
console.log(`Signaux : backtest ${simSignals.length}, moteur live ${paperSignals.length}`)
for (const s of simSignals) console.log(`  ${s.bar} long=${s.long} short=${s.short} sortie=${s.exit}`)
const entries = of('entry', 'paper')
const exits = of('exit', 'paper').concat(of('exit_fill', 'paper'))
console.log(`Ordres du moteur live : ${entries.length} entrée(s), ${exits.length} sortie(s), ${of('stop_placed', 'paper').length} stop(s) posé(s), ${of('stop_moved', 'paper').length} déplacement(s), ${of('orphan_orders_canceled', 'paper').length} annulation(s) d'orphelins, ${of('order_resolved', 'paper').length} issue(s) vérifiée(s)`)
for (const e of entries) console.log(`  entrée ${e.time.slice(11, 19)} ${e.side} ${e.size} @ ${e.avg} (clôture ${e.ref}, spread ${(+e.spreadBps).toFixed(3)} pb)`)
const tr = (f: string) => existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf8').trim().split('\n').slice(1).filter(l => start && l.split(',')[3] >= start.time.slice(0, 19)) : []
console.log(`Trades fermés pendant la session : backtest ${tr('trades-shadow.csv').length}, moteur live ${tr('trades-shadow-paper.csv').length}`)

const errors = E.filter(e => e.type === 'error')
const halts = E.filter(e => e.type === 'HALT')
console.log(`\nErreurs : ${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).map(e => `${e.time.slice(11, 19)} ${e.where}: ${String(e.error).split('\n')[0]}`).join('\n  ') : ''}`)
console.log(`Arrêts des ordres (HALT) : ${halts.length}${halts.length ? ' ' + halts.map(h => h.reason).join(' | ') : ''}`)
console.log(`Fills non reconnus : ${of('fill_unmatched').length} ; reprises après erreur réseau : ${of('retry').length}`)
