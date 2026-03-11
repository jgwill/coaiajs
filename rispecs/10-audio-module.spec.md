# 10 — Audio Module

> Audio transcription (OpenAI Whisper) and synthesis (AWS Polly).

## Desired Outcome

An audio module providing speech-to-text transcription via OpenAI Whisper and text-to-speech synthesis via AWS Polly — enabling voice-driven agent interactions and audio content generation.

## Structural Tension

**Current Reality:**
- `src/audio.ts` is fully implemented (76 lines) with `synthesize()` function using AWS Polly
- `src/llm.ts` includes `transcribeAudio()` using OpenAI Whisper
- Both use lazy client initialization
- coaiapy's `syntation.py` provides the same functionality via boto3 and openai Python packages
- No MCP tools exist for audio in any parent project

**Desired Outcome:**
Audio module consolidating transcription and synthesis in one place:
- `transcribe(audioPath)` — OpenAI Whisper speech-to-text
- `synthesize(text, outputPath, options?)` — AWS Polly text-to-speech
- 2 MCP tools for interactive audio operations
- Support for multiple voices, engines, and output formats

## Core API

```typescript
// Transcription (via OpenAI Whisper)
transcribe(audioPath: string, options?: {
  model?: string;       // default: 'whisper-1'
  language?: string;    // ISO 639-1 code
  prompt?: string;      // context hint
}): Promise<string>     // returns transcribed text

// Synthesis (via AWS Polly)
synthesize(text: string, outputPath: string, options?: {
  voice?: string;       // default: 'Joanna' (from config)
  engine?: 'neural' | 'standard';  // default: 'neural'
  format?: 'mp3' | 'ogg_vorbis' | 'pcm';  // default: 'mp3'
}): Promise<string>     // returns output file path
```

## MCP Tools (2)

| Tool | Purpose |
|------|---------|
| `audio_transcribe` | Transcribe audio file to text |
| `audio_synthesize` | Synthesize text to audio file |

## Configuration

Uses config keys from `src/config.ts`:
- `openai_api_key` — for Whisper transcription
- `aws_access_key_id`, `aws_secret_access_key`, `aws_region` — for Polly synthesis
- `aws_polly_voice` — default voice (fallback: `Joanna`)

## Quality Criteria

- ✅ `transcribe()` accepts wav, mp3, m4a, webm, mp4 audio files
- ✅ `synthesize()` produces valid MP3 output playable in standard players
- ✅ Missing credentials produce clear error at call time, not import time
- ✅ Parity with coaiapy's transcription and synthesis behavior
- ✅ `resetClient()` clears cached clients for test isolation
