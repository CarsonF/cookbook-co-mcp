import { McpServer } from '@modelcontextprotocol/server';
import { CookbookClient } from '../api/index.js';
import { createBackups } from '../files/backups.js';
import { registerTools } from '../tools/index.js';
import { loadConfig } from './config.js';
import { serverInstructions } from './instructions.js';

/**
 * A factory for MCP servers that share one API client; each transport call gets a fresh server.
 * `log` gets the background refresh failures: stdout is fine over HTTP, but not over stdio.
 */
export function createServerFactory(log: (message: string) => void) {
  const config = loadConfig();
  const context = {
    config,
    client: new CookbookClient(config.token, { log, cache: config.cache }),
    backup: createBackups({ dir: config.backupDir, keep: config.backupKeep }),
  };
  const create = () => {
    const server = new McpServer(
      { name: 'cookbook', version: '0.1.0' },
      { instructions: serverInstructions(config.readOnly) },
    );
    registerTools(server, context);
    return server;
  };
  return {
    config,
    create,
    warm: () => context.client.warm(),
    [Symbol.asyncDispose]: () => context.client[Symbol.asyncDispose](),
  };
}
