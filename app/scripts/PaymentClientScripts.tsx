'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface PlanInfo {
  label: string
  price: string
  sub: string
  save?: string
  ltd?: boolean
}

const VALID_PROMO_CODES = ['PREDACRYPTO', 'SUNRIZE', 'ANOUSH']

const plans: Record<string, PlanInfo> = {
  monthly: { label: 'Monthly', price: '$99', sub: 'USD /month' },
  quarterly: { label: 'Quarterly', price: '$279', sub: 'USD /qtr', save: '7%' },
  yearly: { label: 'Annual', price: '$999', sub: 'USD /yr', save: '16%' },
  lifetime: { label: 'Lifetime', price: '$1,699', sub: 'USD once', ltd: true },
}

const planNumeric: Record<string, number> = {
  monthly: 99,
  quarterly: 279,
  yearly: 999,
  lifetime: 1699,
}

export default function PaymentClientScripts() {
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [selectedCrypto, setSelectedCrypto] = useState('usdt-bep20')
  const [activePromo, setActivePromo] = useState<string | null>(null)

  useEffect(() => {
    const planParam = searchParams.get('plan')
    if (planParam && plans[planParam]) {
      setSelectedPlan(planParam)
      const select = document.getElementById('planSelect') as HTMLSelectElement | null
      if (select) select.value = planParam
    }
  }, [searchParams])

  useEffect(() => {
    const planPrice = document.getElementById('planPrice')
    if (planPrice) {
      const plan = plans[selectedPlan]
      const base = planNumeric[selectedPlan] || 99

      if (activePromo) {
        const discounted = Math.round(base * 0.9 * 100) / 100
        const fmtBase = base >= 1000 ? `$${base.toLocaleString('en-US')}` : `$${base}`
        const fmtDisc = discounted >= 1000 ? `$${discounted.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `$${discounted.toFixed(2)}`
        let html = `<span style="text-decoration:line-through;opacity:.5;margin-right:8px">${fmtBase}</span>${fmtDisc}<small> ${plan.sub}</small>`
        html += `<span style="display:inline-block;margin-left:10px;background:rgba(34,197,94,.15);color:#22c55e;font-size:12px;padding:2px 8px;border-radius:6px;font-weight:600">-10% applied</span>`
        planPrice.innerHTML = html
      } else {
        let html = `${plan.price}<small> ${plan.sub}</small>`
        if (plan.save) html += `<span class="pd-save">Save ${plan.save}</span>`
        if (plan.ltd) html += `<span class="pd-ltd">Limited</span>`
        planPrice.innerHTML = html
      }
    }

    const walletBep20 = document.getElementById('wallet-usdt-bep20')
    const walletTrc20 = document.getElementById('wallet-usdt-trc20')
    if (walletBep20 && walletTrc20) {
      if (selectedCrypto === 'usdt-bep20') {
        walletBep20.style.display = 'block'
        walletTrc20.style.display = 'none'
      } else {
        walletBep20.style.display = 'none'
        walletTrc20.style.display = 'block'
      }
    }
  }, [selectedPlan, selectedCrypto, activePromo])

  const handleCryptoSelect = (crypto: string) => {
    setSelectedCrypto(crypto)
    document.querySelectorAll('.crypto-opt').forEach(el => el.classList.remove('active'))
    document.getElementById(`opt-${crypto}`)?.classList.add('active')
  }

  const copyAddr = async (elementId: string, btn: HTMLButtonElement) => {
    const el = document.getElementById(elementId)
    if (!el) return

    try {
      await navigator.clipboard.writeText(el.textContent || '')
    } catch {
      const range = document.createRange()
      range.selectNode(el)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      document.execCommand('copy')
      window.getSelection()?.removeAllRanges()
    }

    btn.textContent = 'Copied!'
    btn.classList.add('copied')
    setTimeout(() => {
      btn.textContent = 'Copy'
      btn.classList.remove('copied')
    }, 2000)
  }

  const applyPromo = () => {
    const promoMsg = document.getElementById('promoMsg')
    const promo = (document.getElementById('promoInput') as HTMLInputElement | null)?.value?.trim()

    if (!promoMsg) return
    if (!promo) {
      promoMsg.style.display = 'none'
      setActivePromo(null)
      return
    }

    const code = promo.toUpperCase()
    if (VALID_PROMO_CODES.includes(code)) {
      promoMsg.style.display = 'block'
      promoMsg.style.color = 'rgba(34,197,94,.9)'
      promoMsg.textContent = 'Promo applied: -10%'
      setActivePromo(code)
    } else {
      promoMsg.style.display = 'block'
      promoMsg.style.color = 'rgba(239,68,68,.7)'
      promoMsg.textContent = 'Promo code will be applied at checkout'
      setActivePromo(null)
    }
  }

  const submitForm = async () => {
    const email = (document.getElementById('email') as HTMLInputElement | null)?.value?.trim()
    const tvUser = (document.getElementById('tvUser') as HTMLInputElement | null)?.value?.trim()
    const promo = (document.getElementById('promoInput') as HTMLInputElement | null)?.value?.trim()
    const planSelect = document.getElementById('planSelect') as HTMLSelectElement | null
    const plan = planSelect?.value || selectedPlan

    if (!email || !tvUser) {
      alert('Please fill in Email + TradingView.')
      return
    }

    const btn = document.getElementById('submitBtn') as HTMLButtonElement | null
    const old = btn?.textContent

    try {
      if (btn) {
        btn.disabled = true
        btn.textContent = 'Creating invoice...'
      }

      const r = await fetch('/api/nowpayments/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          coupon: promo ? promo.toUpperCase() : null,
          email,
          tradingview_id: tvUser,
        }),
      })

      const data = await r.json().catch(() => ({}))

      if (!r.ok || !data?.invoice_url) {
        console.error('create-payment failed:', data)
        alert('Payment setup failed.')
        return
      }

      window.location.href = data.invoice_url
    } catch (e) {
      console.error(e)
      alert('Network error.')
    } finally {
      if (btn) {
        btn.disabled = false
        btn.textContent = old || 'Proceed to payment'
      }
    }
  }

  useEffect(() => {
    ;(window as any).selectCrypto = handleCryptoSelect
    ;(window as any).copyAddr = copyAddr
    ;(window as any).applyPromo = applyPromo
    ;(window as any).submitForm = submitForm
    ;(window as any).updatePlan = () => {
      const select = document.getElementById('planSelect') as HTMLSelectElement | null
      if (select) setSelectedPlan(select.value)
    }
  }, [selectedPlan, selectedCrypto])

  return null
}
