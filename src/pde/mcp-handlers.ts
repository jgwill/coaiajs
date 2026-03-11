/**
 * PDE MCP tool dispatch — handles each tool by calling stcMapper + sessionManager
 * Ported from coaia-pde/src/mcp-server.ts handler logic
 */

import type { DecompositionResult, McpToolResult } from '../types.js';
import { stcMapper } from './stc-mapper.js';
import { sessionManager } from './session-manager.js';

export async function handlePdeTool(
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  try {
    switch (name) {
      case 'import_pde_decomposition': {
        const pdeId = args.pde_id as string;
        const workdir = args.workdir as string | undefined;

        const stored = await sessionManager.loadPdeDecomposition(pdeId, workdir);
        if (!stored) {
          throw new Error(`PDE decomposition ${pdeId} not found in .pde/ directory`);
        }

        const { entities, relations, chartId } = stcMapper.mapDecompositionToChart(
          stored.result,
          stored.prompt,
          { pdeId: stored.id }
        );

        const session = await sessionManager.initSession(stored.prompt, chartId, stored.id);
        for (const entity of entities) {
          await sessionManager.appendEntity(session.sessionId, entity);
        }
        for (const relation of relations) {
          await sessionManager.appendRelation(session.sessionId, relation);
        }

        const desiredOutcome = entities.find(e => e.entityType === 'desired_outcome')?.observations[0];
        const currentReality = entities.find(e => e.entityType === 'current_reality')?.observations;
        const actionSteps = entities
          .filter(e => e.entityType === 'action_step')
          .map(e => ({ name: e.name, description: e.observations[0] }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: session.sessionId,
              chartId,
              pdeDecompositionId: stored.id,
              filePath: await sessionManager.getSessionFilePath(session.sessionId),
              chart: { desiredOutcome, currentReality, actionSteps },
            }, null, 2)
          }]
        };
      }

      case 'create_stc_from_pde': {
        const resultJson = args.decomposition_result as DecompositionResult;
        const originalPrompt = args.original_prompt as string;

        const { entities, relations, chartId } = stcMapper.mapDecompositionToChart(
          resultJson,
          originalPrompt
        );

        const session = await sessionManager.initSession(originalPrompt, chartId);
        for (const entity of entities) {
          await sessionManager.appendEntity(session.sessionId, entity);
        }
        for (const relation of relations) {
          await sessionManager.appendRelation(session.sessionId, relation);
        }

        const desiredOutcome = entities.find(e => e.entityType === 'desired_outcome')?.observations[0];
        const currentReality = entities.find(e => e.entityType === 'current_reality')?.observations;
        const actionSteps = entities
          .filter(e => e.entityType === 'action_step')
          .map(e => ({ name: e.name, description: e.observations[0] }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: session.sessionId,
              chartId,
              filePath: await sessionManager.getSessionFilePath(session.sessionId),
              chart: { desiredOutcome, currentReality, actionSteps },
            }, null, 2)
          }]
        };
      }

      case 'list_pde_decompositions': {
        const workdir = args.workdir as string | undefined;
        const decompositions = await sessionManager.listPdeDecompositions(workdir);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: decompositions.length,
              decompositions: decompositions.map(d => ({
                id: d.id,
                timestamp: d.timestamp,
                prompt: d.prompt.substring(0, 100) + (d.prompt.length > 100 ? '...' : '')
              }))
            }, null, 2)
          }]
        };
      }

      case 'get_session': {
        const sessionId = args.session_id as string;
        const { session, entities } = await sessionManager.loadSession(sessionId);

        const chart = entities.find(e => e.entityType === 'structural_tension_chart');
        const desiredOutcome = entities.find(e => e.entityType === 'desired_outcome');
        const currentReality = entities.find(e => e.entityType === 'current_reality');
        const actionSteps = entities.filter(e => e.entityType === 'action_step');

        const completedCount = actionSteps.filter(a => a.metadata?.completionStatus).length;
        const progress = actionSteps.length > 0 ? completedCount / actionSteps.length : 0;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              session,
              chart: {
                chartId: chart?.metadata?.chartId,
                desiredOutcome: desiredOutcome?.observations[0],
                currentReality: currentReality?.observations,
                dueDate: chart?.metadata?.dueDate,
                progress: Math.round(progress * 100) + '%',
                completedActions: completedCount,
                totalActions: actionSteps.length
              },
              actionSteps: actionSteps.map(a => ({
                name: a.name,
                description: a.observations[0],
                completed: a.metadata?.completionStatus || false,
                dueDate: a.metadata?.dueDate,
                progress: a.observations.slice(1)
              }))
            }, null, 2)
          }]
        };
      }

      case 'list_sessions': {
        const status = args.status as string | undefined;
        let sessions = await sessionManager.listSessions();

        if (status && status !== 'all') {
          sessions = sessions.filter(s => s.status === status);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: sessions.length,
              sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                status: s.status,
                createdAt: s.createdAt,
                pdeDecompositionId: s.pdeDecompositionId,
                prompt: s.originalPrompt.substring(0, 100) + (s.originalPrompt.length > 100 ? '...' : '')
              }))
            }, null, 2)
          }]
        };
      }

      case 'update_action_progress': {
        const sessionId = args.session_id as string;
        const actionName = args.action_name as string;
        const observation = args.observation as string;
        const updateCR = args.update_current_reality as boolean | undefined;

        const { entities } = await sessionManager.loadSession(sessionId);
        const action = entities.find(e => e.name === actionName);

        if (!action) {
          throw new Error(`Action step ${actionName} not found`);
        }

        action.observations.push(observation);
        await sessionManager.updateEntity(sessionId, actionName, { observations: action.observations });

        if (updateCR) {
          const chartId = action.metadata?.chartId;
          const realityName = `${chartId}_current_reality`;
          const reality = entities.find(e => e.name === realityName);
          if (reality) {
            reality.observations.push(`Progress: ${observation}`);
            await sessionManager.updateEntity(sessionId, realityName, { observations: reality.observations });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, actionName, observation })
          }]
        };
      }

      case 'mark_action_complete': {
        const sessionId = args.session_id as string;
        const actionName = args.action_name as string;
        const completionNote = args.completion_note as string | undefined;

        const { entities } = await sessionManager.loadSession(sessionId);
        const action = entities.find(e => e.name === actionName);

        if (!action) {
          throw new Error(`Action step ${actionName} not found`);
        }

        if (!action.metadata) action.metadata = {};
        action.metadata.completionStatus = true;
        action.metadata.updatedAt = new Date().toISOString();

        if (completionNote) {
          action.observations.push(`Completed: ${completionNote}`);
        }

        await sessionManager.updateEntity(sessionId, actionName, {
          observations: action.observations,
          metadata: action.metadata
        });

        const chartId = action.metadata?.chartId;
        const realityName = `${chartId}_current_reality`;
        const reality = entities.find(e => e.name === realityName);
        if (reality) {
          reality.observations.push(`Completed: ${action.observations[0]}`);
          await sessionManager.updateEntity(sessionId, realityName, { observations: reality.observations });
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, actionName, completed: true })
          }]
        };
      }

      case 'add_action_step': {
        const sessionId = args.session_id as string;
        const description = args.action_description as string;
        const currentReality = args.current_reality as string | undefined;

        const { session, entities } = await sessionManager.loadSession(sessionId);
        const chart = entities.find(e => e.entityType === 'structural_tension_chart');
        const chartId = (chart?.metadata?.chartId as string) || session.masterChartId;

        const existingActions = entities.filter(e => e.entityType === 'action_step');
        const actionNum = existingActions.length + 1;
        const actionName = `${chartId}_action_${actionNum}`;
        const now = new Date().toISOString();

        const newAction = {
          name: actionName,
          entityType: 'action_step',
          observations: currentReality ? [description, `Current: ${currentReality}`] : [description],
          metadata: {
            chartId,
            completionStatus: false,
            level: 1,
            parentChart: chartId,
            createdAt: now,
            updatedAt: now,
          }
        };

        await sessionManager.appendEntity(sessionId, newAction);
        await sessionManager.appendRelation(sessionId, {
          from: `${chartId}_chart`,
          to: actionName,
          relationType: 'has_action_step',
          metadata: { createdAt: now }
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, actionName, description })
          }]
        };
      }

      case 'update_current_reality': {
        const sessionId = args.session_id as string;
        const observations = args.observations as string[];

        const { session, entities } = await sessionManager.loadSession(sessionId);
        const chartId = session.masterChartId;
        const realityName = `${chartId}_current_reality`;
        const reality = entities.find(e => e.name === realityName);

        if (!reality) {
          throw new Error(`Current reality not found for chart ${chartId}`);
        }

        reality.observations.push(...observations);
        await sessionManager.updateEntity(sessionId, realityName, { observations: reality.observations });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, added: observations.length, totalObservations: reality.observations.length })
          }]
        };
      }

      case 'complete_session': {
        const sessionId = args.session_id as string;
        const finalNote = args.final_note as string | undefined;

        await sessionManager.updateSession(sessionId, { status: 'completed' });

        if (finalNote) {
          const { session, entities } = await sessionManager.loadSession(sessionId);
          const realityName = `${session.masterChartId}_current_reality`;
          const reality = entities.find(e => e.name === realityName);
          if (reality) {
            reality.observations.push(`Final: ${finalNote}`);
            await sessionManager.updateEntity(sessionId, realityName, { observations: reality.observations });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, sessionId, status: 'completed' })
          }]
        };
      }

      default:
        throw new Error(`Unknown PDE tool: ${name}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${message}`,
      }],
      isError: true
    };
  }
}
