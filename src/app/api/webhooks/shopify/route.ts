import { NextRequest, NextResponse } from "next/server";

import { verifyShopifyWebhook, type ShopifyOrderPayload } from "@/lib/shopify-client";
import { importShopifyOrder } from "@/modules/orders/server/shopify-order.service";
import { db } from "@/lib/db";

// Shopify requires a 200 response within 5 seconds — we verify and process synchronously.
// For high-volume stores, move processing to a background queue (e.g., Railway cron job).
export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic");
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const rawBody = await req.text();

  // Verify HMAC signature — reject anything that doesn't match
  if (!verifyShopifyWebhook(rawBody, hmac)) {
    console.warn(`[shopify-webhook] HMAC verification failed for topic ${topic}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // We only handle orders/paid — ignore others without error so Shopify stops delivering them
  if (topic !== "orders/paid") {
    return NextResponse.json({ ok: true, skipped: topic });
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find a system actor to attribute the import to (use any admin user)
  const actor = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!actor) {
    console.error("[shopify-webhook] No users found in database — cannot import order.");
    return NextResponse.json({ error: "No system user found" }, { status: 500 });
  }

  try {
    const result = await importShopifyOrder(payload, actor.id);
    console.log(`[shopify-webhook] ${result.status} — Shopify order ${payload.name}`);
    return NextResponse.json(result);
  } catch (err) {
    // Log error but return 200 to prevent infinite Shopify retries for non-transient errors
    console.error(`[shopify-webhook] Import failed for order ${payload.name}:`, err);
    return NextResponse.json({ error: "Import failed — check server logs" }, { status: 500 });
  }
}
