import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    await requireAdmin(request);
    const id = params.id as string;
    if (!id) return json({ error: "id required" }, 400);

    const body = (await request.json().catch(() => null)) as {
      title?: string;
      description?: string;
      thumbnailUrl?: string | null;
      status?: "draft" | "active" | "archived";
      featured?: boolean;
      meta?: Record<string, unknown>;
    } | null;

    if (!body) return json({ error: "body required" }, 400);

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title.trim().slice(0, 180);
    if (body.description !== undefined)
      update.description = body.description?.trim() || null;
    if (body.thumbnailUrl !== undefined)
      update.thumbnail_url = body.thumbnailUrl?.trim() || null;
    if (body.status !== undefined) update.status = body.status;
    if (body.featured !== undefined) update.featured = !!body.featured;
    if (body.meta !== undefined) update.meta = body.meta ?? {};

    const { error } = await supabaseAdmin
      .from("products")
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

    // Soft-delete via status = 'archived' to avoid breaking historical order_items
    const { error } = await supabaseAdmin
      .from("products")
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
