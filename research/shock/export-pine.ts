// Génère le code Pine v6 (TradingView) des préréglages adaptatifs volatilité 15 et 30 min, avec
// exactement les réglages de Backtest Lab (lib/strategies/shock/presets.ts).
//
//   node research/shock/export-pine.ts
//
// Écrit public/backtest/strategies/shock-engine-adaptive-{15,30}m.pine.

import { mkdirSync, writeFileSync } from 'node:fs'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import { SHOCK_INPUTS, SHOCK_PRESETS } from '../../lib/strategies/shock/adapter.ts'
import type { ShockInput } from '../../lib/strategies/shock/adapter.ts'

const OUT = 'public/backtest/strategies'

/** Paramètres de shockSignals(), dans l'ordre de sa déclaration. */
const SIGNAL_KEYS: (keyof ShockParams)[] = [
  'highActivityMode', 'volWin', 'kMain', 'useMicroShock', 'kMicro', 'rangeWin', 'wickThr',
  'lamEmaWin', 'lamNormWin', 'lamPctThr', 'onlyHighLam', 'useHTF', 'htfMinutes', 'htfEmaLen',
  'useVolFilter', 'volZWin', 'volZThr', 'volFadeMax', 'useCompression', 'atrZWin', 'compThr',
  'directionalOnly', 'fadeOnlyLowLam', 'atrLen', 'vwapLen', 'useImpulse', 'longLamPct',
  'htfSlopeMode', 'htfSlopeBars',
]

const TF_STRINGS: Record<number, string> = { 60: '60', 240: '240', 1440: 'D', 4320: '3D' }

const num = (x: number, float: boolean) => (float && Number.isInteger(x) ? x.toFixed(1) : String(x))

function inputLine(prefix: string, group: string, inp: ShockInput, p: ShockParams): string {
  const v = p[inp.key]
  const name = `${prefix}_${inp.key}`
  const title = JSON.stringify(inp.title)
  if (inp.kind === 'bool') return `bool   ${name} = input.bool(${v ? 'true' : 'false'}, ${title}, group = ${group})`
  if (inp.key === 'htfMinutes') {
    const tf = TF_STRINGS[v as number]
    if (!tf) throw new Error(`HTF ${v} min : pas de timeframe TradingView`)
    return `string ${name} = input.timeframe(${JSON.stringify(tf)}, ${title}, options = ["60", "240", "D", "3D"], group = ${group})`
  }
  if (inp.kind === 'select') {
    const opts = inp.options!.map(o => JSON.stringify(String(o.value))).join(', ')
    return `string ${name} = input.string(${JSON.stringify(String(v))}, ${title}, options = [${opts}], group = ${group})`
  }
  const x = v as number
  if (inp.min != null && x < inp.min) throw new Error(`${inp.key} = ${x} < ${inp.min}`)
  if (inp.max != null && x > inp.max) throw new Error(`${inp.key} = ${x} > ${inp.max}`)
  const f = inp.kind === 'float'
  const range = `minval = ${num(inp.min!, f)}, maxval = ${num(inp.max!, f)}, step = ${num(inp.step!, f)}`
  return `${f ? 'float  ' : 'int    '}${name} = input.${f ? 'float' : 'int'}(${num(x, f)}, ${title}, ${range}, group = ${group})`
}

function pine(tf: number, calm: ShockParams, agitated: ShockParams, oos: string): string {
  const inputs = (prefix: string, group: string, p: ShockParams) => SHOCK_INPUTS.map(inp => inputLine(prefix, group, inp, p)).join('\n')
  const args = (prefix: string) => SIGNAL_KEYS.map(k => `${prefix}_${k}`).join(', ')
  return `// This Pine Script™ code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © SMPShockEngine
//
// SHOCK ENGINE · ADAPTATIF VOLATILITÉ · ${tf} MIN (EXPÉRIMENTAL)
// Généré par research/shock/export-pine.ts depuis les préréglages de ShadowMarketPro Backtest Lab.
//
// Principe : deux jeux de réglages du Shock Engine, un pour la volatilité calme, un pour la
// volatilité agitée. Le régime est celui du dernier jour UTC clos : écart type des rendements
// journaliers sur 20 jours, comparé aux 365 jours précédents ; au-dessus de la médiane = agité.
// Le jeu du régime décide des entrées ; une position garde jusqu'à sa sortie les réglages du jeu
// qui l'a ouverte (stop, TP1, trailing, sortie VWAP, flip).
//
// ATTENTION : réglages choisis par la recherche sur BTC 2017-2026. Sur cette période, le
// résultat est en échantillon, donc flatteur.
// ${oos}
//
// Graphique en ${tf} minutes. Le filtre HTF et le régime ne lisent que des barres closes, en
// historique comme en temps réel : pas de repaint.

//@version=6
strategy("Shock Engine Adaptive Vol ${tf}m",
     shorttitle = "SHOCK ADAPT ${tf}",
     overlay = true,
     pyramiding = 0,
     initial_capital = 10000,
     default_qty_type = strategy.percent_of_equity,
     default_qty_value = 100,
     commission_type = strategy.commission.percent,
     commission_value = 0.02,
     slippage = 1,
     calc_on_every_tick = false,
     process_orders_on_close = true)

const float EPS = 1e-10


// ════════════════════════════════════════════════════════════════════════════
//                                   INPUTS
// ════════════════════════════════════════════════════════════════════════════

const string G_REG = "═══════════ RÉGIME DE VOLATILITÉ ═══════════"
int   regVolLen   = input.int(20, "Volatility length (days)", minval = 5, maxval = 100, group = G_REG)
int   regLookback = input.int(365, "Percentile lookback (days)", minval = 60, maxval = 1000, group = G_REG)
float regThr      = input.float(50.0, "Agitated above percentile", minval = 1.0, maxval = 99.0, group = G_REG)
bool  showRegime  = input.bool(true, "Show regime background", group = G_REG)

const string G_A = "═══════════ RÉGLAGES · VOLATILITÉ CALME ═══════════"
${inputs('a', 'G_A', calm)}

const string G_B = "═══════════ RÉGLAGES · VOLATILITÉ AGITÉE ═══════════"
${inputs('b', 'G_B', agitated)}


// ════════════════════════════════════════════════════════════════════════════
//                                 FONCTIONS
// ════════════════════════════════════════════════════════════════════════════

// SMA de la dernière barre \`tf\` close à la clôture de la barre du graphique, et sa valeur
// \`back\` barres \`tf\` plus tôt. En historique, lookahead_off donne déjà la dernière barre close ;
// en temps réel, la barre en formation est remplacée par la précédente : même résultat que le
// backtest, sans repaint.
closedHtfSma(string tf, int len, int back) =>
    float s = ta.sma(close, len)
    [v0, b0, v1, b1, tc] = request.security(syminfo.tickerid, tf, [s, s[back], s[1], s[back + 1], time_close], barmerge.gaps_off, barmerge.lookahead_off)
    bool closed = na(tc) or tc <= time_close
    [closed ? v0 : v1, closed ? b0 : b1]

// Régime de volatilité du dernier jour clos : 1 = agité, 0 = calme, -1 = historique insuffisant.
volRegime(int len, int lookback, float thr) =>
    float vol = ta.stdev(math.log(close / close[1]), len)
    float pr = ta.percentrank(vol, lookback)
    [p0, p1, tc] = request.security(syminfo.tickerid, "D", [pr, pr[1], time_close], barmerge.gaps_off, barmerge.lookahead_off)
    float p = na(tc) or tc <= time_close ? p0 : p1
    na(p) ? -1 : p > thr ? 1 : 0

// Signaux du Shock Engine pour un jeu de réglages (calculs identiques au script d'origine).
shockSignals(bool highActivityMode, int volWin, float kMain, bool useMicroShock, float kMicro, int rangeWin, float wickThr, simple int lamEmaWin, int lamNormWin, float lamPctThr, bool onlyHighLam, bool useHTF, string htfTF, int htfEmaLen, bool useVolFilter, int volZWin, float volZThr, float volFadeMax, bool useCompression, int atrZWin, float compThr, bool directionalOnly, bool fadeOnlyLowLam, simple int atrLen, int vwapLen, bool useImpulse, float longLamPct, string htfSlopeMode, int htfSlopeBars) =>
    float effKMicro = highActivityMode ? math.max(kMicro - 0.2, 0.8) : kMicro
    bool effOnlyHighLam = highActivityMode ? false : onlyHighLam
    bool effUseCompression = highActivityMode ? false : useCompression

    // Chocs : z-score du rendement
    float r = math.log(math.max(close, EPS) / math.max(nz(close[1], close), EPS))
    float mu = ta.sma(r, volWin)
    float sd = ta.stdev(r, volWin)
    float z = sd > EPS ? (r - mu) / sd : 0.0
    bool mainShock = math.abs(z) > kMain
    bool shock = mainShock or (useMicroShock and math.abs(z) > effKMicro)
    bool posShock = shock and r > 0
    bool negShock = shock and r < 0

    // Intensité lambda
    float lamPct = ta.percentrank(ta.ema(shock ? 1.0 : 0.0, lamEmaWin), lamNormWin)
    bool highLam = lamPct > lamPctThr
    bool allowLambda = effOnlyHighLam ? highLam : true

    // Classification
    float hh = ta.highest(high, rangeWin)
    float ll = ta.lowest(low, rangeWin)
    float hhPrev = nz(hh[1], hh)
    float llPrev = nz(ll[1], ll)
    float rng = math.max(high - low, syminfo.mintick)
    float upW = (high - math.max(open, close)) / rng
    float dnW = (math.min(open, close) - low) / rng
    float bodyShare = math.abs(close - open) / rng
    float closePos = (close - low) / rng
    bool impulseLong = posShock and close > hhPrev and upW < wickThr and bodyShare > 0.55 and closePos > 0.75
    bool impulseShort = negShock and close < llPrev and dnW < wickThr
    bool fadeLong = negShock and (dnW > wickThr or close > llPrev)
    bool fadeShort = posShock and (upW > wickThr or close < hhPrev)

    // Filtre HTF ; pente mesurée en barres du graphique (script) ou en barres HTF
    [htfVal, htfBack] = closedHtfSma(htfTF, htfEmaLen, htfSlopeBars)
    float htfPrev = htfSlopeMode == "htf" ? htfBack : htfVal[htfSlopeBars]
    bool htfBull = close > htfVal
    bool htfBear = close < htfVal
    bool htfBullStrong = htfBull and htfVal > htfPrev
    bool htfShortOK = not useHTF or htfBear

    // Volume
    float volMu = ta.sma(volume, volZWin)
    float volSd = ta.stdev(volume, volZWin)
    float volZ = volSd > EPS ? (volume - volMu) / volSd : 0.0
    bool volImpulseOK = not useVolFilter or volZ > volZThr
    bool volFadeOK = not useVolFilter or volZ < volFadeMax

    // Compression
    float atrValue = ta.atr(atrLen)
    float atrMu = ta.sma(atrValue, atrZWin)
    float atrSd = ta.stdev(atrValue, atrZWin)
    float atrZ = atrSd > EPS ? (atrValue - atrMu) / atrSd : 0.0
    bool compressionOK = not effUseCompression or atrZ < compThr

    // Entrées (le script exige htfBullStrong pour les longs, même filtre HTF désactivé)
    bool longRegimeOK = lamPct > longLamPct and volZ > 0.0
    bool fadeLambdaOK = not fadeOnlyLowLam or not highLam
    bool impulseEntryLong = useImpulse and impulseLong and htfBullStrong and longRegimeOK and volImpulseOK and compressionOK
    bool impulseEntryShort = useImpulse and impulseShort and htfShortOK and volImpulseOK and compressionOK
    bool fadeEntryLong = fadeLong and not directionalOnly and fadeLambdaOK and volFadeOK
    bool fadeEntryShort = fadeShort and not directionalOnly and fadeLambdaOK and volFadeOK
    float vwapProxy = ta.sma(hlc3, vwapLen)
    [atrValue, vwapProxy, htfVal, mainShock, impulseLong, impulseShort, fadeLong, fadeShort, impulseEntryLong, impulseEntryShort, fadeEntryLong, fadeEntryShort, allowLambda]

setName(int s) =>
    s == 1 ? "agitated" : "calm"


// ════════════════════════════════════════════════════════════════════════════
//                          RÉGIME ET SIGNAUX DES DEUX JEUX
// ════════════════════════════════════════════════════════════════════════════

int regime = volRegime(regVolLen, regLookback, regThr)

[atrA, vwapA, htfA, mainA, impLA, impSA, fadeLA, fadeSA, entImpLA, entImpSA, entFadeLA, entFadeSA, lamOkA] = shockSignals(${args('a')})
[atrB, vwapB, htfB, mainB, impLB, impSB, fadeLB, fadeSB, entImpLB, entImpSB, entFadeLB, entFadeSB, lamOkB] = shockSignals(${args('b')})

int coolA = a_highActivityMode ? math.max(int(a_cooldownBars / 2), 2) : a_cooldownBars
int coolB = b_highActivityMode ? math.max(int(b_cooldownBars / 2), 2) : b_cooldownBars
var int lastTradeBar = na
bool coolOkA = na(lastTradeBar) or bar_index - lastTradeBar > coolA
bool coolOkB = na(lastTradeBar) or bar_index - lastTradeBar > coolB


// ════════════════════════════════════════════════════════════════════════════
//                                  ENTRÉES
// ════════════════════════════════════════════════════════════════════════════

bool isLong = strategy.position_size > 0
bool isShort = strategy.position_size < 0
bool isFlat = strategy.position_size == 0

// Jeu E : celui du régime, décide des entrées. Jeu Q : celui de la position ouverte (ou E).
var int posSet = 0
int eSet = regime
int qSet = isFlat ? math.max(eSet, 0) : posSet

bool coolE = eSet == 0 ? coolOkA : coolOkB
bool coolQ = qSet == 0 ? coolOkA : coolOkB
bool sigLong = eSet == 0 ? lamOkA and a_allowLong and (entImpLA or entFadeLA) : eSet == 1 ? lamOkB and b_allowLong and (entImpLB or entFadeLB) : false
bool sigShort = eSet == 0 ? lamOkA and a_allowShort and (entImpSA or entFadeSA) : eSet == 1 ? lamOkB and b_allowShort and (entImpSB or entFadeSB) : false
bool enterLong = sigLong and coolE
bool enterShort = sigShort and coolE

var bool lastWasFade = false
var float entryPrice = na
var float entryATR = na

if enterLong and strategy.position_size <= 0
    bool imp = eSet == 0 ? impLA : impLB
    bool isMain = eSet == 0 ? mainA : mainB
    string tag = imp ? (isMain ? "IMP" : "μIMP") : "FADE"
    strategy.entry("L", strategy.long, comment = tag + " L " + setName(eSet), alert_message = '{"action":"long","set":"' + setName(eSet) + '"}')
    lastWasFade := eSet == 0 ? fadeLA : fadeLB
    entryPrice := close
    entryATR := eSet == 0 ? atrA : atrB
    lastTradeBar := bar_index
    posSet := eSet

if enterShort and strategy.position_size >= 0
    bool imp = eSet == 0 ? impSA : impSB
    bool isMain = eSet == 0 ? mainA : mainB
    string tag = imp ? (isMain ? "IMP" : "μIMP") : "FADE"
    strategy.entry("S", strategy.short, comment = tag + " S " + setName(eSet), alert_message = '{"action":"short","set":"' + setName(eSet) + '"}')
    lastWasFade := eSet == 0 ? fadeSA : fadeSB
    entryPrice := close
    entryATR := eSet == 0 ? atrA : atrB
    lastTradeBar := bar_index
    posSet := eSet


// ════════════════════════════════════════════════════════════════════════════
//                         SORTIES (réglages du jeu Q)
// ════════════════════════════════════════════════════════════════════════════

float atrQ = qSet == 0 ? atrA : atrB
float vwapQ = qSet == 0 ? vwapA : vwapB
float stopMultQ = qSet == 0 ? a_atrStopMult : b_atrStopMult
float trailMultQ = qSet == 0 ? a_atrTrailMult : b_atrTrailMult
bool useTP1Q = qSet == 0 ? a_useTP1 : b_useTP1
float tp1MultQ = qSet == 0 ? a_tp1AtrMult : b_tp1AtrMult
int tp1QtyQ = qSet == 0 ? a_tp1QtyPct : b_tp1QtyPct
bool useVWAPQ = qSet == 0 ? a_useVWAPExit : b_useVWAPExit
bool useFlipQ = qSet == 0 ? a_useFlipExit : b_useFlipExit
bool flipMainOnlyQ = qSet == 0 ? a_flipMainOnly : b_flipMainOnly
bool flipFadeQ = qSet == 0 ? a_flipIncludeFade : b_flipIncludeFade
float flipLifeQ = qSet == 0 ? a_flipMinLifeATR : b_flipMinLifeATR

float atrSafe = math.max(nz(entryATR, atrQ), syminfo.mintick)
float ep = nz(entryPrice, close)
float tp1Long = ep + tp1MultQ * atrSafe
float tp1Short = ep - tp1MultQ * atrSafe
float stopLong = ep - stopMultQ * atrSafe
float stopShort = ep + stopMultQ * atrSafe
float trailPts = trailMultQ * atrSafe / syminfo.mintick

if isLong
    if useTP1Q
        strategy.exit("L-TP1", "L", limit = tp1Long, qty_percent = tp1QtyQ, comment = "TP1", alert_message = '{"action":"tp1_long"}')
    strategy.exit("L-Exit", "L", stop = stopLong, trail_points = trailPts, trail_offset = trailPts, comment = "SL/TR", alert_message = '{"action":"exit_long"}')
    if useVWAPQ and lastWasFade and close >= vwapQ
        strategy.close("L", comment = "VWAP", alert_message = '{"action":"exit_long"}')

if isShort
    if useTP1Q
        strategy.exit("S-TP1", "S", limit = tp1Short, qty_percent = tp1QtyQ, comment = "TP1", alert_message = '{"action":"tp1_short"}')
    strategy.exit("S-Exit", "S", stop = stopShort, trail_points = trailPts, trail_offset = trailPts, comment = "SL/TR", alert_message = '{"action":"exit_short"}')
    if useVWAPQ and lastWasFade and close <= vwapQ
        strategy.close("S", comment = "VWAP", alert_message = '{"action":"exit_short"}')

// Flip exit : fermeture sur signal brut opposé, sauf si TP1 a déjà été touché.
var bool tp1Hit = false
var float entryRef = na
var float mfeFlip = na
bool justEntered = strategy.position_size != 0 and strategy.position_size[1] == 0
if justEntered
    entryRef := strategy.position_avg_price
if isFlat
    entryRef := na
if justEntered or isFlat
    tp1Hit := false
if useTP1Q and not tp1Hit
    if isLong
        tp1Hit := high >= tp1Long
    if isShort
        tp1Hit := low <= tp1Short
if justEntered
    mfeFlip := close
if isLong
    mfeFlip := math.max(nz(mfeFlip, close), high)
if isShort
    mfeFlip := math.min(nz(mfeFlip, close), low)
if isFlat
    mfeFlip := na
float mfeMove = isLong ? nz(mfeFlip, close) - entryRef : isShort ? entryRef - nz(mfeFlip, close) : 0.0
bool flipLifeOK = flipLifeQ <= 0 or mfeMove >= flipLifeQ * atrSafe

bool lamOkQ = qSet == 0 ? lamOkA : lamOkB
bool mainQ = qSet == 0 ? mainA : mainB
bool impLQ = qSet == 0 ? impLA : impLB
bool impSQ = qSet == 0 ? impSA : impSB
bool fadeEntLQ = qSet == 0 ? entFadeLA : entFadeLB
bool fadeEntSQ = qSet == 0 ? entFadeSA : entFadeSB
bool rawLong = useFlipQ and lamOkQ and coolQ and ((impLQ and (not flipMainOnlyQ or mainQ)) or (flipFadeQ and fadeEntLQ))
bool rawShort = useFlipQ and lamOkQ and coolQ and ((impSQ and (not flipMainOnlyQ or mainQ)) or (flipFadeQ and fadeEntSQ))

if isShort and rawLong and not tp1Hit and flipLifeOK
    strategy.close("S", comment = "FLIP_TO_LONG", alert_message = '{"action":"exit_short"}')
if isLong and rawShort and not tp1Hit and flipLifeOK
    strategy.close("L", comment = "FLIP_TO_SHORT", alert_message = '{"action":"exit_long"}')


// ════════════════════════════════════════════════════════════════════════════
//                                  VISUELS
// ════════════════════════════════════════════════════════════════════════════

color regCol = regime == 1 ? color.new(color.orange, 92) : regime == 0 ? color.new(color.aqua, 94) : na
bgcolor(showRegime ? regCol : na, title = "Volatility regime")
plot(qSet == 0 ? htfA : htfB, "HTF filter (active set)", color = color.new(color.yellow, 40), linewidth = 2)
plot(qSet == 0 ? vwapA : vwapB, "VWAP proxy (active set)", color = color.new(color.gray, 40))

var table info = table.new(position.top_right, 2, 3, bgcolor = color.new(#0d1117, 10), frame_width = 1, frame_color = color.new(#30363d, 50))
if barstate.islast
    color hdr = color.new(#8b949e, 0)
    table.cell(info, 0, 0, "RÉGIME", text_color = hdr, text_size = size.small)
    table.cell(info, 1, 0, regime == 1 ? "AGITÉ" : regime == 0 ? "CALME" : "—", text_color = regime == 1 ? color.orange : color.aqua, text_size = size.small)
    table.cell(info, 0, 1, "JEU POSITION", text_color = hdr, text_size = size.small)
    table.cell(info, 1, 1, isFlat ? "—" : posSet == 1 ? "AGITÉ" : "CALME", text_color = color.white, text_size = size.small)
    table.cell(info, 0, 2, "POSITION", text_color = hdr, text_size = size.small)
    table.cell(info, 1, 2, isLong ? "LONG" : isShort ? "SHORT" : "FLAT", text_color = isLong ? color.lime : isShort ? color.red : hdr, text_size = size.small)
`
}

mkdirSync(OUT, { recursive: true })
for (const id of ['adaptive30', 'adaptive15']) {
  const pr = SHOCK_PRESETS.find(x => x.id === id)!
  const b = pr.build()
  if (!b.adaptive?.calm || !b.adaptive.agitated) throw new Error(`${id} : il faut deux jeux`)
  const file = `${OUT}/shock-engine-adaptive-${pr.tf}m.pine`
  writeFileSync(file, pine(pr.tf!, { ...DEFAULT_PARAMS, ...b.adaptive.calm }, { ...DEFAULT_PARAMS, ...b.adaptive.agitated }, pr.selectedOn?.oos.fr ?? ''))
  console.log(file)
}
