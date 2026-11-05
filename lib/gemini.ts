import { GoogleGenerativeAI } from '@google/generative-ai';

function client() {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) throw new Error('GOOGLE_AI_KEY is missing. Add it to .env.local.');
  return new GoogleGenerativeAI(key);
}

export const genMod = new Proxy({} as any, {
  get(_target, prop) {
    const model = client().getGenerativeModel({ model: 'gemini-2.5-flash' }) as any;
    return typeof model[prop] === 'function' ? model[prop].bind(model) : model[prop];
  },
});

export const embMod = new Proxy({} as any, {
  get(_target, prop) {
    const model = client().getGenerativeModel({ model: 'gemini-embedding-001' }) as any;
    return typeof model[prop] === 'function' ? model[prop].bind(model) : model[prop];
  },
});
