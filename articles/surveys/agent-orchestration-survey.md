# Survey of Multi-Agent Orchestration Patterns: AutoGen, CrewAI, LangGraph, and MCP

> Academic survey for the CoAiA.js project — How AI agents coordinate, delegate, and share context across leading orchestration frameworks and the emergent role of MCP as a universal interoperability layer.

## Abstract

The multi-agent AI ecosystem has fragmented into distinct orchestration paradigms: role-based teams (CrewAI), graph-based state machines (LangGraph), conversation-driven negotiation (AutoGen/AG2), and protocol-standardized tool invocation (MCP). This survey examines the architectural patterns, coordination mechanisms, and operational trade-offs of these four approaches to multi-agent orchestration. We analyze each framework's model for agent specialization, inter-agent communication, context sharing, and error recovery. Our findings reveal a convergence toward hybrid architectures where MCP provides the universal tool interface, while framework-specific patterns handle agent coordination logic. The survey situates CoAiA.js's Four Directions orchestration model within this landscape, demonstrating how structural tension methodology provides an alternative to both role-based and graph-based coordination that naturally prevents the oscillatory patterns common in complex multi-agent workflows.

## Introduction

The transition from single-agent to multi-agent AI systems introduces coordination challenges that mirror those in distributed computing and organizational management: how do agents divide labor, share context, handle failures, and maintain coherent progress toward shared goals? [1]

The 2024–2025 period has seen rapid proliferation of orchestration frameworks, each embodying different assumptions about how agents should interact. This survey examines the four dominant paradigms, identifies their structural properties, and evaluates their implications for the design of CoAiA.js's multi-agent capabilities.

## Survey of Orchestration Patterns

### 1. Role-Based Team Orchestration: CrewAI

**Architecture:** Agents are defined as team members with explicit roles (Researcher, Writer, Reviewer), goals, tools, and behavioral constraints. A "crew" is assembled from these role-defined agents and given a task sequence to execute [2][3].

**Coordination Model:**
```python
researcher = Agent(role="Senior Researcher", goal="Find comprehensive information", tools=[search, scrape])
writer = Agent(role="Technical Writer", goal="Create clear documentation", tools=[write, format])
crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task], process=Process.sequential)
```

**Communication Pattern:** Primarily sequential task handoff—the output of one agent becomes the input of the next. Limited support for parallel execution and inter-agent negotiation.

**Strengths:**
- Intuitive mental model (mirrors human team organization)
- Fastest prototyping and lowest learning curve
- Effective for linear business workflows
- Clean separation of concerns through role specialization

**Weaknesses:**
- Limited control flow: branching, looping, and conditional logic are constrained
- Susceptible to "agent loops" where agents repeatedly invoke each other without progress
- Low determinism: identical inputs can produce different execution paths
- Debugging is challenging: agent decisions are opaque [4][5]

**Structural Tension Analysis:** CrewAI operates without explicit structural tension. Goals are stated but current reality is not formally tracked. This makes CrewAI susceptible to the oscillation pattern: agents work toward goals, partially achieve them, lose momentum, and re-engage when prompted.

### 2. Graph-Based State Machine Orchestration: LangGraph

**Architecture:** Workflows are modeled as directed graphs where nodes represent processing steps (which may involve agents) and edges represent transitions between steps. State is explicitly managed and passed between nodes [6][7].

**Coordination Model:**
```python
graph = StateGraph(AgentState)
graph.add_node("research", research_node)
graph.add_node("write", write_node)
graph.add_node("review", review_node)
graph.add_edge("research", "write")
graph.add_conditional_edges("review", should_revise, {"revise": "write", "approve": END})
```

**Communication Pattern:** State-passing through a shared state object. Each node reads from and writes to the state, enabling complex branching, looping, and conditional logic.

**Strengths:**
- Highest control and determinism among frameworks
- Explicit branching, looping, error recovery, and conditional logic
- Production-grade reliability (~94% accuracy in benchmarks)
- Full visibility into execution state at every point
- Natural fit for complex, multi-step workflows with failure recovery [8]

**Weaknesses:**
- Steepest learning curve: requires understanding of state machines and graph theory
- Most verbose code for simple workflows
- Tightly coupled to LangChain ecosystem
- Over-engineering risk for straightforward sequential tasks

**Structural Tension Analysis:** LangGraph's state machine model can encode structural tension: the state object can carry desired outcome and current reality, and conditional edges can check tension resolution. However, this requires explicit implementation—it is not a native feature.

### 3. Conversation-Driven Orchestration: AutoGen (AG2)

**Architecture:** Agents communicate through structured conversations—rounds of messages where each agent contributes based on its perspective. Coordination emerges from the conversation rather than being imposed by a workflow graph [9][10].

**Coordination Model:**
```python
assistant = AssistantAgent("assistant", llm_config=llm_config)
critic = AssistantAgent("critic", system_message="Critique code quality")
user_proxy = UserProxyAgent("user", code_execution_config={"work_dir": "coding"})
groupchat = GroupChat(agents=[user_proxy, assistant, critic], messages=[], max_round=12)
```

**Communication Pattern:** Round-robin or dynamic turn-taking in group chats. Agents see the full conversation history and contribute based on their system messages and observed context.

**Strengths:**
- Most natural model for collaborative reasoning and negotiation
- Flexible: agent composition can change dynamically
- Strong for human-in-the-loop workflows
- Effective for research, brainstorming, and iterative refinement
- AG2 (successor) adds enterprise reliability features [11]

**Weaknesses:**
- Least deterministic: conversation dynamics are inherently unpredictable
- Context overflow risk: long conversations exceed context windows
- Debugging difficulty: tracing which conversational turn caused which outcome
- Performance unpredictability: conversation length varies significantly

**Structural Tension Analysis:** AutoGen's conversational model naturally surfaces tension—critics identify gaps between desired and actual output. However, this tension is implicit in conversation rather than explicitly tracked, making it difficult to measure advancement vs. oscillation.

### 4. Protocol-Standardized Tool Invocation: MCP

**Architecture:** MCP is not an orchestration framework but a **communication protocol** that standardizes how agents invoke tools. Unlike CrewAI, LangGraph, and AutoGen, MCP does not prescribe coordination patterns—it provides the infrastructure layer upon which coordination is built [12][13].

**Coordination Model:** MCP defines tool discovery (tools/list), tool invocation (tools/call), resource access (resources/read), and prompt provision (prompts/get) through JSON-RPC 2.0 messages over stdio or HTTP transport.

**Strengths:**
- Universal: any framework can use MCP for tool invocation
- Dynamic tool discovery: agents learn available capabilities at runtime
- Human-in-the-loop: built-in approval gates for sensitive operations
- Framework-agnostic: works with CrewAI, LangGraph, AutoGen, or custom systems

**Weaknesses:**
- Not an orchestration framework: does not handle agent coordination, context sharing, or workflow management
- Young ecosystem: tooling and community still developing
- Potential overhead: JSON-RPC adds latency compared to direct function calls

**Structural Tension Analysis:** MCP provides the tool interface through which structural tension charts can be created, read, and updated. MCP servers can expose STC operations as tools, making structural tension accessible to any MCP-compliant agent.

### Comparative Analysis

| Dimension | CrewAI | LangGraph | AutoGen/AG2 | MCP |
|-----------|--------|-----------|-------------|-----|
| **Paradigm** | Role-based teams | Graph state machine | Conversation | Protocol |
| **Control** | Low–Medium | Very High | Medium | N/A (infra) |
| **Determinism** | Low | High | Low | N/A |
| **Learning Curve** | Low | High | Medium | Low |
| **Best For** | Prototyping, business | Production, complex | Research, negotiation | Tool interop |
| **STC Support** | None native | Possible via state | Implicit in conversation | Tool interface |
| **Oscillation Risk** | High | Low (explicit control) | Medium | N/A |

### Emerging Pattern: Hybrid Architectures

The most effective multi-agent systems in 2025 combine multiple paradigms:

1. **MCP as universal tool layer.** All external tool invocations go through MCP, providing standardized access, observability, and security.
2. **LangGraph for critical workflows.** Mission-critical, multi-step processes use graph-based orchestration for determinism and error recovery.
3. **CrewAI for team simulation.** Business workflows with clear role divisions use role-based orchestration for intuitive design.
4. **AutoGen for collaborative reasoning.** Research, brainstorming, and negotiation tasks use conversational orchestration for emergent insights.

### The Four Directions Alternative

CoAiA.js proposes a fifth paradigm: **directional orchestration** based on the Medicine Wheel framework:

- **East Agent:** Vision articulation and creative ideation
- **South Agent:** Analysis, research, and prompt decomposition (PDE)
- **West Agent:** Implementation and iterative building
- **North Agent:** Evaluation (MMOT), documentation, and wisdom synthesis

This model is structurally distinct from role-based, graph-based, or conversation-based orchestration:

- Unlike CrewAI roles, directional agents represent **phases of creative process**, not job descriptions
- Unlike LangGraph graphs, the Four Directions form a **cycle**, not a directed acyclic graph
- Unlike AutoGen conversations, handoffs between directions are **structurally motivated** by the completion of each phase's contribution
- Structural tension charts provide the coordination mechanism: each direction advances the chart, and the tension between desired outcome and current reality drives the cycle forward

## Implications for CoAiA.js

1. **MCP as tool layer.** CoAiA.js uses MCP for all external tool invocations, ensuring framework-agnostic tool access.
2. **Four Directions as orchestration.** Agent coordination follows the directional cycle, not role-based teams or conversation rounds.
3. **Structural tension as coordination.** The STC's tension measurement drives agent scheduling—the direction with the highest contribution potential receives attention.
4. **Hybrid compatibility.** CoAiA.js's directional agents can operate within LangGraph workflows, CrewAI teams, or AutoGen conversations when integration with external frameworks is needed.
5. **Oscillation prevention.** The structural tension chart's advancing structure prevents the oscillation that plagues role-based and conversation-based systems.

## Conclusion

Multi-agent orchestration in 2025 is characterized by framework proliferation and emerging hybridization. Each paradigm—role-based, graph-based, conversational, and protocol-based—offers distinct trade-offs in control, determinism, and expressiveness. CoAiA.js's Four Directions orchestration model adds a fifth paradigm rooted in structural tension methodology, providing cyclical, balanced coordination that naturally resists oscillation. The convergence on MCP as a universal tool interface layer suggests that orchestration frameworks will increasingly specialize in coordination logic while delegating tool invocation to the protocol layer.

## References

1. DataCamp. (2024). "CrewAI vs LangGraph vs AutoGen: Choosing the Right Multi-Agent Framework." https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen
2. TutorialQ. (2025). "CrewAI vs LangGraph vs AutoGen." https://tutorialq.com/agents/frameworks/crewai-vs-langgraph-vs-autogen
3. Youngju.dev. (2026). "Comparing LLM Agent Frameworks." https://www.youngju.dev/blog/llm/2026-03-09-llm-agent-framework-autogen-crewai-langgraph-comparison.en
4. Amplework. (2025). "LangGraph vs AutoGen vs CrewAI." https://www.amplework.com/blog/langgraph-vs-autogen-vs-crewai-multi-agent-framework/
5. Braincuber. (2025). "CrewAI vs AutoGen vs LangGraph: Framework Comparison." https://www.braincuber.com/blog/crewai-vs-autogen-vs-langgraph-multi-agent-framework-comparison
6. Meta Intelligence. (2025). "The Complete Guide to AI Agent Development." https://www.meta-intelligence.tech/en/insight-ai-agent-frameworks
7. SoftwareSeni. (2025). "Navigating the Multi-Agent Framework Landscape." https://www.softwareseni.com/navigating-the-multi-agent-framework-landscape-from-crewai-to-langgraph-to-autogen-and-beyond/
8. Infinite Lambda. (2025). "CrewAI, AutoGen, Vertex AI, and LangGraph Comparison." https://infinitelambda.com/compare-crewai-autogen-vertexai-langgraph/
9. Datagrom. (2025). "Top 3 Trending Agentic AI Frameworks." https://www.datagrom.com/data-science-machine-learning-ai-blog/langgraph-vs-autogen-vs-crewai-comparison-agentic-ai-frameworks
10. Tagline Infotech. (2025). "Choosing the Right AI Agent Framework." https://taglineinfotech.com/blog/langgraph-vs-crewai-vs-autogen/
11. AG2 (AutoGen successor). https://github.com/ag2ai/ag2
12. Anthropic. (2024). "Introducing the Model Context Protocol." https://www.anthropic.com/news/model-context-protocol
13. Model Context Protocol Specification. (2025). https://modelcontextprotocol.io/specification/2025-03-26
