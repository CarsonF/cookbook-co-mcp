import type {
  CallToolResult,
  InputRequiredResult,
  McpServer,
  ServerContext,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { CookbookClient } from '../api/index.js';
import type { createBackups } from '../files/backups.js';
import type { Config } from '../server/config.js';

export interface ToolContext {
  client: CookbookClient;
  config: Config;
  backup: ReturnType<typeof createBackups>;
}

export interface Tool {
  name: string;
  annotations: ToolAnnotations;
  register(server: McpServer, context: ToolContext): void;
}

type Hint = 'readOnly' | 'idempotent' | 'destructive' | 'openWorld';

/**
 * One MCP tool; its file exports the result of this call.
 * `hints` say what the tool does, e.g. `['destructive', 'idempotent']` for a delete;
 * none means an additive write.
 * `run` may return an input request (see `settleTags`) instead of a result.
 */
export function defineTool<Shape extends z.ZodRawShape>(tool: {
  name: string;
  description: string;
  inputSchema: Shape;
  hints: Hint[];
  run(
    args: z.infer<z.ZodObject<Shape>>,
    context: ToolContext,
    mcp: ServerContext,
  ): CallToolResult | InputRequiredResult | Promise<CallToolResult | InputRequiredResult>;
}): Tool {
  const { name, description, inputSchema, hints, run } = tool;
  const annotations = annotate(hints);
  return {
    name,
    annotations,
    register: (server, context) => {
      server.registerTool(
        name,
        { description, inputSchema: z.object(inputSchema), annotations },
        (args, mcp) => run(args, context, mcp),
      );
    },
  };
}

function annotate(hints: Hint[]): ToolAnnotations {
  const has = (hint: Hint) => hints.includes(hint);
  return {
    readOnlyHint: has('readOnly'),
    destructiveHint: has('destructive'),
    idempotentHint: has('idempotent'),
    openWorldHint: has('openWorld'),
  };
}
