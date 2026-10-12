const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");

try {
  let schema = fs.readFileSync(schemaPath, "utf8");
  const dbUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    "";

  if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
    console.log("[Lomely Database Switcher] Detected PostgreSQL DATABASE_URL. Configured Prisma for PostgreSQL.");
    fs.writeFileSync(schemaPath, schema);

    // If on Vercel deployment, automatically push schema to remote PostgreSQL database
    if (process.env.VERCEL === "1" || process.env.CI) {
      console.log("[Lomely Database Switcher] Running automated prisma db push on Vercel...");
      try {
        execSync("npx prisma db push --skip-generate --accept-data-loss", {
          stdio: "inherit",
          env: { ...process.env, DATABASE_URL: dbUrl },
        });
        console.log("[Lomely Database Switcher] Database schema synchronized successfully.");
      } catch (pushErr) {
        console.warn("[Lomely Database Switcher] Warning: prisma db push encountered an issue:", pushErr.message);
      }
    }
  } else {
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    console.log("[Lomely Database Switcher] Configured Prisma for SQLite local development.");
    fs.writeFileSync(schemaPath, schema);
  }
} catch (err) {
  console.error("[Lomely Database Switcher] Error updating schema:", err);
}
