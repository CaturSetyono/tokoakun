import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as {
      productId?: string;
      name?: string;
      price?: number;
      sortOrder?: number;
      isUnlimitedStock?: boolean;
      status?: "active" | "archived";
      meta?: Record<string, unknown>;
    } | null;

    if (!body?.productId || !body?.name || body.price === undefined) {
      return json({ error: "productId, name, price wajib diisi" }, 400);
    }

    const price = Math.max(0, Math.floor(Number(body.price)));

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, niche")
      .eq("id", body.productId)
      .maybeSingle();
    if (!product) return json({ error: "Produk tidak ditemukan" }, 404);

    const isUnlimited =
      body.isUnlimitedStock ?? product.niche !== "premium_apps";

    const { data, error } = await supabaseAdmin
      .from("product_variants")
      .insert({
        product_id: body.productId,
        name: body.name.trim().slice(0, 120),
        price,
        sort_order: Math.max(0, Math.floor(Number(body.sortOrder ?? 0))),
        is_unlimited_stock: isUnlimited,
        status: body.status ?? "active",
        meta: body.meta ?? {},
      })
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, id: data.id });
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
