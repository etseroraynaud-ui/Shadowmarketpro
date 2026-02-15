"use client";

import Link from 'next/link'
import { Suspense } from 'react'
import { LogoSVGNav } from '@/components/Logo'
import PaymentClientScripts from '@/scripts/PaymentClientScripts'


function PaymentContent() {
  return (
    <>
      <div className="bgm"></div>
      <div className="rel">

        {/* NAV */}
        <nav className="pay-nav">
          <div className="nav-in">
            <Link href="/" className="nb">
              <LogoSVGNav />
              <span className="nbt">ShadowMarket<em>Pro</em><sup style={{ fontSize: '8px', color: 'var(--g2)' }}>™</sup></span>
            </Link>
            <Link href="/" className="back-link">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to site
            </Link>
          </div>
        </nav>

        {/* HEADER */}
        <div className="page-header">
          <h1>Crypto Payment</h1>
          <p>Secure payment for your ShadowMarketPro™ subscription</p>
        </div>

        {/* MAIN PAYMENT CARD */}
        <div className="mx">
          <div className="gl pay-card" id="payCard">

            {/* Accepted Crypto */}
            <div className="stitle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Accepted Cryptocurrencies
            </div>
            <div className="crypto-list">
              <div className="cbadge"><span className="coin">USDT</span><span className="net">BEP20 — BSC</span></div>
              <div className="cbadge"><span className="coin">USDT</span><span className="net">TRC20 — Tron</span></div>
            </div>

            {/* Crypto selection */}
            <div className="crypto-select">
              <label>Select your payment method</label>
              <div className="crypto-opts">
                <div className="crypto-opt active" onClick={() => {
                  if (typeof window !== 'undefined' && (window as typeof window & { selectCrypto?: (c: string) => void }).selectCrypto) {
                    (window as typeof window & { selectCrypto: (c: string) => void }).selectCrypto('usdt-bep20')
                  }
                }} id="opt-usdt-bep20">
                  <div className="co-coin">USDT</div>
                  <div className="co-net">BEP20 (BSC)</div>
                </div>
                 <div className="crypto-opt" onClick={() => {
                  if (typeof window !== 'undefined' && (window as typeof window & { selectCrypto?: (c: string) => void }).selectCrypto) {
                  (window as typeof window & { selectCrypto: (c: string) => void }).selectCrypto('usdt-trc20')
                  }
                  }} id="opt-usdt-trc20">
                  <div className="co-coin">USDT</div>
                  <div className="co-net">TRC20 (Tron)</div>
                </div>
              </div>
            </div>

            {/* Wallets */}
            <div className="stitle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="14" rx="3"/>
                <path d="M2 10h20"/>
                <circle cx="17" cy="15" r="1.5"/>
              </svg>
              Wallet Address
            </div>

            <div className="wallet-section" id="wallet-usdt-bep20">
              <div className="wallet-label">USDT — BEP20 (BSC)</div>
              <div className="wallet-box">
                <span className="wallet-addr" id="walletAddrBep20">TBD_BSC_WALLET_ADDRESS_HERE</span>
                <button className="copy-btn" onClick={(e) => {
                  if (typeof window !== 'undefined' && (window as typeof window & { copyAddr?: (id: string, btn: HTMLButtonElement) => void }).copyAddr) {
                    (window as typeof window & { copyAddr: (id: string, btn: HTMLButtonElement) => void }).copyAddr('walletAddrBep20', e.currentTarget)
                  }
                }}>Copy</button>
              </div>
            </div>

            <div className="wallet-section" id="wallet-usdt-trc20" style={{ display: 'none' }}>
              <div className="wallet-label">USDT — TRC20 (Tron)</div>
              <div className="wallet-box">
                <span className="wallet-addr" id="walletAddrTrc20">TPD9kF4CEDQXCfghKHPq41vEiyNrSEtLvL</span>
                <button className="copy-btn" onClick={(e) => {
                  if (typeof window !== 'undefined' && (window as typeof window & { copyAddr?: (id: string, btn: HTMLButtonElement) => void }).copyAddr) {
                    (window as typeof window & { copyAddr: (id: string, btn: HTMLButtonElement) => void }).copyAddr('walletAddrTrc20', e.currentTarget)
                  }
                }}>Copy</button>
              </div>
            </div>

            <div className="warn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p><strong>Important:</strong> Only send the selected cryptocurrency on the correct network. USDT on BEP20 (BSC) or USDT on TRC20 (Tron). Sending funds on the wrong network will result in <strong>irreversible loss of funds</strong>.</p>
            </div>

            {/* Plan selector */}
            <div className="stitle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3h18v18H3z" rx="3"/>
                <path d="M3 9h18M9 3v18"/>
              </svg>
              Payment Details
            </div>

            <div className="fg">
              <label>Subscription Plan</label>
              <select id="planSelect" onChange={() => {
                if (typeof window !== 'undefined' && (window as typeof window & { updatePlan?: () => void }).updatePlan) {
                  (window as typeof window & { updatePlan: () => void }).updatePlan()
                }
              }}>
                <option value="monthly">Monthly — $99 USD</option>
                <option value="quarterly">Quarterly — $259 USD</option>
                <option value="yearly">Annual — $899 USD</option>
                <option value="lifetime">Lifetime — $1,599 USD (Limited: 50 spots)</option>
              </select>
            </div>

            <div className="plan-display" id="planDisplay">
              <span className="pd-left">Amount to send:</span>
              <span className="pd-right" id="planPrice">$99<small> USD /month</small></span>
            </div>

            {/* Promo Code */}
            <div className="fg">
              <label>Promo Code <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            </div>
            <div className="promo-row">
              <input type="text" id="promoInput" placeholder="Enter code" style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(3,8,24,.6)', border: '1px solid rgba(6,182,212,.1)', color: 'var(--w)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', outline: 'none' }} />
              <button className="promo-btn" onClick={() => {
                if (typeof window !== 'undefined' && (window as typeof window & { applyPromo?: () => void }).applyPromo) {
                  (window as typeof window & { applyPromo: () => void }).applyPromo()
                }
              }}>Apply</button>
            </div>
            <div id="promoMsg" style={{ fontSize: '12px', marginBottom: '20px', display: 'none' }}></div>

            <div className="gline" style={{ marginBottom: '28px' }}></div>

            {/* Form */}
            <div className="fg">
              <label>Email Address</label>
              <input type="email" id="email" placeholder="your@email.com" required />
            </div>
            <div className="fg">
              <label>TradingView Username / ID</label>
              <input type="text" id="tvUser" placeholder="Your TradingView username" required />
              <div className="helper">This is the account that will receive indicator access.</div>
            </div>
            <div className="fg">
              <label>Transaction ID / Hash</label>
              <input type="text" id="txHash" placeholder="(optional) Paste your transaction hash here" />
              <div className="helper">Copy this from your wallet after completing the transfer.</div>
            </div>

            <button className="bp" id="submitBtn" onClick={() => {
              if (typeof window !== 'undefined' && (window as typeof window & { submitForm?: () => void }).submitForm) {
                (window as typeof window & { submitForm: () => void }).submitForm()
              }
            }}>I have completed the payment</button>
            <p className="form-note">Your access will be activated manually after payment verification.</p>
          </div>

          {/* SUCCESS */}
          <div className="gl success-card" id="successCard">
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>Payment submitted</h2>
            <p>Thank you! Your payment details have been received. We will verify the transaction and activate your access shortly.</p>
            <div className="summary-box" id="summaryBox"></div>
            <Link href="/" className="bp" style={{ display: 'inline-flex', width: 'auto', padding: '14px 32px', textDecoration: 'none' }}>Return to homepage</Link>
          </div>

          {/* HOW IT WORKS */}
          <div style={{ marginTop: '20px' }}></div>
          <div className="stitle" style={{ marginBottom: '16px', padding: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '20px', height: '20px', color: 'var(--c1)' }}>
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 8v4l2 2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--w)' }}>How it works</span>
          </div>
          <div className="how-grid">
            <div className="how-step">
              <div className="how-num">1</div>
              <div className="how-text">
                <h4>Choose your plan</h4>
                <p>Select your subscription duration from the dropdown above.</p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">2</div>
              <div className="how-text">
                <h4>Send the exact amount</h4>
                <p>Transfer the exact USD amount in USDT (BEP20) or USDT (TRC20) to the wallet address shown above.</p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">3</div>
              <div className="how-text">
                <h4>Fill in the form</h4>
                <p>Enter your email, TradingView username, and the transaction hash from your wallet.</p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">4</div>
              <div className="how-text">
                <h4>Access granted</h4>
                <p>After manual verification, your indicators are activated — usually within 24 hours.</p>
              </div>
            </div>
          </div>

          {/* DISCLAIMER */}
          <div className="disc-box">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Security &amp; Disclaimer
            </h4>
            <ul className="disc-list">
              <li>All payments are non-refundable once processed.</li>
              <li>Indicator access is linked to your TradingView account and is non-transferable.</li>
              <li>Only USDT (BEP20) and USDT (TRC20) are accepted. No other coins or networks.</li>
              <li>Sending funds on an incorrect network will result in permanent loss — we cannot recover these funds.</li>
              <li>ShadowMarketPro™ indicators are analytical tools, not financial advice.</li>
            </ul>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="pay-ft">
          <p>© 2026 ShadowMarketPro™ — All rights reserved.</p>
        </footer>

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
