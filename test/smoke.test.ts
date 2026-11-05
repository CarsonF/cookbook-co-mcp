import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BUNDLE = new URL('../dist/cookbook-mcp.js', import.meta.url).pathname;
const PROTOCOL = '2026-07-28';
const READ_TOOLS = 9;
const ALL_TOOLS = 40;

describe('HTTP server', () => {
  const servers: Server[] = [];
  after(() => Promise.all(servers.map((s) => s.stop())));

  it('lists all tools', async () => {
    const server = await start({});
    servers.push(server);
    const names = await listTools(server.port);
    assert.equal(names.length, ALL_TOOLS);
    assert.ok(names.includes('search_recipes'));
    assert.ok(names.includes('delete_recipe'));
  });

  it('registers only read tools with COOKBOOK_READ_ONLY=1', async () => {
    const server = await start({ COOKBOOK_READ_ONLY: '1' });
    servers.push(server);
    const names = await listTools(server.port);
    assert.equal(names.length, READ_TOOLS);
    assert.ok(!names.includes('delete_recipe'));
  });

  it('names the default shopping list in the instructions', async () => {
    const server = await start({});
    servers.push(server);
    assert.match(await instructions(server.port), /"Shopping List" is the default list/);
  });

  it('uses COOKBOOK_DEFAULT_SHOPPING_LIST as the default list', async () => {
    const server = await start({ COOKBOOK_DEFAULT_SHOPPING_LIST: 'Groceries' });
    servers.push(server);
    assert.match(await instructions(server.port), /"Groceries" is the default list/);
  });

  it('refuses a foreign Host header', async () => {
    const server = await start({});
    servers.push(server);
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port: server.port, path: '/mcp', method: 'POST', headers: { host: 'evil.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.once('error', reject);
      req.end('{}');
    });
    assert.ok(status >= 400);
  });
});

describe('CLI', () => {
  it('check-token without a token exits 2', async () => {
    const child = spawn(process.execPath, [BUNDLE, 'check-token'], {
      env: { ...process.env, COOKBOOK_TOKEN: '' },
      stdio: 'ignore',
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 2);
  });

  it('rejects an unknown command', async () => {
    const child = spawn(process.execPath, [BUNDLE, 'nope'], { stdio: 'ignore' });
    const [code] = await once(child, 'exit');
    assert.equal(code, 2);
  });
});

//#region helpers
interface Server {
  port: number;
  stop: () => Promise<void>;
}

async function start(extraEnv: Record<string, string>): Promise<Server> {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [BUNDLE, 'serve', String(port)], {
    // a dummy token is enough: tools/list never touches the network
    env: { ...process.env, COOKBOOK_TOKEN: 'smoke-test-token', ...extraEnv },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited early with ${code}`)));
    child.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening')) resolve();
    });
  });
  return {
    port,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await once(child, 'exit');
    },
  };
}

async function listTools(port: number): Promise<string[]> {
  const res = await rpc(port, 'tools/list');
  assert.equal(res.status, 200);
  const { result } = (await res.json()) as { result: { tools: { name: string }[] } };
  return result.tools.map((t) => t.name);
}

async function instructions(port: number): Promise<string> {
  const res = await rpc(port, 'server/discover');
  assert.equal(res.status, 200);
  const { result } = (await res.json()) as { result: { instructions: string } };
  return result.instructions;
}

function rpc(port: number, method: string, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL,
      'mcp-method': method,
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL,
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}
//#endregion
