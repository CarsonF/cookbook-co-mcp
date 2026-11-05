import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import {
  collection,
  doc,
  initializeFirestore,
  onSnapshot,
  type QueryDocumentSnapshot,
  terminate,
  writeBatch,
} from 'firebase/firestore';
import ms from 'ms';
import * as R from 'remeda';
import type { Auth } from '../core/auth.js';
import type { Fields, FsDoc } from './fields.js';
import { type LiveCollection, liveCollection } from './liveCollection.js';

const CONFIG = {
  apiKey: 'AIzaSyA3Q_4xjDhCvWN9VNp6b5O6HmZ7IxvHtfE', // public web key, shipped in the app
  projectId: 'cookbook-app-250ac',
};

let instances = 0;

/**
 * The Firebase SDK, signed in with the app's own token, serving the collections under `cb/<user>/`:
 * every collection's listener and writes share one Firestore stream,
 * and the SDK refreshes its own ID token.
 */
export class FirestoreLive implements AsyncDisposable {
  private readonly app = initializeApp(CONFIG, `cookbook-${instances++}`);
  private readonly collections = new Set<LiveCollection>();
  private db?: ReturnType<typeof initializeFirestore>;
  private session?: ReturnType<FirestoreLive['signIn']>;

  constructor(
    private readonly auth: Auth,
    private readonly log: (message: string) => void,
  ) {}

  /** A live collection at `cb/<user>/<path>`, e.g. `shopping/<id>/items`; disposing it closes it. */
  collection(path: string): LiveCollection {
    const live = liveCollection({
      name: path,
      subscribe: this.subscribe(path),
      commit: (writes) => this.commit(path, writes),
      log: this.log,
    });
    this.collections.add(live);
    return {
      ...live,
      [Symbol.asyncDispose]: () => {
        this.collections.delete(live);
        return live[Symbol.asyncDispose]();
      },
    };
  }

  /** Starts the listener of every collection created so far. */
  warm() {
    for (const live of this.collections) live.open();
  }

  async [Symbol.asyncDispose]() {
    await Promise.all([...this.collections].map((live) => live[Symbol.asyncDispose]()));
    this.collections.clear();
    if (this.db) await terminate(this.db);
    await deleteApp(this.app);
  }

  private subscribe(path: string): Subscribe {
    return async ({ onSnapshot: next, onError }) => {
      const { db, userId } = await this.signedIn();
      return onSnapshot(
        collection(db, `cb/${userId}/${path}`),
        // metadata changes tell us when the SDK is serving its cache because the stream is down
        { includeMetadataChanges: true },
        (snap) => next(snap.docs.map(toFsDoc), !snap.metadata.fromCache),
        (error) => {
          // a rejected token needs a new sign-in before the listener starts again
          if (error.code === 'unauthenticated') this.session = undefined;
          onError(error);
        },
      );
    };
  }

  private async commit(path: string, writes: Write[]) {
    const { db, userId } = await this.signedIn();
    for (const chunk of R.chunk(writes, COMMIT_LIMIT)) {
      const batch = writeBatch(db);
      for (const write of chunk) {
        const ref = doc(db, `cb/${userId}/${path}/${write.id}`);
        if (write.kind === 'delete') batch.delete(ref);
        else batch.set(ref, write.fields, { merge: write.kind === 'patch' });
      }
      await withDeadline(batch.commit(), WRITE_DEADLINE);
    }
  }

  private signedIn() {
    return (this.session ??= this.signIn().catch((error: unknown) => {
      this.session = undefined;
      throw error;
    }));
  }

  private async signIn() {
    const { id: userId, jwt_token: customToken } = await this.auth.login();
    await signInWithCustomToken(getAuth(this.app), customToken);
    this.db ??= initializeFirestore(this.app, {});
    return { db: this.db, userId };
  }
}

/** Starts a listener, e.g. after signing in, and resolves to the function that stops it. */
export type Subscribe = (handlers: {
  /** `fromServer` is false while the SDK serves its cache because the stream is down. */
  onSnapshot(docs: FsDoc[], fromServer: boolean): void;
  /** The listener is finished after an error. */
  onError(error: Error): void;
}) => Promise<() => void>;

export type Write =
  | { kind: 'set'; id: string; fields: Fields }
  | { kind: 'patch'; id: string; fields: Fields }
  | { kind: 'delete'; id: string };

const COMMIT_LIMIT = 400;

/** An offline SDK keeps a write queued and applies it later, so a timeout is not a failure. */
const WRITE_DEADLINE = ms('15s');

function withDeadline<T>(work: Promise<T>, deadline: number) {
  let timer: NodeJS.Timeout;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Firestore did not confirm the write; it may still apply')),
      deadline,
    );
    timer.unref();
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
}

/** Values this client reads; any other Firestore type decodes as null. */
function toFsDoc(doc: QueryDocumentSnapshot): FsDoc {
  const data: Fields = {};
  for (const [key, value] of Object.entries(doc.data())) {
    data[key] =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : null;
  }
  return { id: doc.id, data };
}
