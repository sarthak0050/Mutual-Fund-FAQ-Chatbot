import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const sources = await sql`
      SELECT source_id, url, doc_type, scheme_id, date_accessed, source_last_updated
      FROM sources
      ORDER BY source_id
    `;
    return NextResponse.json(sources);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
