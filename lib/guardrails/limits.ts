export const LIMITS = {
  maxQueryChars: Number(process.env.MAX_QUERY_CHARS || 4000),
  maxDocumentChars: Number(process.env.MAX_DOCUMENT_CHARS || 2_000_000),
  maxChunks: Number(process.env.MAX_CHUNKS || 5000),
  maxRetrievalCandidates: Number(process.env.MAX_RETRIEVAL_CANDIDATES || 20),
  maxEvidence: Number(process.env.MAX_EVIDENCE || 5),
  maxAgentRetries: Number(process.env.MAX_AGENT_RETRIES || 2),
  maxRows: Number(process.env.MAX_QUERY_ROWS || 1000),
  maxRequestsPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 30),
};
