# Model Context Protocol as Standardized Interagent Communication

> Academic brief for the CoAiA.js project — MCP as the universal protocol for tool-using AI agents, examining Anthropic's design, transport mechanisms, and the tool/resource/prompt primitive model.

## Abstract

The Model Context Protocol (MCP), introduced by Anthropic in late 2024, establishes an open standard for connecting AI language models to external tools, data sources, and services. Often described as "USB-C for AI integration," MCP addresses the N×M integration problem that has plagued agent-tool ecosystems by defining a single, well-typed protocol through which any compliant AI host can communicate with any compliant tool server. This paper analyzes MCP's architectural design—its JSON-RPC 2.0 foundation, dual-transport model (stdio for local, HTTP for distributed), and three-primitive abstraction (tools, resources, prompts). We examine how MCP enables dynamic tool discovery, maintains session state, and enforces human-in-the-loop safety boundaries. The analysis situates MCP within the broader landscape of agent communication protocols and evaluates its implications for building composable, observable, and secure AI agent systems within CoAiA.js.

## Introduction

The proliferation of AI agents that interact with external tools—databases, APIs, file systems, code execution environments—has created a fragmentation crisis. Each tool integration requires custom adapter code: prompt formatting, response parsing, error handling, and authentication logic unique to that specific tool-host pairing. For an ecosystem with N AI hosts and M tools, this produces N×M integration points, each independently maintained and tested [1].

The Language Server Protocol (LSP), developed by Microsoft for IDE integration, demonstrated that a well-designed protocol can collapse this N×M problem to N+M: each host implements the protocol once, each tool implements it once, and all combinations work. MCP applies this same principle to AI agent-tool communication [2].

Anthropic released MCP as an open specification in November 2024, accompanied by reference implementations in TypeScript and Python, and a growing ecosystem of community-built MCP servers for systems including GitHub, PostgreSQL, Slack, Puppeteer, and file systems [3].

## Background

### The Agent-Tool Integration Problem

Modern AI agents require access to diverse external capabilities:
- **Data retrieval:** Querying databases, searching documents, reading files
- **Action execution:** Creating records, sending messages, deploying code
- **Context provision:** Fetching project structure, reading configuration, accessing knowledge bases
- **Observation:** Monitoring system state, checking test results, reading logs

Without a standard protocol, each capability requires bespoke integration logic within each agent framework—LangChain, CrewAI, AutoGen, and custom implementations each maintain their own tool interfaces, parsing logic, and error handling.

### Prior Art: Language Server Protocol

LSP, standardized by Microsoft in 2016, provides a direct architectural precedent for MCP. LSP defines:
- A JSON-RPC 2.0 message protocol
- Capability negotiation between client and server
- A standard set of operations (completions, diagnostics, hover info)
- Transport over stdio or TCP

MCP follows this design closely, adapting it from IDE-language tool communication to AI agent-tool communication [4].

## Analysis

### Protocol Architecture

MCP defines three roles in a clear hierarchy:

1. **Host:** The overarching application (IDE, chat interface, agent runtime) that manages one or more MCP clients.
2. **Client:** A protocol handler that maintains a 1:1 session with a single MCP server. The client translates between the host's intent and the server's capabilities.
3. **Server:** A process that exposes tools, resources, and prompts to the client, handling actual execution and data access.

This separation enables clean architectural boundaries: the host manages user interaction and policy decisions, the client handles protocol mechanics, and the server encapsulates tool-specific logic.

### Message Protocol: JSON-RPC 2.0

All MCP communication uses JSON-RPC 2.0, a lightweight remote procedure call protocol that defines:

```json
// Request
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "read_file", "arguments": {"path": "/src/index.ts"}}}

// Response
{"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": "import { Server } from '@modelcontextprotocol/sdk';"}]}}

// Notification (no response expected)
{"jsonrpc": "2.0", "method": "notifications/progress", "params": {"progressToken": "abc", "progress": 50, "total": 100}}
```

The choice of JSON-RPC over alternatives (Protocol Buffers, MessagePack) prioritizes debuggability and ecosystem accessibility over raw performance—a deliberate trade-off for a protocol intended to be adopted broadly across diverse language ecosystems [5].

### Transport Mechanisms

MCP supports two transport modes, each optimized for different deployment contexts:

**Stdio Transport:** For local, same-machine integration. The MCP server runs as a child process of the client, communicating through standard input/output streams. This mode:
- Requires zero network configuration
- Provides natural process lifecycle management (client starts/stops the server)
- Offers inherent security through process isolation
- Is ideal for development environments, desktop applications, and single-machine agent runtimes

**HTTP Transport (Streamable HTTP):** For distributed deployments where the MCP server runs on a different machine or as a shared service. This mode:
- Supports Server-Sent Events (SSE) for real-time server-to-client notifications
- Requires authentication and authorization mechanisms
- Enables shared tool servers serving multiple clients
- Is suited for production, cloud, and multi-agent deployments [6]

### The Three Primitives

MCP's abstraction model centers on three primitive types that encompass the full range of agent-tool interactions:

**Tools:** Executable functions that the AI agent can invoke. Tools are the most dynamic primitive—they represent actions with side effects.

```json
{
  "name": "create_issue",
  "description": "Create a new GitHub issue",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": {"type": "string"},
      "body": {"type": "string"},
      "labels": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["title"]
  }
}
```

**Resources:** Data sources that provide context to the model. Resources are read-oriented and can be static (file contents) or dynamic (database query results).

**Prompts:** Instruction templates that guide the model's behavior. Prompts enable servers to provide domain-specific guidance that shapes how the model uses the server's tools and resources.

### Dynamic Tool Discovery

A critical innovation in MCP is runtime tool discovery. Rather than requiring static configuration of available tools, clients can query servers for their capabilities at session initialization:

```json
// Client requests available tools
{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}

// Server responds with tool schemas
{"jsonrpc": "2.0", "id": 1, "result": {"tools": [
  {"name": "read_file", "description": "Read a file's contents", "inputSchema": {...}},
  {"name": "search_code", "description": "Search for patterns in code", "inputSchema": {...}}
]}}
```

This dynamic discovery enables:
- **Modular tool composition:** Agents connect to different MCP servers based on the task, discovering capabilities at runtime.
- **Graceful degradation:** If a server is unavailable, the agent operates with reduced capabilities rather than failing entirely.
- **Semantic tool selection:** LLMs can choose tools based on their descriptions, eliminating the need for hard-coded tool routing logic.

### Human-in-the-Loop Safety

MCP explicitly incorporates human approval gates for sensitive operations. The specification defines that tool invocations may require user consent, with the host application presenting confirmation dialogs for operations that modify state, access sensitive data, or perform irreversible actions [7].

This design philosophy—making the human a mandatory checkpoint for high-impact operations—aligns with the creative orientation principle that agents should advance toward desired outcomes under human guidance, rather than operating autonomously on problem-solving heuristics.

## Implications for CoAiA.js

MCP serves as the standard communication layer in CoAiA.js for all external tool interactions:

1. **Structural tension charts as MCP resources.** Active STCs are exposed as MCP resources, enabling any MCP-compliant host to read agent state.
2. **MMOT evaluations as MCP tools.** The Managerial Moment of Truth cycle is exposed as an invocable tool, enabling external orchestrators to trigger self-evaluation.
3. **JSONL memory as MCP resource.** Agent memory files are exposed through MCP's resource primitive, supporting both direct access and subscription to updates.
4. **Multi-server composition.** A CoAiA.js agent can connect to multiple MCP servers simultaneously—one for code operations, one for observability (Langfuse), one for knowledge graph queries—composing capabilities dynamically.
5. **Observability through protocol traces.** MCP's JSON-RPC format produces naturally structured logs that feed into the observability pipeline.

## Conclusion

The Model Context Protocol represents a maturation point for the AI agent ecosystem—the transition from bespoke, framework-specific tool integrations to a universal, well-typed protocol that enables composable agent architectures. By standardizing the three fundamental primitives of agent-tool interaction (tools, resources, prompts) over a debuggable JSON-RPC protocol with dual-transport support, MCP establishes the infrastructure layer that makes complex, multi-tool agent systems viable for production deployment.

## References

1. Anthropic. (2024). "Introducing the Model Context Protocol." https://www.anthropic.com/news/model-context-protocol
2. Model Context Protocol Specification. (2025). https://modelcontextprotocol.io/specification/2025-03-26
3. Model Context Protocol GitHub. https://github.com/modelcontextprotocol/modelcontextprotocol
4. InfoQ. (2024). "Anthropic Publishes Model Context Protocol Specification." https://www.infoq.com/news/2024/12/anthropic-model-context-protocol/
5. LogRocket. (2024). "Understanding Anthropic's Model Context Protocol." https://blog.logrocket.com/understanding-anthropic-model-context-protocol-mcp/
6. BridgeApp AI. (2024). "A Complete Guide to MCP: Architecture, Integration, and Best Practices." https://bridgeapp.ai/resources/blog/a-complete-guide-to-model-context-protocol-mcp-architecture-integration-and-best-practices
7. Model Context Protocol Info. "MCP Docs." https://modelcontextprotocol.info/docs/
8. Wikipedia. (2025). "Model Context Protocol." https://en.wikipedia.org/wiki/Model_Context_Protocol
9. UPP Technology. (2024). "Anthropic's MCP: The USB-C Standard for AI Integration." https://www.upp-technology.com/en/news/anthropics-model-context-protocol-mcp-the-usb-c-standard-for-ai-integration/
10. Weights & Biases. (2024). "The Model Context Protocol by Anthropic: Origins, Functionality, and Impact." https://wandb.ai/onlineinference/mcp/reports/The-Model-Context-Protocol-MCP-by-Anthropic
