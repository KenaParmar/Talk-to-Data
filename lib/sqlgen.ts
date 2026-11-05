import { genMod } from './gemini';
import { SQL_PROMPT } from './ai/prompts/sql';
import { validateSql } from './sql/validator';

export async function genSql(q: string, schema: string): Promise<string> {
  const prompt = `${SQL_PROMPT}\n\nSCHEMA:\n${schema}\n\nQUESTION:\n${q}\n\nReturn only SQL.`;
  const raw = (await genMod.generateContent(prompt)).response.text().trim();
  return validateSql(raw, schema);
}

export async function fixSql(q: string, schema: string, badSql: string, errMsg: string): Promise<string> {
  const prompt = `${SQL_PROMPT}\n\nThe previous query failed. Repair it without changing the user's intent.\nQUESTION:\n${q}\nSCHEMA:\n${schema}\nFAILED SQL:\n${badSql}\nERROR/RESULT:\n${errMsg}\nReturn only the repaired SQL.`;
  const raw = (await genMod.generateContent(prompt)).response.text().trim();
  return validateSql(raw, schema);
}
