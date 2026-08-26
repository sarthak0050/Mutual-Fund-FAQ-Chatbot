CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schemes (
  scheme_id   TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  amc         TEXT NOT NULL,
  category    TEXT NOT NULL,
  riskometer  TEXT NOT NULL,
  benchmark   TEXT NOT NULL,
  is_elss     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sources (
  source_id           SERIAL PRIMARY KEY,
  url                 TEXT NOT NULL,
  doc_type            TEXT NOT NULL,
  scheme_id           TEXT REFERENCES schemes(scheme_id),
  date_accessed       DATE NOT NULL,
  source_last_updated DATE
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id    SERIAL PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES sources(source_id),
  scheme_id   TEXT REFERENCES schemes(scheme_id),
  fact_type   TEXT NOT NULL,
  text        TEXT NOT NULL,
  page_ref    TEXT,
  embedding   vector(768)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS query_logs (
  log_id      SERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intent_type TEXT NOT NULL,
  fact_type   TEXT,
  scheme_id   TEXT,
  resolved    BOOLEAN NOT NULL,
  latency_ms  INTEGER
);

-- query_logs deliberately has no column for raw query text.
-- This is a privacy-by-design decision: even if the database is compromised,
-- no one can recover what a user typed. PII (PAN, Aadhaar, phone, email,
-- account numbers) is blocked before it reaches this table, and non-PII
-- queries are logged with intent metadata only.
