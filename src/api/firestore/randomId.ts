import { randomBytes } from 'node:crypto';

/** A random 32-character document id, like the ones the app generates. */
export function randomId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(32), (b) => alphabet[b % alphabet.length]).join('');
}
