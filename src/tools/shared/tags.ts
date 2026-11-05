import {
  acceptedContent,
  inputRequired,
  type InputRequiredResult,
  inputResponse,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Tag } from '../../api/index.js';
import { supportsElicitation } from './capabilities.js';

export interface SettledTags {
  tags: string[];
  skipped: string[];
  /** Unknown names awaiting a decision (previews only). */
  pending: string[];
  /** Set when the write must not go ahead. */
  refuse?: string;
  /** Set when the user must be asked first; the tool returns it as its result. */
  input?: InputRequiredResult;
}

/**
 * Decides what happens to tag names that do not exist yet.
 * `ask` prompts the user through MCP elicitation when the client supports it;
 * otherwise a write is refused with a message telling the agent to ask.
 * When a question is needed the result carries `input`: the tool returns it,
 * and the client repeats the call with the answer.
 */
export async function settleTags(
  mcp: ServerContext,
  wanted: string[],
  known: Tag[],
  mode: 'ask' | 'create' | 'skip',
  willWrite: boolean,
): Promise<SettledTags> {
  const unknown = wanted.filter((t) => !known.some((k) => k.name === t));
  if (unknown.length === 0 || mode === 'create') return { tags: wanted, skipped: [], pending: [] };
  const without = wanted.filter((t) => !unknown.includes(t));
  if (mode === 'skip') return { tags: without, skipped: unknown, pending: [] };
  if (!willWrite) return { tags: wanted, skipped: [], pending: unknown };

  const answer = askToCreate(mcp, unknown);
  if (typeof answer === 'object') return { tags: wanted, skipped: [], pending: [], input: answer };
  if (answer === 'create') return { tags: wanted, skipped: [], pending: [] };
  if (answer === 'skip') return { tags: without, skipped: unknown, pending: [] };
  const refuse =
    answer === 'cancel'
      ? 'Cancelled at your request; nothing was changed.'
      : `Unknown tags: ${unknown.join(', ')}. Ask the user whether to create them, then repeat with ` +
        'unknown_tags "create" (create them) or "skip" (leave them off).';
  return { tags: wanted, skipped: [], pending: [], refuse };
}

/** The message a preview adds when unknown tags still need a decision. */
export function tagDecision(pending: string[]): string | undefined {
  return pending.length === 0
    ? undefined
    : `Tags that do not exist yet: ${pending.join(', ')}. Ask the user whether to create them, ` +
        'then apply with unknown_tags "create" or "skip" (or leave it on "ask" to be prompted).';
}

const CREATE_TAGS = 'create_tags';
const createAnswer = z.object({
  create: z.boolean().describe('Create the new tags; if no, the recipe is saved without them'),
});

/**
 * The user's answer, `unsupported` if the client cannot ask, or the question to return.
 * A server cannot ask in the middle of a call:
 * the first call returns the question, the client asks the user
 * and repeats the same call with the answer attached, which is read here.
 */
function askToCreate(
  mcp: ServerContext,
  unknown: string[],
): 'create' | 'skip' | 'cancel' | 'unsupported' | InputRequiredResult {
  const reply = inputResponse(mcp.mcpReq.inputResponses, CREATE_TAGS);
  if (reply.kind === 'elicit') {
    if (reply.action !== 'accept') return 'cancel';
    return acceptedContent(mcp.mcpReq.inputResponses, CREATE_TAGS, createAnswer)?.create === false
      ? 'skip'
      : 'create';
  }

  if (!supportsElicitation(mcp)) return 'unsupported';
  const message = `These tags do not exist yet: ${unknown.join(', ')}. Create them?`;
  return inputRequired({
    inputRequests: {
      [CREATE_TAGS]: inputRequired.elicit({ message, requestedSchema: createAnswer }),
    },
  });
}
