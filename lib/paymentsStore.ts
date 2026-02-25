// app/lib/paymentsStore.ts

export type PaymentRecord = {
  paymentId: string;
  payCurrency: string;        // ex: "usdttrc20"
  amountCrypto?: number;      // montants issus IPN
  coupon?: string | null;
  affiliateEligible: boolean;
  affiliatePaid: boolean;
};

const store = new Map<string, PaymentRecord>();

export function savePayment(rec: PaymentRecord) {
  store.set(rec.paymentId, rec);
}

export function getPayment(paymentId: string) {
  return store.get(paymentId);
}

export function markAffiliatePaid(paymentId: string) {
  const r = store.get(paymentId);
  if (!r) return;
  r.affiliatePaid = true;
  store.set(paymentId, r);
}
