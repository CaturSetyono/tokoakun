import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const { data: cred } = await supabaseAdmin
      .from("product_credentials")
      .select("id, variant_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!cred) return json({ error: "Credential tidak ditemukan" }, 404);

    if (cred.status !== "available") {
      return json(
        { error: `Tidak bisa hapus credential berstatus ${cred.status}` },
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from("product_credentials")
      .delete()
      .eq("id", id);
    if (error) return json({ error: error.message }, 500);

    const { count } = await supabaseAdmin
      .from("product_credentials")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", cred.variant_id)
      .eq("status", "available");

    await supabaseAdmin
      .from("product_variants")
      .update({ stock_cached: count ?? 0 })
      .eq("id", cred.variant_id);

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
