// coaiajs/src/audio.ts — Audio synthesis module
// Parity with coaiapy's syntation.py using AWS Polly

import {
  PollyClient,
  SynthesizeSpeechCommand,
  type SynthesizeSpeechCommandInput,
} from '@aws-sdk/client-polly';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getConfig } from './config.js';

let _client: PollyClient | null = null;

function getPollyClient(): PollyClient {
  if (!_client) {
    const cfg = getConfig();
    _client = new PollyClient({
      region: cfg.aws?.region ?? process.env['AWS_REGION'] ?? 'us-east-1',
      credentials:
        cfg.aws?.accessKeyId
          ? {
              accessKeyId: cfg.aws.accessKeyId,
              secretAccessKey: cfg.aws.secretAccessKey ?? '',
            }
          : undefined,
    });
  }
  return _client;
}

/** Reset client (testing). */
export function resetClient(): void {
  _client = null;
}

/**
 * Synthesize text to speech using AWS Polly.
 * Returns the path to the output audio file.
 *
 * @param text - Text to synthesize
 * @param voiceId - Polly voice ID (default: "Joanna")
 * @param outFile - Output file path (default: "./output.mp3")
 */
export async function synthesize(
  text: string,
  voiceId?: string,
  outFile?: string,
): Promise<string> {
  const client = getPollyClient();
  const outputPath = resolve(outFile ?? './output.mp3');

  const params: SynthesizeSpeechCommandInput = {
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: (voiceId ?? 'Joanna') as SynthesizeSpeechCommandInput['VoiceId'],
    Engine: 'neural',
  };

  const result = await client.send(new SynthesizeSpeechCommand(params));

  if (result.AudioStream) {
    // AudioStream is a Readable or Uint8Array depending on environment
    const chunks: Uint8Array[] = [];
    const stream = result.AudioStream as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    writeFileSync(outputPath, buffer);
  }

  return outputPath;
}
