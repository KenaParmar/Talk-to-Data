/**
 * Legacy server-side DuckDB helper retained for compatibility.
 * The active application intentionally executes uploaded CSV queries in DuckDB WASM
 * in the browser, so raw CSV data is not persisted by this module.
 */
export async function runSql() {
  throw new Error('Server-side runSql is disabled. Use the browser DuckDB WASM connection.');
}
