import * as crypto from 'node:crypto';

const MAYAR_API_URL = import.meta.env.MAYAR_API_URL as string;
const MAYAR_API_KEY = import.meta.env.MAYAR_API_KEY as string;
const MAYAR_WEBHOOK_SECRET = import.meta.env.MAYAR_WEBHOOK_SECRET as string;

export interface MayarInvoicePayload {
  name: string;
  amount: number;
  orderId: string;
  description?: string;
  redirectUrl?: string;
}

export interface MayarInvoiceResponse {
  status: string;
  data: {
    id: string;
    link: string;
  };
}

export async function createMayarInvoice(payload: MayarInvoicePayload): Promise<MayarInvoiceResponse> {
  const body = {
    name: payload.name,
    amount: payload.amount,
    description: payload.description ?? `Order #${payload.orderId}`,
    redirectUrl: payload.redirectUrl ?? `${import.meta.env.PUBLIC_APP_URL}/dashboard/buyer/orders`,
    externalId: payload.orderId,
  };

  const res = await fetch(`${MAYAR_API_URL}/invoice/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

export function verifyMayarSignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', MAYAR_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
