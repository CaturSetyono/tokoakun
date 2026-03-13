import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { getCurrentUser } from '../../lib/auth';
import { createMayarInvoice } from '../../lib/mayar';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { accountId } = await request.json() as { accountId?: string };

    if (!accountId) {
      return new Response(JSON.stringify({ error: 'accountId wajib diisi' }), { status: 400 });
    }

    // 1. Fetch account
    const { data: account, error: accError } = await supabaseAdmin
      .from('accounts')
      .select('id, price, title, status')
      .eq('id', accountId)
      .single();

    if (accError || !account) {
       return new Response(JSON.stringify({ error: 'Akun tidak ditemukan' }), { status: 404 });
    }

    if (account.status !== 'available') {
       return new Response(JSON.stringify({ error: 'Akun sudah tidak tersedia' }), { status: 409 });
    }

    // 2. Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id: user.id,
        status: 'pending',
        total_price: account.price
      })
      .select()
      .single();

    if (orderError) {
       return new Response(JSON.stringify({ error: 'Gagal membuat order' }), { status: 500 });
    }

    // 3. Create order item
    await supabaseAdmin
      .from('order_items')
      .insert({
        order_id: order.id,
        account_id: account.id,
        price: account.price
      });

    // 4. Create Mayar invoice
    const invoice = await createMayarInvoice({
      name: user.name || 'Pembeli',
      amount: account.price,
      orderId: order.id,
      description: `TokoAkun Order #${order.id.slice(0, 8)} - ${account.title}`,
    });

    // 5. Update order with Mayar details
    await supabaseAdmin
      .from('orders')
      .update({
        mayar_payment_url: invoice.data.link,
        mayar_invoice_id: invoice.data.id,
      })
      .eq('id', order.id);

    return new Response(JSON.stringify({ paymentUrl: invoice.data.link }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
