import type { Method, OptionsInit } from 'got';
import { APP_PARAMS, type Auth } from './auth.js';
import { type Envelope, readEnvelope } from './envelope.js';
import type { Http } from './http.js';

const API_ROOT = 'https://api.cookbookmanager.com/cookbook';

export interface RestRequest {
  query?: Record<string, string>;
  json?: unknown;
  retry?: OptionsInit['retry'];
  root?: string;
}

/** The CookBook REST API: authorized requests that return the reply's payload as `T`. */
export class RestClient {
  constructor(
    private readonly http: Http,
    private readonly auth: Auth,
  ) {}

  async request<T = unknown>(method: Method, path: string, request: RestRequest = {}) {
    const { query, json, retry, root = API_ROOT } = request;
    const res = await this.http<Envelope>(path ? `${root}/${path}` : root, {
      method,
      searchParams: { ...query, ...APP_PARAMS },
      headers: { Authorization: this.auth.header() },
      json,
      responseType: 'json',
      ...(retry && { retry }),
    });
    return readEnvelope<T>(res, `${method} ${path}`);
  }
}
