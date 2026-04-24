import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import type { ProductNiche } from "../../../../lib/database.types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);

    const body = (await request.json().catch(() => null)) as {
      niche?: ProductNiche;
      title?: string;
      slug?: string;
      description?: string;
      thumbnailUrl?: string;
      status?: "draft" | "active" | "archived";
      featured?: boolean;
      meta?: Record<string, unknown>;
      requirements?: {
        fieldKey: string;
        label: string;
        fieldType: "text" | "url" | "textarea";
        required: boolean;
        placeholder?: string;
      }[];
    } | null;

    if (!body?.title || !body?.niche) {
      return json({ error: "title dan niche wajib diisi" }, 400);
    }

    if (!["social_media", "premium_apps", "jasa"].includes(body.niche)) {
      return json({ error: "niche tidak valid" }, 400);
    }

    const baseSlug = slugify(body.slug ?? body.title);
    if (!baseSlug) return json({ error: "slug/judul tidak valid" }, 400);

    // resolve unique slug
    let slug = baseSlug;
    let n = 2;
    while (true) {
      const { data } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data) break;
      slug = `${baseSlug}-${n++}`;
      if (n > 20) break;
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .insert({
        niche: body.niche,
        slug,
        title: body.title.trim().slice(0, 180),
        description: body.description?.trim() || null,
        thumbnail_url: body.thumbnailUrl?.trim() || null,
        status: body.status ?? "draft",
        featured: !!body.featured,
        meta: body.meta ?? {},
      })
      .select("id, slug")
      .single();

    if (error || !product) {
      return json({ error: error?.message ?? "Insert gagal" }, 500);
    }

    // seed requirements
    const seeded =
      body.requirements && body.requirements.length > 0
        ? body.requirements
        : defaultRequirementsFor(body.niche);

    if (seeded.length > 0) {
      await supabaseAdmin.from("product_requirements").insert(
        seeded.map((r, idx) => ({
          product_id: product.id,
          field_key: r.fieldKey,
          label: r.label,
          field_type: r.fieldType,
          required: r.required,
          placeholder: r.placeholder ?? null,
          sort_order: idx,
        })),
      );
    }

    return json({ success: true, id: product.id, slug: product.slug });
  } catch (err: any) {
    const msg = err?.message ?? "Internal error";
    return json(
      { error: msg },
      msg === "Unauthorized" ? 401 : msg.includes("Forbidden") ? 403 : 500,
    );
  }
};

function defaultRequirementsFor(niche: ProductNiche) {
  if (niche === "social_media") {
    return [
      {
        fieldKey: "target_url",
        label: "Link Akun / URL Tujuan",
        fieldType: "url" as const,
        required: true,
        placeholder: "https://instagram.com/username",
      },
    ];
  }
  if (niche === "jasa") {
    return [
      {
        fieldKey: "brief",
        label: "Brief / Kebutuhan",
        fieldType: "textarea" as const,
        required: true,
        placeholder: "Jelaskan detail kebutuhan project...",
      },
    ];
  }
  return [];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
