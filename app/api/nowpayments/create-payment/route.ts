import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const NOW_BASE = "https://api.nowpayments.io/v1";

function getPlanUSD(plan: string) {
  switch (plan) {
    case "monthly":   return 99;
    case "quarterly": return 279;
    case "yearly":    return 999;
    case "lifetime":  return 1699;
    default:          return 99;
  }
}

const upper = (s?: string | null) => (s || "").trim().toUpperCase();

// Coupons valides pour -10%
const VALID_PROMO_CODES = ["PREDACRYPTO", "SUNRIZE", "ANOUSH"];
const PREDACRYPTO_FALLBACK_WALLET = "TBJLWktw3gyjdXY4fGXvQ4Fo3Uuh9Efzu2";

type Body = {
  plan?: "monthly" | "quarterly" | "yearly" | "lifetime" | string;
  coupon?: string | null;
  email?: string | null;
  tradingview_id?: string | null;
};

export async function POST(req: Request) {
  try {
    const body: Body = await req.json().catch(() => ({}));

    const plan = String(body.plan ?? "monthly").toLowerCase();
    const coupon = body.coupon ? upper(String(body.coupon)) : null;

    const email = body.email ? String(body.email).trim() : null;
    const tradingview_id = body.tradingview_id
      ? String(body.tradingview_id).trim()
      : null;

    const basePriceUSD = getPlanUSD(plan);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const ipnUrl = `${siteUrl}/api/nowpayments/ipn`;

    const payCurrency = "usdttrc20";

    /* ──────────────────────────────────────────────
       1) Resolve coupon → influencer_id + wallet + percent
       ────────────────────────────────────────────── */
    let influencer_id: string | null = null;
    let influencer_wallet: string | null = null;
    let split_percent: number | null = null;
    let discount_percent = 0;

    if (coupon) {
      const { data: cRow, error: cErr } = await supabaseAdmin
        .from("coupons")
        .select("code,influencer_id,influencer_wallet,percent,active")
        .eq("code", coupon)
        .maybeSingle();

      if (cErr) {
        return NextResponse.json(
          { error: "Coupon lookup failed", details: cErr.message },
          { status: 500 }
        );
      }

      if (cRow?.active) {
        influencer_id = cRow.influencer_id ?? null;
        influencer_wallet = cRow.influencer_wallet ?? null;
        // Force 15% commission si wallet affilié existe
        split_percent = cRow.influencer_wallet
          ? 0.15
          : cRow.percent != null
            ? Number(cRow.percent)
            : null;

        // -10% discount si code valide
        if (VALID_PROMO_CODES.includes(coupon)) {
          discount_percent = 0.1;
        }
      }

      // fallback env "TEST_COUPON"
      if (!influencer_wallet && coupon === upper(process.env.TEST_COUPON)) {
        influencer_wallet = process.env.AFFILIATE_WALLET_TRC20 || null;
        split_percent = 0.15;
      }

      // fallback wallet PREDACRYPTO
      if (!influencer_wallet && coupon === "PREDACRYPTO") {
        influencer_wallet = PREDACRYPTO_FALLBACK_WALLET;
        split_percent = 0.15;
        discount_percent = 0.1;
      }
    }

    // Force split_percent = 0.15 si influencer_wallet existe
    if (influencer_wallet) {
      split_percent = 0.15;
    }

    // Appliquer remise -10%
    const priceAmountUSD =
      discount_percent > 0
        ? Math.round(basePriceUSD * (1 - discount_percent) * 100) / 100
        : basePriceUSD;

    /* ──────────────────────────────────────────────
       2) Create order in DB FIRST
       ────────────────────────────────────────────── */
    const order_id = crypto.randomUUID();

    const planLabel =
      plan === "monthly"   ? "Monthly"  :
      plan === "quarterly" ? "Quarterly":
      plan === "yearly"    ? "Annual"   :
      plan === "lifetime"  ? "Lifetime" :
      null;

    const { error: insErr } = await supabaseAdmin.from("orders").insert({
      order_id,
      status: "created",
      currency: "usd",
      amount_expected: priceAmountUSD,
      amount_paid: 0,
      coupon_code: coupon,
      influencer_wallet,
      split_percent,
      payout_done: false,
      email,
      tradingview_id,
      plan: planLabel,
      amount_usd: priceAmountUSD,
      payment_status: "pending",
      influencer_id,
    });

    if (insErr) {
      console.error("[create-payment] DB insert failed:", insErr.message);
      return NextResponse.json(
        { error: "DB insert failed", details: insErr.message },
        { status: 500 }
      );
    }

    /* ──────────────────────────────────────────────
       3) Create NOWPayments INVOICE (hosted checkout)
       ──────────────────────────────────────────────
       POST /v1/invoice renvoie TOUJOURS un invoice_url
       contrairement à POST /v1/payment qui peut ne pas
       en renvoyer selon le contexte.
       ────────────────────────────────────────────── */
    const invoicePayload = {
      price_amount:      priceAmountUSD,
      price_currency:    "usd",
      pay_currency:      payCurrency,
      order_id,
      order_description: `ShadowMarketPro ${planLabel ?? plan}`,
      ipn_callback_url:  ipnUrl,
      success_url:       `${siteUrl}/payment?success=1&order_id=${order_id}`,
      cancel_url:        `${siteUrl}/payment?canceled=1&order_id=${order_id}`,
      // is_fixed_rate n'est pas obligatoire pour /v1/invoice
      // on le laisse absent → NOWPayments applique le taux live
    };

    console.log("[create-payment] Calling NOWPayments /v1/invoice for order:", order_id);

    const r = await fetch(`${NOW_BASE}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.NOWPAYMENTS_API_KEY || "",
      },
      body: JSON.stringify(invoicePayload),
    });

    const data = await r.json().catch(() => null);

    /* ── Erreur NOWPayments ── */
    if (!r.ok || !data) {
      console.error("[create-payment] NOWPayments invoice error:", r.status, data);

      await supabaseAdmin
        .from("orders")
        .update({ status: "create_payment_failed", payment_status: "failed" })
        .eq("order_id", order_id);

      return NextResponse.json(
        {
          error: "NOWPayments invoice creation failed",
          details: data ?? `HTTP ${r.status}`,
        },
        { status: 502 }
      );
    }

    /* ── Parse tolérant : invoice_url peut être sous différentes clés ── */
    const invoice_url: string | undefined =
      data.invoice_url ?? data.invoiceUrl ?? data.url ?? undefined;

    if (!invoice_url) {
      console.error(
        "[create-payment] invoice_url MISSING in NOWPayments response:",
        JSON.stringify(data).slice(0, 500)
      );

      await supabaseAdmin
        .from("orders")
        .update({ status: "create_payment_failed", payment_status: "failed" })
        .eq("order_id", order_id);

      return NextResponse.json(
        {
          error: "NOWPayments returned no invoice_url",
          details: data,
        },
        { status: 502 }
      );
    }

    /* ── Parse invoice_id (string) ── */
    const invoice_id: string | null =
      data.id != null ? String(data.id) : null;

    /* ──────────────────────────────────────────────
       4) Save invoice reference in DB
       ────────────────────────────────────────────── */
    await supabaseAdmin
      .from("orders")
      .update({
        nowpayments_payment_id: invoice_id ?? "",
        status: "pending",
        payment_status: "pending",
      })
      .eq("order_id", order_id);

    console.log(
      `[create-payment] Invoice created: order=${order_id} invoice_id=${invoice_id} url=${invoice_url}`
    );

    /* ──────────────────────────────────────────────
       5) Return to frontend
       ────────────────────────────────────────────── */
    return NextResponse.json({
      order_id,
      invoice_url,
      invoice_id,
      // Debug / optional fields
      amount_usd: priceAmountUSD,
      plan: planLabel,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-payment] Unexpected error:", msg);
    return NextResponse.json(
      { error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
