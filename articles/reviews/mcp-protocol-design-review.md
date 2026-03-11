# Literature Review: MCP Protocol Design Decisions

> Literature review for the CoAiA.js project — Comparative analysis of MCP's design choices against gRPC, REST, and GraphQL for AI agent tool invocation.

## Abstract

The Model Context Protocol (MCP), introduced by Anthropic in late 2024, makes specific design choices that distinguish it from established communication protocols: JSON-RPC 2.0 over Protocol Buffers, dual-transport (stdio/HTTP) over unified transport, dynamic tool discovery over static contracts, and human-in-the-loop approval over autonomous execution. This literature review examines these design decisions in the context of the broader protocol landscape—comparing MCP with gRPC (high-performance RPC), REST (ubiquitous web APIs), and GraphQL (flexible data querying)—and evaluates whether MCP's trade-offs are appropriate for its target domain: AI agent tool invocation. We review protocol design literature, benchmark data, and emerging production experience to assess MCP's architectural fitness for the next generation of AI agent systems.

## Introduction

Protocol design for AI agent systems faces a unique set of requirements not fully addressed by existing protocols. Traditional protocols were designed for human-initiated, deterministic interactions: a client knows what it wants, constructs a request, and expects a predictable response. AI agent tool invocation differs fundamentally: the agent may not know which tools are available until runtime, the semantics of tool descriptions must be LLM-comprehensible, tool invocation may require human approval, and sessions may maintain state across multiple tool calls [1][2].

MCP was designed from first principles for this new interaction pattern. This review examines whether its design decisions are well-justified by comparing each choice against alternatives from the protocol design literature.

## Review

### Design Decision 1: JSON-RPC 2.0 vs. Protocol Buffers

**MCP's Choice:** All communication uses JSON-RPC 2.0—a lightweight, text-based RPC protocol where requests and responses are JSON objects [3].

**Alternative: Protocol Buffers (gRPC).** gRPC uses Protocol Buffers for binary serialization, achieving significantly lower payload sizes and faster parsing. Benchmarks consistently show gRPC outperforming JSON-based protocols by 5-10x in throughput and 2-5x in latency for high-volume workloads [4][5].

**Analysis:**

The MCP team's choice of JSON-RPC prioritizes three properties over raw performance:

1. **Debuggability.** JSON messages are human-readable, enabling developers to inspect traffic with standard text tools. Protocol Buffers require specialized tools for inspection.

2. **Ecosystem breadth.** JSON parsing is native in every programming language. Protocol Buffer support requires additional libraries and code generation steps.

3. **LLM compatibility.** LLMs naturally produce and consume JSON. Protocol Buffers' binary format would require an additional serialization layer between the LLM and the protocol.

**Literature Support:** The Language Server Protocol (LSP), MCP's direct architectural predecessor, made the identical choice—JSON-RPC 2.0 over binary protocols—for the same reasons. LSP's success across dozens of language implementations validates this trade-off for developer-facing protocols [6].

**Performance Impact:** For AI agent workloads, LLM inference dominates latency (typically 1-30 seconds per generation). The difference between JSON-RPC and Protocol Buffers (~1-5ms per message) is negligible in this context. The trade-off is justified.

### Design Decision 2: Dual Transport (Stdio + HTTP)

**MCP's Choice:** Two transport modes: stdio for local (same-machine) integration, HTTP with Server-Sent Events for distributed deployment [3].

**Alternatives:**
- **gRPC:** HTTP/2 only (with bidirectional streaming)
- **REST:** HTTP/1.1 or HTTP/2 (stateless)
- **GraphQL:** HTTP (typically POST, with WebSocket for subscriptions)

**Analysis:**

MCP's dual-transport design addresses the fundamental deployment dichotomy in AI agent systems:

**Local Development (Stdio):** During development, agents and tools run on the same machine. Stdio transport provides:
- Zero network configuration
- Process lifecycle management (parent starts/stops child)
- Inherent security (no network exposure)
- No port conflicts or firewall issues

**Production Deployment (HTTP):** In production, tools may run as shared services, cloud functions, or on different machines. HTTP transport provides:
- Network accessibility
- Authentication and authorization integration
- Load balancing and scaling
- Server-Sent Events for real-time notifications

**Literature Support:** The stdio + TCP dual-transport pattern originated with LSP and has been validated across thousands of IDE integrations. Research on developer experience shows that zero-config local development significantly impacts adoption—developers who can try a tool immediately are more likely to integrate it permanently [7].

**Comparison with Alternatives:** gRPC's HTTP/2-only transport creates friction for local development (requires server process, port allocation). REST's stateless model requires workarounds for maintaining session context. GraphQL's single-endpoint design is elegant but doesn't naturally support the process-lifecycle semantics that stdio provides.

### Design Decision 3: Dynamic Tool Discovery vs. Static Contracts

**MCP's Choice:** Clients discover available tools at runtime through `tools/list` requests. Tool schemas are self-describing JSON objects with natural-language descriptions [3][8].

**Alternatives:**
- **gRPC:** Static `.proto` files define services at compile time. Reflection is available but not standard practice.
- **REST:** OpenAPI/Swagger specifications describe endpoints statically. Runtime discovery requires additional infrastructure.
- **GraphQL:** Schema introspection is native, but schemas are typically static and manually authored.

**Analysis:**

Dynamic tool discovery is MCP's most innovative design decision and the one most clearly motivated by AI-specific requirements:

1. **LLM Tool Selection.** LLMs select tools based on natural-language descriptions. MCP's tool schemas include human-readable `description` fields that LLMs use for semantic matching. Static contracts lack this semantic layer.

2. **Composable Tool Sets.** An agent may connect to different MCP servers depending on the task—a code-editing server for development tasks, a database server for data tasks. Dynamic discovery enables this modular composition without pre-configuration.

3. **Graceful Degradation.** If a server is unavailable, the agent operates with reduced capabilities rather than failing. Static contracts make unavailable tools compile-time or configuration errors.

**Literature Support:** Service discovery patterns in microservice architectures (Consul, Eureka, Kubernetes DNS) demonstrate the value of runtime discovery for dynamic systems. The research on self-describing services in semantic web literature directly prefigures MCP's approach [9].

**Trade-off:** Dynamic discovery introduces the risk of inconsistent tool sets across invocations—a tool available in one call may not be available in the next. MCP mitigates this through capability negotiation at session initialization.

### Design Decision 4: Human-in-the-Loop Approval Gates

**MCP's Choice:** The specification explicitly supports human approval gates for sensitive tool invocations, with the host application presenting confirmation dialogs [3][10].

**Alternatives:**
- **gRPC:** No built-in approval mechanism; security is handled at the transport/middleware level.
- **REST:** Authentication/authorization at the endpoint level; no per-request human approval.
- **GraphQL:** Permission checking in resolvers; no standard approval UX.

**Analysis:**

MCP's approval gate design reflects the unique risk profile of AI agent tool invocation:

1. **Non-deterministic requests.** Unlike human-initiated API calls, AI-generated tool invocations may be unexpected, incorrect, or dangerous. A human checkpoint prevents autonomous execution of high-impact operations.

2. **Progressive trust.** The approval mechanism enables a trust gradient: agents begin with full approval requirements, which can be relaxed for trusted operations as confidence grows.

3. **Creative orientation alignment.** In the structural tension framework, human approval ensures that agent actions align with the human's desired outcome, not just the agent's interpretation of it.

**Literature Support:** Research on human-AI teaming demonstrates that appropriate human checkpoints improve both safety and user trust. The "HITL" (human-in-the-loop) pattern is established best practice in safety-critical AI applications [11].

### Design Decision 5: Three Primitives (Tools, Resources, Prompts)

**MCP's Choice:** Three semantic primitives cover the full range of agent-tool interactions [3]:
- **Tools:** Executable functions with side effects
- **Resources:** Read-only data sources
- **Prompts:** Instruction templates

**Comparison with Traditional APIs:**
- **REST:** Uses HTTP verbs (GET, POST, PUT, DELETE) as primitives—action-oriented but lacking semantic richness
- **gRPC:** Uses service methods as primitives—typed but not self-describing
- **GraphQL:** Uses queries, mutations, and subscriptions—closest to MCP's three-primitive model

**Analysis:**

MCP's three primitives map cleanly to the three modes of agent-tool interaction:
- "Do something" → Tool
- "Tell me something" → Resource
- "Guide my behavior" → Prompt

GraphQL's query/mutation/subscription model is structurally similar but lacks the AI-specific semantics—particularly the "prompt" primitive, which has no analog in traditional protocols.

## Synthesis

MCP's design decisions collectively optimize for a specific user: an LLM-powered agent that needs to discover, understand, and invoke tools in a human-supervised context. Each decision trades performance for accessibility, static safety for dynamic flexibility, and autonomous execution for human oversight.

The trade-offs are well-justified for the target domain:

| Decision | Trade-off | Justification |
|----------|-----------|---------------|
| JSON-RPC | Performance for debuggability | LLM inference dominates latency |
| Dual transport | Complexity for deployment flexibility | Addresses local vs. distributed dichotomy |
| Dynamic discovery | Consistency for composability | LLM tool selection requires runtime semantics |
| Approval gates | Autonomy for safety | Non-deterministic requests require human checkpoints |
| Three primitives | Simplicity for semantic clarity | Maps cleanly to agent interaction modes |

## Implications for CoAiA.js

1. **MCP as default protocol.** CoAiA.js adopts MCP for all external tool interactions, leveraging its AI-native design.
2. **Stdio for development.** Local development uses stdio transport, enabling zero-config agent setup.
3. **HTTP for production.** Production deployments use HTTP transport with SSE for real-time notifications.
4. **STC operations as MCP tools.** Structural tension chart operations are exposed through MCP, enabling cross-framework access.
5. **Approval gates for MMOT.** Human approval is integrated with the MMOT cycle—agents propose corrections, humans approve execution.

## Conclusion

MCP's protocol design decisions reflect a clear understanding of AI agent requirements that differ fundamentally from traditional client-server interactions. By prioritizing debuggability, dynamic discovery, and human oversight over raw performance and static contracts, MCP establishes a protocol layer that is fit for purpose in the emerging AI agent ecosystem. The comparison with gRPC, REST, and GraphQL reveals not that MCP is "better" in absolute terms, but that it is better *for its intended domain*—a distinction that validates Anthropic's decision to create a new protocol rather than adapting an existing one.

## References

1. Anthropic. (2024). "Introducing the Model Context Protocol." https://www.anthropic.com/news/model-context-protocol
2. CloudCusp. (2025). "MCP and gRPC: Why MCP Beats gRPC for AI." https://cloudcusp.com/blogs/mcp-and-grpc-why-mcp-beats-grpc-in-ai/
3. Model Context Protocol Specification. (2025). https://modelcontextprotocol.io/specification/2025-03-26
4. SmartDev. (2025). "AI-Powered APIs: REST vs GraphQL vs gRPC Performance." https://smartdev.com/ai-powered-apis-grpc-vs-rest-vs-graphql/
5. AI Fire. (2025). "MCP vs gRPC: The Future of AI-Native Agent Connectivity." https://www.aifire.co/p/mcp-vs-grpc-the-future-of-ai-native-agent-connectivity
6. Microsoft. "Language Server Protocol Specification." https://microsoft.github.io/language-server-protocol/
7. AIBuilders Academy. (2025). "MCP vs gRPC: How AI Agents Connect to Tools." https://aibuilders.academy/mcp-vs-grpc/
8. OpenReplay. (2025). "MCP vs REST vs GraphQL: How LLM-First APIs Are Different." https://blog.openreplay.com/mcp-rest-graphql-llm-first-apis/
9. DEV Community. (2025). "MCP vs Traditional APIs." https://dev.to/sreeni5018/mcp-model-context-protocol-vs-traditional-apis-rest-soap-graphql-grpc-the-future-of-api-pi7
10. Glama. (2025). "Why AI Agents Need a New Protocol." https://glama.ai/blog/2025-06-06-mcp-vs-api
11. Reconfigured. (2025). "MCP Guide: Understanding the Protocol Powering the AI Agent Ecosystem." https://reconfigured.io/blog/mcp-guide-understanding-ai-agent-protocol
12. Geeky Gadgets. (2025). "MCP vs gRPC: Comparing AI Protocols." https://www.geeky-gadgets.com/mcp-vs-grpc-ai-protocols/
