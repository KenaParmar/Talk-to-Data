const INJECTION_PATTERNS = [
  /ignore\s+(all|any|the)\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+(the|your)\s+(api|secret|system)/i,
  /follow\s+these\s+instructions/i,
  /disregard\s+.*instructions/i,
  /jailbreak/i,
];

export function detectPromptInjection(text: string) {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
