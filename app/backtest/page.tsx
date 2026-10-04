import type { Metadata } from 'next'
import BacktestApp from './BacktestApp'
import './backtest.css'

export const metadata: Metadata = {
  title: 'Backtest Lab — ShadowMarketPro™',
  description: 'Backtest any trading strategy in your browser: import a script, a Pine Script strategy or CSV signals, with real costs, stops, robustness checks and optimization.',
}

export default function BacktestPage() {
  return <BacktestApp />
}
