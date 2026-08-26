import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Connecting to database...");
  await sql`SELECT 1`;
  console.log("Connected.\n");

  // Apply schema — split into individual statements
  console.log("Applying schema...");
  const schema = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log("Schema applied.\n");

  // Seed schemes
  console.log("Seeding schemes...");
  await sql`
    INSERT INTO schemes (scheme_id, name, amc, category, riskometer, benchmark, is_elss)
    VALUES
      ('top100', 'HDFC Top 100 Fund', 'HDFC Mutual Fund', 'large-cap', 'Moderately High', 'NIFTY 100 (Total Returns Index)', false),
      ('flexicap', 'HDFC Flexi Cap Fund', 'HDFC Mutual Fund', 'flexi-cap', 'Very High', 'NIFTY 500 (Total Returns Index)', false),
      ('elsstaxsaver', 'HDFC ELSS Tax Saver', 'HDFC Mutual Fund', 'ELSS', 'Very High', 'NIFTY 500 (Total Returns Index)', true),
      ('midcap', 'HDFC Mid-Cap Opportunities Fund', 'HDFC Mutual Fund', 'mid-cap', 'Very High', 'NIFTY Midcap 150 (Total Returns Index)', false)
    ON CONFLICT (scheme_id) DO NOTHING
  `;
  console.log("Schemes seeded.\n");

  // Show results
  const rows = await sql`SELECT * FROM schemes ORDER BY scheme_id`;
  console.log("Schemes in database:");
  console.table(rows);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
