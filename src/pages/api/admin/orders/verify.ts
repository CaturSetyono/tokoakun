import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);

    const { orderId } = await request.json() as { orderId?: string };
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), { status: 400 });
    }

    // Ambil detail order + buyer + akun-akun di dalamnya
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        total_price,
        status,
        buyer_id,
        users!buyer_id(name, email),
        order_items(
          id,
          price,
          accounts(id, title, category, email_account, password_account, status)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    if (order.status === 'paid') {
      return new Response(JSON.stringify({ error: 'Order already marked as paid' }), { status: 400 });
    }

    // Update status order menjadi paid
    const { error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id);

    if (orderUpdateError) {
      return new Response(JSON.stringify({ error: orderUpdateError.message }), { status: 500 });
    }

    // Tandai semua akun di order sebagai sold
    const items = (order as any).order_items ?? [];
    for (const item of items) {
      const acc = item.accounts;
      if (!acc) continue;

      const { error: accountError } = await supabaseAdmin
        .from('accounts')
        .update({
          status: 'sold',
          buyer_id: order.buyer_id,
          sold_at: new Date().toISOString(),
        })
        .eq('id', acc.id)
        .eq('status', 'available');

      if (accountError) {
        console.error(`Gagal update akun ${acc.id}: ${accountError.message}`);
      }
    }

    // Panggil Apps Script untuk kirim email detail akun
    const webhookUrl = import.meta.env.APPSCRIPT_WEBHOOK_URL as string | undefined;
    if (!webhookUrl) {
      console.error('APPSCRIPT_WEBHOOK_URL is not set');
      return new Response(JSON.stringify({ error: 'Webhook URL not configured, but order marked as paid.' }), { status: 500 });
    }

    const payload = {
      orderId: order.id,
      buyerEmail: (order as any).users?.email as string,
      buyerName: (order as any).users?.name as string,
      totalPrice: order.total_price,
      accounts: items
        .map((item: any) => item.accounts)
        .filter((acc: any) => !!acc)
        .map((acc: any) => ({
          title: acc.title,
          category: acc.category,
          email_account: acc.email_account,
          password_account: acc.password_account,
        })),
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.text();
      if (!res.ok) {
        console.error('Apps Script error:', res.status, body);
        return new Response(JSON.stringify({ error: 'Order paid, but failed to trigger email webhook.' }), { status: 500 });
      }
    } catch (err: any) {
      console.error('Failed to call Apps Script webhook:', err?.message ?? err);
      return new Response(JSON.stringify({ error: 'Order paid, but failed to trigger email webhook.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
