import type { McpServer } from '@modelcontextprotocol/server';
import type { Tool, ToolContext } from './define.js';
import { mealPlanTools } from './meal-plan/index.js';
import { recipeTools } from './recipes/index.js';
import { shoppingTools } from './shopping/index.js';
import { tagTools } from './tags/index.js';

/** Registers every tool; in read-only mode only the ones that read. */
export function registerTools(server: McpServer, context: ToolContext) {
  for (const tool of TOOLS) {
    if (context.config.readOnly && !tool.annotations.readOnlyHint) continue;
    tool.register(server, context);
  }
}

const TOOLS: Tool[] = [...recipeTools, ...tagTools, ...mealPlanTools, ...shoppingTools];
