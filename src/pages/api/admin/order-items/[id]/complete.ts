import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../../lib/auth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

/**
 * Admin completes a Social Media / Jasa order item manually.
 * If all items in the order become delivered → order auto-flips to 'completed'.
 */
export const POST: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const body = (await request.json().catch(() => ({}))) as {
      fulfillmentNote?: string;
    };

    const { data: item, error } = await supabaseAdmin
      .from("order_items")
      .select("id, status, order_id, product_snapshot")
      .eq("id", id)
      .maybeSingle();

    if (error || !item) return json({ error: "Item tidak ditemukan" }, 404);
    if (item.status !== "processing") {
      return json(
        { error: `Item harus berstatus 'processing' (sekarang: ${item.status})` },
        400,
      );
    }

    const niche = (item as any).product_snapshot?.niche;
    if (niche === "premium_apps") {
      return json(
        { error: "Gunakan Mark Paid untuk Premium Apps (auto-delivered)" },
        400,
      );
    }

    const note =
      typeof body?.fulfillmentNote === "string"
        ? body.fulfillmentNote.trim().slice(0, 2000)
        : null;

    const { error: updErr } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "delivered",
        fulfillment_note: note,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updErr) return json({ error: updErr.message }, 500);

    const { data: siblings } = await supabaseAdmin
      .from("order_items")
      .select("status")
      .eq("order_id", item.order_id);

    const allDelivered =
      siblings && siblings.every((s) => s.status === "delivered");

    if (allDelivered) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "completed" })
        .eq("id", item.order_id);
    }

    return json({ success: true, orderCompleted: !!allDelivered });
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
