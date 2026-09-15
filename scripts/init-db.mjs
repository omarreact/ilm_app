import fs from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const migration = await fs.readFile(new URL("../sql/001_init.sql", import.meta.url), "utf8");

try {
  await sql.unsafe(migration);
  console.log("Database initialized.");
} finally {
  await sql.end();
}
