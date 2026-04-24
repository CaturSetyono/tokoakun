import type { APIRoute } from "astro";
import { requireAuth } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  loadProductRequirements,
  validateBuyerInput,
} from "../../lib/cart";
import type { ProductSnapshot } from "../../lib/database.types";

/**
 * Checkout flow:
 *   1. Load cart + variants + products + requirements
 *   2. Re-validate buyer input & stock
 *   3. Premium Apps → reserve credentials via reserve_credentials() RPC
 *      (FOR UPDATE SKIP LOCKED). Abort + release if stock insufficient.
 *   4. Insert orders (pending) + order_items with frozen product_snapshot
 *   5. Update product_credentials.order_item_id on reserved rows
 *   6. Clear cart rows
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    const body = (await request.json().catch(() => ({}))) as {
      buyerNote?: string;
    };
    const buyerNote =
      typeof body?.buyerNote === "string" && body.buyerNote.trim()
        ? body.buyerNote.trim().slice(0, 1000)
        : null;

    const { data: cartRows, error: cartErr } = await supabaseAdmin
      .from("cart_items")
      .select(
        `
          id, quantity, buyer_input, variant_id,
          product_variants!inner(
            id, name, price, status, is_unlimited_stock,
            products!inner(id, slug, title, niche, status, thumbnail_url, meta)
          )
        `,
      )
      .eq("user_id", user.id);

    if (cartErr) return json({ error: cartErr.message }, 500);
    if (!cartRows || cartRows.length === 0) {
      return json({ error: "Keranjang kosong" }, 400);
    }

    // ─── validate each line ────────────────────────
    const lines: {
      cartId: string;
      variantId: string;
      productId: string;
      niche: string;
      snapshot: ProductSnapshot;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      buyerInput: Record<string, unknown>;
      isUnlimited: boolean;
    }[] = [];

    for (const row of cartRows as any[]) {
      const variant = row.product_variants;
      const product = variant?.products;

      if (
        !variant ||
        !product ||
        variant.status !== "active" ||
        product.status !== "active"
      ) {
        return json(
          {
            error: `Produk "${product?.title ?? "tidak diketahui"}" sudah tidak tersedia`,
          },
          400,
        );
      }

      const requirements = await loadProductRequirements(product.id);
      const errors = validateBuyerInput(requirements, row.buyer_input ?? {});
      if (errors.length > 0) {
        return json(
          {
            error: `Lengkapi data pada "${product.title}" (${variant.name})`,
            fieldErrors: errors,
            cartItemId: row.id,
          },
          400,
        );
      }

      const unitPrice = Number(variant.price);
      const quantity = Number(row.quantity);
      const lineTotal = unitPrice * quantity;

      lines.push({
        cartId: row.id,
        variantId: variant.id,
        productId: product.id,
        niche: product.niche,
        snapshot: {
          product_id: product.id,
          product_title: product.title,
          product_slug: product.slug,
          niche: product.niche,
          variant_id: variant.id,
          variant_name: variant.name,
          unit_price: unitPrice,
          thumbnail_url: product.thumbnail_url ?? null,
          meta: product.meta ?? {},
        },
        unitPrice,
        quantity,
        lineTotal,
        buyerInput: row.buyer_input ?? {},
        isUnlimited: Boolean(variant.is_unlimited_stock),
      });
    }

    const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    // ─── reserve credentials for Premium Apps lines ───
    type Reservation = { lineIndex: number; credentialIds: string[] };
    const reservations: Reservation[] = [];
    const releaseAll = async () => {
      const ids = reservations.flatMap((r) => r.credentialIds);
      if (ids.length === 0) return;
      await supabaseAdmin
        .from("product_credentials")
        .update({ status: "available", order_item_id: null })
        .in("id", ids);
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.niche !== "premium_apps") continue;

      const { data: reservedIds, error: rpcErr } = await supabaseAdmin.rpc(
        "reserve_credentials",
        { p_variant_id: line.variantId, p_needed: line.quantity },
      );

      if (rpcErr) {
        await releaseAll();
        return json({ error: `Gagal reserve: ${rpcErr.message}` }, 500);
      }

      const ids = (reservedIds as string[] | null) ?? [];
      if (ids.length < line.quantity) {
        if (ids.length > 0) {
          reservations.push({ lineIndex: i, credentialIds: ids });
        }
        await releaseAll();
        return json(
          {
            error: `Stok tidak cukup untuk "${line.snapshot.product_title}" (${line.snapshot.variant_name}). Tersedia: ${ids.length}, dibutuhkan: ${line.quantity}`,
          },
          409,
        );
      }

      reservations.push({ lineIndex: i, credentialIds: ids });
    }

    // ─── insert order ───────────────────────────────
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: user.id,
        total_price: total,
        buyer_note: buyerNote,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      await releaseAll();
      return json({ error: orderErr?.message ?? "Gagal membuat order" }, 500);
    }

    // ─── insert order_items ─────────────────────────
    const itemRows = lines.map((line) => ({
      order_id: order.id,
      variant_id: line.variantId,
      product_snapshot: line.snapshot,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
      buyer_input: line.buyerInput,
      status: "pending" as const,
    }));

    const { data: insertedItems, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(itemRows)
      .select("id, variant_id");

    if (itemsErr || !insertedItems) {
      await releaseAll();
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      return json(
        { error: itemsErr?.message ?? "Gagal membuat order items" },
        500,
      );
    }

    // ─── link reserved credentials to their order_items ───
    for (const res of reservations) {
      const line = lines[res.lineIndex];
      const item = insertedItems.find((it) => it.variant_id === line.variantId);
      if (!item) continue;
      await supabaseAdmin
        .from("product_credentials")
        .update({ order_item_id: item.id })
        .in("id", res.credentialIds);
    }

    // ─── clear cart ────────────────────────────────
    await supabaseAdmin.from("cart_items").delete().eq("user_id", user.id);

    return json({ success: true, orderId: order.id });
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
