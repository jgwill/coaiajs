# Ceremony Observations GPT Action

Use `ceremony-observations.yml` when the GPT must create Langfuse traces and append nested observations. It is intentionally smaller and more explicit than `ceremony.yml` so GPT Actions can reliably construct OTLP/HTTP JSON.

## What this specification solves

Langfuse v4 does not provide mutable REST trace and observation creation endpoints. A trace is the group of immutable observations sharing one `traceId`. The supported direct-ingestion path is:

```text
POST /api/public/otel/v1/traces
Content-Type: application/json
Authorization: Basic <base64(public-key:secret-key)>
```

The `observations_export` action exposes that endpoint with a constrained OTLP schema and examples. It supports both:

1. Creating a trace by sending a root span without `parentSpanId`.
2. Appending an observation by reusing the trace ID and setting `parentSpanId` to an existing observation/span ID.

The file has **23 actions**, below the stated 30-action limit. Scores and the original media operations remain in this specification because the complete focused surface still fits. Destructive delete actions are omitted.

## Configure the Custom GPT

1. Import `ceremony-observations.yml` as the GPT Action schema.
2. If the Langfuse project is not in the EU region, replace the server URL first:
   - US: `https://us.cloud.langfuse.com`
   - Japan: `https://jp.cloud.langfuse.com`
   - HIPAA: `https://hipaa.cloud.langfuse.com`
   - Self-hosted: the deployment's public base URL
3. In the Action authentication UI choose **API Key** with a custom header:
   - Header name: `Authorization`
   - Value: `Basic BASE64_VALUE`
   - `BASE64_VALUE` is the base64 encoding of `LANGFUSE_PUBLIC_KEY:LANGFUSE_SECRET_KEY` without a trailing newline.
4. Never put either Langfuse key or the encoded Authorization value in GPT instructions, knowledge files, or conversation messages.
5. Keep Code Interpreter/Data Analysis enabled if available. Before an export, use it to generate IDs and current timestamps rather than inventing them:

   ```python
   import secrets, time
   trace_id = secrets.token_hex(16)  # only for a new trace
   span_id = secrets.token_hex(8)    # fresh for every observation
   start_ns = time.time_ns()
   # perform/describe the observed work
   end_ns = max(time.time_ns(), start_ns)
   ```

Custom GPT currently ignores ordinary OpenAPI header parameters, so this direct specification intentionally does not declare `x-langfuse-ingestion-version`. Langfuse documents that OTLP ingestion without that header still works, but data may take up to ten minutes to appear in v4 reads. If real-time visibility is mandatory, use a trusted proxy that adds `x-langfuse-ingestion-version: 4` before forwarding the request to Langfuse.

## Recommended GPT instructions

Add the following behavior to the GPT's instructions:

```markdown
### Langfuse tracing

Use observations_export to record ceremony work.

When starting a new trace:
1. Generate a cryptographically random, non-zero, lowercase 32-hex traceId.
2. Generate a cryptographically random, non-zero, lowercase 16-hex root spanId.
3. Calculate current Unix epoch nanoseconds as a decimal string.
4. Export one complete root span without parentSpanId.
5. Preserve the returned/local traceId and root spanId for later steps.

When adding an observation:
1. Reuse the exact 32-hex traceId.
2. Generate a fresh non-zero 16-hex spanId. Never reuse a spanId.
3. Set parentSpanId to the exact 16-hex ID of its parent observation.
4. Export a complete observation with start and end epoch-nanosecond strings.
5. Repeat trace-level attributes on the child.

Every span must include langfuse.observation.type. Allowed values are span,
generation, or event. JSON input/output must be serialized into stringValue.
For generations, include langfuse.observation.model.name and, when known,
langfuse.observation.usage_details as a JSON string.

Treat exported spans as immutable. Do not retry with the same spanId to edit a
span. To record a correction or later result, append a new child event/span.

After exporting, call observations_list with the traceId and fields
core,basic,time,io,metadata,model,usage,trace_context to verify the hierarchy.
Use each returned observation id as the span/parent ID for later children.

### Langfuse media

When the user supplies media, use the actual file bytes—never placeholder text.
Compute contentLength from those bytes. Compute SHA-256 over those bytes and
send the standard padded Base64 digest, not hexadecimal, as sha256Hash.

media_getUploadUrl only creates a record and returns a presigned URL. Do not
claim an upload succeeded until the exact bytes were PUT to that URL and
media_patch recorded the PUT result. If an arbitrary PUT is unavailable,
report that the media upload is pending instead of claiming completion.
```

## Minimal append example

The parent trace and root observation must already exist. Replace every example value with live values; do not copy IDs or timestamps literally.

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          {
            "key": "service.name",
            "value": { "stringValue": "custom-gpt-ceremony" }
          }
        ]
      },
      "scopeSpans": [
        {
          "scope": {
            "name": "custom-gpt-ceremony",
            "version": "0.4.2"
          },
          "spans": [
            {
              "traceId": "REPLACE_WITH_32_HEX_TRACE_ID",
              "spanId": "REPLACE_16_HEX",
              "parentSpanId": "REPLACE_16_HEX",
              "name": "ceremony-step",
              "kind": 1,
              "startTimeUnixNano": "REPLACE_WITH_EPOCH_NANOSECONDS",
              "endTimeUnixNano": "REPLACE_WITH_EPOCH_NANOSECONDS",
              "attributes": [
                {
                  "key": "langfuse.observation.type",
                  "value": { "stringValue": "span" }
                },
                {
                  "key": "langfuse.trace.name",
                  "value": { "stringValue": "ceremony" }
                },
                {
                  "key": "langfuse.observation.input",
                  "value": { "stringValue": "{\"step\":\"input\"}" }
                },
                {
                  "key": "langfuse.observation.output",
                  "value": { "stringValue": "{\"status\":\"complete\"}" }
                }
              ],
              "status": { "code": 1 }
            }
          ]
        }
      ]
    }
  ]
}
```

## Included action groups

| Group | Actions |
|---|---:|
| Observations and trace ingestion | 2 |
| Projects | 1 |
| Prompts | 4 |
| Datasets and dataset items | 6 |
| Scores and score configurations | 5 |
| Comments | 2 |
| Media | 3 |
| **Total** | **23** |

## Media workflow

When the user supplies media, always use that media's actual bytes. Never create or hash placeholder text or surrogate bytes unless the user explicitly requests a placeholder.

1. Read the exact bytes that will be uploaded.
2. Derive `contentType` from those bytes/file and set `contentLength` to their exact byte length.
3. Compute SHA-256 over those exact bytes, then encode the 32-byte digest with standard padded RFC 4648 Base64. Send the resulting 44-character value as `sha256Hash`; never send the 64-character hexadecimal digest.
4. Call `media_getUploadUrl` with the context, file metadata, Base64 hash, and field.
5. PUT the same exact bytes to the returned presigned `uploadUrl` using the declared content type.
6. Only after that PUT completes, call `media_patch` with the completion time and HTTP result.
7. Optionally call `media_get` to verify the media record and obtain a temporary download URL.

Example for the four UTF-8 bytes `test`:

```text
sha256Hash: n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=
```

Receiving `uploadUrl` creates a Langfuse media record but does **not** upload the bytes. Never report that media was uploaded after `media_getUploadUrl` alone. The current OpenAPI document cannot describe a PUT to a dynamically returned storage host. If the Custom GPT runtime cannot issue that arbitrary PUT, it must report the upload as pending; full autonomy requires a trusted repository-controlled `media_upload` proxy, which is not currently implemented.

## Why there are not separate create-trace and append-observation actions

OpenAPI allows one operation for each HTTP method/path pair, and Langfuse uses the same OTLP endpoint for both behaviors. The `observations_export` action distinguishes them through span context:

- root: new `traceId`, new `spanId`, no `parentSpanId`
- child: existing `traceId`, new `spanId`, existing parent `spanId`

A friendlier pair of actions with bodies such as `{traceId, parentId, input, output}` would require a trusted proxy that transforms those requests into OTLP and adds the ingestion-version header. An OpenAPI document alone cannot change Langfuse's wire contract.

## Primary references

- Langfuse OpenTelemetry integration: https://langfuse.com/integrations/native/opentelemetry
- Langfuse observability data model: https://langfuse.com/docs/observability/data-model
- Langfuse current OpenAPI document: https://cloud.langfuse.com/generated/api/openapi.yml
- OTLP JSON encoding: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
- OpenAI GPT Actions introduction: https://developers.openai.com/api/docs/actions/introduction
- OpenAI GPT Action authentication: https://developers.openai.com/api/docs/actions/authentication
- OpenAI GPT Actions getting started: https://developers.openai.com/api/docs/actions/getting-started
