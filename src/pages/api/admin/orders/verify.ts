import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/auth";
import { sendOrderEmail } from "../../../../lib/order-email";

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = await requireAdmin(request);

    const { orderId } = (await request.json()) as { orderId?: string };
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
      });
    }

    // Ambil detail order + buyer + akun-akun di dalamnya
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
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
      `,
      )
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
      });
    }

    if (order.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Order already marked as paid" }),
        { status: 400 },
      );
    }

    // Update status order menjadi paid
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id);

    if (orderUpdateError) {
      return new Response(JSON.stringify({ error: orderUpdateError.message }), {
        status: 500,
      });
    }

    // Tandai semua akun di order sebagai sold
    const items = (order as any).order_items ?? [];
    for (const item of items) {
      const acc = item.accounts;
      if (!acc) continue;

      const { error: accountError } = await supabaseAdmin
        .from("accounts")
        .update({
          status: "sold",
          buyer_id: order.buyer_id,
          sold_at: new Date().toISOString(),
        })
        .eq("id", acc.id)
        .eq("status", "available");

      if (accountError) {
        console.error(`Gagal update akun ${acc.id}: ${accountError.message}`);
      }
    }

    // Kirim email lewat Apps Script (jangan gagalkan order jika email gagal)
    const emailResult = await sendOrderEmail(order.id);

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: emailResult.success,
        emailError: emailResult.error ?? null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};
