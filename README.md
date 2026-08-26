# MF-Facts

A facts-only mutual fund information chatbot built with Retrieval-Augmented Generation (RAG). Answers factual questions about HDFC mutual fund schemes using official AMC sources. No opinions, no comparisons, no investment advice.

## Live Demo

**Vercel URL:** [https://mutual-fund-faq-chatbot.vercel.app](https://mutual-fund-faq-chatbot.vercel.app)

## Scope

### AMC Covered
- **HDFC Mutual Fund** (HDFC Asset Management Company Limited)

### Schemes Covered
| scheme_id | Name | Category | Riskometer |
|-----------|------|----------|------------|
| top100 | HDFC Top 100 Fund | Large-Cap | Moderately High |
| flexicap | HDFC Flexi Cap Fund | Flexi-Cap | Very High |
| elsstaxsaver | HDFC ELSS Tax Saver | ELSS | Very High |
| midcap | HDFC Mid-Cap Opportunities Fund | Mid-Cap | Very High |

### Fact Types Covered
- Expense Ratio (TER)
- Exit Load
- Lock-in Period (ELSS only)
- Fund Manager
- Benchmark Index
- Investment Objective

## Tech Stack
- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, App Router
- **Database:** Neon Postgres with pgvector extension
- **LLM:** Google Gemini (intent classification + answer generation)
- **Embeddings:** Gemini text-embedding-001 (768 dimensions)
- **Deployment:** Vercel
- **No ORM** — raw SQL only

## Setup

### Prerequisites
- Node.js 20+
- npm
- A Neon database (neon.tech)
- A Google AI Studio API key (ai.google.dev)

### 1. Clone the repository
```bash
git clone https://github.com/sarthak0050/Mutual-Fund-FAQ-Chatbot.git
cd Mutual-Fund-FAQ-Chatbot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create `.env.local` in the project root:
```
DATABASE_URL=postgresql://user:password@your-neon-endpoint/neondb?sslmode=require
GEMINI_API_KEY=your-google-ai-studio-api-key
```

### 4. Enable pgvector extension
In the Neon SQL editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5. Apply schema and seed data
```bash
npm run db:setup
```

### 6. Ingest source documents
```bash
npm run ingest
```

### 7. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Main query endpoint. Accepts `{ "text": "..." }` |
| `/api/sources` | GET | Returns all source documents |
| `/api/health` | GET | Health check |

### Query Pipeline (in order)
1. **PII Filter** — blocks PAN, Aadhaar, phone, email, account numbers
2. **Intent Classification** — factual | opinion_advice | out_of_scope
3. **Entity Extraction** — extracts scheme_id and fact_type
4. **Embedding** — converts query to 768-dim vector via Gemini
5. **pgvector Search** — cosine similarity filtered by scheme_id AND fact_type
6. **Answer Generation** — Gemini generates answer from retrieved chunk
7. **Citation** — source URL attached from database, not from LLM
8. **Logging** — metadata only (no raw query text stored)

## Known Limitations

1. **Rate limits** — Gemini free tier allows 5 text generation requests/minute. Production use requires upgrading.
2. **4 schemes only** — Out-of-scope queries are refused. The app does not answer questions about other mutual fund schemes.
3. **No conversation history** — Each query is independent. No chat memory across turns.
4. **No real-time data** — Information is only as current as the last ingestion run. NAV, returns, and portfolio holdings are not updated in real-time.
5. **PDF extraction quality** — Some PDF layouts may not extract text cleanly.
6. **No authentication** — Anyone can use the app. No user accounts or access control.
7. **Fact-type coverage** — Only 6 fact types are covered (expense ratio, exit load, lock-in, fund manager, benchmark, objective). Other facts like NAV, AUM, returns, and portfolio holdings are not included.
8. **English only** — The app does not support Hindi or other Indian languages.

## Project Structure

```
mf-facts/
├── app/
│   ├── api/
│   │   ├── query/route.ts     # Main query endpoint
│   │   ├── sources/route.ts   # Source transparency
│   │   └── health/route.ts    # Health check
│   ├── page.tsx               # Frontend UI
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Tailwind imports
├── db/
│   └── schema.sql             # Database tables + pgvector index
├── scripts/
│   ├── db-setup.ts            # Schema + seed runner
│   ├── ingest.ts              # Ingestion pipeline
│   └── check-logs.ts          # Query log viewer
├── data/
│   └── source_list.csv        # Source document URLs
└── .env.local                 # Secrets (not committed)
```

## Disclaimer

> MF-Facts provides factual information about mutual fund schemes sourced from official AMC documentation. It does not provide investment advice, recommendations, or performance predictions. All information is for educational purposes only. Please consult a certified financial advisor before making investment decisions. Mutual fund investments are subject to market risks. Read all scheme-related documents carefully.

## License

For educational and learning purposes only.
