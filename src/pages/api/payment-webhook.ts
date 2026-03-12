import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { verifyMayarSignature } from '../../lib/mayar';

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-mayar-signature') ?? '';

    if (!verifyMayarSignature(rawBody, signature)) {
      return new Response(JSON.stringify({ error: 'Signature tidak valid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.parse(rawBody) as {
      status?: string;
      externalId?: string;
      id?: string;
    };

    if (payload.status !== 'paid') {
      // Non-paid events: acknowledge but take no action
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mayarInvoiceId: string = payload.id ?? '';
    const externalId: string = payload.externalId ?? '';

    // Find order by mayar_invoice_id or external id (order UUID)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, status, order_items(id, account_id)')
      .or(`mayar_invoice_id.eq.${mayarInvoiceId},id.eq.${externalId}`)
      .single();

    if (orderError || !order) {
      // Unknown order; return 200 to prevent Mayar retries
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (order.status === 'paid') {
      // Idempotent: already processed
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mark order as paid
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id);

    if (orderUpdateError) {
      throw new Error(`Gagal update order: ${orderUpdateError.message}`);
    }

    // Mark all accounts in order as sold
    const items = (order as any).order_items ?? [];
    for (const item of items) {
      const { error: accountError } = await supabase
        .from('accounts')
        .update({
          status: 'sold',
          buyer_id: order.buyer_id,
          sold_at: new Date().toISOString(),
        })
        .eq('id', item.account_id)
        .eq('status', 'available'); // Guard: only update if still available

      if (accountError) {
        // Log but don't fail — order is already paid
        console.error(`Gagal update akun ${item.account_id}: ${accountError.message}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
