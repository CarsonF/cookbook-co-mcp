import ms from 'ms';
import type { Windows } from './cache.js';

/** Which cached read: `recipes`, the `mealPlan` window, or the `tags` list. */
export type CacheName = 'recipes' | 'mealPlan' | 'tags';

export type CacheSettings = Record<CacheName, Windows>;

export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  // a delta is one small request, so the hourly refresh and every revalidation are cheap
  recipes: { fresh: ms('1m'), maxAge: ms('1d'), refreshEvery: ms('1h') },
  mealPlan: { fresh: ms('1m'), maxAge: ms('1d'), refreshEvery: ms('1h') },
  // tags change once in weeks
  tags: { fresh: ms('1h'), refreshEvery: ms('1d') },
};

/** Settings with the given overrides applied; an explicit `undefined` removes a default. */
export function withCacheSettings(overrides: { [K in CacheName]?: Windows } = {}): CacheSettings {
  return {
    recipes: { ...DEFAULT_CACHE_SETTINGS.recipes, ...overrides.recipes },
    mealPlan: { ...DEFAULT_CACHE_SETTINGS.mealPlan, ...overrides.mealPlan },
    tags: { ...DEFAULT_CACHE_SETTINGS.tags, ...overrides.tags },
  };
}
