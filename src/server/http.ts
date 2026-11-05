import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PATH = '/mcp';

/**
 * Serves MCP over HTTP at `http://127.0.0.1:<port>/mcp`:
 * protocol 2026-07-28 only, no sessions, no token, loopback only.
 */
export function serveHttp(create: () => McpServer, port: number) {
  const handle = toNodeHandler(createMcpHandler(create, { legacy: 'reject' }));
  const checkHost = localhostHostValidation();
  const checkOrigin = localhostOriginValidation();

  const server = createServer((req, res) => {
    if (!checkHost(req, res) || !checkOrigin(req, res)) return;
    if (new URL(req.url ?? '/', `http://${HOST}`).pathname !== PATH) {
      res.writeHead(404).end();
      return;
    }
    void handle(req, res);
  });
  server.listen(port, HOST, () =>
    console.log(`cookbook-mcp listening on http://${HOST}:${port}${PATH}`),
  );
  return server;
}
