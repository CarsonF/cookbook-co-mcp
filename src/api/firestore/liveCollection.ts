import ms from 'ms';
import type { Fields, FsDoc } from './fields.js';
import type { Subscribe, Write } from './FirestoreLive.js';
import { randomId } from './randomId.js';

/** A collection kept in memory by a Firestore listener, e.g. `recents`. */
export interface LiveCollection extends AsyncDisposable {
  /** The documents from the latest server snapshot; waits briefly for one, then throws. */
  docs(): Promise<FsDoc[]>;
  /** Starts the listener now instead of on the first read. */
  open(): void;
  /**
   * Atomic writes to this collection's documents, in chunks of 400, from a synchronous callback.
   * Reads see them at once; resolves with the callback's value when the server has them,
   * rejects if it refuses.
   * Example: `const id = await items.write((batch) => batch.add({ name: 'milk' }));`
   */
  write<T = void>(build: (batch: WriteBatch) => T): Promise<T>;
}

interface WriteBatch {
  /** Creates a document under a new random id and returns the id. */
  add(fields: Fields): string;
  /** Creates or replaces the whole document. */
  set(id: string, fields: Fields): void;
  /** Changes only these fields, creating the document if it is missing. */
  patch(id: string, fields: Fields): void;
  delete(ids: Many<string>): void;
}

interface LiveOptions {
  name: string;
  subscribe: Subscribe;
  commit: (writes: Write[]) => Promise<void>;
  log: (message: string) => void;
}

/**
 * Reads come from memory and are as current as the listener's last server snapshot.
 * A listener that fails is started again with a growing delay, and reads throw meanwhile.
 * Example: `const recents = liveCollection({ name: 'recents', subscribe, commit, log });`
 */
export function liveCollection({ name, subscribe, commit, log }: LiveOptions): LiveCollection {
  let current: FsDoc[] | undefined;
  let stop: (() => void) | undefined;
  let retry: NodeJS.Timeout | undefined;
  let failures = 0;
  let disposed = false;
  // true from `open` until the listener fails or is disposed, including while it is connecting
  let running = false;
  // identifies the current listener, so a late callback from an earlier one is ignored
  let attempt = 0;
  let lastError: Error | undefined;
  // reads waiting for the next server snapshot
  const waiting: Array<() => void> = [];
  const wake = () => waiting.splice(0).forEach((resolve) => resolve());

  function open() {
    if (running || retry || disposed) return;
    running = true;
    const mine = ++attempt;
    const live = () => mine === attempt && !disposed;
    const fail = (error: Error) => {
      if (!live()) return;
      running = false;
      attempt++;
      stop = undefined;
      current = undefined;
      lastError = error;
      const delay = RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)];
      log(`live: ${name} listener failed (next try in ${ms(delay)}): ${error.message}`);
      retry = setTimeout(() => {
        retry = undefined;
        open();
      }, delay);
      retry.unref();
    };
    subscribe({
      onSnapshot(docs, fromServer) {
        if (!live()) return;
        current = fromServer ? docs : undefined;
        if (!fromServer) return;
        failures = 0;
        wake();
      },
      onError: fail,
    }).then((unsubscribe) => (live() ? (stop = unsubscribe) : unsubscribe()), fail);
  }

  return {
    open,
    async write<T>(build: (batch: WriteBatch) => T) {
      const writes: Write[] = [];
      const result = build({
        add(fields) {
          const id = randomId();
          writes.push({ kind: 'set', id, fields });
          return id;
        },
        set: (id, fields) => void writes.push({ kind: 'set', id, fields }),
        patch: (id, fields) => void writes.push({ kind: 'patch', id, fields }),
        delete(ids) {
          for (const id of [ids].flat()) writes.push({ kind: 'delete', id });
        },
      });
      if (result instanceof Promise) {
        // writes made after its first await would miss the batch
        result.catch(() => {});
        throw new TypeError('write() takes a synchronous callback');
      }
      if (writes.length > 0) await commit(writes);
      return result;
    },
    async docs() {
      open();
      // only a listener that is connecting, or reconnecting, is worth waiting for
      if (!current && running) {
        await Promise.race([new Promise<void>((resolve) => waiting.push(resolve)), pause(WAIT)]);
      }
      if (current) return current;
      throw new Error(`Firestore ${name} is unavailable: ${lastError?.message ?? 'no snapshot'}`);
    },
    async [Symbol.asyncDispose]() {
      disposed = true;
      running = false;
      wake();
      clearTimeout(retry);
      stop?.();
      stop = undefined;
      current = undefined;
    },
  };
}

//#region helpers
type Many<T> = T | readonly T[];

/** How long a read waits for a server snapshot before it throws. */
const WAIT = ms('10s');

/** Delays before starting a failed listener again; the last repeats. */
const RETRY_DELAYS = [ms('5s'), ms('30s'), ms('5m')];

function pause(delay: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delay).unref());
}
//#endregion
