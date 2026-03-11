// coaiajs/src/llm.ts — LLM module
// Parity with coaiapy's OpenAI functions

import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { getConfig } from './config.js';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const cfg = getConfig();
    _client = new OpenAI({
      apiKey: cfg.openai?.apiKey ?? process.env['OPENAI_API_KEY'],
    });
  }
  return _client;
}

/** Reset client (testing). */
export function resetClient(): void {
  _client = null;
}

/**
 * Send a chat completion request.
 * Minimal wrapper matching coaiapy's `llm()` function.
 */
export async function llm(
  user: string,
  system?: string,
  temperature?: number,
): Promise<string> {
  const client = getClient();
  const cfg = getConfig();
  const model = cfg.openai?.model ?? 'gpt-4o';

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: user });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: temperature ?? 0.7,
  });

  return response.choices[0]?.message?.content ?? '';
}

/**
 * Transcribe audio using Whisper API.
 * Parity with coaiapy's transcription functions.
 */
export async function transcribeAudio(filePath: string): Promise<string> {
  const client = getClient();

  const file = new File(
    [readFileSync(filePath)],
    filePath.split('/').pop() ?? 'audio.wav',
    { type: 'audio/wav' },
  );

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  return response.text;
}

/**
 * Generate an image using DALL-E.
 * Returns the URL of the generated image.
 */
export async function generateImage(
  prompt: string,
  size?: string,
): Promise<string> {
  const client = getClient();

  const validSize = (size ?? '1024x1024') as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: validSize,
  });

  return response.data?.[0]?.url ?? '';
}

/**
 * Abstract process: config-driven LLM call with a named process.
 * Looks up system prompt by processName in config or uses a default.
 */
export async function abstractProcess(
  processName: string,
  input: string,
): Promise<string> {
  const systemPrompt = `You are executing the "${processName}" process. Follow the process instructions precisely and produce the expected output format.`;
  return llm(input, systemPrompt);
}
