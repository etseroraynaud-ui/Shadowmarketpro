"use client";

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { LogoSVGNav } from "../components/Logo";
import PaymentClientScripts from '@/scripts/PaymentClientScripts'

function PaymentContent() {

  const [crypto, setCrypto] = useState<'usdt-bep20' | 'usdt-trc20'>('usdt-bep20')

  const walletBep20 = "TBD_BSC_WALLET_ADDRESS_HERE"
  const walletTrc20 = "TPD9kF4CEDQXCfghKHPq41vEiyNrSEtLvL"

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
  }

  return (
    <>
      <div className="bgm"></div>
      <div className="rel">

        {/* NAV */}
        <nav className="pay-nav">
          <div className="nav-in">
            <Link href="/" className="nb">
              <LogoSVGNav />
              <span className="nbt">
                ShadowMarket<em>Pro</em>
                <sup style={{ fontSize: '8px', color: 'var(--g2)' }}>™</sup>
              </span>
            </Link>
            <Link href="/" className="back-link">
              Back to site
            </Link>
          </div>
        </nav>

        {/* HEADER */}
        <div className="page-header">
          <h1>Crypto Payment</h1>
          <p>Secure payment for your ShadowMarketPro™ subscription</p>
        </div>

        <div className="mx">
          <div className="gl pay-card">

            {/* Crypto selection */}
            <div className="crypto-select">
              <label>Select your payment method</label>

              <div className="crypto-opts">
                <div
                  className={`crypto-opt ${crypto === 'usdt-bep20' ? 'active' : ''}`}
                  onClick={() => setCrypto('usdt-bep20')}
                >
                  <div className="co-coin">USDT</div>
                  <div className="co-net">BEP20 (BSC)</div>
                </div>

                <div
                  className={`crypto-opt ${crypto === 'usdt-trc20' ? 'active' : ''}`}
                  onClick={() => setCrypto('usdt-trc20')}
                >
                  <div className="co-coin">USDT</div>
                  <div className="co-net">TRC20 (Tron)</div>
                </div>
              </div>
            </div>

            {/* Wallet */}
            <div className="stitle">
              Wallet Address
            </div>

            {crypto === 'usdt-bep20' ? (
              <div className="wallet-section">
                <div className="wallet-label">USDT — BEP20 (BSC)</div>
                <div className="wallet-box">
                  <span className="wallet-addr">{walletBep20}</span>
                  <button className="copy-btn" onClick={() => copy(walletBep20)}>
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="wallet-section">
                <div className="wallet-label">USDT — TRC20 (Tron)</div>
                <div className="wallet-box">
                  <span className="wallet-addr">{walletTrc20}</span>
                  <button className="copy-btn" onClick={() => copy(walletTrc20)}>
                    Copy
                  </button>
                </div>
              </div>
            )}

          </div>

          <footer className="pay-ft">
            <p>© 2026 ShadowMarketPro™ — All rights reserved.</p>
          </footer>
        </div>

      </div>

      <PaymentClientScripts />
    </>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#030818' }}></div>}>
      <PaymentContent />
    </Suspense>
  )
}
