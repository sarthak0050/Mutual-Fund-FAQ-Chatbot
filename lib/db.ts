import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Lazy, cached Neon client.
 *
 * Created on first use instead of at module scope so `next build` can compile
 * the routes without DATABASE_URL set (module-scope `neon()` throws during
 * page-data collection), and so a missing DATABASE_URL surfaces as one clear
 * error at request time instead of a build failure.
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Add it to .env.local (local) or Vercel "Environment Variables" (deploy).',
      );
    }
    client = neon(url);
  }
  return client;
}
