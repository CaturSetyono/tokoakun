import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const RATE_WINDOW_MIN = 60;
const RATE_MAX_PER_WINDOW = 5;

/**
 * Public reseller application endpoint.
 * Basic rate-limit: max N submissions per hour per (IP, email).
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      fullName?: string;
      email?: string;
      phone?: string;
      city?: string;
      experience?: string;
      motivation?: string;
    } | null;

    if (!body) return json({ error: "Body required" }, 400);

    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim();

    if (!fullName || !email || !phone) {
      return json(
        { error: "Nama lengkap, email, dan nomor telepon wajib diisi" },
        400,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Format email tidak valid" }, 400);
    }

    if (fullName.length > 120 || email.length > 120 || phone.length > 40) {
      return json({ error: "Input terlalu panjang" }, 400);
    }

    const since = new Date(
      Date.now() - RATE_WINDOW_MIN * 60 * 1000,
    ).toISOString();

    const { count } = await supabaseAdmin
      .from("reseller_applications")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_MAX_PER_WINDOW) {
      return json(
        {
          error:
            "Terlalu banyak pendaftaran dari email ini. Coba lagi nanti atau hubungi admin.",
        },
        429,
      );
    }

    const { data, error } = await supabaseAdmin
      .from("reseller_applications")
      .insert({
        full_name: fullName.slice(0, 120),
        email: email.slice(0, 120),
        phone: phone.slice(0, 40),
        city: body.city?.trim().slice(0, 80) || null,
        experience: body.experience?.trim().slice(0, 2000) || null,
        motivation: body.motivation?.trim().slice(0, 2000) || null,
      })
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, id: data.id });
  } catch (err: any) {
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
