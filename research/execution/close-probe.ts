// Sonde de clôture Hyperliquid : observateur indépendant du bot (aucun ordre, aucune clé, aucun
// accès au processus ni aux fichiers du bot). Pour chaque clôture 15 min, elle enregistre ce qu'un
// moteur d'exécution peut savoir, et à quel instant :
// - arrivée par le WebSocket du premier message de la nouvelle bougie, et état de la bougie close
//   reçu juste avant (chemin rapide possible, sans attente fixe) ;
// - lectures REST de la bougie close à T + 250 ms … 60 s : à partir de quand l'API la confirme
//   (règle du bot : une bougie plus récente existe), et si sa valeur change ensuite ;
// - de T − 10 s à T + 30 s : BBO, transactions, prix mark / oracle / milieu, carnet rapide (5
//   niveaux, ≈ 0,5 s) et carnet à trois agrégations (20 niveaux exacts, puis 4 et 3 chiffres
//   significatifs, ≈ 5 s : la profondeur au-delà des niveaux exacts reste visible, en tranches).
//
//   NODE_USE_ENV_PROXY=1 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/close-probe.ts \
//     [--minutes 75] [--coins BTC,ETH] [--rest 1] [--out research/data/hl-probe]
//
// --rest 0 : aucune requête REST (seulement des abonnements WebSocket, sans poids pour la limite de
// 1 200 par minute et par IP) : à utiliser sur la machine du bot, qui partage cette limite.

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const MINUTES = Number(opt('minutes', '75'))
const COINS = opt('coins', 'BTC,ETH').split(',')
const REST = opt('rest', '1') !== '0'
const OUT_DIR = resolve(opt('out', join(ROOT, 'research/data/hl-probe')))
const WS_URL = 'wss://api.hyperliquid.xyz/ws'
const INFO = 'https://api.hyperliquid.xyz/info'
const STEP = 15 * 60000
const BEFORE = 10000
const AFTER = 30000
const REST_OFFSETS = [250, 500, 1000, 1500, 2000, 3000, 5000, 10000, 60000]
/** Agrégations du carnet : exact (null), puis 4 et 3 chiffres significatifs. */
const AGG = [null, 4, 3] as const

mkdirSync(OUT_DIR, { recursive: true })
const file = join(OUT_DIR, `probe-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)
const write = (rec: Record<string, unknown>) => appendFileSync(file, JSON.stringify(rec) + '\n')

/** Clôture T dont la fenêtre [T − 10 s, T + 30 s] contient t, sinon null. */
function windowOf(t: number): number | null {
  const next = Math.ceil(t / STEP) * STEP
  if (next - t <= BEFORE) return next
  const prev = Math.floor(t / STEP) * STEP
  return t - prev <= AFTER ? prev : null
}

// Derniers états connus (hors fenêtre, seul le plus récent est gardé).
const lastBook = new Map<string, unknown>()
const candles = new Map<string, { t: number; o: string; h: string; l: string; c: string; v: string; n: number; recv: number }>()
const openT = new Map<string, number>()
let dumpedFor = -1

interface Conn { ws: WebSocket | null; subs: Record<string, unknown>[]; name: string; opens: number }
const conns: Conn[] = AGG.map(a => ({
  ws: null, opens: 0, name: a == null ? 'exact' : `sig${a}`,
  subs: COINS.flatMap(coin => [
    { type: 'l2Book', coin, ...(a == null ? {} : { nSigFigs: a }) },
    ...(a == null ? [{ type: 'candle', coin, interval: '15m' }, { type: 'bbo', coin }, { type: 'trades', coin }, { type: 'activeAssetCtx', coin }] : []),
  ]),
}))
// Carnet rapide : 5 niveaux exacts environ toutes les 0,5 s (le carnet à 20 niveaux n'est envoyé
// qu'environ toutes les 5 s).
conns.push({ ws: null, opens: 0, name: 'fast', subs: COINS.map(coin => ({ type: 'l2Book', coin, fast: true })) })

function onMessage(conn: Conn, raw: string) {
  const recv = Date.now()
  const m = JSON.parse(raw) as { channel: string; data: any }
  const T = windowOf(recv)
  if (T != null && T !== dumpedFor) {
    // Ouverture d'une fenêtre : derniers carnets connus, pour avoir l'état à T − 10 s.
    dumpedFor = T
    for (const [key, data] of lastBook) write({ k: 'book_at_open', T, key, data })
  }
  switch (m.channel) {
    case 'l2Book': {
      const key = `${conn.name}:${m.data.coin}`
      lastBook.set(key, m.data)
      if (T != null) write({ k: 'book', T, agg: conn.name, recv, coin: m.data.coin, time: m.data.time, levels: m.data.levels.map((side: { px: string; sz: string; n: number }[]) => side.map(l => [+l.px, +l.sz, l.n])) })
      break
    }
    case 'candle': {
      const c = m.data
      const prevOpen = openT.get(c.s) ?? -Infinity
      if (c.t > prevOpen) {
        const prev = candles.get(c.s)
        // Premier message de la nouvelle bougie : l'état reçu juste avant de la précédente.
        if (prevOpen !== -Infinity) write({ k: 'ws_close', T: c.t, coin: c.s, recv, prev, first: { t: c.t, o: c.o, c: c.c, v: c.v, n: c.n } })
        openT.set(c.s, c.t)
      }
      if (c.t >= (openT.get(c.s) ?? -Infinity)) candles.set(c.s, { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, n: c.n, recv })
      if (T != null) write({ k: 'candle', T, recv, coin: c.s, t: c.t, c: c.c, v: c.v, n: c.n })
      break
    }
    case 'bbo':
      if (T != null) write({ k: 'bbo', T, recv, coin: m.data.coin, time: m.data.time, bid: m.data.bbo[0] ? [+m.data.bbo[0].px, +m.data.bbo[0].sz] : null, ask: m.data.bbo[1] ? [+m.data.bbo[1].px, +m.data.bbo[1].sz] : null })
      break
    case 'trades':
      if (T != null) for (const x of m.data) write({ k: 'trade', T, recv, coin: x.coin, time: x.time, px: +x.px, sz: +x.sz, side: x.side, tid: x.tid })
      break
    case 'activeAssetCtx':
      if (T != null) write({ k: 'ctx', T, recv, coin: m.data.coin, mark: +m.data.ctx.markPx, oracle: +m.data.ctx.oraclePx, mid: m.data.ctx.midPx == null ? null : +m.data.ctx.midPx })
      break
    case 'subscriptionResponse':
      break
    case 'error':
      write({ k: 'ws_error', recv, conn: conn.name, data: m.data })
      break
  }
}

function connect(conn: Conn) {
  const ws = new WebSocket(WS_URL)
  conn.ws = ws
  ws.onopen = () => {
    conn.opens++
    write({ k: 'ws_open', recv: Date.now(), conn: conn.name, count: conn.opens })
    for (const s of conn.subs) ws.send(JSON.stringify({ method: 'subscribe', subscription: s }))
  }
  ws.onmessage = e => { try { onMessage(conn, String(e.data)) } catch (err) { write({ k: 'parse_error', recv: Date.now(), error: String(err) }) } }
  ws.onclose = () => {
    write({ k: 'ws_closed', recv: Date.now(), conn: conn.name })
    if (!stopping) setTimeout(() => connect(conn), 1000)
  }
  ws.onerror = () => undefined
}

// Ping applicatif : Hyperliquid ferme une connexion muette au bout de 60 s.
const ping = setInterval(() => { for (const c of conns) if (c.ws?.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify({ method: 'ping' })) }, 30000)

async function restCandles(coin: string, T: number, offset: number) {
  const t0 = Date.now()
  try {
    const res = await fetch(INFO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: '15m', startTime: T - 2 * STEP, endTime: T + STEP } }) })
    const rows = (await res.json()) as { t: number; o: string; h: string; l: string; c: string; v: string; n: number }[]
    write({ k: 'rest_candles', T, coin, offset, t0, t1: Date.now(), status: res.status, bars: rows.map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, n: r.n })) })
  } catch (e) {
    write({ k: 'rest_error', T, coin, offset, t0, t1: Date.now(), error: String(e) })
  }
}

let stopping = false
const timers: NodeJS.Timeout[] = []
function scheduleRest() {
  const T = Math.ceil((Date.now() + 1) / STEP) * STEP
  for (const coin of COINS) for (const off of REST_OFFSETS) timers.push(setTimeout(() => void restCandles(coin, T, off), T + off - Date.now()))
  timers.push(setTimeout(scheduleRest, T + 1000 - Date.now()))
}

write({ k: 'start', recv: Date.now(), coins: COINS, rest: REST, minutes: MINUTES, offsets: REST_OFFSETS, agg: AGG, node: process.version })
for (const c of conns) connect(c)
if (REST) scheduleRest()
setTimeout(() => {
  stopping = true
  clearInterval(ping)
  for (const t of timers) clearTimeout(t)
  for (const c of conns) c.ws?.close()
  write({ k: 'stop', recv: Date.now() })
  process.stderr.write(`sonde terminée : ${file}\n`)
  setTimeout(() => process.exit(0), 500)
}, MINUTES * 60000)
process.stderr.write(`sonde : ${COINS.join(', ')}, ${MINUTES} min, REST ${REST ? 'oui' : 'non'} → ${file}\n`)
