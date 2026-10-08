import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShadowMarketPro™ — Shock Engine research and quantitative indicators',
  description: 'Systematic crypto research on the Shock Engine strategy, published as historical simulations with their tests and limits, and adaptive quantitative indicators for TradingView.',
  keywords: 'Shock Engine, systematic trading research, crypto strategy research, quantitative trading indicators, TradingView indicators',
  authors: [{ name: 'ShadowMarketPro' }],
  openGraph: {
    title: 'ShadowMarketPro™ — Shock Engine research and quantitative indicators',
    description: 'Systematic crypto research on the Shock Engine strategy (historical simulation, not live performance) and adaptive TradingView indicators.',
    type: 'website',
    images: ['/favicon.png'],
  },
  twitter: {
    card: 'summary',
    title: 'ShadowMarketPro™ — Shock Engine research and quantitative indicators',
    description: 'Systematic crypto research on the Shock Engine strategy and adaptive TradingView indicators.',
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
