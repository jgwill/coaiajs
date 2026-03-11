/**
 * Session Manager — JSONL persistence for PDE sessions in .coaia/pde/<UUID>.jsonl
 * Ported from coaia-pde/src/session-manager.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, Relation, PdeSession, StoredDecomposition } from '../types.js';

function serializeEntity(entity: Entity): string {
  return JSON.stringify({ type: 'entity', ...entity });
}

function serializeRelation(relation: Relation): string {
  return JSON.stringify({ type: 'relation', ...relation });
}

export class SessionManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), '.coaia', 'pde');
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}.jsonl`);
  }

  async ensureBaseDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async initSession(
    originalPrompt: string,
    masterChartId: string,
    pdeDecompositionId?: string
  ): Promise<PdeSession> {
    await this.ensureBaseDir();

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: PdeSession = {
      type: 'pde_session',
      sessionId,
      originalPrompt,
      masterChartId,
      pdeDecompositionId,
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };

    const sessionPath = this.getSessionPath(sessionId);
    await fs.writeFile(sessionPath, JSON.stringify(session) + '\n');

    return session;
  }

  async loadSession(sessionId: string): Promise<{
    session: PdeSession;
    entities: Entity[];
    relations: Relation[];
  }> {
    const sessionPath = this.getSessionPath(sessionId);
    const data = await fs.readFile(sessionPath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim());

    let session: PdeSession | null = null;
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    for (const line of lines) {
      const item = JSON.parse(line);
      if (item.type === 'pde_session') {
        session = item as PdeSession;
      } else if (item.type === 'entity') {
        const { type: _discriminator, ...entity } = item;
        entities.push(entity as Entity);
      } else if (item.type === 'relation') {
        const { type: _discriminator, ...relation } = item;
        relations.push(relation as Relation);
      }
    }

    if (!session) {
      throw new Error(`Session ${sessionId} not found or corrupted`);
    }

    return { session, entities, relations };
  }

  async appendEntity(sessionId: string, entity: Entity): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    await fs.appendFile(sessionPath, serializeEntity(entity) + '\n');
  }

  async appendRelation(sessionId: string, relation: Relation): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    await fs.appendFile(sessionPath, serializeRelation(relation) + '\n');
  }

  async updateSession(sessionId: string, updates: Partial<PdeSession>): Promise<void> {
    const { session, entities, relations } = await this.loadSession(sessionId);
    const updatedSession = { ...session, ...updates, updatedAt: new Date().toISOString() };

    const sessionPath = this.getSessionPath(sessionId);
    const lines = [
      JSON.stringify(updatedSession),
      ...entities.map(e => serializeEntity(e)),
      ...relations.map(r => serializeRelation(r))
    ];
    await fs.writeFile(sessionPath, lines.join('\n') + '\n');
  }

  async updateEntity(sessionId: string, entityName: string, updates: Partial<Entity>): Promise<void> {
    const { session, entities, relations } = await this.loadSession(sessionId);

    const entityIndex = entities.findIndex(e => e.name === entityName);
    if (entityIndex === -1) {
      throw new Error(`Entity ${entityName} not found in session ${sessionId}`);
    }

    entities[entityIndex] = { ...entities[entityIndex], ...updates };
    if (entities[entityIndex].metadata) {
      entities[entityIndex].metadata!.updatedAt = new Date().toISOString();
    }

    const sessionPath = this.getSessionPath(sessionId);
    const lines = [
      JSON.stringify(session),
      ...entities.map(e => serializeEntity(e)),
      ...relations.map(r => serializeRelation(r))
    ];
    await fs.writeFile(sessionPath, lines.join('\n') + '\n');
  }

  async listSessions(): Promise<PdeSession[]> {
    try {
      await this.ensureBaseDir();
      const files = await fs.readdir(this.baseDir);
      const sessions: PdeSession[] = [];

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          try {
            const sessionId = file.replace('.jsonl', '');
            const { session } = await this.loadSession(sessionId);
            sessions.push(session);
          } catch {
            // Skip corrupted files
          }
        }
      }

      return sessions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    await fs.unlink(sessionPath);
  }

  async getSessionFilePath(sessionId: string): Promise<string> {
    return this.getSessionPath(sessionId);
  }

  // =========================================================================
  // PDE Decomposition File Access (.pde/ directory)
  // =========================================================================

  async listPdeDecompositions(workdir?: string): Promise<Array<{
    id: string;
    timestamp: string;
    prompt: string;
  }>> {
    const pdeDir = path.join(workdir || process.cwd(), '.pde');
    try {
      const entries = await fs.readdir(pdeDir);
      const results: Array<{ id: string; timestamp: string; prompt: string }> = [];

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        try {
          const filePath = path.join(pdeDir, entry);
          const data = await fs.readFile(filePath, 'utf-8');
          const stored = JSON.parse(data) as StoredDecomposition;
          if (stored.id && stored.result) {
            results.push({
              id: stored.id,
              timestamp: stored.timestamp,
              prompt: stored.prompt,
            });
          }
        } catch {
          // Skip invalid files
        }
      }

      return results.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch {
      return [];
    }
  }

  async loadPdeDecomposition(id: string, workdir?: string): Promise<StoredDecomposition | null> {
    const pdeDir = path.join(workdir || process.cwd(), '.pde');

    // Try direct {id}.json file first
    const directPath = path.join(pdeDir, `${id}.json`);
    try {
      const data = await fs.readFile(directPath, 'utf-8');
      return JSON.parse(data) as StoredDecomposition;
    } catch {
      // Not found as direct file — scan for matching id
    }

    // Scan directory for a .json file whose parsed id matches
    try {
      const entries = await fs.readdir(pdeDir);
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        try {
          const filePath = path.join(pdeDir, entry);
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data) as StoredDecomposition;
          if (parsed.id === id) return parsed;
        } catch {
          // Skip invalid
        }
      }
    } catch {
      // Directory not found
    }

    return null;
  }
}

export const sessionManager = new SessionManager();
