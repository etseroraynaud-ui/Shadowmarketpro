// Configuration du bot, lue uniquement dans les variables d'environnement. Aucune clé dans le code.
//
//   BOT_MODE              shadow (défaut) | testnet | mainnet
//   BOT_ALLOW_MAINNET     doit valoir 1 pour BOT_MODE=mainnet ; sinon le bot refuse de démarrer
//                         et ne lit aucune clé
//   HL_ACCOUNT_ADDRESS    adresse du compte Hyperliquid (le compte principal, pas l'agent)
//   HL_SUBACCOUNT_ADDRESS sous-compte (ou vault) du compte principal que le bot trade ; vide : le
//                         compte principal. Un sous-compte dédié isole le track record du bot.
//   HL_AGENT_PRIVATE_KEY  clé privée du wallet agent dédié au bot (approuvé sur le compte) ;
//                         obligatoire en testnet et mainnet, jamais lue en shadow
//   BOT_DATA_NETWORK      réseau des bougies et du BBO : celui du mode par défaut (shadow : mainnet)
//   BOT_COIN              BTC (défaut)
//   BOT_DATA_DIR          bot/data (cache des bougies)
//   BOT_STATE_DIR         bot/state (état persistant)
//   BOT_LOG_DIR           bot/logs (journal JSONL des signaux et des trades)
//
// Stratégie :
//   BOT_SHORT_TREND_FILTER 1 : version publique du Shock Engine, une entrée short n'est autorisée
//                         qu'en régime de tendance journalier baissier (engine/short-trend.ts) ;
//                         0 (défaut) : le moteur v1, sans cette condition. À changer seulement compte
//                         à plat avec BOT_RESET_STATE=1 : les signaux à partir de là ne sont plus les
//                         mêmes que ceux de l'état sauvegardé.
//
// Exécution et risque (ne changent pas les signaux, seulement la taille et les garde-fous) :
//   BOT_EQUITY_PCT        part du capital engagée par position, en % (défaut 100, comme le backtest)
//   BOT_LEVERAGE          levier de la position (défaut 1)
//   BOT_MAX_NOTIONAL_USD  plafond de la valeur d'une position (défaut 1000)
//   BOT_MAX_SLIPPAGE_PCT  écart maximal accepté pour un ordre au marché (défaut 0.5)
//   BOT_STOP_SLIPPAGE_PCT écart maximal du stop une fois déclenché (défaut 5)
//   BOT_EMERGENCY_STOP_PCT stop de sécurité entre l'entrée et la pose du stop du script, en % du
//                         prix (défaut : désactivé, comme le script)
//   BOT_KILL_FILE         si ce fichier existe : plus aucune nouvelle entrée (défaut bot/state/KILL)
//   BOT_MAX_SPREAD_BPS    spread maximal pour une entrée, en points de base (défaut 10) ; au-delà,
//                         le bot attend jusqu'à 10 s puis renonce à l'entrée (jamais aux sorties)
//   BOT_TRAIL_STEP_PCT    pas minimal de déplacement du stop suiveur entre deux clôtures, en % de la
//                         distance de suivi (défaut 5) : limite le nombre d'ordres
//   BOT_TRAIL_MIN_INTERVAL_MS  intervalle minimal entre deux déplacements (défaut 2000)
//   BOT_WS_STALE_MS       aucune donnée du WebSocket depuis ce délai : reconnexion forcée
//                         (défaut 60000 sur les données mainnet, 900000 sur le testnet, plus calme)
//
// Shadow mode (broker simulé, mêmes coûts que le backtest du site par défaut) :
//   BOT_SHADOW_CAPITAL    10000
//   BOT_SHADOW_FEE_PCT    0.045 (taker Hyperliquid, palier de base)
//   BOT_SHADOW_PAPER      1 (défaut) : le moteur live tourne aussi, sur l'exchange papier (BBO réel)
//   BOT_PAPER_MAKER_FEE_PCT 0.015 (maker Hyperliquid, palier de base)

import { join, resolve } from 'node:path'

export type Mode = 'shadow' | 'testnet' | 'mainnet'

export interface BotConfig {
  mode: Mode
  /** Réseau des données (bougies, BBO). */
  dataNetwork: 'mainnet' | 'testnet'
  coin: string
  tfMin: 15
  /** Version publique : shorts seulement en régime de tendance journalier baissier. */
  shortTrendFilter: boolean
  account: `0x${string}` | null
  subAccount: `0x${string}` | null
  agentKey: `0x${string}` | null
  dataDir: string
  stateDir: string
  logDir: string
  equityPct: number
  leverage: number
  maxNotionalUsd: number
  maxSlippagePct: number
  stopSlippagePct: number
  emergencyStopPct: number | null
  killFile: string
  maxSpreadBps: number
  trailStepPct: number
  trailMinIntervalMs: number
  wsStaleMs: number
  shadowCapital: number
  shadowFeePct: number
  shadowPaper: boolean
  paperMakerFeePct: number
}

const ROOT = resolve(import.meta.dirname, '..')

function num(env: NodeJS.ProcessEnv, key: string, def: number, min: number, max: number): number {
  const raw = env[key]
  if (raw == null || raw === '') return def
  const v = Number(raw)
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${key}=${raw} : attendu un nombre entre ${min} et ${max}`)
  return v
}

function flag(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = env[key]?.trim()
  if (raw == null || raw === '' || raw === '0') return false
  if (raw === '1') return true
  throw new Error(`${key}=${raw} : 0 ou 1`)
}

function hex(env: NodeJS.ProcessEnv, key: string, len: number): `0x${string}` | null {
  const raw = env[key]?.trim()
  if (!raw) return null
  if (!new RegExp(`^0x[0-9a-fA-F]{${len}}$`).test(raw)) throw new Error(`${key} : format invalide (0x suivi de ${len} caractères hexadécimaux)`)
  return raw as `0x${string}`
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const mode = (env.BOT_MODE ?? 'shadow') as Mode
  if (!['shadow', 'testnet', 'mainnet'].includes(mode)) throw new Error(`BOT_MODE=${mode} : shadow, testnet ou mainnet`)
  if (mode === 'mainnet' && env.BOT_ALLOW_MAINNET !== '1') throw new Error('BOT_MODE=mainnet refusé : BOT_ALLOW_MAINNET=1 est obligatoire (aucune clé lue)')
  const dataNetwork = (env.BOT_DATA_NETWORK ?? (mode === 'testnet' ? 'testnet' : 'mainnet')) as BotConfig['dataNetwork']
  if (dataNetwork !== 'mainnet' && dataNetwork !== 'testnet') throw new Error(`BOT_DATA_NETWORK=${dataNetwork} : mainnet ou testnet`)
  const account = hex(env, 'HL_ACCOUNT_ADDRESS', 40)
  const subAccount = hex(env, 'HL_SUBACCOUNT_ADDRESS', 40)
  if (subAccount && !account) throw new Error('HL_SUBACCOUNT_ADDRESS demande HL_ACCOUNT_ADDRESS (le compte principal qui a approuvé l\'agent)')
  if (subAccount && account && subAccount.toLowerCase() === account.toLowerCase()) throw new Error('HL_SUBACCOUNT_ADDRESS est le compte principal : laisser vide')
  // La clé n'est lue que lorsqu'on va s'en servir.
  const agentKey = mode === 'shadow' ? null : hex(env, 'HL_AGENT_PRIVATE_KEY', 64)
  if (mode !== 'shadow' && (!account || !agentKey)) throw new Error(`mode ${mode} : HL_ACCOUNT_ADDRESS et HL_AGENT_PRIVATE_KEY sont obligatoires`)
  const stateDir = resolve(env.BOT_STATE_DIR ?? join(ROOT, 'state'))
  const emergency = env.BOT_EMERGENCY_STOP_PCT
  return {
    mode,
    dataNetwork,
    coin: env.BOT_COIN ?? 'BTC',
    tfMin: 15,
    shortTrendFilter: flag(env, 'BOT_SHORT_TREND_FILTER'),
    account,
    subAccount,
    agentKey,
    dataDir: resolve(env.BOT_DATA_DIR ?? join(ROOT, 'data')),
    stateDir,
    logDir: resolve(env.BOT_LOG_DIR ?? join(ROOT, 'logs')),
    equityPct: num(env, 'BOT_EQUITY_PCT', 100, 1, 100),
    leverage: num(env, 'BOT_LEVERAGE', 1, 1, 20),
    maxNotionalUsd: num(env, 'BOT_MAX_NOTIONAL_USD', 1000, 10, 10_000_000),
    maxSlippagePct: num(env, 'BOT_MAX_SLIPPAGE_PCT', 0.5, 0.01, 5),
    stopSlippagePct: num(env, 'BOT_STOP_SLIPPAGE_PCT', 5, 0.1, 20),
    emergencyStopPct: emergency == null || emergency === '' ? null : num(env, 'BOT_EMERGENCY_STOP_PCT', 0, 0.1, 50),
    killFile: resolve(env.BOT_KILL_FILE ?? join(stateDir, 'KILL')),
    maxSpreadBps: num(env, 'BOT_MAX_SPREAD_BPS', 10, 0.1, 500),
    trailStepPct: num(env, 'BOT_TRAIL_STEP_PCT', 5, 0, 50),
    trailMinIntervalMs: num(env, 'BOT_TRAIL_MIN_INTERVAL_MS', 2000, 0, 60000),
    wsStaleMs: num(env, 'BOT_WS_STALE_MS', dataNetwork === 'testnet' ? 900000 : 60000, 10000, 3600000),
    shadowCapital: num(env, 'BOT_SHADOW_CAPITAL', 10000, 10, 1e9),
    shadowFeePct: num(env, 'BOT_SHADOW_FEE_PCT', 0.045, 0, 1),
    shadowPaper: (env.BOT_SHADOW_PAPER ?? '1') !== '0',
    paperMakerFeePct: num(env, 'BOT_PAPER_MAKER_FEE_PCT', 0.015, -0.1, 1),
  }
}

/** Adresse dont le bot trade la position : le sous-compte s'il y en a un, sinon le compte. */
export function tradedAccount(c: Pick<BotConfig, 'account' | 'subAccount'>): `0x${string}` | null {
  return c.subAccount ?? c.account
}

/** Configuration sans secret, pour le journal. */
export function publicConfig(c: BotConfig): Record<string, unknown> {
  const { agentKey: _k, ...rest } = c
  return { ...rest, agentKey: c.agentKey ? '***' : null }
}
