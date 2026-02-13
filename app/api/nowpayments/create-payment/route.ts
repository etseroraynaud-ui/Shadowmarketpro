import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabase/admin";

const NOW_BASE = "https://api.nowpayments.io/v1";

function getPlanUSD(plan: string) {
  switch (plan) {
    case "monthly": return 99;
    case "quarterly": return 259;
    case "yearly": return 899;
    case "lifetime": return 1599;
    default: return 99;
  }
}

const upper = (s?: string | null) => (s || "").trim().toUpperCase();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const plan = String(body.plan ?? "monthly");
    const coupon = body.coupon ? upper(String(body.coupon)) : null;

    const priceAmountUSD = getPlanUSD(plan);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const ipnUrl = `${siteUrl}/api/nowpayments/ipn`;

    const payCurrency = "usdttrc20";

    // 1) Resolve coupon -> influencer wallet + percent
    let influencer_wallet: string | null = null;
    let split_percent: number | null = null;

    if (coupon) {
      // coupon en DB (si tu l’utilises)
      const { data: cRow } = await supabaseAdmin
        .from("coupons")
        .select("code,influencer_wallet,percent,active")
        .eq("code", coupon)
        .maybeSingle();

      if (cRow?.active) {
        influencer_wallet = cRow.influencer_wallet;
        split_percent = Number(cRow.percent);
      }

      // fallback env "TEST_COUPON"
      if (!influencer_wallet && coupon === upper(process.env.TEST_COUPON)) {
        influencer_wallet = process.env.AFFILIATE_WALLET_TRC20 || null;
        split_percent = Number(process.env.AFFILIATE_PERCENT || "0.15");
      }
    }

    // 2) Create order in DB FIRST
    const order_id = crypto.randomUUID();

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
      order_id, // IMPORTANT: order_id = UUID stable
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
        .update({ status: "create_payment_failed" })
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
