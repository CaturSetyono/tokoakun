import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../../lib/auth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const admin = await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const body = (await request.json().catch(() => null)) as {
      status?: "approved" | "rejected";
      adminNote?: string;
    } | null;

    if (!body || (body.status !== "approved" && body.status !== "rejected")) {
      return json(
        { error: "status must be 'approved' or 'rejected'" },
        400,
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("reseller_applications")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return json({ error: "Aplikasi tidak ditemukan" }, 404);
    if (existing.status !== "pending") {
      return json({ error: `Sudah direview (${existing.status})` }, 400);
    }

    const note =
      typeof body.adminNote === "string"
        ? body.adminNote.trim().slice(0, 2000)
        : null;

    const { error } = await supabaseAdmin
      .from("reseller_applications")
      .update({
        status: body.status,
        admin_note: note,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
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
