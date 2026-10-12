const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");

try {
  let schema = fs.readFileSync(schemaPath, "utf8");
  const dbUrl = process.env.DATABASE_URL || "";

  if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
    console.log("[Lomely Database Switcher] Detected PostgreSQL DATABASE_URL. Configured Prisma for PostgreSQL.");
  } else {
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    console.log("[Lomely Database Switcher] Configured Prisma for SQLite local development.");
  }

  fs.writeFileSync(schemaPath, schema);
} catch (err) {
  console.error("[Lomely Database Switcher] Error updating schema:", err);
}
