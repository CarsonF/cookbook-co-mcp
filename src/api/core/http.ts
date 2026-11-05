import ms from 'ms';
import got, { type OptionsInit } from 'got';

export type Http = typeof http;
/** The shared `got` client: error statuses are returned, not thrown, and only GETs are retried. */
export const http = got.extend({
  throwHttpErrors: false,
  timeout: { request: ms('10s') },
  retry: { limit: 2, methods: ['GET'] },
});

/** For a POST that only reads (sign-in, sync) or is idempotent, so a network error may be retried. */
export const retryPost: Pick<OptionsInit, 'retry'> = { retry: { limit: 2, methods: ['POST'] } };
