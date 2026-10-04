import type { Metadata } from 'next'
import ResearchApp from './ResearchApp'
import '../backtest.css'

export const metadata: Metadata = {
  title: 'Shock Engine · recherche — ShadowMarketPro™',
  description: 'Diagnostic, walk-forward optimization and regime-based parameter research for the Shock Engine strategy on BTC/USD.',
}

export default function ResearchPage() {
  return <ResearchApp />
}
