import { createHmac, timingSafeEqual } from "crypto";

import { requireShopifyEnv } from "@/lib/env";

// ---------------------------------------------------------------------------
// Token management
//
// Custom Shopify apps (Settings > Apps > Develop apps) issue a permanent
// Admin API token (shpat_xxx). Partner apps can use client_credentials.
// We prefer the permanent token (SHOPIFY_ACCESS_TOKEN) and fall back to
// the client_credentials flow if only client_id/secret are provided.
// ---------------------------------------------------------------------------

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export async function getShopifyAccessToken(): Promise<string> {
  const { storeDomain, clientId, clientSecret } = requireShopifyEnv();
  const permanentToken = process.env.SHOPIFY_ACCESS_TOKEN;

  // Prefer permanent token (no expiry management needed)
  if (permanentToken) {
    return permanentToken;
  }

  // Fall back to client_credentials flow (24h token, auto-refresh)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 82_800) * 1000,
  };
  return tokenCache.token;
}

export async function shopifyAdminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getShopifyAccessToken();
  const { storeDomain } = requireShopifyEnv();

  const res = await fetch(`https://${storeDomain}/admin/api/2026-04/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

// Shopify signs webhook payloads with HMAC-SHA256 using the client_secret
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;

  const { clientSecret } = requireShopifyEnv();
  const digest = createHmac("sha256", clientSecret).update(rawBody, "utf8").digest("base64");

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export type ShopifyOrderPayload = {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  currency: string;
  subtotal_price: string;
  total_tax: string;
  total_price: string;
  total_discounts: string;
  payment_gateway_names: string[];
  customer: {
    id: number;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    price: string;
    total_discount: string;
    tax_lines: Array<{ price: string; rate: number; title: string }>;
  }>;
  shipping_lines: Array<{
    title: string;
    price: string;
  }>;
  shipping_address: {
    city: string | null;
    country: string | null;
    phone: string | null;
  } | null;
};
