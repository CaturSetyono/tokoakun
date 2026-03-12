import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { createMayarInvoice } from '../../lib/mayar';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { orderId?: string };
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return new Response(JSON.stringify({ error: 'orderId wajib diisi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, buyer_id, status,
        order_items(
          id, account_id,
          accounts(id, price, title, status)
        ),
        users!buyer_id(name, email)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order tidak ditemukan' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Order sudah diproses' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate all accounts are still available
    const items = (order as any).order_items ?? [];
    for (const item of items) {
      if (item.accounts?.status !== 'available') {
        return new Response(JSON.stringify({ error: `Akun "${item.accounts?.title}" sudah tidak tersedia` }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Calculate total
    const total: number = items.reduce((sum: number, item: any) => sum + (item.accounts?.price ?? 0), 0);

    // Update order_items price and total_price
    for (const item of items) {
      await supabase
        .from('order_items')
        .update({ price: item.accounts?.price ?? 0 })
        .eq('id', item.id);
    }

    await supabase.from('orders').update({ total_price: total }).eq('id', orderId);

    // Create Mayar invoice
    const buyer = (order as any).users;
    const invoice = await createMayarInvoice({
      name: buyer?.name ?? 'Pembeli',
      amount: total,
      orderId,
      description: `TokoAkun Order #${orderId.slice(0, 8)}`,
    });

    // Save payment URL to order
    await supabase
      .from('orders')
      .update({
        mayar_payment_url: invoice.data.link,
        mayar_invoice_id: invoice.data.id,
      })
      .eq('id', orderId);

    return new Response(JSON.stringify({ paymentUrl: invoice.data.link }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
