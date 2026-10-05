// Configuration du bot, lue uniquement dans les variables d'environnement. Aucune clé dans le code.
//
//   BOT_MODE              shadow (défaut) | testnet | mainnet
//   HL_ACCOUNT_ADDRESS    adresse du compte Hyperliquid (le compte principal, pas l'agent)
//   HL_AGENT_PRIVATE_KEY  clé privée du wallet agent dédié au bot (approuvé sur le compte) ;
//                         obligatoire en testnet et mainnet, jamais lue en shadow
//   BOT_COIN              BTC (défaut)
//   BOT_DATA_DIR          bot/data (cache des bougies)
//   BOT_STATE_DIR         bot/state (état persistant)
//   BOT_LOG_DIR           bot/logs (journal JSONL des signaux et des trades)
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
//
// Shadow mode (broker simulé, mêmes coûts que le backtest du site par défaut) :
//   BOT_SHADOW_CAPITAL    10000
//   BOT_SHADOW_FEE_PCT    0.045 (taker Hyperliquid, palier de base)

import { join, resolve } from 'node:path'

export type Mode = 'shadow' | 'testnet' | 'mainnet'

export interface BotConfig {
  mode: Mode
  coin: string
  tfMin: 15
  account: `0x${string}` | null
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
  shadowCapital: number
  shadowFeePct: number
}

const ROOT = resolve(import.meta.dirname, '..')

function num(env: NodeJS.ProcessEnv, key: string, def: number, min: number, max: number): number {
  const raw = env[key]
  if (raw == null || raw === '') return def
  const v = Number(raw)
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${key}=${raw} : attendu un nombre entre ${min} et ${max}`)
  return v
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
  const account = hex(env, 'HL_ACCOUNT_ADDRESS', 40)
  // La clé n'est lue que lorsqu'on va s'en servir.
  const agentKey = mode === 'shadow' ? null : hex(env, 'HL_AGENT_PRIVATE_KEY', 64)
  if (mode !== 'shadow' && (!account || !agentKey)) throw new Error(`mode ${mode} : HL_ACCOUNT_ADDRESS et HL_AGENT_PRIVATE_KEY sont obligatoires`)
  const stateDir = resolve(env.BOT_STATE_DIR ?? join(ROOT, 'state'))
  const emergency = env.BOT_EMERGENCY_STOP_PCT
  return {
    mode,
    coin: env.BOT_COIN ?? 'BTC',
    tfMin: 15,
    account,
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
    shadowCapital: num(env, 'BOT_SHADOW_CAPITAL', 10000, 10, 1e9),
    shadowFeePct: num(env, 'BOT_SHADOW_FEE_PCT', 0.045, 0, 1),
  }
}

/** Configuration sans secret, pour le journal. */
export function publicConfig(c: BotConfig): Record<string, unknown> {
  const { agentKey: _k, ...rest } = c
  return { ...rest, agentKey: c.agentKey ? '***' : null }
}
