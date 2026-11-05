import {
  CLIENT_CAPABILITIES_META_KEY,
  isSpecType,
  type ServerContext,
} from '@modelcontextprotocol/server';

/** Whether the client declared that it can answer elicitation requests on this call. */
export function supportsElicitation(mcp: ServerContext) {
  return clientCapabilities(mcp)?.elicitation !== undefined;
}

/**
 * What the client declared on this call.
 * The SDK types `mcpReq.envelope` as empty, so the capabilities are read by key and validated.
 */
function clientCapabilities(mcp: ServerContext) {
  const declared: unknown = Reflect.get(mcp.mcpReq.envelope ?? {}, CLIENT_CAPABILITIES_META_KEY);
  return isSpecType.ClientCapabilities(declared) ? declared : undefined;
}
