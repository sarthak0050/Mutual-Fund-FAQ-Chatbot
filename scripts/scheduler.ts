/**
 * scheduler — weekly source-health check for the MF-Facts ingestion pipeline.
 *
 * data/source_list.csv lists every official source (URL, doc type, scheme,
 * fact type) that `npm run ingest` turns into embedded chunks. Fund factsheets
 * and scheme pages change over time, and a source that silently starts
 * returning an error page would poison the RAG index. This job watches the
 * sources so that drift is noticed before the chatbot starts answering from
 * stale facts.
 *
 * It is deliberately credential-free: it only fetches the public source URLs.
 * Re-ingesting (npm run ingest) needs DATABASE_URL and GEMINI_API_KEY, so this
 * job *reports* that a re-ingest is due and leaves that step to a human or to
 * the opt-in CI input.
 *
 * Modes:
 *   check      Report only. Exit 2 if a source is unreachable or a PDF changed.
 *   once       Report, then write data/source_status.json + docs/source-health.md.
 *   daemon     Loop every --interval-minutes running the `once` logic.
 *
 * Exit codes:
 *   0   healthy (or artifacts written)
 *   1   failed (bad arguments, unreadable source list, or write error)
 *   2   check mode: a source is unreachable, or a document changed
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIVE_URL = 'https://mutual-fund-faq-chatbot-gold.vercel.app';
const APP_MARKER = 'MF-Facts';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) mf-facts-scheduler/1.0';
const REQUEST_TIMEOUT_MS = 45_000;

// Resolve paths from the working directory rather than __dirname, so the
// script runs under tsx, plain `node`, and from a subdirectory.
let cachedRoot: string | null = null;

function repoRoot(): string {
  if (cachedRoot) return cachedRoot;
  for (const dir of [process.cwd(), resolve(process.cwd(), '..')]) {
    if (existsSync(resolve(dir, 'data/source_list.csv'))) {
      cachedRoot = dir;
      return dir;
    }
  }
  throw new Error(
    'Could not locate the repository root (expected data/source_list.csv). Run this from the repository root.',
  );
}

const sourceListPath = () => resolve(repoRoot(), 'data/source_list.csv');
const statusPath = () => resolve(repoRoot(), 'data/source_status.json');
const docPath = () => resolve(repoRoot(), 'docs/source-health.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceRow {
  url: string;
  doc_type: string;
  scheme_id: string;
  fact_type: string;
  date_accessed: string;
}

type Change = 'new' | 'unchanged' | 'changed' | 'unreachable';

interface SourceResult {
  url: string;
  docType: string;
  status: number | null;
  ok: boolean;
  bytes: number;
  lastModified: string | null;
  elapsedMs: number;
  digest: string | null;
  digestKind: 'bytes' | 'normalized';
  change: Change;
  error: string | null;
}

interface Options {
  mode: 'check' | 'once' | 'daemon';
  maxAgeDays: number;
  intervalMinutes: number;
  noHttp: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  console.log(`[scheduler] ${message}`);
}

/** Minimal CSV parser (handles quoted fields; the source list has none, but be safe). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function readSourceList(): SourceRow[] {
  const rows = parseCsv(readFileSync(sourceListPath(), 'utf8'));
  const [header, ...body] = rows;
  if (!header) {
    throw new Error('data/source_list.csv is empty');
  }
  return body.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name.trim()] = (cells[index] ?? '').trim();
    });
    return record as unknown as SourceRow;
  });
}

function daysSince(isoDate: string): number | null {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86_400_000);
}

/**
 * HTML pages embed CSRF tokens, cache-busters and timestamps, so a raw byte
 * hash changes on nearly every fetch. Hashing a whitespace- and
 * long-digits-normalized copy keeps the signal (real content edits) and drops
 * the noise (rotating tokens). PDFs are stable documents, so they are hashed
 * as raw bytes.
 */
function normalizeHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\d{7,}/g, '#')
    .trim();
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function probe(
  url: string,
  docType: string,
  previous: Record<string, { digest: string | null }>,
): Promise<SourceResult> {
  const started = Date.now();
  const base: SourceResult = {
    url,
    docType,
    status: null,
    ok: false,
    bytes: 0,
    lastModified: null,
    elapsedMs: 0,
    digest: null,
    digestKind: docType === 'pdf' ? 'bytes' : 'normalized',
    change: 'unreachable',
    error: null,
  };

  try {
    const response = await fetchWithTimeout(url);
    const isPdf = docType === 'pdf' || url.toLowerCase().endsWith('.pdf');
    let digest: string;
    let bytes: number;

    if (isPdf) {
      const buffer = Buffer.from(await response.arrayBuffer());
      bytes = buffer.length;
      digest = sha256(buffer);
    } else {
      const text = await response.text();
      bytes = Buffer.byteLength(text);
      digest = sha256(normalizeHtml(text));
    }

    const prior = previous[url];
    const change: Change = !response.ok
      ? 'unreachable'
      : !prior || !prior.digest
        ? 'new'
        : prior.digest === digest
          ? 'unchanged'
          : 'changed';

    return {
      ...base,
      status: response.status,
      ok: response.ok,
      bytes,
      lastModified: response.headers.get('last-modified'),
      elapsedMs: Date.now() - started,
      digest,
      change,
    };
  } catch (error) {
    return {
      ...base,
      elapsedMs: Date.now() - started,
      error: (error as Error).message,
    };
  }
}

function readPreviousStatus(): Record<string, { digest: string | null }> {
  try {
    const parsed = JSON.parse(readFileSync(statusPath(), 'utf8'));
    const sources = (parsed.sources ?? []) as { url: string; digest: string | null }[];
    return Object.fromEntries(sources.map((s) => [s.url, { digest: s.digest }]));
  } catch {
    return {};
  }
}

async function checkLiveSite(): Promise<{
  url: string;
  status: number | null;
  markerFound: boolean;
}> {
  try {
    const response = await fetchWithTimeout(LIVE_URL);
    const body = await response.text();
    return {
      url: LIVE_URL,
      status: response.status,
      markerFound: body.includes(APP_MARKER),
    };
  } catch {
    return { url: LIVE_URL, status: null, markerFound: false };
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

interface Report {
  generatedAt: string;
  uniqueSources: number;
  rows: number;
  schemes: Record<string, number>;
  staleAccessed: { url: string; days: number }[];
  site: { url: string; status: number | null; markerFound: boolean } | null;
  sources: SourceResult[];
  issues: string[];
}

function buildReport(
  rows: SourceRow[],
  results: SourceResult[],
  site: Report['site'],
  maxAgeDays: number,
): Report {
  const issues: string[] = [];
  const schemes: Record<string, number> = {};
  const staleAccessed: { url: string; days: number }[] = [];

  for (const row of rows) {
    schemes[row.scheme_id] = (schemes[row.scheme_id] ?? 0) + 1;
    const age = daysSince(row.date_accessed);
    if (age !== null && age > maxAgeDays && !staleAccessed.some((s) => s.url === row.url)) {
      staleAccessed.push({ url: row.url, days: age });
    }
  }

  const seen = new Set<string>();
  for (const result of results) {
    const label = result.url.split('/').pop()?.slice(0, 48) ?? result.url;
    if (result.change === 'unreachable') {
      issues.push(`${label} → HTTP ${result.status ?? 'ERR'}`);
    } else if (result.change === 'changed' && result.digestKind === 'bytes') {
      issues.push(`${label} → document changed, re-ingest recommended`);
    } else if (result.change === 'changed') {
      log(`note: ${label} → HTML content shifted (advisory, tokens are normalized out)`);
    }
    seen.add(result.url);
  }

  return {
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    uniqueSources: results.length,
    rows: rows.length,
    schemes,
    staleAccessed,
    site,
    sources: results,
    issues,
  };
}

function printReport(report: Report): void {
  log(`sources: ${report.uniqueSources} unique URLs across ${Object.keys(report.schemes).length} schemes (${report.rows} rows in source_list.csv)`);
  for (const source of report.sources) {
    const size = source.bytes > 0 ? `${Math.round(source.bytes / 1024)} KB` : '—';
    const status = source.ok ? `HTTP ${source.status}` : `FAILED (${source.error ?? 'HTTP ' + source.status})`;
    log(`  [${source.change.padEnd(11)}] ${status} · ${size} · ${source.elapsedMs} ms · ${source.url.slice(0, 72)}`);
  }
  for (const scheme of Object.entries(report.schemes)) {
    log(`scheme ${scheme[0]}: ${scheme[1]} fact sources`);
  }
  for (const stale of report.staleAccessed) {
    log(`note: last accessed ${stale.days} days ago → ${stale.url.slice(0, 72)}`);
  }
  if (report.site) {
    log(`site: ${report.site.url} → ${report.site.status} · marker ${report.site.markerFound ? 'ok' : 'MISSING'}`);
  }
}

function renderDoc(report: Report): string {
  const lines = [
    '# Source health',
    '',
    '> Auto-generated by `scripts/scheduler.ts` — do not edit by hand.',
    '',
    `- **Generated:** ${report.generatedAt}`,
    `- **Unique sources:** ${report.uniqueSources} (${report.rows} rows in \`data/source_list.csv\`)`,
    `- **Schemes covered:** ${Object.keys(report.schemes).join(', ') || 'none'}`,
    report.site
      ? `- **Live site:** ${report.site.url} → \`${report.site.status}\`, marker ${report.site.markerFound ? 'found' : 'MISSING'}`
      : '- **Live site:** check skipped',
    '',
    '## Sources',
    '',
    '| Change | Status | Size | Type | Source |',
    '| --- | --- | ---: | --- | --- |',
    ...report.sources.map(
      (s) =>
        `| ${s.change} | ${s.status ?? 'error'} | ${s.bytes > 0 ? `${Math.round(s.bytes / 1024)} KB` : '—'} | ${s.docType} | ${s.url} |`,
    ),
    '',
    '## Scheme coverage',
    '',
    '| Scheme | Fact sources |',
    '| --- | ---: |',
    ...Object.entries(report.schemes).map(([scheme, count]) => `| ${scheme} | ${count} |`),
    '',
  ];

  if (report.staleAccessed.length > 0) {
    lines.push('## Re-access recommended', '', '| Last accessed | URL |', '| --- | --- |');
    for (const stale of report.staleAccessed) {
      lines.push(`| ${stale.days} days ago | ${stale.url} |`);
    }
    lines.push('');
  }

  lines.push(
    '## Digest notes',
    '',
    '- PDF digests are SHA-256 of the raw file bytes, so a `changed` verdict means',
    '  the document itself was replaced (a re-ingest is due).',
    '- HTML digests are SHA-256 of a normalized copy of the page (scripts, styles,',
    '  whitespace and long digit runs removed), because live pages embed rotating',
    '  tokens. HTML shifts are reported as advisory notes, not failures.',
    '',
  );
  return lines.join('\n');
}

function writeArtifacts(report: Report): void {
  mkdirSync(resolve(repoRoot(), 'data'), { recursive: true });
  mkdirSync(resolve(repoRoot(), 'docs'), { recursive: true });
  writeFileSync(statusPath(), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(docPath(), renderDoc(report), 'utf8');
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Options {
  const options: Options = {
    mode: 'once',
    maxAgeDays: 90,
    intervalMinutes: 360,
    noHttp: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      const value = argv[i + 1] as Options['mode'] | undefined;
      if (value !== 'check' && value !== 'once' && value !== 'daemon') {
        throw new Error(`Unknown --mode "${value ?? ''}" (expected check|once|daemon)`);
      }
      options.mode = value;
    } else if (arg === '--max-age-days') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--max-age-days must be a positive number');
      }
      options.maxAgeDays = value;
    } else if (arg === '--interval-minutes') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--interval-minutes must be a positive number');
      }
      options.intervalMinutes = value;
    } else if (arg === '--no-http') {
      options.noHttp = true;
    }
  }
  return options;
}

async function collect(options: Options): Promise<{ rows: SourceRow[]; results: SourceResult[]; site: Report['site'] }> {
  const rows = readSourceList();
  const previous = readPreviousStatus();
  const uniqueUrls = [...new Set(rows.map((row) => row.url))];
  const docTypeFor = (url: string) => rows.find((row) => row.url === url)?.doc_type ?? 'html';

  const results: SourceResult[] = [];
  for (const url of uniqueUrls) {
    results.push(await probe(url, docTypeFor(url), previous));
  }
  const site = options.noHttp ? null : await checkLiveSite();
  return { rows, results, site };
}

async function runCheck(options: Options): Promise<number> {
  const { rows, results, site } = await collect(options);
  const report = buildReport(rows, results, site, options.maxAgeDays);
  printReport(report);

  if (!readFileSafe(statusPath())) {
    report.issues.push('no previous data/source_status.json — run --mode once');
  }

  // Site health is informational, not a failure: a stale or mismatched
  // deployment should be visible in the report without failing the job.
  if (site && (site.status !== 200 || !site.markerFound)) {
    log(
      `WARNING: live site is not serving MF-Facts (status ${site.status}, marker ${site.markerFound ? 'ok' : 'missing'}) — check the Vercel deployment for this repo`,
    );
  }

  if (report.issues.length > 0) {
    for (const issue of report.issues) {
      log(`ISSUE: ${issue}`);
    }
    log(`CHECK: ${report.issues.length} issue(s) found`);
    return 2;
  }
  log('CHECK: healthy — all sources reachable and unchanged');
  return 0;
}

function readFileSafe(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

async function runOnce(options: Options): Promise<number> {
  const { rows, results, site } = await collect(options);
  const report = buildReport(rows, results, site, options.maxAgeDays);
  printReport(report);
  writeArtifacts(report);
  log(`wrote data/source_status.json and docs/source-health.md at ${report.generatedAt}`);

  const reingest = report.sources.filter(
    (s) => s.change === 'changed' && s.digestKind === 'bytes',
  );
  if (reingest.length > 0) {
    log(`${reingest.length} document(s) changed — run \`npm run ingest\` to refresh the index`);
  }
  return 0;
}

async function runDaemon(options: Options): Promise<number> {
  const intervalMs = Math.max(300, options.intervalMinutes * 60_000);
  log(`DAEMON START: polling every ${Math.round(intervalMs / 60_000)} min`);
  for (;;) {
    try {
      await runOnce(options);
    } catch (error) {
      log(`cycle failed: ${(error as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function main(argv: string[]): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`ARGUMENT ERROR: ${(error as Error).message}`);
    console.error('Usage: tsx scripts/scheduler.ts --mode check|once|daemon [--max-age-days N] [--interval-minutes N] [--no-http]');
    return 1;
  }

  try {
    if (options.mode === 'check') return await runCheck(options);
    if (options.mode === 'daemon') return await runDaemon(options);
    return await runOnce(options);
  } catch (error) {
    console.error(`FAILED: ${(error as Error).message}`);
    return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`FATAL: ${(error as Error).message}`);
    process.exitCode = 1;
  });
