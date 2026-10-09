// Comptes Hyperliquid suivis par la page Performance live. Une adresse Hyperliquid est publique :
// la mettre ici ne donne aucun accès au compte, seulement la lecture de ce qui est déjà on-chain.
//
// À remplir quand le sous-compte du bot existe, par exemple :
//   { address: '0x…', coin: 'BTC', network: 'testnet', label: 'Shock Engine · BTC · testnet', since: '2026-10-12' }
// Sans compte ici, la page affiche un formulaire (et accepte ?address=0x…&coin=BTC&net=testnet ;
// &version=v1 pour un bot qui tourne sans la condition de la version publique).

import type { Network } from './hl'

export interface LiveAccount {
  address: string
  coin: string
  network: Network
  label: string
  /** Début du track record (AAAA-MM-JJ). Absent : premier ordre du bot sur ce compte. */
  since?: string
  /**
   * Version du bot suivie, pour le backtest de comparaison : `public` (défaut) n'autorise les shorts
   * qu'en régime de tendance journalier baissier (bot lancé avec BOT_SHORT_TREND_FILTER=1) ; `v1`
   * sans cette condition.
   */
  version?: 'public' | 'v1'
}

export const LIVE_ACCOUNTS: LiveAccount[] = []
