import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const body = (await request.json().catch(() => null)) as {
      name?: string;
      price?: number;
      sortOrder?: number;
      isUnlimitedStock?: boolean;
      status?: "active" | "archived";
      meta?: Record<string, unknown>;
    } | null;

    if (!body) return json({ error: "body required" }, 400);

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name.trim().slice(0, 120);
    if (body.price !== undefined)
      update.price = Math.max(0, Math.floor(Number(body.price)));
    if (body.sortOrder !== undefined)
      update.sort_order = Math.max(0, Math.floor(Number(body.sortOrder)));
    if (body.isUnlimitedStock !== undefined)
      update.is_unlimited_stock = !!body.isUnlimitedStock;
    if (body.status !== undefined) update.status = body.status;
    if (body.meta !== undefined) update.meta = body.meta ?? {};

    const { error } = await supabaseAdmin
      .from("product_variants")
      .update(update)
      .eq("id", id);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    return json(
      { error: msg },
      msg === "Unauthorized" ? 401 : msg.includes("Forbidden") ? 403 : 500,
    );
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    // Archive instead of deleting to preserve order_items integrity
    const { error } = await supabaseAdmin
      .from("product_variants")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
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
