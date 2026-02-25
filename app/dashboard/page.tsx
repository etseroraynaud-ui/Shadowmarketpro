import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;

type Influencer = {
  id: string;
  user_id: string | null;
  name: string | null;
  coupon_code: string | null;
  commission_rate: number | null; // ex: 0.15
  wallet_address: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  status: string | null;
  amount_usd: number | null;
  plan: string | null;
  email: string | null;
  coupon_code: string | null;
  tx_hash: string | null;
};

type PayoutRow = {
  id: string;
  created_at: string;
  status: string | null; // "due" | "paid"
  amount_usd: number | null;
  order_id: string | null;
  paid_tx_hash: string | null;
};

function fmtMoney(x: number) {
  return x.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string) {
  // Stable SSR: ISO -> yyyy-mm-dd hh:mm (sans locale)
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid rgba(6,182,212,.18)",
        background: "rgba(6,182,212,.06)",
        color: "var(--tp)",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ v }: { v: string | null }) {
  const value = (v ?? "unknown").toLowerCase();
  const isPaid = ["paid", "completed", "success"].includes(value);
  const isDue = ["due", "pending"].includes(value);

  const bg = isPaid
    ? "rgba(34,197,94,.12)"
    : isDue
    ? "rgba(250,204,21,.10)"
    : "rgba(148,163,184,.10)";

  const bd = isPaid
    ? "rgba(34,197,94,.22)"
    : isDue
    ? "rgba(250,204,21,.18)"
    : "rgba(148,163,184,.18)";

  const col = isPaid ? "#22c55e" : isDue ? "#facc15" : "rgba(224,232,255,.75)";

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: `1px solid ${bd}`,
        background: bg,
        color: col,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {value}
    </span>
  );
}

function TableShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gl" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 16, color: "var(--w)" }}>
            {title}
          </div>
          {subtitle ? <div style={{ marginTop: 4, fontSize: 12, color: "var(--tm)" }}>{subtitle}</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          {children}
        </table>
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "12px 12px",
        borderBottom: "1px solid rgba(6,182,212,.08)",
        fontFamily: "Outfit, sans-serif",
        fontSize: 12,
        letterSpacing: ".02em",
        color: "rgba(224,232,255,.75)",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  muted,
  colSpan,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  muted?: boolean;
  colSpan?: number;   // ✅ AJOUT ICI
}) {
  return (
    <td
      colSpan={colSpan}   // ✅ AJOUT ICI
      style={{
        textAlign: align ?? "left",
        padding: "12px 12px",
        borderBottom: "1px solid rgba(6,182,212,.05)",
        color: muted ? "var(--tm)" : "var(--tp)",
        fontFamily: mono ? "JetBrains Mono, monospace" : "DM Sans, sans-serif",
        whiteSpace: "nowrap",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1) Influencer
  const { data: influencer, error: inflErr } = await supabase
    .from("influencers")
    .select("id,user_id,name,coupon_code,commission_rate,wallet_address")
    .eq("user_id", user.id)
    .maybeSingle<Influencer>();

  if (inflErr) {
    return (
      <main className="rel">
        <div className="mx" style={{ paddingTop: 110, paddingBottom: 80 }}>
          <div className="gl" style={{ padding: 22 }}>
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 18, color: "var(--w)" }}>
              Dashboard affilié
            </div>
            <div style={{ marginTop: 10, color: "var(--tm)", fontSize: 13 }}>
              Erreur Supabase: {inflErr.message}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!influencer || !influencer.coupon_code) {
    return (
      <main className="rel">
        <div className="mx" style={{ paddingTop: 110, paddingBottom: 80 }}>
          <div className="gl" style={{ padding: 22 }}>
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 18, color: "var(--w)" }}>
              Dashboard affilié
            </div>
            <div style={{ marginTop: 10, color: "var(--tm)", fontSize: 13 }}>
              Aucun profil affilié lié à ce compte.
            </div>
            <div style={{ marginTop: 14 }}>
              <form action="/auth/logout" method="post">
                <button className="bo" type="submit">
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const coupon = influencer.coupon_code;

  // 2) Orders (paginated)
  const { data: ordersRaw, error: ordersErr } = await supabase
    .from("orders")
    .select("id,created_at,status,amount_usd,plan,email,coupon_code,tx_hash")
    .eq("coupon_code", coupon)
    .order("created_at", { ascending: false })
    .range(from, to);

  // 3) Total count (for pagination buttons)
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("coupon_code", coupon);

  // 4) Payouts (last 50 paginated with same page, optional)
  const { data: payoutsRaw, error: payoutsErr } = await supabase
    .from("affiliate_payouts")
    .select("id,created_at,status,amount_usd,order_id,paid_tx_hash")
    .eq("influencer_id", influencer.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const orders = (ordersRaw ?? []) as OrderRow[];
  const payouts = (payoutsRaw ?? []) as PayoutRow[];

  // KPIs
  const revenue = orders.reduce((acc, o) => acc + (Number(o.amount_usd) || 0), 0);
  const due = payouts
    .filter((p) => (p.status ?? "").toLowerCase() !== "paid")
    .reduce((acc, p) => acc + (Number(p.amount_usd) || 0), 0);
  const paid = payouts
    .filter((p) => (p.status ?? "").toLowerCase() === "paid")
    .reduce((acc, p) => acc + (Number(p.amount_usd) || 0), 0);

  const maxPage = totalOrders ? Math.max(1, Math.ceil(totalOrders / PAGE_SIZE)) : 1;
  const hasPrev = page > 1;
  const hasNext = page < maxPage;

  return (
    <main className="rel">
      <div className="bgm" />
      <div className="mx" style={{ paddingTop: 110, paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1.1, color: "var(--w)" }}>
              Dashboard <span className="tg">affilié</span>
            </div>

            <div style={{ marginTop: 10, color: "var(--ts)", fontSize: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge>{influencer.name ?? "—"}</Badge>
              <Badge>Coupon: {coupon}</Badge>
              <Badge>Commission: {Math.round(((influencer.commission_rate ?? 0) * 100) * 100) / 100}%</Badge>
              <Badge>Wallet: {influencer.wallet_address ?? "—"}</Badge>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <form action="/auth/logout" method="post">
              <button className="bo" type="submit">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        {/* Errors */}
        {(ordersErr || payoutsErr) ? (
          <div className="gl" style={{ padding: 18, marginTop: 18, borderColor: "rgba(250,204,21,.18)" }}>
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, color: "#facc15" }}>
              Attention: erreur de lecture
            </div>
            <div style={{ marginTop: 6, color: "rgba(224,232,255,.7)", fontSize: 13 }}>
              {ordersErr ? `Orders: ${ordersErr.message} ` : ""}
              {payoutsErr ? `Payouts: ${payoutsErr.message}` : ""}
            </div>
          </div>
        ) : null}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginTop: 22 }}>
          {[
            { k: "Commandes", v: String(totalOrders ?? orders.length) },
            { k: "CA généré", v: fmtMoney(revenue) },
            { k: "Commissions dues", v: fmtMoney(due) },
            { k: "Commissions payées", v: fmtMoney(paid) },
          ].map((x) => (
            <div key={x.k} className="gl glh" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: "var(--tm)", fontFamily: "Outfit, sans-serif", letterSpacing: ".08em", textTransform: "uppercase" }}>
                {x.k}
              </div>
              <div style={{ marginTop: 8, fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: 22, color: "var(--w)" }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div style={{ marginTop: 18 }}>
          <TableShell
            title="Orders"
            subtitle={`Page ${page}/${maxPage} • ${PAGE_SIZE} par page`}
          >
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th align="right">Montant</Th>
                <Th>Plan</Th>
                <Th>Email</Th>
                <Th>Coupon</Th>
                <Th>Tx</Th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <Td muted colSpan={7 as any}>
                    Aucune commande pour l’instant.
                  </Td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <Td mono>{fmtDate(o.created_at)}</Td>
                    <Td><StatusPill v={o.status} /></Td>
                    <Td align="right" mono>{fmtMoney(Number(o.amount_usd) || 0)}</Td>
                    <Td>{o.plan ?? "—"}</Td>
                    <Td mono>{o.email ?? "—"}</Td>
                    <Td mono>{o.coupon_code ?? "—"}</Td>
                    <Td mono>
                      {o.tx_hash ? (
                        <span title={o.tx_hash}>{o.tx_hash.slice(0, 10)}…</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableShell>

          {/* Pagination controls */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ color: "var(--tm)", fontSize: 12 }}>
              Affichage {from + 1}–{Math.min((totalOrders ?? from + orders.length), to + 1)} sur {totalOrders ?? "—"}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {hasPrev ? (
                <Link className="bo" href={`/dashboard?page=${page - 1}`}>
                  ← Précédent
                </Link>
              ) : (
                <button className="bo" disabled>
                  ← Précédent
                </button>
              )}

              {hasNext ? (
                <Link className="bo" href={`/dashboard?page=${page + 1}`}>
                  Suivant →
                </Link>
              ) : (
                <button className="bo" disabled>
                  Suivant →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Commissions table */}
        <div style={{ marginTop: 18 }}>
          <TableShell title="Commissions" subtitle={`Liées à l’influenceur: ${influencer.id}`}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th align="right">Montant</Th>
                <Th>Order</Th>
                <Th>Tx (paiement)</Th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <Td muted colSpan={5 as any}>
                    Aucune commission pour l’instant.
                  </Td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id}>
                    <Td mono>{fmtDate(p.created_at)}</Td>
                    <Td><StatusPill v={p.status} /></Td>
                    <Td align="right" mono>{fmtMoney(Number(p.amount_usd) || 0)}</Td>
                    <Td mono>{p.order_id ? p.order_id.slice(0, 8) + "…" : "—"}</Td>
                    <Td mono>{p.paid_tx_hash ? p.paid_tx_hash.slice(0, 10) + "…" : "—"}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableShell>
        </div>

        <div style={{ marginTop: 18, color: "var(--tm)", fontSize: 12 }}>
          Besoin d’ajouter des colonnes (currency, network, customer_id) ? Dis-moi la structure exacte de tes tables Supabase et je te le plug en 2 minutes.
        </div>
      </div>
    </main>
  );
}
