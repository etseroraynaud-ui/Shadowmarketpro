import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabase/admin";

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
const EMAILJS_TEMPLATE_ADMIN = process.env.EMAILJS_TEMPLATE_ADMIN || "template_9v05vy8";

async function sendAdminPaidEmail(params: Record<string, any>) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_TEMPLATE_ADMIN) return;

  const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ADMIN,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: params,
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`EmailJS failed (${r.status}): ${t}`);
  }
}




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
  const payCurrency = String(body.pay_currency ?? "").toLowerCase();
  const actuallyPaid = Number(body.actually_paid ?? body.pay_amount ?? 0);

const orderId = String(body.order_id ?? "");
if (!orderId) return NextResponse.json({ ok: true, warning: "missing order_id" });

// Rester "strict TRC20" mais tolérant sur le format
if (!payCurrency.includes("trc20")) {
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

  // ✅ EMAIL ADMIN (1 seule fois) quand paiement confirmé
if (!order.admin_email_sent) {
  try {
    await sendAdminPaidEmail({
      title: `Payment confirmed — ${order.plan ?? "subscription"}`,
      name: "NOWPayments",
      time: new Date().toISOString(),
      message: `Payment confirmed (finished)

Order: ${orderId}
Payment ID: ${paymentId}
Amount paid: ${actuallyPaid} ${payCurrency}

Customer email: ${order.email ?? ""}
TradingView: ${order.tradingview_id ?? ""}`,
      email: order.email ?? "",
      plan: order.plan ?? "",
      payment_id: paymentId,
      order_id: orderId,
      amount_paid: actuallyPaid,
      pay_currency: payCurrency,
    });

    await supabaseAdmin
      .from("orders")
      .update({ admin_email_sent: true, updated_at: nowIso })
      .eq("order_id", orderId);

  } catch (e) {
    console.error("EmailJS admin send failed:", e);
    // on continue quand même (ne bloque pas l’IPN)
  }
}

  // 4) Créer la commission (affiliate_payouts) si influencer_wallet existe
  //    Commission fixe 15% sur prix final (amount_usd)
  const influencerId = order.influencer_id as string | null;
  const influencerWallet = order.influencer_wallet as string | null;

  if (influencerWallet && influencerId) {
    // Commission 15% fixe sur prix final (après remise)
    const baseUsd = Number(order.amount_usd ?? order.amount_expected ?? 0);
    const commissionUsd = Math.round(baseUsd * 0.15 * 100) / 100;

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
