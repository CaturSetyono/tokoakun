import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../../lib/auth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendPremiumAppsEmail } from "../../../../../lib/order-email";

/**
 * Admin marks an order as paid after manual payment verification.
 *  - Premium Apps items → credential status → 'delivered', item → 'delivered', trigger email
 *  - SocMed/Jasa items  → item status → 'processing' (admin completes manually later)
 *  - Order itself → 'paid'
 */
export const POST: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const orderId = params.id as string;
    if (!orderId) return json({ error: "orderId required" }, 400);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, status, order_items(id, status, product_snapshot, variant_id)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) return json({ error: "Order tidak ditemukan" }, 404);
    if (order.status !== "pending") {
      return json({ error: `Order sudah berstatus ${order.status}` }, 400);
    }

    const items = (order as any).order_items as {
      id: string;
      status: string;
      variant_id: string;
      product_snapshot: any;
    }[];

    const emailResults: { itemId: string; success: boolean; error?: string }[] =
      [];
    let hasProcessing = false;

    for (const item of items) {
      const niche = item.product_snapshot?.niche;

      if (niche === "premium_apps") {
        const now = new Date().toISOString();

        await supabaseAdmin
          .from("product_credentials")
          .update({ status: "delivered", delivered_at: now })
          .eq("order_item_id", item.id);

        await supabaseAdmin
          .from("order_items")
          .update({ status: "delivered", delivered_at: now })
          .eq("id", item.id);

        const r = await sendPremiumAppsEmail(item.id);
        emailResults.push({ itemId: item.id, ...r });
      } else {
        hasProcessing = true;
        await supabaseAdmin
          .from("order_items")
          .update({ status: "processing" })
          .eq("id", item.id);
      }
    }

    // If ALL items were premium_apps → everything is already delivered → order is completed
    const { data: itemsAfter } = await supabaseAdmin
      .from("order_items")
      .select("status")
      .eq("order_id", orderId);

    const allDelivered =
      itemsAfter && itemsAfter.every((i) => i.status === "delivered");

    await supabaseAdmin
      .from("orders")
      .update({ status: allDelivered ? "completed" : "paid" })
      .eq("id", orderId);

    return json({
      success: true,
      orderStatus: allDelivered ? "completed" : "paid",
      hasProcessing,
      emails: emailResults,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    return json(
      { error: msg },
      msg === "Unauthorized" ? 401 : msg.includes("Forbidden") ? 403 : 500,
    );
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
