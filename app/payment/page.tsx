"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogoSVGNav } from "../components/Logo";
import CheckoutButton from "../components/CheckoutButton";

/* ─── Types ─── */
type PaymentStatus = "pending" | "confirmed" | "failed" | null;

interface OrderStatus {
  payment_status: PaymentStatus;
  status: string;
  amount_paid: number;
  pay_currency: string;
  plan: string;
  email: string;
}

/* ─── Plan data ─── */
const PLANS: Record<string, { label: string; price: string; sub: string; save?: string; ltd?: boolean }> = {
  monthly:   { label: "Monthly",   price: "$99",    sub: "USD /month" },
  quarterly: { label: "Quarterly", price: "$279",   sub: "USD /qtr", save: "7%" },
  yearly:    { label: "Annual",    price: "$999",   sub: "USD /yr",  save: "16%" },
  lifetime:  { label: "Lifetime",  price: "$1,699", sub: "USD once", ltd: true },
};

const PLAN_PRICES: Record<string, number> = {
  monthly: 99, quarterly: 279, yearly: 999, lifetime: 1699,
};

const VALID_PROMO_CODES = ["PREDACRYPTO", "SUNRIZE", "ANOUSH"];

/* ────────────────────────────────────────────
   Post-payment component (success / canceled)
   ──────────────────────────────────────────── */
function PostPayment({ success, orderId }: { success: boolean; orderId: string }) {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [polling, setPolling] = useState(success);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attempts = useRef(0);
  const MAX_ATTEMPTS = 200; // ~10 min at 3s intervals

  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/status?order_id=${encodeURIComponent(orderId)}`);
      if (!res.ok) return;
      const data: OrderStatus = await res.json();
      setOrderStatus(data);

      if (data.payment_status === "confirmed" || data.payment_status === "failed") {
        setPolling(false);
      }
    } catch (err) {
      console.error("[PostPayment] polling error:", err);
    }
  }, [orderId]);

  useEffect(() => {
    if (!success || !orderId) return;

    // Initial fetch
    fetchStatus();

    intervalRef.current = setInterval(() => {
      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        setPolling(false);
        return;
      }
      fetchStatus();
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [success, orderId, fetchStatus]);

  // Stop interval when polling ends
  useEffect(() => {
    if (!polling && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [polling]);

  const ps = orderStatus?.payment_status;

  /* ── Canceled ── */
  if (!success) {
    return (
      <div className="gl pay-card" style={{ textAlign: "center", padding: "48px 32px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h2 style={{ color: "#ef4444", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
          Paiement annulé
        </h2>
        <p style={{ color: "rgba(255,255,255,.6)", marginBottom: 24 }}>
          Vous avez annulé le processus de paiement. Aucun montant n'a été débité.
        </p>
        {orderId && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginBottom: 16 }}>
            Réf: {orderId}
          </p>
        )}
        <Link href="/payment" className="bp" style={{ display: "inline-flex", width: "auto", padding: "14px 32px", textDecoration: "none" }}>
          Réessayer
        </Link>
      </div>
    );
  }

  /* ── Success → Polling / Confirmed / Failed ── */
  return (
    <div className="gl pay-card" style={{ textAlign: "center", padding: "48px 32px" }}>
      {/* Confirmed */}
      {ps === "confirmed" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: "#22c55e", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
            Paiement confirmé
          </h2>
          <p style={{ color: "rgba(255,255,255,.7)", marginBottom: 8 }}>
            Votre paiement de <strong>{orderStatus?.amount_paid} {orderStatus?.pay_currency?.toUpperCase()}</strong> a été reçu.
          </p>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 24 }}>
            Plan : {orderStatus?.plan} — {orderStatus?.email}
          </p>
          <p style={{ color: "rgba(255,255,255,.4)", fontSize: 13, marginBottom: 24 }}>
            Votre accès aux indicateurs sera activé sous 24h.
          </p>
          <Link href="/" className="bp" style={{ display: "inline-flex", width: "auto", padding: "14px 32px", textDecoration: "none" }}>
            Retour à l'accueil
          </Link>
        </>
      )}

      {/* Failed */}
      {ps === "failed" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ color: "#ef4444", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
            Paiement échoué
          </h2>
          <p style={{ color: "rgba(255,255,255,.6)", marginBottom: 24 }}>
            Le réseau crypto a signalé un échec. Si vous avez effectué un transfert, contactez le support.
          </p>
          <Link href="/payment" className="bp" style={{ display: "inline-flex", width: "auto", padding: "14px 32px", textDecoration: "none" }}>
            Réessayer
          </Link>
        </>
      )}

      {/* Still pending / polling */}
      {ps !== "confirmed" && ps !== "failed" && (
        <>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid rgba(6,182,212,.2)",
              borderTopColor: "var(--c1, #06b6d4)",
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
              margin: "0 auto 20px",
            }}
          />
          <h2 style={{ color: "var(--w, #fff)", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
            Paiement en cours de confirmation…
          </h2>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 8 }}>
            Nous vérifions votre transaction sur la blockchain. Cela peut prendre quelques minutes.
          </p>
          {orderId && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginBottom: 16 }}>
              Réf: {orderId}
            </p>
          )}
          {!polling && (
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 13 }}>
              Le polling a expiré. Revenez plus tard ou contactez le support.
            </p>
          )}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─────────────────────────
   Checkout form (pre-pay)
   ───────────────────────── */
function CheckoutForm() {
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState(searchParams.get("plan") || "monthly");
  const [email, setEmail] = useState("");
  const [tvUser, setTvUser] = useState("");
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const basePrice = PLAN_PRICES[plan] ?? 99;
  const discount = promoApplied ? 0.10 : 0;
  const finalPrice = Math.round(basePrice * (1 - discount) * 100) / 100;
  const planInfo = PLANS[plan];

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    if (!code) {
      setPromoApplied(false);
      setPromoMsg(null);
      return;
    }
    if (VALID_PROMO_CODES.includes(code)) {
      setPromoApplied(true);
      setPromoMsg({ text: "Promo applied: -10%", ok: true });
    } else {
      setPromoApplied(false);
      setPromoMsg({ text: "Code will be verified at checkout", ok: false });
    }
  };

  return (
    <div className="gl pay-card" id="payCard">
      {/* Plan selector */}
      <div className="stitle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h18v18H3z" rx="3" />
          <path d="M3 9h18M9 3v18" />
        </svg>
        Payment Details
      </div>

      <div className="fg">
        <label>Subscription Plan</label>
        <select
          id="planSelect"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
        >
          <option value="monthly">Monthly — $99 USD</option>
          <option value="quarterly">Quarterly — $279 USD</option>
          <option value="yearly">Annual — $999 USD</option>
          <option value="lifetime">Lifetime — $1,699 USD (Limited: 50 spots)</option>
        </select>
      </div>

      <div className="plan-display" id="planDisplay">
        <span className="pd-left">Amount to pay:</span>
        <span className="pd-right">
          {promoApplied && (
            <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 8 }}>
              {planInfo?.price}
            </span>
          )}
          ${finalPrice.toLocaleString("en-US", { minimumFractionDigits: finalPrice % 1 ? 2 : 0 })}
          <small> {planInfo?.sub}</small>
          {promoApplied && (
            <span style={{ display: "inline-block", marginLeft: 10, background: "rgba(34,197,94,.15)", color: "#22c55e", fontSize: 12, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
              -10%
            </span>
          )}
          {!promoApplied && planInfo?.save && <span className="pd-save">Save {planInfo.save}</span>}
          {!promoApplied && planInfo?.ltd && <span className="pd-ltd">Limited</span>}
        </span>
      </div>

      {/* Promo */}
      <div className="fg">
        <label>
          Promo Code <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </label>
      </div>
      <div className="promo-row">
        <input
          type="text"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          placeholder="Enter code"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(3,8,24,.6)",
            border: "1px solid rgba(6,182,212,.1)",
            color: "var(--w)",
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button className="promo-btn" onClick={applyPromo} type="button">
          Apply
        </button>
      </div>
      {promoMsg && (
        <div style={{ fontSize: 12, marginBottom: 20, color: promoMsg.ok ? "rgba(34,197,94,.9)" : "rgba(239,68,68,.7)" }}>
          {promoMsg.text}
        </div>
      )}

      <div className="gline" style={{ marginBottom: 28 }} />

      {/* Form */}
      <div className="fg">
        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
        />
      </div>
      <div className="fg">
        <label>TradingView Username / ID</label>
        <input
          type="text"
          value={tvUser}
          onChange={(e) => setTvUser(e.target.value)}
          placeholder="Your TradingView username"
          required
        />
        <div className="helper">This is the account that will receive indicator access.</div>
      </div>

      {/* Checkout button */}
      <CheckoutButton
        plan={plan as "monthly" | "quarterly" | "yearly" | "lifetime"}
        email={email}
        tradingview_id={tvUser}
        coupon={promo || null}
        label="Payer avec Crypto"
        className="bp"
      />
      <p className="form-note">
        Vous serez redirigé vers le checkout sécurisé NOWPayments pour compléter votre paiement en USDT.
      </p>

      {/* How it works */}
      <div style={{ marginTop: 32 }}>
        <div className="stitle" style={{ marginBottom: 16, padding: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20, color: "var(--c1)" }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l2 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, color: "var(--w)" }}>
            How it works
          </span>
        </div>
        <div className="how-grid">
          <div className="how-step">
            <div className="how-num">1</div>
            <div className="how-text">
              <h4>Choose your plan</h4>
              <p>Select your subscription and fill in your details above.</p>
            </div>
          </div>
          <div className="how-step">
            <div className="how-num">2</div>
            <div className="how-text">
              <h4>Secure checkout</h4>
              <p>You'll be redirected to NOWPayments where you scan a QR code and send USDT TRC20.</p>
            </div>
          </div>
          <div className="how-step">
            <div className="how-num">3</div>
            <div className="how-text">
              <h4>Automatic confirmation</h4>
              <p>Once confirmed on-chain, you'll be redirected back here with live status updates.</p>
            </div>
          </div>
          <div className="how-step">
            <div className="how-num">4</div>
            <div className="how-text">
              <h4>Access granted</h4>
              <p>Your indicators are activated on TradingView — usually within 24 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────
   Main page
   ───────────── */
function PaymentContent() {
  const searchParams = useSearchParams();

  const isSuccess = searchParams.get("success") === "1";
  const isCanceled = searchParams.get("canceled") === "1";
  const orderId = searchParams.get("order_id") || "";

  const isPostPayment = isSuccess || isCanceled;

  return (
    <>
      <div className="bgm" />
      <div className="rel">
        {/* NAV */}
        <nav className="pay-nav">
          <div className="nav-in">
            <Link href="/" className="nb">
              <LogoSVGNav />
              <span className="nbt">
                ShadowMarket<em>Pro</em>
                <sup style={{ fontSize: 8, color: "var(--g2)" }}>™</sup>
              </span>
            </Link>
            <Link href="/" className="back-link">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to site
            </Link>
          </div>
        </nav>

        {/* HEADER */}
        <div className="page-header">
          <h1>{isPostPayment ? "Payment Status" : "Crypto Payment"}</h1>
          <p>
            {isPostPayment
              ? "Tracking your payment confirmation"
              : "Secure payment for your ShadowMarketPro™ subscription"}
          </p>
        </div>

        {/* MAIN */}
        <div className="mx">
          {isPostPayment ? (
            <PostPayment success={isSuccess} orderId={orderId} />
          ) : (
            <CheckoutForm />
          )}

          {/* DISCLAIMER */}
          <div className="disc-box">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Security &amp; Disclaimer
            </h4>
            <ul className="disc-list">
              <li>All payments are non-refundable once processed.</li>
              <li>Indicator access is linked to your TradingView account and is non-transferable.</li>
              <li>Only USDT TRC20 is accepted via NOWPayments checkout.</li>
              <li>ShadowMarketPro™ indicators are analytical tools, not financial advice.</li>
            </ul>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="pay-ft">
          <p>© 2026 ShadowMarketPro™ — All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#030818" }} />}>
      <PaymentContent />
    </Suspense>
  );
}
