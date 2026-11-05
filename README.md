# Talk-to-Data — Grounded Agentic Analytics

Talk-to-Data is a privacy-conscious conversational analytics application for CSV datasets and business documents. It combines browser-local DuckDB execution with Text-to-SQL, hybrid RAG, evidence-grounded generation, factual verification, prompt-injection defenses, privacy guardrails and rate limiting.

## What changed in the production-grade architecture

### 1. Multi-format document ingestion
- PDF/TXT/Markdown support.
- DOCX support through Mammoth.
- Normalized document text is chunked into bounded records.
- Evidence keeps source metadata so the answer can be audited.

### 2. Hybrid RAG
The retrieval pipeline combines:
- semantic similarity using Gemini embeddings;
- keyword retrieval using BM25;
- Reciprocal Rank Fusion (RRF);
- bounded top-k evidence.

Embeddings are cached by document-content fingerprint, so the same document is not re-embedded on every question within a running server instance.

> For multi-instance production deployments, replace the in-process cache with Redis/pgvector or another shared vector index.

### 3. Grounded generation
The synthesis prompt explicitly treats retrieved content as untrusted evidence rather than instructions. It forbids unsupported claims, invented numbers and system-prompt disclosure.

### 4. Factual verification loop
After generation, a verifier checks:
- evidence support;
- unsupported claims;
- numerical consistency with SQL results;
- citation/evidence grounding.

If verification fails, generation is retried with a reduced evidence set, up to the configured retry limit. If grounding still cannot be established, the UI reports that verification is uncertain rather than pretending the answer is correct.

### 5. SQL guardrails
Generated SQL is validated before execution:
- SELECT/WITH only;
- no write operations;
- no filesystem/network functions;
- no multiple statements;
- only uploaded schema is supplied to the model.

The existing browser-side DuckDB execution remains the computation boundary for CSV data.

### 6. Privacy and safety guardrails
- query/document size limits;
- credential/secret detection;
- basic PII detection;
- prompt-injection detection;
- untrusted-document instructions are never treated as system instructions;
- no raw user data is written to application logs;
- rate limiting on AI endpoints.

### 7. Production loop

```text
Input
  ↓
Safety / Privacy Guardrails
  ↓
Route: DATA / DOCS / BOTH
  ↓
SQL generation + validation       Hybrid RAG
  ↓                                  ↓
DuckDB execution                 Retrieve + RRF
  └──────────────┬───────────────────┘
                 ↓
             Evidence
                 ↓
             Synthesis
                 ↓
             Verification
            ↙          ↘
         PASS          FAIL
          ↓              ↓
       Answer        Repair / retry
                       ↓
                  max 2–3 loops
```

## Run locally

```bash
npm install
cp env.example .env.local
# set GOOGLE_AI_KEY
npm run dev
```

Open http://localhost:3000.

## Supported uploads

- CSV — queried locally with DuckDB WASM
- PDF — parsed in the browser
- DOCX — parsed in the browser
- TXT / Markdown — parsed in the browser

## Important deployment note

The current repository deliberately keeps uploaded CSV execution in the browser. The RAG service sends document text/chunks to Gemini for embeddings and grounded synthesis. Do not describe this as "no data ever leaves the browser". The accurate claim is that CSV files are not persisted by the application backend and SQL execution happens locally.

For a multi-instance production deployment, use a shared Redis rate limiter and a shared vector store/cache rather than the included process-local cache.

## Key modules

```text
lib/
├── agent/                 agent state/types
├── ai/prompts/            versioned prompts
├── guardrails/            privacy, safety, limits, rate limiting
├── ingestion/             document ingestion primitives
├── retrieval/             chunking, BM25, hybrid retrieval, embedding cache
├── sql/                   SQL validation/execution safeguards
├── verification/          factual + numerical verification
├── route.ts               DATA/DOCS/BOTH routing
├── sqlgen.ts              Text-to-SQL + repair
└── insight.ts             grounded synthesis + verification loop
```

## Production hardening still recommended before public launch

1. Use Redis/Upstash for distributed rate limiting.
2. Use a shared vector database (pgvector, Pinecone, etc.) if document indexes must survive restarts.
3. Add authentication and per-user quotas.
4. Add structured observability with request IDs and latency/cost metrics, never raw document contents.
5. Add automated evaluation for routing accuracy, SQL execution accuracy, retrieval Recall@K, citation accuracy, factuality and latency.
6. Add stronger PII classification/redaction if the application will process regulated data.
