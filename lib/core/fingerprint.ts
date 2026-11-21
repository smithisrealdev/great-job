import { createHash } from 'node:crypto';

// \p{M} keeps Thai vowel/tone marks attached to their letters.
export const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

export function fingerprint(companyName: string, title: string): string {
  return createHash('sha256').update(`${normalize(companyName)}|${normalize(title)}`).digest('hex').slice(0, 32);
}
