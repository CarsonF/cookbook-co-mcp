import ms from 'ms';

export type Cache = ReturnType<typeof createCache>;

/** When an entry is refreshed and when it is too old to serve; every field is optional. */
export interface Windows {
  /** Served as it is this long; after that a read returns it and refreshes behind it. */
  fresh?: number;
  /** Never served past this age: the read waits for a fresh load instead. */
  maxAge?: number;
  /** Once loaded, kept warm: refreshed in the background this often, even if nobody reads it. */
  refreshEvery?: number;
}

/** One cached read. */
export interface Memo<T> {
  /** The value; `true` skips the memo (it joins a load already in flight). */
  (fresh?: boolean): Promise<T>;
  /**
   * Call after a write whose result you know, e.g. a tag you just renamed.
   * The cached value is edited in place: no request, reads never wait, the schedule is untouched.
   * Does nothing if the list is not cached.
   */
  update(change: (current: T) => T): void;
  /**
   * Call after a write whose result you cannot work out.
   * It reloads in the background, and reads wait for that reload instead of returning the old
   * value; the entry and its refresh schedule stay in place.
   */
  refresh(): void;
}

/** After a failed refresh, reads keep the old value and leave the API alone this long. */
const RETRY_AFTER_FAILURE_MS = ms('10s');

/** Delays between background refresh attempts while the API keeps failing; the last repeats. */
const BACKGROUND_RETRY_DELAYS = [ms('1m'), ms('5m'), ms('15m'), ms('1h')];

/** The longest delay `setTimeout` accepts; a longer one fires at once. */
const MAX_TIMER_MS = 2 ** 31 - 1;

interface Entry {
  value: unknown;
  /** When the load that produced it started. */
  at: number;
}

/**
 * Memoized API reads with stale-while-revalidate and an optional keep-warm schedule:
 * concurrent readers share one load, and a failed refresh is not retried on every read.
 * A load that started before a write is never stored over one that started after it.
 * Disposing cancels every timer, so nothing refreshes afterwards.
 * The loader gets the value it replaces, so it can fetch only what changed.
 * Example: `const tags = cache.memo('tags', { fresh: ms('1h') }, () => loadTags());`
 */
export function createCache({ log = console.error }: { log?: (message: string) => void } = {}) {
  const memos = new Map<
    string,
    { windows: Windows; run: (previous?: unknown) => Promise<unknown> }
  >();
  const entries = new Map<string, Entry>();
  const loading = new Map<string, Promise<Entry>>();
  const failures = new Map<string, number>();
  const timers = new Map<string, NodeJS.Timeout>();
  const scheduleFailures = new Map<string, number>();
  // keys written to since their entry was loaded: reads wait for the reload
  const changed = new Set<string>();
  // the newest load started per key; an older one that finishes later is not stored
  const newest = new Map<string, number>();
  let disposed = false;

  /** Refreshes `key` after `delay`, even if nobody reads it by then. */
  function arm(key: string, delay: number) {
    if (disposed) return;
    clearTimeout(timers.get(key));
    const timer = setTimeout(() => void refreshQuietly(key), delay);
    timer.unref();
    timers.set(key, timer);
  }

  /** A background refresh: reads are not waiting on it, so a failure is logged and retried later. */
  async function refreshQuietly(key: string) {
    const pending = load(key);
    const sequence = newest.get(key);
    try {
      await pending;
    } catch (error) {
      if (newest.get(key) !== sequence) return;
      const reason = error instanceof Error ? error.message : String(error);
      if (!memos.get(key)?.windows.refreshEvery) {
        log(`cache: refreshing ${key} failed: ${reason}`);
        return;
      }
      const count = (scheduleFailures.get(key) ?? 0) + 1;
      scheduleFailures.set(key, count);
      const delay = BACKGROUND_RETRY_DELAYS[Math.min(count, BACKGROUND_RETRY_DELAYS.length) - 1];
      log(`cache: refreshing ${key} failed (attempt ${count}, next in ${ms(delay)}): ${reason}`);
      arm(key, delay);
    }
  }

  /** The running load for `key`, or a new one; `replace` starts a new one even if one is running. */
  function load(key: string, replace = false) {
    const running = loading.get(key);
    if (running && !replace) return running;

    const { windows, run } = memos.get(key)!;
    const sequence = (newest.get(key) ?? 0) + 1;
    newest.set(key, sequence);
    const at = Date.now();
    const isNewest = () => newest.get(key) === sequence;
    // an expired entry or one that predates a write is still a valid base for a delta
    const pending: Promise<Entry> = run(entries.get(key)?.value).then(
      (value) => {
        if (isNewest()) {
          entries.set(key, { value, at });
          changed.delete(key);
          failures.delete(key);
          scheduleFailures.delete(key);
          if (windows.refreshEvery) arm(key, windows.refreshEvery);
        }
        if (loading.get(key) === pending) loading.delete(key);
        return { value, at };
      },
      (error) => {
        if (isNewest()) failures.set(key, Date.now());
        if (loading.get(key) === pending) loading.delete(key);
        throw error;
      },
    );
    loading.set(key, pending);
    return pending;
  }

  async function read<T>(key: string, force: boolean) {
    const { fresh = Infinity, maxAge = Infinity } = memos.get(key)!.windows;
    const entry = entries.get(key);
    const age = entry ? Date.now() - entry.at : Infinity;
    const usable = !force && entry && !changed.has(key);
    if (usable && age < fresh) return entry.value as T;

    if (usable && age < maxAge) {
      const failedAt = failures.get(key);
      const cooling = failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS;
      if (!cooling) void refreshQuietly(key);
      return entry.value as T;
    }
    return (await load(key)).value as T;
  }

  /** Reloads after a write; with `wait`, reads block on it instead of using the old value. */
  function reload(key: string, wait: boolean) {
    if (wait) changed.add(key);
    load(key, true).catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      log(`cache: reloading ${key} after a write failed: ${reason}`);
    });
  }

  function refresh(key: string) {
    if (disposed || !(entries.has(key) || loading.has(key))) return;
    reload(key, true);
  }

  function update<T>(key: string, change: (current: T) => T) {
    const entry = entries.get(key);
    if (disposed || !entry) {
      // a first load that started before the write may not include it
      if (!disposed && loading.has(key)) reload(key, true);
      return;
    }
    entries.set(key, { ...entry, value: change(entry.value as T) });
    // a load running now may predate the write, so it must not replace the edit;
    // a newer one takes its place (quietly: reads keep using the edit) and keeps the schedule going
    if (loading.has(key)) reload(key, false);
  }

  return {
    memo<T>(key: string, windows: Windows, run: (previous?: T) => Promise<T>): Memo<T> {
      if ((windows.refreshEvery ?? 0) > MAX_TIMER_MS) {
        throw new RangeError(`${key}: refreshEvery is longer than a timer can wait`);
      }
      memos.set(key, { windows, run: run as (previous?: unknown) => Promise<unknown> });
      return Object.assign((fresh = false) => read<T>(key, fresh), {
        update: (change: (current: T) => T) => update(key, change),
        refresh: () => refresh(key),
      });
    },
    [Symbol.asyncDispose]: async () => {
      disposed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      entries.clear();
      loading.clear();
      failures.clear();
      scheduleFailures.clear();
      changed.clear();
      newest.clear();
    },
  };
}
