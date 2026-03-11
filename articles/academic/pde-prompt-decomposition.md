# Prompt Decomposition as Engineering Methodology

> Academic brief for the CoAiA.js project — Breaking complex prompts into primary/secondary intents, context requirements, and Four Directions action stacks through systematic decomposition.

## Abstract

Complex prompts submitted to large language models frequently contain multiple intents—some explicit, some implied by hedging language or contextual assumptions. When processed holistically, LLMs tend to prioritize salient explicit intents while dropping implicit ones, resulting in incomplete task execution. This paper presents Prompt Decomposition Engineering (PDE) as a systematic methodology for analyzing complex prompts before execution. PDE identifies primary and secondary intents, extracts implicit requirements from hedging language ("maybe," "also consider," "if possible"), maps dependencies between action items, and organizes them into executable Four Directions action stacks. We compare PDE with existing reasoning strategies—Chain-of-Thought (CoT), Tree-of-Thought (ToT), Self-Consistency, and Decomposed Prompting (DecomP)—and argue that PDE operates at a fundamentally different level: it decomposes the *input prompt* rather than the *reasoning process*, serving as a completeness safeguard rather than a reasoning enhancer. The methodology is evaluated in the context of the CoAiA.js PDE engine.

## Introduction

A user submits the following prompt to an AI agent:

> "Set up the project with TypeScript, add ESLint and Prettier, maybe also configure Husky for pre-commit hooks, and write a basic README. Oh and we'll probably need tests too—Jest should work. Make sure the CI/CD pipeline runs everything."

This 44-word prompt contains at least seven distinct action items, three implicit dependencies, two hedged requests ("maybe," "probably"), and one underdetermined requirement ("runs everything"). A capable LLM might execute the most salient items (TypeScript setup, ESLint, README) while dropping the hedged ones (Husky, Jest) and underdetermining others (CI/CD scope) [1].

The fundamental issue is not that LLMs lack capability—it's that complex prompts exceed the scope of single-pass intent extraction. Prompt Decomposition Engineering addresses this by introducing a systematic pre-processing phase that decomposes complex prompts into structured, complete, and dependency-mapped action specifications before execution begins.

## Background

### Existing Prompt Engineering Strategies

The prompt engineering landscape has produced several strategies for improving LLM reasoning on complex tasks:

**Chain-of-Thought (CoT):** Introduced by Wei et al. (2022), CoT prompts models to "think step by step," revealing intermediate reasoning. This improves accuracy on multi-step problems but does not prevent intent loss—the model may reason carefully about a subset of intents while still dropping others [2].

**Tree-of-Thought (ToT):** Yao et al. (2023) extended CoT to explore multiple reasoning branches simultaneously, evaluating alternative solution paths. ToT improves exploration of solution spaces but addresses reasoning quality, not input completeness—it assumes all intents have been correctly identified [3].

**Self-Consistency:** Wang et al. (2022) proposed sampling multiple reasoning paths and selecting the most consistent answer. This reduces errors in reasoning but does not address the prior problem of intent extraction from complex inputs [4].

**Decomposed Prompting (DecomP):** Khot et al. (2022) introduced decomposition of complex questions into sub-questions, each handled by specialized sub-prompts. DecomP is the closest precursor to PDE but operates on reasoning decomposition rather than input prompt decomposition—it assumes the question is well-specified and decomposes the answer strategy [5].

**Plan-and-Solve (PS):** Wang et al. (2023) proposed devising a plan before executing, then following the plan step-by-step. PS addresses sequencing but not completeness—the plan may omit implicit intents [6].

### The Completeness Gap

All existing strategies share a common assumption: the model correctly identifies all intents in the input prompt. This assumption fails for complex, multi-intent prompts—particularly those containing:

- **Hedging language:** "maybe," "perhaps," "if possible," "also consider"
- **Embedded conditionals:** "if X then also Y"
- **Implied requirements:** "set up CI/CD" implies test execution, linting, build verification
- **Conversational asides:** "oh and we'll need..." signals an afterthought the model may deprioritize
- **Scope ambiguity:** "make sure everything works" requires decomposition to define "everything"

PDE addresses this completeness gap by operating on the prompt itself, before any reasoning strategy is applied.

## Analysis

### The PDE Methodology

PDE operates in three phases:

#### Phase 1: Intent Extraction

The complex prompt is analyzed for:

**Primary Intents:** Directly stated, unhedged action items.
```json
[
  {"intent": "Set up project with TypeScript", "confidence": "high", "explicit": true},
  {"intent": "Add ESLint and Prettier", "confidence": "high", "explicit": true},
  {"intent": "Write a basic README", "confidence": "high", "explicit": true}
]
```

**Secondary Intents:** Hedged, implied, or conditionally stated items.
```json
[
  {"intent": "Configure Husky for pre-commit hooks", "confidence": "medium", "marker": "maybe also"},
  {"intent": "Set up Jest testing", "confidence": "medium", "marker": "probably need"},
  {"intent": "Configure CI/CD pipeline", "confidence": "high", "explicit": true, "underdetermined": true}
]
```

**Implicit Intents:** Requirements not stated but logically entailed.
```json
[
  {"intent": "Create package.json with scripts", "derivedFrom": "TypeScript setup + tooling"},
  {"intent": "Create tsconfig.json", "derivedFrom": "TypeScript setup"},
  {"intent": "Define CI/CD scope (lint, test, build)", "derivedFrom": "CI/CD + all tools mentioned"}
]
```

#### Phase 2: Dependency Mapping

Extracted intents are analyzed for dependencies:

```
TypeScript setup ← ESLint config (needs tsconfig)
TypeScript setup ← Jest config (needs ts-jest)
ESLint + Prettier ← Husky pre-commit hooks (hooks run lint/format)
All tooling ← CI/CD pipeline (pipeline runs all tools)
All tooling ← README (documents all tools)
```

This dependency graph prevents execution ordering errors (e.g., configuring Husky before ESLint exists).

#### Phase 3: Four Directions Organization

Extracted and dependency-mapped intents are organized into a Four Directions action stack:

**East (Vision/Initiation):** Understand the project requirements, establish the desired architecture, define what "done" looks like.

**South (Analysis/Design):** Decompose into specific, executable tasks. This is where PDE's output resides—the structured decomposition.

**West (Implementation/Testing):** Execute the tasks in dependency order, verifying each step.

**North (Integration/Wisdom):** Review the complete result, verify all intents (including secondary and implicit) have been addressed, document the outcome.

### Comparison with Existing Strategies

| Strategy | Operates On | Addresses | Completeness |
|----------|------------|-----------|-------------|
| CoT | Reasoning process | Accuracy | No |
| ToT | Solution exploration | Creativity | No |
| Self-Consistency | Answer validation | Reliability | No |
| DecomP | Question structure | Complexity | Partial |
| Plan-and-Solve | Execution plan | Sequencing | Partial |
| **PDE** | **Input prompt** | **Completeness** | **Yes** |

PDE is complementary to, not competitive with, existing strategies. A system can first apply PDE to ensure all intents are captured, then apply CoT or ToT to reason about each extracted intent.

### Hedging Language as Signal, Not Noise

A distinctive contribution of PDE is its treatment of hedging language. Traditional NLP treats hedging ("maybe," "perhaps," "if possible") as uncertainty markers to be discounted. PDE treats them as **intent signals with reduced confidence**—the user wants the thing, but is expressing it with social softening or conditional framing.

When a user says "maybe also configure Husky," they almost certainly want Husky configured—the "maybe" reflects conversational politeness or uncertainty about whether it's the right tool, not genuine indifference to the outcome. PDE captures this as a secondary intent with a confidence annotation, ensuring it is not dropped during execution.

### The Decomposition Result Schema

PDE produces a structured `DecompositionResult` object:

```typescript
interface DecompositionResult {
  id: string;
  timestamp: string;
  originalPrompt: string;
  primaryIntents: Intent[];
  secondaryIntents: Intent[];
  implicitIntents: Intent[];
  contextRequirements: ContextRequirement[];
  dependencies: Dependency[];
  fourDirectionsStack: {
    east: ActionItem[];   // Vision
    south: ActionItem[];  // Analysis
    west: ActionItem[];   // Implementation
    north: ActionItem[];  // Integration
  };
  ambiguityFlags: AmbiguityFlag[];
}
```

This schema is serialized as JSON and stored in a `.pde/` directory alongside the project, creating a persistent record of prompt decompositions that can be reviewed, edited, and versioned.

### PDE as Completeness Safeguard

The primary value proposition of PDE is not sophistication but **completeness.** In multi-mission agent sessions where a single prompt may contain dozens of intents spanning multiple domains, the risk of intent loss is the primary failure mode. PDE functions as a safeguard against this loss—a systematic check that everything the user asked for has been identified before execution begins.

This is particularly critical in voice-transcription handoff scenarios, where speech-to-text produces raw verbatim text with conversational hedging, tangential asides, and implicit assumptions that text-based prompts typically refine away.

## Implications for CoAiA.js

PDE is the entry point of the CoAiA.js agent pipeline:

1. **Session start decomposition.** Every agent session begins with PDE decomposition of the user's initial prompt, ensuring no intents are lost before work begins.
2. **Structural tension chart generation.** PDE's output feeds directly into STC creation—primary intents become desired outcomes, current reality is assessed, and action steps are populated from the Four Directions stack.
3. **MMOT completeness checks.** During evaluation, agents verify that all extracted intents (including secondary and implicit) have been addressed, using PDE's output as the completeness checklist.
4. **Version-controlled decompositions.** PDE results stored in `.pde/` directories provide audit trails showing exactly how complex prompts were interpreted.
5. **MCP integration.** The PDE engine is exposed as an MCP tool, enabling any MCP-compliant host to decompose prompts using the same methodology.

## Conclusion

Prompt Decomposition Engineering addresses a fundamental gap in the prompt engineering landscape: the completeness of intent extraction from complex, multi-intent prompts. By operating on the input prompt rather than the reasoning process, PDE complements existing strategies (CoT, ToT, DecomP) while solving a distinct problem. The methodology's systematic extraction of primary, secondary, and implicit intents—combined with dependency mapping and Four Directions organization—provides the completeness safeguard that complex agent sessions require.

## References

1. LearnPrompting. (2024). "Advanced Decomposition Techniques for Improved Prompting in LLMs." https://learnprompting.org/docs/advanced/decomposition/introduction
2. Wei, J., et al. (2022). "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models." *NeurIPS 2022*.
3. Yao, S., et al. (2023). "Tree of Thoughts: Deliberate Problem Solving with Large Language Models." *NeurIPS 2023*.
4. Wang, X., et al. (2022). "Self-Consistency Improves Chain of Thought Reasoning in Language Models." *ICLR 2023*.
5. Khot, T., et al. (2022). "Decomposed Prompting: A Modular Approach for Solving Complex Tasks." *ICLR 2023*.
6. Wang, L., et al. (2023). "Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning." *ACL 2023*.
7. Oxen.ai. (2024). "The Prompt Report Part 2: Plan and Solve, Tree of Thought, and Decomposition Prompting." https://ghost.oxen.ai/the-prompt-report-part-2-thought-generation-tree-of-thought-and-decomposition-prompting/
8. CalmOps. (2024). "Prompt Engineering Patterns: CoT, ReAct, and ToT." https://calmops.com/ai/prompt-engineering-patterns-cot-react-tot/
9. Exploratio Journal. (2024). "Zooming-in On Prompting: A Comparative Study." https://exploratiojournal.com/zooming-in-on-prompting/
10. Coupler.io. (2024). "Advanced Prompting Techniques for Complex AI Reasoning." https://blog.coupler.io/advanced-prompting-techniques/
