import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabase/admin";

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
}

function safeEqualHex(a: string, b: string) {
  try {
    const aa = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verifyNowSig(body: any, sigHeader: string | null, secret: string) {
  if (!sigHeader || !secret) return false;
  const payload = stableStringify(body);
  const h = crypto.createHmac("sha512", secret).update(payload).digest("hex");
  return safeEqualHex(h, sigHeader);
}

// ⚠️ Tentative de payout seulement si tu as une vraie payout key
async function trySendAffiliatePayoutUSDTTRC20(amount: number, address: string) {
  const payoutKey = process.env.NOWPAYMENTS_PAYOUT_API_KEY;
  if (!payoutKey) {
    return { skipped: true, reason: "NO_PAYOUT_KEY" as const };
  }

  const PAYOUT_URL = "https://api.nowpayments.io/v1/payout"; // dépend de l’accès Custody/Mass payouts

  const payload = {
    currency: "usdttrc20",
    amount,
    address,
  };

  const r = await fetch(PAYOUT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": payoutKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { skipped: true, reason: "PAYOUT_FAILED" as const, details: data };
  }
  return { skipped: false, data };
}

export async function POST(req: Request) {
  const sig = req.headers.get("x-nowpayments-sig");
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";

  const rawText = await req.text();
  let body: any;
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyNowSig(body, sig, secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const paymentId = String(body.payment_id ?? "");
  const status = String(body.payment_status ?? "");
  const payCurrency = String(body.pay_currency ?? "");
  const payAmount = Number(body.pay_amount ?? 0); // amount demandé
  const actuallyPaid = Number(body.actually_paid ?? body.pay_amount ?? 0); // NOWPayments envoie souvent actually_paid

  const orderId = String(body.order_id ?? ""); // IMPORTANT: on l’utilise comme clé DB
  if (!orderId) return NextResponse.json({ ok: true, warning: "missing order_id" });

  // On ne gère que USDT TRC20 pour l’instant (comme tu veux)
  if (payCurrency !== "usdttrc20") {
    return NextResponse.json({ ok: true, ignored: "wrong currency", payCurrency });
  }

  // 1) récupère l’ordre
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (oErr) return NextResponse.json({ error: "DB error", details: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ ok: true, warning: "unknown order_id" });

  // 2) update status (idempotent) + store payment_id/amount_paid
  // NOWPayments spam l’IPN => on fait des updates safe
  await supabaseAdmin
    .from("orders")
    .update({
      nowpayments_payment_id: paymentId || order.nowpayments_payment_id,
      status,
      amount_paid: actuallyPaid,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  // 3) on ne déclenche la logique "split" que quand c’est FINAL
  // ("finished" chez NOWPayments)
  if (status !== "finished") {
    return NextResponse.json({ ok: true, status });
  }

  // 4) si pas de coupon / pas de wallet / déjà fait => stop
  const influencerWallet = order.influencer_wallet as string | null;
  const splitPercent = Number(order.split_percent ?? 0);

  if (!influencerWallet || !splitPercent || order.payout_done) {
    // marquer payout_done si pas de split à faire
    if (!order.payout_done) {
      await supabaseAdmin
        .from("orders")
        .update({ payout_done: true, updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
    }
    return NextResponse.json({ ok: true, payout: "none" });
  }

  // 5) calc payout
  const affiliateAmount = Math.round(actuallyPaid * splitPercent * 1e6) / 1e6;

  // 6) crée un payout record (idempotent: un seul par order_id + target)
  // -> si tu peux, ajoute une contrainte unique en DB plus tard
  const { data: payoutRow, error: pErr } = await supabaseAdmin
    .from("payouts")
    .insert({
      order_id: order.id, // si payouts.order_id référence uuid "orders.id"
      target: "affiliate",
      address: influencerWallet,
      amount: affiliateAmount,
      status: "pending",
      nowpayments_payout_id: null,
    })
    .select("*")
    .maybeSingle();

  if (pErr) {
    // si déjà créé, on continue sans casser
    // (souvent erreur "duplicate" si tu ajoutes une contrainte unique plus tard)
  }

  // 7) tente le payout auto si possible (sinon reste pending)
  const payoutAttempt = await trySendAffiliatePayoutUSDTTRC20(affiliateAmount, influencerWallet);

  if (!payoutAttempt.skipped) {
    await supabaseAdmin
      .from("payouts")
      .update({
        status: "sent",
        nowpayments_payout_id: String((payoutAttempt as any).data?.id ?? ""),
      })
      .eq("id", payoutRow?.id ?? null);

    await supabaseAdmin
      .from("orders")
      .update({ payout_done: true, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);

    return NextResponse.json({ ok: true, payout: "sent" });
  }

  // pas de payout key / feature non activée => on laisse pending
  await supabaseAdmin
    .from("orders")
    .update({ payout_done: true, updated_at: new Date().toISOString() })
    .eq("order_id", orderId);

  return NextResponse.json({ ok: true, payout: "queued", reason: payoutAttempt.reason });
}
