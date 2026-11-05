import { LIMITS } from './limits';

const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|password|access[_-]?token|private[_-]?key)\s*[:=]\s*[^\s,;]+/i,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
];
const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d[\d\s().-]{8,}\d)\b/g,
  /\b(?:\d[ -]*?){13,19}\b/g,
];

export function validateTextSize(text: string, field: string) {
  if (text.length > (field === 'query' ? LIMITS.maxQueryChars : LIMITS.maxDocumentChars)) {
    throw new Error(`${field} exceeds the configured safety limit.`);
  }
}

export function detectSecrets(text: string) {
  return SECRET_PATTERNS.some((p) => p.test(text));
}

export function detectPII(text: string) {
  return PII_PATTERNS.some((p) => p.test(text));
}

export function privacyScan(text: string) {
  validateTextSize(text, 'document');
  return { containsSecrets: detectSecrets(text), containsPII: detectPII(text) };
}

export function redactPII(text: string) {
  return text
    .replace(PII_PATTERNS[0], '[EMAIL_REDACTED]')
    .replace(PII_PATTERNS[1], '[PHONE_REDACTED]')
    .replace(PII_PATTERNS[2], '[CARD_REDACTED]');
}
