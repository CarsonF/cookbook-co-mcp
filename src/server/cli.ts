import { CookbookClient, cleanToken } from '../api/index.js';

const USAGE = `cookbook-mcp
  (no arguments)          run the MCP server over stdio
  serve [port]            run it over HTTP on 127.0.0.1 (default port: $COOKBOOK_PORT)
  check-token             sign in with $COOKBOOK_TOKEN and report whether it works
  help                    show this text`;

/** The command-line helpers around the token; returns the process exit code. */
export async function runCli(command: string, args: string[]): Promise<number> {
  switch (command) {
    case 'check-token':
      return checkToken(process.env.COOKBOOK_TOKEN);
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return 0;
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

async function checkToken(raw: string | undefined): Promise<number> {
  if (!raw) {
    console.error('No token: set COOKBOOK_TOKEN');
    return 2;
  }
  try {
    const token = cleanToken(raw);
    const { id, plan } = await new CookbookClient(token).whoami();
    console.log(`OK: account ${id}, ${plan}. Token of ${token.length} characters.`);
    return 0;
  } catch (err) {
    console.error(`The token did not work: ${err instanceof Error ? err.message : String(err)}`);
    console.error(
      'Copy a fresh `cbtoken` cookie while signed in at https://app.cookbookmanager.com (see README).',
    );
    return 1;
  }
}
