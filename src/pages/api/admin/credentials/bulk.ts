import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

/**
 * Bulk-add credentials for a Premium Apps variant.
 * Accepts `lines`: array of "email:password" strings OR {email,password,extra_notes} objects.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const body = (await request.json().catch(() => null)) as {
      variantId?: string;
      lines?: (string | { email: string; password: string; extra_notes?: string })[];
    } | null;

    if (!body?.variantId || !Array.isArray(body.lines) || body.lines.length === 0) {
      return json({ error: "variantId dan lines wajib" }, 400);
    }

    const { data: variant } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id, products!inner(niche)")
      .eq("id", body.variantId)
      .maybeSingle();

    if (!variant) return json({ error: "Variant tidak ditemukan" }, 404);
    if ((variant as any).products.niche !== "premium_apps") {
      return json(
        { error: "Credentials hanya untuk niche Premium Apps" },
        400,
      );
    }

    const rows: {
      variant_id: string;
      email: string;
      password: string;
      extra_notes: string | null;
    }[] = [];

    for (const line of body.lines) {
      if (typeof line === "string") {
        const sep = line.indexOf(":");
        if (sep <= 0) continue;
        const email = line.slice(0, sep).trim();
        const password = line.slice(sep + 1).trim();
        if (email && password) {
          rows.push({
            variant_id: variant.id,
            email,
            password,
            extra_notes: null,
          });
        }
      } else if (line?.email && line?.password) {
        rows.push({
          variant_id: variant.id,
          email: line.email.trim(),
          password: line.password.trim(),
          extra_notes: line.extra_notes?.trim() || null,
        });
      }
    }

    if (rows.length === 0) {
      return json({ error: "Tidak ada baris valid (format email:password)" }, 400);
    }

    const { error: insErr } = await supabaseAdmin
      .from("product_credentials")
      .insert(rows);

    if (insErr) return json({ error: insErr.message }, 500);

    // update stock_cached
    const { count } = await supabaseAdmin
      .from("product_credentials")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variant.id)
      .eq("status", "available");

    await supabaseAdmin
      .from("product_variants")
      .update({ stock_cached: count ?? 0 })
      .eq("id", variant.id);

    return json({ success: true, inserted: rows.length, stock: count ?? 0 });
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
