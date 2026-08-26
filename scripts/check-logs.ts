import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`SELECT log_id, intent_type, fact_type, scheme_id, resolved FROM query_logs ORDER BY log_id`;
  console.log("query_logs contents:");
  console.table(rows);
}
main();
