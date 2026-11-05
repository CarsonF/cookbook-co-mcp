export function normalizeName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !DESCRIPTORS.has(w));
  const normalized = words
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
  // never empty, so names made only of descriptor words cannot all collapse to one key
  return normalized || name.trim().toLowerCase();
}

const DESCRIPTORS = new Set([
  'fresh',
  'freshly',
  'chopped',
  'minced',
  'diced',
  'sliced',
  'grated',
  'shredded',
  'finely',
  'roughly',
  'large',
  'medium',
  'small',
  'optional',
  'divided',
  'peeled',
  'drained',
  'rinsed',
]);
