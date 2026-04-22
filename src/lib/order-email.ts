import { supabaseAdmin } from "./supabaseAdmin";

interface SendOrderEmailResult {
  success: boolean;
  error?: string;
}

export async function sendOrderEmail(
  orderId: string,
): Promise<SendOrderEmailResult> {
  const webhookUrl = import.meta.env.APPSCRIPT_WEBHOOK_URL as
    | string
    | undefined;

  if (!webhookUrl) {
    console.error("APPSCRIPT_WEBHOOK_URL is not set");
    return {
      success: false,
      error: "Webhook URL not configured",
    };
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      total_price,
      status,
      buyer_id,
      users!buyer_id(name, email),
      order_items(
        id,
        price,
        accounts(id, title, category, email_account, password_account, status)
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error || !order) 
  {
    console.error("Order not found when sending email:", error);
    return {
      success: false,
      error: "Order not found",
    };
  }

  const items = (order as any).order_items ?? [];

  const payload = {
    orderId: order.id,
    buyerEmail: (order as any).users?.email as string,
    buyerName: (order as any).users?.name as string,
    totalPrice: order.total_price,
    accounts: items
      .map((item: any) => item.accounts)
      .filter((acc: any) => !!acc)
      .map((acc: any) => ({
        title: acc.title,
        category: acc.category,
        email_account: acc.email_account,
        password_account: acc.password_account,
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
      return {
        success: false,
        error: `Apps Script responded with ${res.status}`,
      };
    }
  } catch (err: any) {
    console.error("Failed to call Apps Script webhook:", err?.message ?? err);
    return {
      success: false,
      error: err?.message ?? "Failed to call Apps Script webhook",
    };
  }

  return { success: true };
}
