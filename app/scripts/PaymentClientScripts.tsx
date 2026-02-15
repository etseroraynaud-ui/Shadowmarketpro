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

const plans: Record<string, PlanInfo> = {
  monthly: { label: 'Monthly', price: '$99', sub: 'USD /month' },
  quarterly: { label: 'Quarterly', price: '$259', sub: 'USD /qtr', save: '13%' },
  yearly: { label: 'Annual', price: '$899', sub: 'USD /yr', save: '24%' },
  lifetime: { label: 'Lifetime', price: '$1,599', sub: 'USD once', ltd: true },
}

export default function PaymentClientScripts() {
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [selectedCrypto, setSelectedCrypto] = useState('usdt-bep20')

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
      let html = `${plan.price}<small> ${plan.sub}</small>`
      if (plan.save) html += `<span class="pd-save">Save ${plan.save}</span>`
      if (plan.ltd) html += `<span class="pd-ltd">Limited</span>`
      planPrice.innerHTML = html
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
  }, [selectedPlan, selectedCrypto])

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
    // (optionnel) tu peux faire une validation serveur plus tard
    const promoMsg = document.getElementById('promoMsg')
    const promo = (document.getElementById('promoInput') as HTMLInputElement | null)?.value?.trim()

    if (!promoMsg) return
    if (!promo) {
      promoMsg.style.display = 'none'
      return
    }

    promoMsg.style.display = 'block'
    promoMsg.style.color = 'rgba(239,68,68,.7)'
    promoMsg.textContent = 'Promo code will be applied at checkout'
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
