// Règles de cotation Hyperliquid, partagées par le bot et le site.

/**
 * Pas de cotation effectif : 5 chiffres significatifs au plus, 6 - szDecimals décimales au plus,
 * prix entiers toujours permis.
 */
export function tickOf(price: number, szDecimals: number): number {
  const digits = Math.floor(Math.log10(price)) + 1
  if (digits >= 5) return 1
  return Math.max(10 ** (digits - 5), 10 ** -(6 - szDecimals))
}

/**
 * Marché HIP-3 (perp déployé par un tiers, ex. actions) : « dex:SYMBOLE » (xyz:NVDA). Les
 * positions, ordres et prix de ces marchés se demandent avec le nom du dex ; le marché principal
 * (BTC, ETH…) a un nom de dex vide.
 */
export function dexOf(coin: string): string {
  const k = coin.indexOf(':')
  return k > 0 ? coin.slice(0, k) : ''
}
