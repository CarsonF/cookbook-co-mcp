import { type Envelope, readEnvelope } from './envelope.js';
import { type Http, retryPost } from './http.js';

// the web app's package.json version; the server ignores it today, so a stale value is harmless
const APP_VERSION = '3.1.065';

export const APP_PARAMS = {
  app: APP_VERSION,
  code_version: APP_VERSION,
  lang: 'en-US',
  project: 'cb',
};

const AUTH_URL = 'https://api.cookbook.company/project/cb/auth';

/**
 * The token as the app stores it, however it was copied: with whitespace or quotes around it,
 * or percent-encoded as a cookie value is.
 */
export function cleanToken(text: string): string {
  const trimmed = text.trim().replace(/^["']|["']$/g, '');
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export class Auth {
  constructor(
    private readonly http: Http,
    private readonly token: string,
  ) {}

  /** The `Authorization` header value for the REST API. */
  header() {
    return Buffer.from(this.token).toString('base64');
  }

  /** Signs in with the token; the response carries the account id and a Firebase custom token. */
  async login() {
    const res = await this.http.post<Envelope>(AUTH_URL, {
      searchParams: APP_PARAMS,
      json: { token: this.token },
      responseType: 'json',
      ...retryPost,
    });
    const { attributes } = readEnvelope<{ attributes: LoginAttributes }>(
      res,
      'POST api.cookbook.company',
    );
    return attributes;
  }

  /** Proves the token works; never returns the token or the email. */
  async whoami() {
    const { id, subscription } = await this.login();
    return {
      id,
      plan: subscription?.active ? (subscription.subtype ?? 'active') : 'no active plan',
    };
  }
}

interface LoginAttributes {
  id: number;
  jwt_token: string;
  subscription?: { active: boolean; subtype?: string };
}
