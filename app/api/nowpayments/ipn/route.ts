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

function mapPaymentStatus(npStatus: string): "pending" | "confirmed" | "failed" {
  const s = (npStatus || "").toLowerCase();
  if (["finished", "confirmed"].includes(s)) return "confirmed";
  if (["failed", "expired", "refunded"].includes(s)) return "failed";
  return "pending";
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

  // ✅ Signature OK (on garde)
  if (!verifyNowSig(body, sig, secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const paymentId = String(body.payment_id ?? "");
  const npStatus = String(body.payment_status ?? "");
  const payCurrency = String(body.pay_currency ?? "");
  const actuallyPaid = Number(body.actually_paid ?? body.pay_amount ?? 0);

  const orderId = String(body.order_id ?? "");
  if (!orderId) return NextResponse.json({ ok: true, warning: "missing order_id" });

  // Si tu veux rester strict USDT TRC20 comme avant
  if (payCurrency !== "usdttrc20") {
    return NextResponse.json({ ok: true, ignored: "wrong currency", payCurrency });
  }

  // 1) récupérer l’ordre
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (oErr) return NextResponse.json({ error: "DB error", details: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ ok: true, warning: "unknown order_id" });

  const payment_status = mapPaymentStatus(npStatus);
  const nowIso = new Date().toISOString();

  // 2) update order (idempotent)
  await supabaseAdmin
    .from("orders")
    .update({
      nowpayments_payment_id: paymentId || order.nowpayments_payment_id,
      status: npStatus,              // legacy
      payment_status,                // ✅ nouveau champ propre
      amount_paid: actuallyPaid,
      updated_at: nowIso,
    })
    .eq("order_id", orderId);

  // 3) On déclenche la commission uniquement en FINAL
  if (npStatus.toLowerCase() !== "finished") {
    return NextResponse.json({ ok: true, status: npStatus, payment_status });
  }

  // 4) Créer la commission (affiliate_payouts) si influencer_id existe
  //    split_percent = coupons.percent (ou fallback env) déjà stocké sur order
  const influencerId = order.influencer_id as string | null;
  const splitPercent = Number(order.split_percent ?? 0);

  if (influencerId && splitPercent > 0) {
    // base: amount_usd si présent sinon amount_expected
    const baseUsd = Number(order.amount_usd ?? order.amount_expected ?? 0);
    const commissionUsd = Math.round(baseUsd * splitPercent * 100) / 100;

    const { error: apErr } = await supabaseAdmin
      .from("affiliate_payouts")
      .insert({
        influencer_id: influencerId,
        order_id: order.id,          // ✅ uuid orders.id (FK)
        amount_usd: commissionUsd,
        status: "due",
      });

    // unique(order_id) => si déjà existant on ignore
    if (apErr && !String(apErr.message).toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "affiliate_payouts insert failed", details: apErr.message }, { status: 500 });
    }
  }

  // 5) On marque payout_done (legacy) pour éviter retriggers dans ton code actuel
  if (!order.payout_done) {
    await supabaseAdmin
      .from("orders")
      .update({ payout_done: true, updated_at: nowIso })
      .eq("order_id", orderId);
  }

  return NextResponse.json({ ok: true, status: npStatus, payment_status, commission_created: true });
}
