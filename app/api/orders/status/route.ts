import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json(
      { error: "Missing order_id query parameter" },
      { status: 400 }
    );
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("payment_status, status, amount_paid, currency, plan, email")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("[orders/status] DB error:", error.message);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      payment_status: order.payment_status,
      status: order.status,
      amount_paid: order.amount_paid ?? 0,
      pay_currency: order.currency ?? "usdttrc20",
      plan: order.plan ?? "",
      email: order.email ?? "",
    });
  } catch (err: unknown) {
    console.error("[orders/status] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
