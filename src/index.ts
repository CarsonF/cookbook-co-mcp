#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { runCli } from './server/cli.js';
import { createServerFactory } from './server/create-server.js';
import { serveHttp } from './server/http.js';

async function main(command: string | undefined, args: string[]) {
  if (command === 'serve') {
    const factory = createServerFactory(console.log);
    const port = Number(args[0] ?? factory.config.port);
    if (!Number.isInteger(port)) throw new Error('No port: pass one or set COOKBOOK_PORT');
    const server = serveHttp(factory.create, port);
    factory.warm();
    const stop = async () => {
      server.close();
      await factory[Symbol.asyncDispose]();
    };
    process.once('SIGTERM', () => void stop());
    process.once('SIGINT', () => void stop());
  } else if (command) {
    process.exit(await runCli(command, args));
  } else {
    // stdout is the protocol channel here, so logs go to stderr
    const { create } = createServerFactory(console.error);
    serveStdio(create, { legacy: 'reject' });
  }
}

const [command, ...args] = process.argv.slice(2);
main(command, args).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
