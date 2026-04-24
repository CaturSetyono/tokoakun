import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../../lib/auth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

/**
 * Cancel an order item. If it reserved credentials (Premium Apps), release them.
 * If the last active item is cancelled, mark the order 'cancelled'.
 */
export const POST: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const { data: item, error } = await supabaseAdmin
      .from("order_items")
      .select("id, status, order_id, product_snapshot")
      .eq("id", id)
      .maybeSingle();

    if (error || !item) return json({ error: "Item tidak ditemukan" }, 404);
    if (item.status === "delivered" || item.status === "cancelled") {
      return json(
        { error: `Tidak bisa cancel item berstatus ${item.status}` },
        400,
      );
    }

    const niche = (item as any).product_snapshot?.niche;

    if (niche === "premium_apps") {
      await supabaseAdmin
        .from("product_credentials")
        .update({ status: "available", order_item_id: null })
        .eq("order_item_id", id);
    }

    await supabaseAdmin
      .from("order_items")
      .update({ status: "cancelled" })
      .eq("id", id);

    const { data: siblings } = await supabaseAdmin
      .from("order_items")
      .select("status")
      .eq("order_id", item.order_id);

    const allCancelled =
      siblings && siblings.every((s) => s.status === "cancelled");

    if (allCancelled) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", item.order_id);
    }

    return json({ success: true, orderCancelled: !!allCancelled });
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
