import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

/* ─── EmailJS ─── */
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
const EMAILJS_TEMPLATE_ADMIN = process.env.EMAILJS_TEMPLATE_ADMIN || "template_9v05vy8";

async function sendAdminPaidEmail(params: Record<string, unknown>) {
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

/* ─── Signature verification ───
   CRITICAL: HMAC SHA-512 must be computed on the EXACT raw body string
   received from NOWPayments. Do NOT use JSON.stringify or stableStringify.
   NOWPayments signs the raw bytes they send — any re-serialisation changes
   key ordering or whitespace and breaks the signature.
*/
function verifyNowSig(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader || !secret) return false;

  const computed = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison
  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(sigHeader, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ─── Status mapping ─── */
function mapPaymentStatus(npStatus: string): "pending" | "confirmed" | "failed" {
  const s = (npStatus || "").toLowerCase();
  if (["finished", "confirmed"].includes(s)) return "confirmed";
  if (["failed", "expired", "refunded"].includes(s)) return "failed";
  return "pending";
}

/* ─── IPN Handler ─── */
export async function POST(req: Request) {
  const sig = req.headers.get("x-nowpayments-sig");
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";

  // 1) Read raw body ONCE — used for both signature & parsing
  const rawText = await req.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText);
  } catch {
    console.error("[IPN] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2) Verify HMAC on the EXACT raw text
  if (!verifyNowSig(rawText, sig, secret)) {
    console.error("[IPN] Bad HMAC signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const paymentId = String(body.payment_id ?? "");
  const npStatus = String(body.payment_status ?? "");
  const payCurrency = String(body.pay_currency ?? "").toLowerCase();
  const actuallyPaid = Number(body.actually_paid ?? body.pay_amount ?? 0);
  const orderId = String(body.order_id ?? "");

  console.log(`[IPN] Received: order=${orderId} payment=${paymentId} status=${npStatus} paid=${actuallyPaid} ${payCurrency}`);

  if (!orderId) {
    return NextResponse.json({ ok: true, warning: "missing order_id" });
  }

  // Accept any TRC20-related currency string
  if (!payCurrency.includes("trc20")) {
    console.log(`[IPN] Ignored non-TRC20 currency: ${payCurrency}`);
    return NextResponse.json({ ok: true, ignored: "wrong currency", payCurrency });
  }

  // 3) Fetch order from DB
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (oErr) {
    console.error("[IPN] DB error:", oErr.message);
    return NextResponse.json({ error: "DB error", details: oErr.message }, { status: 500 });
  }
  if (!order) {
    console.warn(`[IPN] Unknown order_id: ${orderId}`);
    return NextResponse.json({ ok: true, warning: "unknown order_id" });
  }

  const payment_status = mapPaymentStatus(npStatus);
  const nowIso = new Date().toISOString();

  // 4) Idempotency: if order already confirmed or failed, skip
  if (order.payment_status === "confirmed" || order.payment_status === "failed") {
    console.log(`[IPN] Order ${orderId} already terminal (${order.payment_status}), skipping`);
    return NextResponse.json({ ok: true, already: order.payment_status });
  }

  // 5) Update order
  await supabaseAdmin
    .from("orders")
    .update({
      nowpayments_payment_id: paymentId || order.nowpayments_payment_id,
      status: npStatus,
      payment_status,
      amount_paid: actuallyPaid,
      updated_at: nowIso,
    })
    .eq("order_id", orderId);

  // 6) Final actions only on "finished" or "confirmed" from NOWPayments
  const isFinal = ["finished", "confirmed"].includes(npStatus.toLowerCase());
  if (!isFinal) {
    return NextResponse.json({ ok: true, status: npStatus, payment_status });
  }

  // 7) Admin email (once)
  if (!order.admin_email_sent) {
    try {
      await sendAdminPaidEmail({
        title: `Payment confirmed — ${order.plan ?? "subscription"}`,
        name: "NOWPayments",
        time: nowIso,
        message: [
          `Payment confirmed (${npStatus})`,
          "",
          `Order: ${orderId}`,
          `Payment ID: ${paymentId}`,
          `Amount paid: ${actuallyPaid} ${payCurrency}`,
          "",
          `Customer email: ${order.email ?? ""}`,
          `TradingView: ${order.tradingview_id ?? ""}`,
        ].join("\n"),
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

      console.log(`[IPN] Admin email sent for order ${orderId}`);
    } catch (e) {
      console.error("[IPN] EmailJS send failed:", e);
      // Don't block the IPN response
    }
  }

  // 8) Create affiliate commission (idempotent via unique constraint)
  const influencerId = order.influencer_id as string | null;
  const influencerWallet = order.influencer_wallet as string | null;

  if (influencerWallet && influencerId) {
    const baseUsd = Number(order.amount_usd ?? order.amount_expected ?? 0);
    const commissionUsd = Math.round(baseUsd * 0.15 * 100) / 100;

    const { error: apErr } = await supabaseAdmin
      .from("affiliate_payouts")
      .insert({
        influencer_id: influencerId,
        order_id: order.id, // uuid FK
        amount_usd: commissionUsd,
        status: "due",
      });

    // Unique constraint on order_id → duplicate = already created = OK
    if (apErr && !String(apErr.message).toLowerCase().includes("duplicate")) {
      console.error("[IPN] affiliate_payouts insert error:", apErr.message);
      return NextResponse.json(
        { error: "affiliate_payouts insert failed", details: apErr.message },
        { status: 500 }
      );
    }

    console.log(`[IPN] Commission ${commissionUsd} USD created for influencer ${influencerId}`);
  }

  // 9) Mark payout_done (legacy)
  if (!order.payout_done) {
    await supabaseAdmin
      .from("orders")
      .update({ payout_done: true, updated_at: nowIso })
      .eq("order_id", orderId);
  }

  console.log(`[IPN] Order ${orderId} fully processed ✅`);
  return NextResponse.json({ ok: true, status: npStatus, payment_status, commission_created: true });
}
