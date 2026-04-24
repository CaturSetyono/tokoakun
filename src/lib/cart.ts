import { supabaseAdmin } from "./supabaseAdmin";
import type { Database } from "./database.types";

type RequirementRow = Database["public"]["Tables"]["product_requirements"]["Row"];

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBuyerInput(
  requirements: Pick<
    RequirementRow,
    "field_key" | "label" | "field_type" | "required"
  >[],
  input: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const req of requirements) {
    const rawValue = input?.[req.field_key];
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;

    if (value === undefined || value === null || value === "") {
      if (req.required) {
        errors.push({
          field: req.field_key,
          message: `${req.label} wajib diisi`,
        });
      }
      continue;
    }

    if (typeof value !== "string") {
      errors.push({
        field: req.field_key,
        message: `${req.label} harus berupa teks`,
      });
      continue;
    }

    if (req.field_type === "url") {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push({
            field: req.field_key,
            message: `${req.label} harus berupa URL http/https yang valid`,
          });
        }
      } catch {
        errors.push({
          field: req.field_key,
          message: `${req.label} bukan URL yang valid`,
        });
      }
    }

    if (value.length > 2000) {
      errors.push({
        field: req.field_key,
        message: `${req.label} terlalu panjang (maks 2000 karakter)`,
      });
    }
  }

  return errors;
}

export async function loadProductRequirements(productId: string) {
  const { data, error } = await supabaseAdmin
    .from("product_requirements")
    .select("field_key, label, field_type, required, placeholder, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCartCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

export function idrFormat(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

export const NICHE_LABEL: Record<string, string> = {
  social_media: "Social Media Solution",
  premium_apps: "Premium Apps",
  jasa: "Jasa",
};

export const NICHE_SLUG: Record<string, string> = {
  social_media: "social-media",
  premium_apps: "premium-apps",
  jasa: "jasa",
};

export const NICHE_BY_SLUG: Record<string, "social_media" | "premium_apps" | "jasa"> = {
  "social-media": "social_media",
  "premium-apps": "premium_apps",
  jasa: "jasa",
};
