// Comptes Hyperliquid suivis par la page Performance live. Une adresse Hyperliquid est publique :
// la mettre ici ne donne aucun accès au compte, seulement la lecture de ce qui est déjà on-chain.
//
// À remplir quand le sous-compte du bot existe, par exemple :
//   { address: '0x…', coin: 'BTC', network: 'mainnet', label: 'Shock Engine · BTC', since: '2026-11-01' }
// Sans compte ici, la page affiche un formulaire (et accepte ?address=0x…&coin=BTC&net=testnet).

import type { Network } from './hl'

export interface LiveAccount {
  address: string
  coin: string
  network: Network
  label: string
  /** Début du track record (AAAA-MM-JJ). Absent : premier ordre du bot sur ce compte. */
  since?: string
}

export const LIVE_ACCOUNTS: LiveAccount[] = []
