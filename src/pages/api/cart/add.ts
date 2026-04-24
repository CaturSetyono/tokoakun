import type { APIRoute } from "astro";
import { requireAuth } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { loadProductRequirements, validateBuyerInput } from "../../../lib/cart";

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    const body = (await request.json().catch(() => null)) as {
      variantId?: string;
      quantity?: number;
      buyerInput?: Record<string, unknown>;
    } | null;

    if (!body?.variantId) {
      return json({ error: "variantId is required" }, 400);
    }

    const quantity = Math.max(1, Math.floor(Number(body.quantity ?? 1)));
    const buyerInput = body.buyerInput ?? {};

    const { data: variant, error: vErr } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id, status, products!inner(id, status, niche)")
      .eq("id", body.variantId)
      .maybeSingle();

    if (vErr || !variant) {
      return json({ error: "Variant tidak ditemukan" }, 404);
    }
    if (variant.status !== "active") {
      return json({ error: "Variant sudah tidak tersedia" }, 400);
    }
    if ((variant as any).products.status !== "active") {
      return json({ error: "Produk tidak aktif" }, 400);
    }

    const requirements = await loadProductRequirements(
      (variant as any).products.id,
    );
    const errors = validateBuyerInput(requirements, buyerInput);
    if (errors.length > 0) {
      return json({ error: "Input tidak valid", fieldErrors: errors }, 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("cart_items")
      .select("id, quantity, buyer_input")
      .eq("user_id", user.id)
      .eq("variant_id", variant.id)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabaseAdmin
        .from("cart_items")
        .update({
          quantity: existing.quantity + quantity,
          buyer_input: buyerInput,
        })
        .eq("id", existing.id);
      if (updErr) return json({ error: updErr.message }, 500);
      return json({ success: true, cartItemId: existing.id });
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("cart_items")
      .insert({
        user_id: user.id,
        variant_id: variant.id,
        quantity,
        buyer_input: buyerInput,
      })
      .select("id")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);
    return json({ success: true, cartItemId: inserted.id });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return json({ error: msg }, status);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
