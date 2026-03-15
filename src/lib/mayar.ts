import * as crypto from "node:crypto";

const MAYAR_API_URL = import.meta.env.MAYAR_API_URL as string;
const MAYAR_API_KEY = import.meta.env.MAYAR_API_KEY as string;
const MAYAR_WEBHOOK_SECRET = import.meta.env.MAYAR_WEBHOOK_SECRET as string;

export interface MayarInvoicePayload {
  name: string;
  amount: number;
  orderId: string;
  description?: string;
  redirectUrl?: string;
  email: string;
  mobile?: string;
}

export interface MayarInvoiceResponse {
  status: string;
  data: {
    id: string;
    link: string;
  };
}

export async function createMayarInvoice(
  payload: MayarInvoicePayload,
): Promise<MayarInvoiceResponse> {
  // Pastikan mobile memenuhi minimal panjang 10 karakter (sesuai validasi Mayar)
  const safeMobile =
    payload.mobile && payload.mobile.length >= 10
      ? payload.mobile
      : "0812345678";

  const body = {
    name: payload.name,
    amount: payload.amount,
    description: payload.description ?? `Order #${payload.orderId}`,
    // Setelah pembayaran, arahkan kembali ke halaman shop (dashboard buyer sudah dihapus)
    redirectUrl:
      payload.redirectUrl ?? `${import.meta.env.PUBLIC_APP_URL}/shop`,
    externalId: payload.orderId,
    email: payload.email,
    mobile: safeMobile,
    items: [
      {
        // Struktur field mengikuti error Mayar: description, quantity, rate
        name: payload.description ?? `Order #${payload.orderId}`,
        description: payload.description ?? `Order #${payload.orderId}`,
        quantity: 1,
        rate: payload.amount,
      },
    ],
  };

  const res = await fetch(`${MAYAR_API_URL}/invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MAYAR_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mayar API error: ${res.status} ${text}`);
  }

  return res.json() as Promise<MayarInvoiceResponse>;
}

export function verifyMayarSignature(
  payload: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", MAYAR_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}
