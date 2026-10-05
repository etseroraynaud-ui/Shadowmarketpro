import type { Metadata } from 'next'
import LiveApp from './LiveApp'
import '../backtest/backtest.css'
import './live.css'

export const metadata: Metadata = {
  title: 'Shock Engine · live — ShadowMarketPro™',
  description: 'Live track record of the Shock Engine bot on Hyperliquid, read from public on-chain data and compared trade by trade with the backtest.',
}

export default function LivePage() {
  return <LiveApp />
}
