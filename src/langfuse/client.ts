// coaiajs/src/langfuse/client.ts — Langfuse REST client
// Parity with cofuse.py's direct REST approach (no SDK dependency for API calls)

import { getConfig } from '../config.js';

export interface IngestionEvent {
  id: string;
  timestamp: string;
  type: 'trace-create' | 'observation-create' | 'score-create' | 'sdk-log';
  body: Record<string, unknown>;
}

export interface LangfuseClientConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

export class LangfuseClient {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(config?: LangfuseClientConfig) {
    const appConfig = getConfig();
    this.publicKey = config?.publicKey ?? appConfig.langfuse?.publicKey ?? '';
    this.secretKey = config?.secretKey ?? appConfig.langfuse?.secretKey ?? '';
    this.baseUrl = (config?.baseUrl ?? appConfig.langfuse?.baseUrl ?? 'https://cloud.langfuse.com').replace(/\/+$/, '');
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const text = await response.text();

    if (!response.ok) {
      let detail: string;
      try {
        detail = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        detail = text;
      }
      throw new LangfuseApiError(
        `Langfuse API error ${response.status}: ${detail}`,
        response.status,
        detail,
      );
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async ingest(events: IngestionEvent[]): Promise<void> {
    await this.request('POST', '/api/public/ingestion', { batch: events });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

export class LangfuseApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly detail: string,
  ) {
    super(message);
    this.name = 'LangfuseApiError';
  }
}

// Singleton with lazy init
let _client: LangfuseClient | null = null;

export function getClient(config?: LangfuseClientConfig): LangfuseClient {
  if (!_client) {
    _client = new LangfuseClient(config);
  }
  return _client;
}

export function resetClient(): void {
  _client = null;
}

export function nowISO(): string {
  return new Date().toISOString();
}
