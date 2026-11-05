import * as R from 'remeda';
import { titleCase } from 'title-case';

/** "ground beef" becomes "Ground Beef"; small words stay lowercase and hyphens are kept. */
export function toTitleCase(name: string) {
  const words = name.trim().replace(/\s+/g, ' ');
  // ALL CAPS reads as shouting, so it is normalized; mixed case such as "McDonald's" is kept
  return titleCase(words === words.toUpperCase() ? words.toLowerCase() : words);
}

/** Values already in `known` keep their spelling (matched ignoring case); the rest go through `create`. */
export function canonicalize(values: string[], known: string[], create: (value: string) => string) {
  const byLower = new Map(known.map((value) => [value.toLowerCase(), value]));
  return R.unique(values.map((value) => byLower.get(value.trim().toLowerCase()) ?? create(value)));
}
