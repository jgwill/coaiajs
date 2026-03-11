# @aws-sdk/client-polly: Technical Assessment for CoAiA.js

> Package selection brief — Text-to-speech synthesis replacing coaiapy's boto3-based syntation.py

## Summary & Recommendation

**Use `@aws-sdk/client-polly` v3.x** (currently 3.997.0). The AWS SDK v3 modular architecture means we import only the Polly client — not the entire AWS SDK. Streaming audio responses pipe directly to files or downstream consumers. This replaces coaiapy's `syntation.py` which uses boto3 with manually configured credentials.

**Pin:** `"@aws-sdk/client-polly": "^3.700.0"`

## What We're Replacing

Coaiapy's `syntation.py` uses boto3 for AWS Polly:

```python
# coaiapy/syntation.py — boto3-based Polly
import boto3
from coaiamodule import read_config

def synthesize(text, voice_id, outfile, outformat="mp3"):
    config = read_config()
    key = config["pollyconf"]["key"]
    secret = config["pollyconf"]["secret"]
    region = config["pollyconf"]["region"]
    
    polly = boto3.client('polly',
                         aws_access_key_id=key,
                         aws_secret_access_key=secret,
                         region_name=region)
    response = polly.synthesize_speech(
        Text=text,
        OutputFormat=outformat,
        VoiceId=voice_id
    )
    # Write audio stream to file
    with open(outfile, 'wb') as f:
        f.write(response['AudioStream'].read())
```

Key issues: monolithic boto3 import (~100MB installed), manual credential management from config file, synchronous blocking I/O.

## Options Compared

| Feature | @aws-sdk/client-polly v3 | boto3 (Python) | AWS SDK v2 (deprecated) |
|---------|------------------------|----------------|----------------------|
| Install size | ~5MB (just Polly) | ~100MB (all of boto3) | ~40MB (entire aws-sdk) |
| Modular imports | ✅ Only Polly client | ❌ Entire SDK | ❌ Entire SDK |
| Streaming response | ✅ Node.js Readable stream | ⚠️ StreamingBody | ✅ |
| Credential chain | ✅ Automatic (env, profile, IMDS) | ✅ Automatic | ✅ Automatic |
| TypeScript | Full native types | N/A | @types/aws-sdk |
| Async/await | ✅ Native | ✅ | ⚠️ Callback + promise |
| End of support | Active | Active | September 2025 ❌ |
| SSML support | ✅ | ✅ | ✅ |
| Neural voices | ✅ | ✅ | ✅ |

## API Overview

### Basic Speech Synthesis

```typescript
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { loadConfig } from '../config.js';

const config = loadConfig();

const polly = new PollyClient({
  region: config.awsRegion ?? 'us-east-1',
  // Credentials auto-resolve from env/profile/config
  // Or explicit:
  credentials: config.pollyKey ? {
    accessKeyId: config.pollyKey,
    secretAccessKey: config.pollySecret!,
  } : undefined,
});

async function synthesize(
  text: string,
  voiceId: string,
  outfile: string,
  format: 'mp3' | 'ogg_vorbis' | 'pcm' = 'mp3'
): Promise<void> {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    VoiceId: voiceId,
    OutputFormat: format,
    Engine: 'neural', // Use neural voices for quality
  });

  const response = await polly.send(command);

  if (response.AudioStream instanceof Readable) {
    await pipeline(response.AudioStream, createWriteStream(outfile));
  }
}
```

### SSML Support (Rich Speech Control)

```typescript
async function synthesizeSSML(
  ssml: string,
  voiceId: string,
  outfile: string
): Promise<void> {
  const command = new SynthesizeSpeechCommand({
    Text: ssml,
    TextType: 'ssml',
    VoiceId: voiceId,
    OutputFormat: 'mp3',
    Engine: 'neural',
  });

  const response = await polly.send(command);
  if (response.AudioStream instanceof Readable) {
    await pipeline(response.AudioStream, createWriteStream(outfile));
  }
}

// Usage
await synthesizeSSML(
  `<speak>
    <prosody rate="slow">Welcome to CoAiA.</prosody>
    <break time="500ms"/>
    Your structural tension chart has <emphasis>three</emphasis> pending actions.
  </speak>`,
  'Joanna',
  'output.mp3'
);
```

### Long-Form Synthesis (Start Task)

For texts >3000 characters, use the async task API:

```typescript
import { 
  PollyClient, 
  StartSpeechSynthesisTaskCommand,
  GetSpeechSynthesisTaskCommand 
} from '@aws-sdk/client-polly';

async function synthesizeLongForm(
  text: string,
  voiceId: string,
  s3Bucket: string,
  s3Key: string
): Promise<string> {
  const command = new StartSpeechSynthesisTaskCommand({
    Text: text,
    VoiceId: voiceId,
    OutputFormat: 'mp3',
    OutputS3BucketName: s3Bucket,
    OutputS3KeyPrefix: s3Key,
    Engine: 'neural',
  });

  const response = await polly.send(command);
  const taskId = response.SynthesisTask?.TaskId;

  // Poll for completion
  let status = 'inProgress';
  while (status === 'inProgress' || status === 'scheduled') {
    await new Promise(r => setTimeout(r, 2000));
    const task = await polly.send(
      new GetSpeechSynthesisTaskCommand({ TaskId: taskId })
    );
    status = task.SynthesisTask?.TaskStatus ?? 'failed';
  }

  return response.SynthesisTask?.OutputUri ?? '';
}
```

### Voice Listing

```typescript
import { DescribeVoicesCommand } from '@aws-sdk/client-polly';

async function listVoices(language?: string): Promise<{ id: string; name: string; engine: string }[]> {
  const command = new DescribeVoicesCommand({
    LanguageCode: language,
    Engine: 'neural',
  });

  const response = await polly.send(command);
  return (response.Voices ?? []).map(v => ({
    id: v.Id!,
    name: v.Name!,
    engine: v.SupportedEngines?.join(', ') ?? 'standard',
  }));
}
```

### Stream to Buffer (for API responses)

```typescript
async function synthesizeToBuffer(text: string, voiceId: string): Promise<Buffer> {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    VoiceId: voiceId,
    OutputFormat: 'mp3',
    Engine: 'neural',
  });

  const response = await polly.send(command);
  
  if (response.AudioStream instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('No audio stream in response');
}
```

## Integration Plan

1. **Core module:** `src/polly/client.ts` — PollyClient singleton from config
2. **Synthesis:** `src/polly/synthesize.ts` — text/SSML → audio file/buffer
3. **Voice management:** `src/polly/voices.ts` — list/select voices
4. **CLI command:** `src/commands/speak.ts` or integrate into pipeline steps
5. **MCP tool:** `mcp/tools/speech.ts` — speech synthesis as an agent tool
6. **Credential pattern:** AWS credential chain (env → profile → config file)

### Credential Migration

```typescript
// BEFORE (coaiapy — manual from config)
key = config["pollyconf"]["key"]
secret = config["pollyconf"]["secret"]

// AFTER (coaiajs — AWS credential chain)
// Option 1: Environment variables (recommended)
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

// Option 2: Explicit from coaia config (backward compat)
const polly = new PollyClient({
  region: config.awsRegion,
  credentials: config.pollyKey ? {
    accessKeyId: config.pollyKey,
    secretAccessKey: config.pollySecret!,
  } : undefined, // falls back to default credential chain
});
```

## Version & Ecosystem

| Metric | Value |
|--------|-------|
| Current version | 3.997.0 (Feb 2026) |
| Install size | ~5MB (Polly client only) |
| TypeScript | Full native types |
| Node.js compat | ≥16 (we target ≥20) |
| Streaming | Native Node.js Readable |
| Credential chain | env → profile → IMDS → config |
| Neural voices | 60+ voices, 30+ languages |
| SSML | Full support |
| License | Apache-2.0 |

## References

- npm: https://www.npmjs.com/package/@aws-sdk/client-polly
- AWS Polly docs: https://docs.aws.amazon.com/polly/
- SDK v3 migration: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/
- v2 EOL notice: https://www.npmjs.com/package/aws-sdk
