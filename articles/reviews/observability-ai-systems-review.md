# Literature Review: Observability in AI Systems

> Literature review for the CoAiA.js project — OpenTelemetry for LLMs, Langfuse, LangSmith, and Weights & Biases examined through the trace/span/generation model for AI application monitoring.

## Abstract

Observability for AI systems—particularly LLM-powered applications—has evolved rapidly from ad-hoc logging to structured tracing frameworks that capture the full lifecycle of model interactions. This literature review examines the current state of AI observability through four lenses: OpenTelemetry as the emerging standard for vendor-neutral instrumentation, Langfuse as the leading open-source LLM observability platform, LangSmith as the LangChain-native monitoring solution, and Weights & Biases (W&B Weave) as the experiment-tracking platform extending into production monitoring. We analyze the convergence on a trace/span/generation data model, evaluate each platform's approach to evaluation and scoring, and identify the gap that structural tension methodology fills: transforming observability from a problem-detection tool into a creative advancement instrument.

## Introduction

Traditional software observability rests on three pillars: logs (event records), metrics (aggregated measurements), and traces (request-scoped execution paths). These pillars, standardized through OpenTelemetry, have proven sufficient for deterministic systems where identical inputs produce identical outputs and where "correct behavior" is well-defined [1][2].

LLM-powered applications violate both assumptions. Identical prompts can produce different outputs across invocations (non-determinism), and "correct behavior" is often subjective—dependent on context, user intent, and quality standards that resist formal specification. This fundamental shift requires observability approaches that capture not just operational health but **semantic quality**: what was generated, whether it was helpful, and how it compares to desired standards [3].

The 2024–2025 period has seen the rapid emergence of LLM-specific observability platforms that extend the traditional three pillars with a fourth: **evaluation**—structured assessment of output quality through automated scoring, human annotation, and LLM-as-judge techniques.

## Review

### OpenTelemetry: The Foundation Layer

**Overview:** OpenTelemetry (OTel) is a CNCF (Cloud Native Computing Foundation) project that provides vendor-neutral APIs, SDKs, and tools for generating and collecting telemetry data. It has become the de facto standard for observability instrumentation in cloud-native applications [1][4].

**LLM Extensions:** The OpenTelemetry community has developed semantic conventions for LLM operations, defining standard attribute names for:
- Model name and version
- Token counts (input, output, total)
- Prompt and completion content (with optional redaction)
- Temperature and other generation parameters
- Cost attribution

These conventions enable LLM telemetry to flow through existing OTel infrastructure (collectors, exporters, backends) without requiring LLM-specific tooling for data transport [4][5].

**Strengths:**
- Vendor-neutral: data can be routed to any compatible backend
- Mature ecosystem: collectors, exporters, and instrumentation libraries for all major languages
- Standards-based: semantic conventions ensure consistent data representation
- Composable: LLM traces can be correlated with infrastructure traces for full-stack visibility

**Limitations:**
- Generic by design: LLM-specific concepts (prompt management, evaluation workflows, cost optimization) are not addressed
- No built-in evaluation: OTel collects data but does not analyze quality
- Configuration complexity: setting up collectors, exporters, and backends requires significant infrastructure knowledge [6]

**Literature Position:** OTel is best understood as a foundation layer—it provides the instrumentation and transport upon which LLM-specific platforms build. Several LLM observability platforms (Langfuse, LangSmith) now support OTel data ingestion, enabling teams to use standard OTel instrumentation while routing LLM-specific data to specialized analysis platforms.

### Langfuse: Open-Source LLM Observability

**Overview:** Langfuse is an open-source (MIT-licensed) LLM observability platform providing trace-based monitoring, prompt management, evaluation workflows, and cost analytics. It can be self-hosted as a single Docker container or accessed through managed cloud hosting [7][8].

**Data Model:** Langfuse implements a hierarchical trace model:
- **Traces** represent end-to-end executions (user request → final response)
- **Spans** represent logical subdivisions (retrieval, prompt construction, generation)
- **Generations** represent specific LLM completions with full prompt/completion capture
- **Scores** represent quality assessments attached at any level of the hierarchy

**Evaluation Capabilities:**
- LLM-as-Judge: automated quality scoring using a judge model
- Annotation Queues: human review workflows with structured scoring
- Dataset Management: curated evaluation sets for regression testing
- Prompt Experimentation: A/B testing with tracked performance metrics [9]

**Literature Assessment:** Langfuse occupies a unique position in the observability landscape: open-source, self-hostable, and increasingly feature-complete. Its MIT license addresses the data sovereignty concerns that prevent many organizations from using cloud-only platforms. As of 2025, all major features (including formerly "Pro" capabilities like LLM-as-judge) are fully open source [10].

**Key Publication:** Langfuse's blog post on OpenTelemetry integration (October 2024) is a significant technical document, demonstrating how LLM-specific observability can be built on standardized instrumentation rather than proprietary data collection [4].

### LangSmith: LangChain-Native Monitoring

**Overview:** LangSmith is the observability platform developed by LangChain Inc., designed for deep integration with LangChain and LangGraph applications. It provides tracing, evaluation, dataset management, and prompt monitoring with tight coupling to the LangChain execution model [11].

**Key Features:**
- Automatic tracing of LangChain chains, agents, and tools
- End-to-end OpenTelemetry support (announced 2025)
- Evaluation workflows with human annotation and automated scoring
- Prompt hub for versioning and sharing prompt templates
- Regression detection through dataset-based testing

**Strengths:**
- Deepest integration with LangChain/LangGraph ecosystem
- Most comprehensive evaluation workflow (A/B testing, regression gating, win-rate analysis)
- Strong enterprise features (access control, compliance, audit trails)
- OTel bridge enables integration with broader observability infrastructure [11]

**Limitations:**
- Primarily a cloud service (limited self-hosting options)
- Tightly coupled to LangChain ecosystem
- Proprietary—dependency on LangChain Inc.'s business model

**Literature Assessment:** LangSmith is the most feature-rich LLM observability platform, particularly for teams already invested in the LangChain ecosystem. Its adoption of OpenTelemetry standards signals a convergence in the industry toward standardized instrumentation. However, its cloud-first model and ecosystem coupling create vendor lock-in concerns.

### Weights & Biases (W&B Weave): Experiment Tracking to Production

**Overview:** Weights & Biases, originally an experiment tracking platform for ML research, has extended into LLM application monitoring through its Weave product. Weave provides tracing, evaluation, and comparison capabilities specifically for LLM applications [12][13].

**Key Features:**
- Side-by-side experiment comparison (prompts, models, parameters)
- Automatic token and cost tracking
- Trace-based debugging with full input/output capture
- Integration with research workflows (MLflow compatibility)
- Real-time dashboards with custom metrics

**Strengths:**
- Research-to-production continuity: teams using W&B for ML research can extend to LLM monitoring
- Deep experiment comparison capabilities
- Strong visualization tools
- Broad model and framework support

**Limitations:**
- Primarily cloud-hosted
- Research-oriented UX may not suit operations teams
- Less LLM-specific than Langfuse or LangSmith
- Pricing can be significant for high-volume production use [13]

**Literature Assessment:** W&B Weave is best suited for teams that bridge research and production—organizations that experiment with different models, prompts, and architectures and need to carry insights from experimentation into production monitoring.

### Emerging Platforms

Beyond the four primary platforms, the literature notes several emerging tools:

- **Arize Phoenix:** Focus on drift detection and production monitoring with strong visualization
- **Helicone:** No-code observability with particular strength in cost analytics and caching optimization
- **Maxim AI:** Agent-specific tracing with support for diverse agent architectures
- **VictoriaMetrics + OTel:** Infrastructure-first approach integrating AI agent observability into existing monitoring stacks [14][15]

### Convergence Patterns

The literature reveals several convergent trends:

1. **Trace/span/generation as standard model.** All platforms have converged on this hierarchical data model, whether they call it "traces" (Langfuse, LangSmith) or "runs" (W&B).

2. **OpenTelemetry as foundation.** Langfuse, LangSmith, and emerging platforms increasingly support OTel data ingestion, suggesting convergence on standardized instrumentation.

3. **Evaluation as core capability.** All platforms have moved beyond passive observation to active evaluation—automated scoring, human annotation, and regression testing.

4. **Cost attribution as first-class concern.** LLM applications have direct, per-request costs that traditional applications lack. All platforms now track and attribute costs.

5. **Self-hosting demand.** Data sovereignty requirements are driving open-source and self-hostable solutions, with Langfuse leading this trend.

### The Structural Tension Observability Gap

The literature reveals a gap in current observability thinking: all platforms treat observability as **problem-detection**—finding errors, identifying bottlenecks, detecting drift. None frame observability as **creative advancement**—measuring progress toward a desired quality standard while maintaining honest current reality assessment.

This gap is precisely where structural tension methodology contributes. By mapping:
- Traces → STC progressions (how is the agent advancing toward its creative goal?)
- Scores → MMOT evaluations (honest assessment of output quality against Elements of Performance)
- Reality updates → observation data (what does the observability data tell us about current reality?)

...observability transforms from defensive monitoring into a creative instrument that drives purposeful advancement.

## Implications for CoAiA.js

1. **Langfuse as primary observability backend.** Open-source, self-hostable, and MIT-licensed—aligned with CoAiA.js's zero-dependency philosophy.
2. **OpenTelemetry instrumentation.** Standard OTel spans for all agent operations, enabling routing to any compatible backend.
3. **MMOT-as-score integration.** Self-evaluation scores flow to Langfuse as structured quality signals.
4. **Cost-aware agents.** Token and cost data from Langfuse informs agent decision-making (model selection, context management).
5. **Creative-orientation observability.** Dashboards frame metrics as tension indicators (how far is current reality from desired outcome?) rather than problem indicators (what's broken?).

## Conclusion

AI observability has matured rapidly from ad-hoc logging to structured, platform-supported monitoring with evaluation capabilities. The convergence on the trace/span/generation model, OpenTelemetry standardization, and active evaluation workflows provides a solid foundation. The remaining gap—transforming observability from problem-detection to creative advancement—is addressed by integrating structural tension methodology with the observability data model, a contribution that CoAiA.js implements through MMOT-as-score and creative-orientation dashboards.

## References

1. OpenTelemetry. "What is OpenTelemetry?" https://opentelemetry.io/docs/what-is-opentelemetry/
2. Glukhov.org. (2024). "Observability for LLM Systems." https://www.glukhov.org/observability/observability-for-llm-systems/
3. Elysiate. (2025). "LLM Observability: Monitoring, Tracing, and Cost Control." https://www.elysiate.com/blog/llm-observability-monitoring-langsmith-helicone-2025
4. Langfuse. (2024). "OpenTelemetry for LLM Observability." https://langfuse.com/blog/2024-10-opentelemetry-for-llm-observability
5. Grafana. (2024). "LLM Observability with OpenTelemetry and Grafana Cloud." https://grafana.com/blog/a-complete-guide-to-llm-observability-with-opentelemetry-and-grafana-cloud/
6. Spanora AI. (2025). "OpenTelemetry LLM Monitoring." https://spanora.ai/blog/opentelemetry-llm-monitoring
7. Langfuse GitHub. https://github.com/langfuse/langfuse
8. Mayol, M. (2025). "Langfuse: The Definitive LLM Observability Platform." https://marcmayol.com/blog/en/langfuse_the_definitive_observability_platform_for_llms_in_2025/
9. Pondhouse Data. "Langfuse: The Open Source Observability Platform." https://www.pondhouse-data.com/blog/langfuse-observability-platform
10. It's FOSS. (2025). "LLM Analytics Platform Langfuse Goes Open Source." https://itsfoss.com/news/langfuse-open-source/
11. LangChain Blog. (2025). "End-to-End OpenTelemetry Support in LangSmith." https://blog.langchain.com/end-to-end-opentelemetry-langsmith/
12. AI Multiple Research. (2024). "LLM Observability Tools: Weights & Biases, LangSmith." https://research.aimultiple.com/llm-observability/
13. GetMaxim. (2025). "Top AI Observability Tools in 2025." https://www.getmaxim.ai/articles/top-ai-observability-tools-in-2025-the-ultimate-guide/
14. VictoriaMetrics. (2025). "AI Agents Observability with OpenTelemetry." https://victoriametrics.com/blog/ai-agents-observability/
15. DEV Community. (2025). "LLM Observability with OpenTelemetry: A Practical Guide." https://dev.to/kartikdudeja21/llm-observability-with-opentelemetry-a-practical-guide-3clo
