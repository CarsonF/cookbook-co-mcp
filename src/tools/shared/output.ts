import * as R from 'remeda';

/** Compact JSON as a tool result. */
export function json(value: unknown) {
  return { content: [textBlock(JSON.stringify(value))] };
}

/**
 * Compact JSON, with long multi-line strings under `keys` lifted into their own text blocks,
 * since newlines escaped inside JSON cost more than plain ones.
 * Takes a result object or a list of them (one block per entry, labelled by its name).
 * Example: `jsonWithText(result, ['preview'])`.
 */
export function jsonWithText(value: unknown, keys: string[]) {
  const blocks: string[] = [];
  const lift = (entry: unknown, label: string): unknown => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const rest: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(entry)) {
      if (keys.includes(key) && typeof v === 'string' && v.includes('\n')) {
        blocks.push(`${key}${label}:\n${v}`);
      } else {
        rest[key] = v;
      }
    }
    return rest;
  };
  const body = Array.isArray(value)
    ? value.map((entry, i) => lift(entry, ` (${(entry as { name?: string })?.name ?? i + 1})`))
    : lift(value, '');
  return { content: [JSON.stringify(body), ...blocks].map(textBlock) };
}

export function fail(message: string) {
  return { isError: true, content: [textBlock(message)] };
}

function textBlock(text: string) {
  return { type: 'text' as const, text };
}

/** The object without empty values: `undefined`, `null`, `''`, `0`, `false` and `[]`. */
export function dropEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return R.pickBy(obj, (v) => v && !(Array.isArray(v) && v.length === 0)) as Partial<T>;
}
