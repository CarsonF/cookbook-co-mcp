import type { Response } from 'got';

/** The CookBook services reply `{ data: [payload] }`, or `{ errors: [...] }` (even with HTTP 200). */
export interface Envelope {
  data?: unknown[];
  errors?: { status: number | string; detail: string }[];
}

/**
 * The payload of a reply, e.g. `{ recipes }` for a sync; `label` names the call in errors.
 * A reply without a `data` wrapper is returned whole.
 */
export function readEnvelope<T>(res: Response<Envelope>, label: string) {
  // errors arrive as HTTP 200 with an `errors` array, e.g. status 701 for a dead token
  const error = res.body.errors?.[0];
  if (error) throw new Error(`${label}: ${error.status} ${error.detail}`);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.statusCode}`);
  return (res.body.data?.[0] ?? res.body) as T;
}
