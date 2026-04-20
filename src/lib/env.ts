import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SEED_INCLUDE_DEMO: z
    .string()
    .optional()
    .transform((value) => value === "1"),
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2026-04"),
  SHOPIFY_PAYMENT_FEE_RATE: z.coerce.number().min(0).max(1).default(0.024),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    APP_URL: process.env.APP_URL ?? "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV ?? "development",
    SEED_INCLUDE_DEMO: process.env.SEED_INCLUDE_DEMO,
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION ?? "2026-04",
    SHOPIFY_PAYMENT_FEE_RATE: process.env.SHOPIFY_PAYMENT_FEE_RATE,
  });

  return cachedEnv;
}

export function hasShopifyConnectionEnv() {
  const env = getEnv();

  if (!env.SHOPIFY_STORE_DOMAIN) {
    return false;
  }

  return Boolean(
    env.SHOPIFY_ACCESS_TOKEN ||
      (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET),
  );
}

export function requireShopifyEnv() {
  const env = getEnv();

  if (!env.SHOPIFY_STORE_DOMAIN) {
    throw new Error("SHOPIFY_STORE_DOMAIN must be set.");
  }

  const canUsePermanentToken = Boolean(env.SHOPIFY_ACCESS_TOKEN);
  const canExchangeShortLivedToken = Boolean(
    env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET,
  );

  if (!canUsePermanentToken && !canExchangeShortLivedToken) {
    throw new Error(
      "Set SHOPIFY_ACCESS_TOKEN or provide both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.",
    );
  }

  return {
    storeDomain: env.SHOPIFY_STORE_DOMAIN,
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
    accessToken: env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: env.SHOPIFY_API_VERSION,
    paymentFeeRate: env.SHOPIFY_PAYMENT_FEE_RATE,
  };
}
