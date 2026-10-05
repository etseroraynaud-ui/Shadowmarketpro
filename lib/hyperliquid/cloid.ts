// Identifiants client (cloid) des ordres du bot Shock Engine : préfixe fixe, nature de l'ordre,
// partie aléatoire. Ils sont publics sur Hyperliquid : la page Performance live s'en sert pour
// reconnaître les ordres du bot et le motif de chaque sortie (stop, TP1, clôture).

export const CLOID_PREFIX = '0x5b0c'
export type OrderKind = 'entry' | 'close' | 'stop' | 'tp1' | 'emergency'
const KIND_CODE: Record<OrderKind, string> = { entry: '01', close: '02', stop: '03', tp1: '04', emergency: '05' }

export function newCloid(kind: OrderKind): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(13)), b => b.toString(16).padStart(2, '0')).join('')
  return `${CLOID_PREFIX}${KIND_CODE[kind]}${rand}`
}

export function cloidKind(cloid: string | null | undefined): OrderKind | null {
  if (!cloid || !cloid.startsWith(CLOID_PREFIX)) return null
  const code = cloid.slice(CLOID_PREFIX.length, CLOID_PREFIX.length + 2)
  return (Object.keys(KIND_CODE) as OrderKind[]).find(k => KIND_CODE[k] === code) ?? null
}
