# Ceremony Media Upload Proxy

`ceremony-media-proxy.yml` is the executable bridge missing from direct Langfuse media actions. It uses the official Custom GPT `openaiFileIdRefs` mechanism, so the GPT sends a temporary reference to the user's real file instead of attempting to place a large Base64 payload in function arguments.

## Why this is a second action specification

The main `ceremony-observations.yml` talks directly to `cloud.langfuse.com`. A presigned media URL points to a dynamic object-storage host, which cannot be represented as a static OpenAPI path. The bridge therefore runs on a public HTTPS service you control and is imported as a second GPT Action. Together the specifications expose 24 actions, below the 30-action limit.

## Deploy the bridge

Build and run the included Node service:

```bash
npm install
npm run build

export LANGFUSE_PUBLIC_KEY='pk-lf-...'
export LANGFUSE_SECRET_KEY='sk-lf-...'
export LANGFUSE_BASE_URL='https://cloud.langfuse.com'
export COAIA_MEDIA_PROXY_API_KEY='generate-a-long-random-secret'
export PORT=8787

node dist/src/media-upload-proxy.js
# or, from the installed package:
coaiajs-media-proxy
```

Deploy it behind a public HTTPS URL. The Custom GPT service cannot reach localhost.

Optional controls:

- `COAIA_MEDIA_MAX_BYTES`: maximum downloaded file size; defaults to 10 MiB.
- `COAIA_OPENAI_FILE_HOSTS`: comma-separated additional trusted conversation-file hosts.
- `COAIA_MEDIA_UPLOAD_HOSTS`: comma-separated additional trusted presigned-upload hosts for self-hosted storage.
- `COAIA_MEDIA_ALLOW_HTTP=true`: allows HTTP for local tests only; never use it in production.

The proxy only downloads from approved OpenAI file hosts and only uploads to approved S3-compatible storage hosts. It rejects empty files, invalid media contexts, oversized payloads, and untrusted URLs.

## Configure the Custom GPT

1. Replace `https://replace-with-your-proxy.invalid` in `ceremony-media-proxy.yml` with the deployed HTTPS origin.
2. Import it as a second Action alongside `ceremony-observations.yml`.
3. Configure API Key authentication with:
   - Header: `X-Coaia-Proxy-Key`
   - Value: the `COAIA_MEDIA_PROXY_API_KEY` configured on the service
4. Keep `x-openai-isConsequential: false` unchanged.
5. Do not put the proxy key or Langfuse keys in GPT instructions or conversation text.

## GPT behavior

Add this to the GPT instructions:

```markdown
When the user supplies media for Langfuse, call media_uploadConversationFile
with exactly that conversation file in openaiFileIdRefs and the target trace or
dataset-item context. Never create placeholder bytes unless explicitly asked.

The bridge performs media-record creation, exact-byte hashing, the presigned PUT,
and media finalization. Do not claim success unless the bridge returns
success=true and a mediaToken.

Put the returned mediaToken unchanged into an observation input, output, or
metadata value, then call observations_export. Optionally call media_get with
the returned mediaId to verify uploadedAt and the temporary URL.
```

## Completed flow

```text
user/DALL-E/Code Interpreter file
    → openaiFileIdRefs temporary download URL
    → media_uploadConversationFile
        → download exact bytes
        → compute padded Base64 SHA-256 and exact length/type
        → POST /api/public/media
        → PUT exact bytes to the presigned storage URL
        → PATCH /api/public/media/{mediaId}
        → return @@@langfuseMedia:type=...|id=...|source=bytes@@@
    → observations_export containing the returned media token
    → observations_list / media_get verification
```

Primary references:

- OpenAI GPT Actions file transfer: https://developers.openai.com/api/docs/actions/sending-files
- Langfuse multi-modality and media tokens: https://langfuse.com/docs/observability/features/multi-modality
