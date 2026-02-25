import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const NOW_BASE = "https://api.nowpayments.io/v1";
const MIN_PAYOUT = Number(process.env.MIN_AFFILIATE_PAYOUT_USD || "20");

export async function POST(req: Request) {
  // Sécurité: vérifier le header cron secret
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const PAYOUT_URL =
    process.env.NOWPAYMENTS_PAYOUT_URL || `${NOW_BASE}/payout`;
  const apiKey = process.env.NOWPAYMENTS_API_KEY || "";

  try {
    // 1) Sélectionner tous les payouts "due"
    const { data: duePays, error: fetchErr } = await supabaseAdmin
      .from("affiliate_payouts")
      .select("id, order_id, amount_usd, influencer_id")
      .eq("status", "due");

    if (fetchErr) {
      return NextResponse.json(
        { error: "Failed to fetch due payouts", details: fetchErr.message },
        { status: 500 }
      );
    }

    if (!duePays || duePays.length === 0) {
      return NextResponse.json({ ok: true, message: "No due payouts", paid: 0 });
    }

    // 2) Retrouver influencer_wallet via orders pour chaque payout
    const orderIds = [...new Set(duePays.map((p) => p.order_id))];
    const { data: orders, error: ordErr } = await supabaseAdmin
      .from("orders")
      .select("id, influencer_wallet")
      .in("id", orderIds);

    if (ordErr) {
      return NextResponse.json(
        { error: "Failed to fetch orders", details: ordErr.message },
        { status: 500 }
      );
    }

    const walletByOrderId = new Map<string, string>();
    (orders || []).forEach((o: any) => {
      if (o.influencer_wallet) {
        walletByOrderId.set(o.id, o.influencer_wallet);
      }
    });

    // 3) Grouper par wallet
    const walletTotals = new Map<
      string,
      { totalUsd: number; payoutIds: string[] }
    >();

    for (const p of duePays) {
      const wallet = walletByOrderId.get(p.order_id);
      if (!wallet) continue;

      const existing = walletTotals.get(wallet) || {
        totalUsd: 0,
        payoutIds: [],
      };
      existing.totalUsd += Number(p.amount_usd);
      existing.payoutIds.push(p.id);
      walletTotals.set(wallet, existing);
    }

    const results: Array<{
      wallet: string;
      totalUsd: number;
      status: string;
      error?: string;
    }> = [];

    // 4) Traiter chaque wallet
    for (const [wallet, data] of walletTotals.entries()) {
      const totalUsd = Math.round(data.totalUsd * 100) / 100;

      // Seuil minimum
      if (totalUsd < MIN_PAYOUT) {
        results.push({
          wallet,
          totalUsd,
          status: "skipped_below_minimum",
        });
        continue;
      }

      // Idempotence: marquer "processing" AVANT l'appel
      await supabaseAdmin
        .from("affiliate_payouts")
        .update({ status: "processing" })
        .in("id", data.payoutIds);

      try {
        // Appeler NOWPayments payout
        const r = await fetch(PAYOUT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            currency: "usdttrc20",
            address: wallet,
            amount: totalUsd,
          }),
        });

        const resData = await r.json().catch(() => ({}));

        if (r.ok) {
          // Succès => paid
          await supabaseAdmin
            .from("affiliate_payouts")
            .update({ status: "paid" })
            .in("id", data.payoutIds);

          results.push({ wallet, totalUsd, status: "paid" });
        } else {
          // Échec => failed
          await supabaseAdmin
            .from("affiliate_payouts")
            .update({ status: "failed" })
            .in("id", data.payoutIds);

          results.push({
            wallet,
            totalUsd,
            status: "failed",
            error: JSON.stringify(resData),
          });
        }
      } catch (e: any) {
        // Erreur réseau => failed
        await supabaseAdmin
          .from("affiliate_payouts")
          .update({ status: "failed" })
          .in("id", data.payoutIds);

        results.push({
          wallet,
          totalUsd,
          status: "failed",
          error: e?.message,
        });
      }
    }

    const paid = results.filter((r) => r.status === "paid");
    const failed = results.filter((r) => r.status === "failed");
    const skipped = results.filter((r) => r.status === "skipped_below_minimum");

    return NextResponse.json({
      ok: true,
      summary: {
        total_wallets: results.length,
        paid: paid.length,
        failed: failed.length,
        skipped: skipped.length,
      },
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message },
      { status: 500 }
    );
  }
}
