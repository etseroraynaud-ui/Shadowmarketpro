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
  lifetime: { label: 'Lifetime', price: '$1,599', sub: 'USD once', ltd: true }
}

export default function PaymentClientScripts() {
  const searchParams = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState('monthly')
  const [selectedCrypto, setSelectedCrypto] = useState('usdt-bep20')
  const [showSuccess, setShowSuccess] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    tvUser: '',
    txHash: '',
    promo: ''
  })

  useEffect(() => {
    const planParam = searchParams.get('plan')
    if (planParam && plans[planParam]) {
      setSelectedPlan(planParam)
      const select = document.getElementById('planSelect') as HTMLSelectElement
      if (select) select.value = planParam
    }
  }, [searchParams])

  useEffect(() => {
    updatePlanDisplay()
    updateWalletVisibility()
  }, [selectedPlan, selectedCrypto])

  const updatePlanDisplay = () => {
    const planDisplay = document.getElementById('planDisplay')
    const planPrice = document.getElementById('planPrice')
    if (!planDisplay || !planPrice) return

    const plan = plans[selectedPlan]
    let html = `${plan.price}<small> ${plan.sub}</small>`
    if (plan.save) {
      html += `<span class="pd-save">Save ${plan.save}</span>`
    }
    if (plan.ltd) {
      html += `<span class="pd-ltd">Limited</span>`
    }
    planPrice.innerHTML = html
  }

  const updateWalletVisibility = () => {
    const walletBep20 = document.getElementById('wallet-usdt-bep20')
    const walletTrc20 = document.getElementById('wallet-usdt-trc20')
    if (!walletBep20 || !walletTrc20) return

    if (selectedCrypto === 'usdt-bep20') {
      walletBep20.style.display = 'block'
      walletTrc20.style.display = 'none'
    } else {
      walletBep20.style.display = 'none'
      walletTrc20.style.display = 'block'
    }
  }

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlan(e.target.value)
  }

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
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = 'Copy'
        btn.classList.remove('copied')
      }, 2000)
    } catch {
      // Fallback for older browsers
      const range = document.createRange()
      range.selectNode(el)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      document.execCommand('copy')
      window.getSelection()?.removeAllRanges()
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.textContent = 'Copy'
        btn.classList.remove('copied')
      }, 2000)
    }
  }

  const applyPromo = () => {
    const promoMsg = document.getElementById('promoMsg')
    if (!promoMsg) return

    if (formData.promo.trim() === '') {
      promoMsg.style.display = 'none'
      return
    }

    // Placeholder promo logic
    promoMsg.style.display = 'block'
    promoMsg.style.color = 'rgba(239,68,68,.7)'
    promoMsg.textContent = 'Invalid promo code'
  }

  const submitForm = () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value
    const tvUser = (document.getElementById('tvUser') as HTMLInputElement)?.value
    const txHash = (document.getElementById('txHash') as HTMLInputElement)?.value

    if (!email || !tvUser || !txHash) {
      alert('Please fill in all required fields.')
      return
    }

    // Show success card
    const payCard = document.getElementById('payCard')
    const successCard = document.getElementById('successCard')
    const summaryBox = document.getElementById('summaryBox')

    if (payCard) payCard.style.display = 'none'
    if (successCard) {
      successCard.style.display = 'block'
      successCard.classList.add('show')
    }

    if (summaryBox) {
      const plan = plans[selectedPlan]
      summaryBox.innerHTML = `
        <div class="summary-row"><span class="sr-label">Plan</span><span class="sr-value">${plan.label}</span></div>
        <div class="summary-row"><span class="sr-label">Amount</span><span class="sr-value">${plan.price}</span></div>
        <div class="summary-row"><span class="sr-label">Payment</span><span class="sr-value">${selectedCrypto === 'usdt-bep20' ? 'USDT (BEP20)' : 'USDC (TRC20)'}</span></div>
        <div class="summary-row"><span class="sr-label">Email</span><span class="sr-value">${email}</span></div>
        <div class="summary-row"><span class="sr-label">TradingView</span><span class="sr-value">${tvUser}</span></div>
        <div class="summary-row"><span class="sr-label">TX Hash</span><span class="sr-value" style="font-size:11px;word-break:break-all">${txHash}</span></div>
      `
    }

    setShowSuccess(true)
  }

  // Expose functions to window for inline handlers
  useEffect(() => {
    (window as typeof window & {
      selectCrypto: typeof handleCryptoSelect
      copyAddr: typeof copyAddr
      applyPromo: typeof applyPromo
      submitForm: typeof submitForm
      updatePlan: () => void
    }).selectCrypto = handleCryptoSelect;
    (window as typeof window & { copyAddr: typeof copyAddr }).copyAddr = copyAddr;
    (window as typeof window & { applyPromo: typeof applyPromo }).applyPromo = applyPromo;
    (window as typeof window & { submitForm: typeof submitForm }).submitForm = submitForm;
    (window as typeof window & { updatePlan: () => void }).updatePlan = () => {
      const select = document.getElementById('planSelect') as HTMLSelectElement
      if (select) setSelectedPlan(select.value)
    }
  }, [selectedPlan, selectedCrypto, formData])

  return null
}
