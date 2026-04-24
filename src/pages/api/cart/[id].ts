import type { APIRoute } from "astro";
import { requireAuth } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { loadProductRequirements, validateBuyerInput } from "../../../lib/cart";

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireAuth(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const body = (await request.json().catch(() => null)) as {
      quantity?: number;
      buyerInput?: Record<string, unknown>;
    } | null;

    const { data: existing } = await supabaseAdmin
      .from("cart_items")
      .select(
        "id, user_id, quantity, buyer_input, variant_id, product_variants!inner(product_id)",
      )
      .eq("id", id)
      .maybeSingle();

    if (!existing || existing.user_id !== user.id) {
      return json({ error: "Item tidak ditemukan" }, 404);
    }

    const update: Record<string, unknown> = {};

    if (body?.quantity !== undefined) {
      const q = Math.max(1, Math.floor(Number(body.quantity)));
      update.quantity = q;
    }

    if (body?.buyerInput !== undefined) {
      const requirements = await loadProductRequirements(
        (existing as any).product_variants.product_id,
      );
      const errors = validateBuyerInput(requirements, body.buyerInput);
      if (errors.length > 0) {
        return json({ error: "Input tidak valid", fieldErrors: errors }, 400);
      }
      update.buyer_input = body.buyerInput;
    }

    if (Object.keys(update).length === 0) {
      return json({ success: true });
    }

    const { error: updErr } = await supabaseAdmin
      .from("cart_items")
      .update(update)
      .eq("id", id);
    if (updErr) return json({ error: updErr.message }, 500);
    return json({ success: true });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const user = await requireAuth(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const { data: existing } = await supabaseAdmin
      .from("cart_items")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing || existing.user_id !== user.id) {
      return json({ error: "Item tidak ditemukan" }, 404);
    }

    const { error } = await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
