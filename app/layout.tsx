import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShadowMarketPro™ — Quantitative Trading Indicators',
  description: 'ShadowMarketPro™ delivers adaptive quantitative trading indicators for crypto, forex, indices and stocks. All timeframes. All market conditions.',
  keywords: 'quantitative trading indicators, crypto indicators, forex indicators, adaptive trading, TradingView indicators',
  authors: [{ name: 'ShadowMarketPro' }],
  openGraph: {
    title: 'ShadowMarketPro™ — Quantitative Trading Indicators',
    description: 'Adaptive quantitative trading indicators for crypto, forex, indices and stocks. All timeframes. All market conditions.',
    type: 'website',
    images: ['/favicon.png'],
  },
  twitter: {
    card: 'summary',
    title: 'ShadowMarketPro™ — Quantitative Trading Indicators',
    description: 'Adaptive quantitative trading indicators for crypto, forex, indices and stocks.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
