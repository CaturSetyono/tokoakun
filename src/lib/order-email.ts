import { supabaseAdmin } from "./supabaseAdmin";

interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Deliver Premium Apps credentials for a single order_item via Apps Script webhook.
 * Social Media / Jasa items are fulfilled manually and should not call this.
 */
export async function sendPremiumAppsEmail(
  orderItemId: string,
): Promise<SendResult> {
  const webhookUrl = import.meta.env.APPSCRIPT_WEBHOOK_URL as
    | string
    | undefined;

  if (!webhookUrl) {
    console.error("APPSCRIPT_WEBHOOK_URL is not set");
    return { success: false, error: "Webhook URL not configured" };
  }

  const { data: item, error } = await supabaseAdmin
    .from("order_items")
    .select(
      `
        id,
        quantity,
        unit_price,
        line_total,
        product_snapshot,
        buyer_input,
        status,
        order_id,
        orders!inner(id, buyer_id, users!buyer_id(name, email))
      `,
    )
    .eq("id", orderItemId)
    .single();

  if (error || !item) {
    console.error("Order item not found when sending email:", error);
    return { success: false, error: "Order item not found" };
  }

  const snapshot = (item as any).product_snapshot ?? {};
  if (snapshot?.niche !== "premium_apps") {
    return {
      success: false,
      error: "Order item is not a Premium Apps niche — skipping email",
    };
  }

  const { data: credentials, error: credErr } = await supabaseAdmin
    .from("product_credentials")
    .select("email, password, extra_notes")
    .eq("order_item_id", item.id);

  if (credErr) {
    console.error("Failed to load credentials:", credErr);
    return { success: false, error: credErr.message };
  }

  const buyer = (item as any).orders?.users ?? {};
  const payload = {
    orderId: (item as any).order_id,
    orderItemId: item.id,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    productTitle: snapshot.product_title,
    variantName: snapshot.variant_name,
    quantity: item.quantity,
    lineTotal: item.line_total,
    credentials: (credentials ?? []).map((c) => ({
      email: c.email,
      password: c.password,
      extra_notes: c.extra_notes,
    })),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error("Apps Script error:", res.status, body);
      return { success: false, error: `Apps Script responded with ${res.status}` };
    }
  } catch (err: any) {
    console.error("Failed to call Apps Script webhook:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Webhook call failed" };
  }

  return { success: true };
}
