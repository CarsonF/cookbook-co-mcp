import { homedir } from 'node:os';
import { join } from 'node:path';
import ms from 'ms';
import * as R from 'remeda';
import { cleanToken } from '../api/index.js';
import type { Windows } from '../api/core/cache.js';
import { type CacheSettings, DEFAULT_CACHE_SETTINGS } from '../api/core/cache-settings.js';

export interface Config {
  /** The CookBook login token, as copied from the web app. */
  token: string;
  readOnly: boolean;
  /** Port for `serve`; the server always binds to 127.0.0.1. */
  port?: number;
  /** Where exports land when the caller gives no path (the first of these that exists). */
  exportDirs: string[];
  backupDir: string;
  /** Edit backups kept per recipe. */
  backupKeep: number;
  /** Shopping list used when a tool is given none; unset means "Shopping List". */
  defaultShoppingList?: string;
  cache: CacheSettings;
}

/** Settings from the environment; `home` and `env` are parameters so tests can inject them. */
export function loadConfig(env = process.env, home = homedir()): Config {
  if (!env.COOKBOOK_TOKEN) throw new Error('COOKBOOK_TOKEN is not set');
  const state = join(home, '.local/state/cookbook-mcp');
  return {
    token: cleanToken(env.COOKBOOK_TOKEN),
    readOnly: env.COOKBOOK_READ_ONLY === '1',
    port: env.COOKBOOK_PORT ? Number(env.COOKBOOK_PORT) : undefined,
    exportDirs: env.COOKBOOK_EXPORT_DIR
      ? [env.COOKBOOK_EXPORT_DIR]
      : [join(home, 'Downloads'), join(state, 'exports')],
    backupDir: env.COOKBOOK_BACKUP_DIR ?? join(state, 'backups'),
    backupKeep: Math.max(1, Number(env.COOKBOOK_BACKUP_KEEP ?? 20) || 20),
    defaultShoppingList: env.COOKBOOK_DEFAULT_SHOPPING_LIST?.trim() || undefined,
    cache: loadCacheSettings(env),
  };
}

//#region helpers
const CACHE_VARIABLES = {
  recipes: 'RECIPES',
  mealPlan: 'MEAL_PLAN',
  tags: 'TAGS',
} as const satisfies Record<keyof CacheSettings, string>;

const WINDOW_VARIABLES = {
  fresh: 'FRESH',
  maxAge: 'MAX_AGE',
  refreshEvery: 'REFRESH_EVERY',
} as const satisfies Record<keyof Windows, string>;

/** Example: `COOKBOOK_CACHE_RECIPES_FRESH=30s`; `off` removes a max age or a refresh schedule. */
function loadCacheSettings(env: NodeJS.ProcessEnv): CacheSettings {
  return R.mapValues(DEFAULT_CACHE_SETTINGS, (defaults, cache) => {
    const windows: Windows = { ...defaults };
    for (const [field, suffix] of R.entries(WINDOW_VARIABLES)) {
      const variable = `COOKBOOK_CACHE_${CACHE_VARIABLES[cache]}_${suffix}`;
      const raw = env[variable]?.trim();
      if (raw) windows[field] = parseWindow(variable, raw, field !== 'fresh');
    }
    const { fresh = 0, maxAge = Infinity } = windows;
    if (maxAge < fresh) {
      const prefix = `COOKBOOK_CACHE_${CACHE_VARIABLES[cache]}`;
      throw new Error(`${prefix}_MAX_AGE must not be shorter than ${prefix}_FRESH`);
    }
    return windows;
  });
}

function parseWindow(variable: string, raw: string, canBeOff: boolean) {
  if (canBeOff && raw.toLowerCase() === 'off') return undefined;
  // `ms` reads "30s", "5m" and "1h"; a bare number is milliseconds
  const value = ms(raw as ms.StringValue);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    const hint = canBeOff ? ', or "off"' : '';
    throw new Error(`${variable} is not a duration: "${raw}" (use e.g. "30s", "5m", "1h"${hint})`);
  }
  return value;
}
//#endregion
