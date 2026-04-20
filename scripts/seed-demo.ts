import "dotenv/config";

process.env.SEED_INCLUDE_DEMO = "1";

await import("../prisma/seed");
