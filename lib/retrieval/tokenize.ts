export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9_]+/g, ' ').split(/\s+/).filter(Boolean);
}
