import ms from 'ms';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Recipe } from '../api/index.js';

const DELETED_SUFFIX = '-deleted';
const DELETED_KEEP = ms('1y');

/**
 * Saves the recipe as it is before a change; `delete` backups are the only copy of a deleted recipe.
 * Older edit backups are pruned to the newest `keep` per recipe.
 */
export function createBackups({ dir, keep }: { dir: string; keep: number }) {
  return async (recipe: Recipe, reason: 'edit' | 'delete' = 'edit') => {
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = reason === 'delete' ? DELETED_SUFFIX : '';
    const file = join(dir, `${recipe.id}-${stamp}${suffix}.json`);
    await writeFile(file, JSON.stringify(recipe, null, 2));
    await pruneBackups(dir, keep);
    return file;
  };
}

/** Per-recipe cap on edit backups, and a year's retention for deleted-recipe backups. */
async function pruneBackups(dir: string, keep: number) {
  const byRecipe = new Map<string, string[]>();
  for (const file of await readdir(dir)) {
    const [id] = file.split('-');
    if (!file.endsWith('.json') || !/^\d+$/.test(id)) continue;
    if (file.endsWith(`${DELETED_SUFFIX}.json`)) {
      const age = Date.now() - (await stat(join(dir, file))).mtimeMs;
      if (age > DELETED_KEEP) await rm(join(dir, file));
    } else {
      byRecipe.set(id, [...(byRecipe.get(id) ?? []), file]);
    }
  }
  // names start with an ISO timestamp, so a name sort is a time sort
  for (const files of byRecipe.values()) {
    for (const old of files.sort().reverse().slice(keep)) await rm(join(dir, old));
  }
}
