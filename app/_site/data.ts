// Résultats figés du portefeuille Shock Engine BTC/ETH, publiés par
// research/shock/publish-portfolio.ts. À importer seulement depuis des composants serveur : le
// fichier pèse ~200 Ko et ne doit pas partir dans le JavaScript du navigateur.

import data from '../../lib/research/btc-eth-portfolio.json'

export const P = data
export type Portfolio = typeof data

/** Dossier public des fichiers téléchargeables. */
export const DOWNLOADS = '/research/btc-eth-portfolio'

/** Série du graphique : rogne les jours sans valeur (fenêtres glissantes incomplètes). */
export const series = (values: (number | null)[]) => values.map(v => (v === null ? NaN : v))

/** Un point tous les `step` jours, aligné sur le dernier jour (gardé). */
export const sample = (values: number[], step: number) => values.filter((_, i) => (values.length - 1 - i) % step === 0)
/** Date du premier point gardé par `sample`. */
export const sampleStart = (start: string, n: number, step: number) => new Date(Date.parse(start + 'T00:00:00Z') + ((n - 1) % step) * 864e5).toISOString().slice(0, 10)

/** Adresse de contact institutionnelle (variable d'environnement publique, lue au build). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_INSTITUTIONAL_EMAIL ?? ''

export const COLORS = { btc: 'var(--s-btc)', eth: 'var(--s-eth)', portfolio: 'var(--s-pf)' }
