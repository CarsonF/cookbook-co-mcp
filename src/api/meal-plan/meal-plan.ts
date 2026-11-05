import ms from 'ms';
import * as R from 'remeda';
import type { Cache, Memo, Windows } from '../core/cache.js';
import type { RestClient } from '../core/rest.js';
import type { PlannedMealRow } from './types.js';

/** The API calls the meal planner "diary". */
export class MealPlanApi {
  private readonly window: Memo<Window>;

  constructor(
    private readonly rest: RestClient,
    cache: Cache,
    windows: Windows,
  ) {
    this.window = cache.memo('meal plan', windows, async () => {
      const from = isoDay(Date.now() - BACK);
      const to = isoDay(Date.now() + AHEAD);
      return { from, to, rows: await this.fetch(from, to) };
    });
  }

  /** Every entry from a year back to a year ahead; `true` skips the memo, for writes. */
  async all(fresh = false) {
    return (await this.window(fresh)).rows;
  }

  /** Entries from `from` to `to` (inclusive); inside the cached window they come from memory. */
  async list(from: string, to: string, fresh = false) {
    const window = await this.window(fresh);
    if (from > to || from < window.from || to > window.to) return this.fetch(from, to);
    return window.rows.filter((row) => dayOf(row) >= from && dayOf(row) <= to);
  }

  /** `id` 0 adds an entry; an existing id edits it. */
  async save(entry: {
    id: number;
    date: string;
    slot: number;
    serving: number;
    recipe: number;
    note: string;
  }) {
    const { diary } = await this.rest.request<{ diary: SavedRow }>('PUT', 'user/diary', {
      query: { id: String(entry.id) },
      json: entry,
    });
    const row = {
      ...diary,
      diarydate: `${diary.diarydate.slice(0, 10)} 00:00:00`,
      diaryrecipe: diary.diaryrecipe ?? 0,
    };
    this.window.update((window) => {
      const rows = window.rows.filter((r) => r.diaryid !== row.diaryid);
      if (dayOf(row) >= window.from && dayOf(row) <= window.to) rows.push(row);
      return {
        ...window,
        rows: R.sortBy(
          rows,
          (r) => r.diarydate,
          (r) => r.diaryslot,
          (r) => r.diaryid,
        ),
      };
    });
    return row;
  }

  async remove(id: number) {
    await this.rest.request('DELETE', 'user/diary', { query: { id: String(id) } });
    this.window.update((window) => ({
      ...window,
      rows: window.rows.filter((r) => r.diaryid !== id),
    }));
  }

  /** For when a recipe changed: entries show the recipe's name. */
  refresh() {
    this.window.refresh();
  }

  private async fetch(from: string, to: string) {
    const { diary } = await this.rest.request<{ diary: PlannedMealRow[] }>('GET', 'user/diary', {
      query: { from, to },
    });
    return diary;
  }
}

/** The server refuses ranges over 740 days and end dates over 370 days ahead. */
const BACK = ms('370d');
const AHEAD = ms('365d');

/** The `PUT` reply: a list row with a bare date and a null recipe for notes. */
type SavedRow = Omit<PlannedMealRow, 'diaryrecipe'> & { diaryrecipe: number | null };

interface Window {
  from: string;
  to: string;
  rows: PlannedMealRow[];
}

function isoDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function dayOf(row: PlannedMealRow) {
  return row.diarydate.slice(0, 10);
}
