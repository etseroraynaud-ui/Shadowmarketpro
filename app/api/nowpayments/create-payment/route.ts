import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const NOW_BASE = "https://api.nowpayments.io/v1";

function getPlanUSD(plan: string) {
  switch (plan) {
    case "monthly": return 99;
    case "quarterly": return 279;
    case "yearly": return 999;
    case "lifetime": return 1699;
    default: return 99;
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
    const tradingview_id = body.tradingview_id ? String(body.tradingview_id).trim() : null;

    const basePriceUSD = getPlanUSD(plan);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const ipnUrl = `${siteUrl}/api/nowpayments/ipn`;

    const payCurrency = "usdttrc20";

    // 1) Resolve coupon -> influencer_id + wallet + percent
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
        split_percent = cRow.influencer_wallet ? 0.15 : (cRow.percent != null ? Number(cRow.percent) : null);

        // -10% discount si code valide
        if (VALID_PROMO_CODES.includes(coupon)) {
          discount_percent = 0.10;
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
        discount_percent = 0.10;
      }
    }

    // Force split_percent = 0.15 si influencer_wallet existe
    if (influencer_wallet) {
      split_percent = 0.15;
    }

    // Appliquer remise -10%
    const priceAmountUSD = discount_percent > 0
      ? Math.round(basePriceUSD * (1 - discount_percent) * 100) / 100
      : basePriceUSD;

    // 2) Create order in DB FIRST
    const order_id = crypto.randomUUID();

    const { error: insErr } = await supabaseAdmin.from("orders").insert({
      // clé stable NOWPayments
      order_id,

      // legacy (tu avais déjà)
      status: "created",
      currency: "usd",
      amount_expected: priceAmountUSD,
      amount_paid: 0,
      coupon_code: coupon,
      influencer_wallet,
      split_percent,
      payout_done: false,

      // nouveau schéma (Retool/portal)
      email,
      tradingview_id,
      plan:
        plan === "monthly" ? "Monthly" :
        plan === "quarterly" ? "Quarterly" :
        plan === "yearly" ? "Annual" :
        plan === "lifetime" ? "Lifetime" :
        null,

      amount_usd: priceAmountUSD,
      payment_status: "pending",
      influencer_id,
    });

    if (insErr) {
      return NextResponse.json(
        { error: "DB insert failed", details: insErr.message },
        { status: 500 }
      );
    }

    // 3) Create NOWPayments payment
    const payload = {
      price_amount: priceAmountUSD,
      price_currency: "usd",
      pay_currency: payCurrency,
      order_id, // IMPORTANT
      order_description: `ShadowMarketPro ${plan}`,
      ipn_callback_url: ipnUrl,
      success_url: `${siteUrl}/payment?success=1&order_id=${order_id}`,
      cancel_url: `${siteUrl}/payment?canceled=1&order_id=${order_id}`,
    };

    const r = await fetch(`${NOW_BASE}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.NOWPAYMENTS_API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "create_payment_failed", payment_status: "failed" })
        .eq("order_id", order_id);

      return NextResponse.json(
        { error: "NOWPayments create payment failed", details: data },
        { status: 500 }
      );
    }

    // 4) Save NOWPayments payment id in DB
    await supabaseAdmin
      .from("orders")
      .update({
        nowpayments_payment_id: String(data.payment_id),
        status: "pending",
        payment_status: "pending",
      })
      .eq("order_id", order_id);

    return NextResponse.json({
      order_id,
      payment_id: data.payment_id,
      pay_address: data.pay_address,
      pay_amount: data.pay_amount,
      pay_currency: data.pay_currency,
      invoice_url: data.invoice_url,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message },
      { status: 500 }
    );
  }
}
