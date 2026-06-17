/**
 * PDE module — Prompt Decomposition Engine → Structural Tension Chart transformation
 */

export { StcMapper, stcMapper } from './stc-mapper.js';
export { SessionManager, sessionManager } from './session-manager.js';
export { PDE_MCP_TOOLS } from './mcp-tools.js';
export { handlePdeTool } from './mcp-handlers.js';

import { handlePdeTool } from './mcp-handlers.js';
import type { McpToolResult } from '../types.js';

function firstText(result: McpToolResult): string {
  return result.content[0]?.text ?? '';
}

export async function importDecomposition(pdeId: string, workdir?: string): Promise<string> {
  return firstText(await handlePdeTool('import_pde_decomposition', {
    pde_id: pdeId,
    workdir,
  }));
}

export async function listDecompositions(workdir?: string): Promise<string> {
  return firstText(await handlePdeTool('list_pde_decompositions', { workdir }));
}

export async function listSessions(status = 'all'): Promise<string> {
  return firstText(await handlePdeTool('list_sessions', { status }));
}

export async function showSession(sessionId: string): Promise<string> {
  return firstText(await handlePdeTool('get_session', { session_id: sessionId }));
}
