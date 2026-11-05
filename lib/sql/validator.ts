import { LIMITS } from '../guardrails/limits';

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|ATTACH|DETACH|EXPORT|IMPORT|INSTALL|LOAD|CALL|PRAGMA|VACUUM)\b/i;

export function validateSql(sql: string, schema: string) {
  const cleaned = sql.trim().replace(/```sql|```/gi, '').trim();
  if (!/^(SELECT|WITH)\b/i.test(cleaned)) throw new Error('Only SELECT/WITH SQL is allowed.');
  if (FORBIDDEN.test(cleaned)) throw new Error('Unsafe SQL operation rejected.');
  if (/;\s*\S/.test(cleaned)) throw new Error('Multiple SQL statements are not allowed.');
  if (/read_csv|read_parquet|read_json|httpfs|glob\s*\(/i.test(cleaned)) throw new Error('Filesystem/network SQL functions are not allowed.');
  if (cleaned.length > 20000) throw new Error('Generated SQL is too large.');
  if (!schema) throw new Error('Schema is required.');
  return cleaned;
}

export function clampRows(rows: any[]) { return rows.slice(0, LIMITS.maxRows); }
