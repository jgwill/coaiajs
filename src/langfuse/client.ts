// coaiajs/src/langfuse/client.ts — Langfuse v4 REST and OpenTelemetry client

import { createHash, randomBytes } from 'node:crypto';
import { LangfuseClient as OfficialLangfuseClient } from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import {
  setLangfuseTracerProvider,
  startObservation,
} from '@langfuse/tracing';
import { TraceFlags, type SpanContext } from '@opentelemetry/api';
import { NodeTracerProvider, type IdGenerator } from '@opentelemetry/sdk-trace-node';
import { getConfig } from '../config.js';

export interface LangfuseClientConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

export type V4ObservationType = 'SPAN' | 'GENERATION' | 'EVENT';

export interface V4ObservationInput {
  traceId?: string;
  observationId?: string;
  parentObservationId?: string;
  name: string;
  type?: V4ObservationType;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
  environment?: string;
  startTime?: string;
  endTime?: string;
  model?: string;
  modelParameters?: Record<string, string | number>;
  usageDetails?: Record<string, number>;
  costDetails?: Record<string, number>;
  traceName?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  traceMetadata?: Record<string, unknown>;
}

export interface V4ObservationResult {
  traceId: string;
  observationId: string;
}

// The Langfuse tracing package stores its isolated provider globally. Serialize
// short-lived exports so concurrent callers cannot swap providers mid-span.
let exportQueue: Promise<void> = Promise.resolve();

export class LangfuseClient {
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  readonly sdk: OfficialLangfuseClient;

  constructor(config?: LangfuseClientConfig) {
    const appConfig = getConfig();
    this.publicKey = config?.publicKey ?? appConfig.langfuse?.publicKey ?? '';
    this.secretKey = config?.secretKey ?? appConfig.langfuse?.secretKey ?? '';
    this.baseUrl = (config?.baseUrl ?? appConfig.langfuse?.baseUrl ?? 'https://cloud.langfuse.com').replace(/\/+$/, '');
    this.sdk = new OfficialLangfuseClient({
      publicKey: this.publicKey,
      secretKey: this.secretKey,
      baseUrl: this.baseUrl,
    });
  }

  get api(): OfficialLangfuseClient['api'] {
    return this.sdk.api;
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
      'x-langfuse-sdk-name': 'coaiajs',
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

  /**
   * Export one complete, immutable observation through the Langfuse JS SDK v5
   * OpenTelemetry pipeline. This replaces legacy trace/observation events sent
   * to POST /api/public/ingestion.
   */
  async exportObservation(input: V4ObservationInput): Promise<V4ObservationResult> {
    const pending = exportQueue.then(() => this.exportObservationNow(input));
    exportQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private async exportObservationNow(input: V4ObservationInput): Promise<V4ObservationResult> {
    const traceId = normalizeTraceId(input.traceId);
    const observationId = normalizeObservationId(input.observationId);
    const idGenerator = new FixedIdGenerator(traceId, observationId);
    const processor = new LangfuseSpanProcessor({
      publicKey: this.publicKey,
      secretKey: this.secretKey,
      baseUrl: this.baseUrl,
      exportMode: 'immediate',
      mediaUploadEnabled: false,
      additionalHeaders: { 'x-langfuse-ingestion-version': '4' },
    });
    const provider = new NodeTracerProvider({
      idGenerator,
      spanProcessors: [processor],
    });

    setLangfuseTracerProvider(provider);
    try {
      const parentSpanContext = input.parentObservationId
        ? makeParentSpanContext(traceId, input.parentObservationId)
        : undefined;
      const options = {
        startTime: input.startTime ? new Date(input.startTime) : undefined,
        parentSpanContext,
      };
      const baseAttributes = {
        input: input.input,
        output: input.output,
        metadata: input.metadata,
        level: input.level,
        statusMessage: input.statusMessage,
        version: input.version,
        environment: input.environment,
      };
      const observation = (() => {
        switch (input.type ?? 'SPAN') {
          case 'GENERATION':
            return startObservation(input.name, {
              ...baseAttributes,
              model: input.model,
              modelParameters: input.modelParameters,
              usageDetails: input.usageDetails,
              costDetails: input.costDetails,
            }, { ...options, asType: 'generation' });
          case 'EVENT':
            // LangfuseEvent ends immediately in its constructor, before trace-wide
            // attributes can be attached. Create a zero/short span and set its
            // final observation type before ending it instead.
            return startObservation(input.name, baseAttributes, { ...options, asType: 'span' });
          default:
            return startObservation(input.name, baseAttributes, { ...options, asType: 'span' });
        }
      })();
      observation.otelSpan.setAttributes(buildTraceAttributes(input));
      if ((input.type ?? 'SPAN') === 'EVENT') {
        observation.otelSpan.setAttribute('langfuse.observation.type', 'event');
      }
      observation.end(input.endTime ? new Date(input.endTime) : undefined);
      await processor.forceFlush();

      return {
        traceId: observation.traceId,
        observationId: observation.id,
      };
    } finally {
      setLangfuseTracerProvider(null);
      await provider.shutdown();
    }
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

class FixedIdGenerator implements IdGenerator {
  constructor(
    private readonly traceId: string,
    private readonly firstSpanId: string,
  ) {}

  private usedFirstSpanId = false;

  generateTraceId(): string {
    return this.traceId;
  }

  generateSpanId(): string {
    if (!this.usedFirstSpanId) {
      this.usedFirstSpanId = true;
      return this.firstSpanId;
    }
    return randomBytes(8).toString('hex');
  }
}

function makeParentSpanContext(traceId: string, parentObservationId: string): SpanContext {
  return {
    traceId,
    spanId: normalizeObservationId(parentObservationId),
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  };
}

function normalizeTraceId(value?: string): string {
  if (!value) return randomBytes(16).toString('hex');
  const compact = value.replaceAll('-', '').toLowerCase();
  if (/^[0-9a-f]{32}$/.test(compact) && !/^0+$/.test(compact)) return compact;
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function normalizeObservationId(value?: string): string {
  if (!value) return randomBytes(8).toString('hex');
  const compact = value.replaceAll('-', '').toLowerCase();
  if (/^[0-9a-f]{16}$/.test(compact) && !/^0+$/.test(compact)) return compact;
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function buildTraceAttributes(input: V4ObservationInput): Record<string, string | string[]> {
  const attributes: Record<string, string | string[]> = {};
  if (input.traceName) attributes['langfuse.trace.name'] = input.traceName;
  if (input.userId) attributes['langfuse.user.id'] = input.userId;
  if (input.sessionId) attributes['langfuse.session.id'] = input.sessionId;
  if (input.tags?.length) attributes['langfuse.trace.tags'] = input.tags;
  if (input.version) attributes['langfuse.version'] = input.version;
  if (input.environment) attributes['langfuse.environment'] = input.environment;
  for (const [key, value] of Object.entries(stringifyMetadata(input.traceMetadata))) {
    attributes[`langfuse.trace.metadata.${key}`] = value;
  }
  return attributes;
}

function stringifyMetadata(metadata?: Record<string, unknown>): Record<string, string> {
  if (!metadata) return {};
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return [key, serialized.slice(0, 200)];
  }));
}

export function nowISO(): string {
  return new Date().toISOString();
}

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
