"use client";

import { useState } from "react";

type Plan = "monthly" | "quarterly" | "yearly" | "lifetime";

interface CheckoutButtonProps {
  plan: Plan;
  email: string;
  tradingview_id: string;
  coupon?: string | null;
  /** Override button label (default: "Pay with Crypto") */
  label?: string;
  /** Extra CSS class */
  className?: string;
}

export default function CheckoutButton({
  plan,
  email,
  tradingview_id,
  coupon = null,
  label = "Pay with Crypto",
  className = "",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);

    // Basic client-side validation
    if (!email || !tradingview_id) {
      setError("Email and TradingView ID are required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/nowpayments/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          coupon: coupon ? coupon.trim().toUpperCase() : null,
          email: email.trim(),
          tradingview_id: tradingview_id.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.invoice_url) {
        const msg =
          data?.error ?? data?.details ?? "Payment creation failed. Please try again.";
        console.error("[CheckoutButton] create-payment error:", data);
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

      // Redirect to NOWPayments hosted checkout
      window.location.href = data.invoice_url;
    } catch (err: unknown) {
      console.error("[CheckoutButton] network error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className || "bp"}
        style={loading ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
      >
        {loading ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin .6s linear infinite",
                marginRight: 8,
                verticalAlign: "middle",
              }}
            />
            Création de la facture…
          </>
        ) : (
          label
        )}
      </button>

      {error && (
        <p
          style={{
            color: "#ef4444",
            fontSize: 13,
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          {error}
        </p>
      )}

      {/* Inline keyframes for the spinner */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
