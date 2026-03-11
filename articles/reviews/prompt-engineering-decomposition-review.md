# Literature Review: Prompt Engineering and Decomposition Methodologies

> Literature review for the CoAiA.js project — From Chain-of-Thought to Tree-of-Thought, Self-Consistency, and PDE: a review of how prompt decomposition strategies address complexity in LLM applications.

## Abstract

Prompt engineering has evolved from simple instruction formatting to a sophisticated discipline encompassing reasoning strategies, decomposition techniques, and quality-assurance methodologies. This literature review examines the major prompt decomposition approaches—Chain-of-Thought (CoT), Tree-of-Thought (ToT), Self-Consistency, Decomposed Prompting (DecomP), Plan-and-Solve, and Prompt Decomposition Engineering (PDE)—analyzing their theoretical foundations, empirical effectiveness, and complementary relationships. We identify a critical distinction in the literature between strategies that improve *reasoning quality* (CoT, ToT, Self-Consistency) and strategies that improve *input completeness* (DecomP, PDE), arguing that both categories are necessary for robust AI agent systems. The review situates PDE's unique contribution—extracting implicit intents from hedging language and organizing actions into Four Directions stacks—within this broader landscape.

## Introduction

The quality of LLM output is profoundly shaped by input construction. A well-structured prompt can transform a mediocre model into an effective problem-solver, while a poorly structured prompt can cause a capable model to miss critical requirements, hallucinate details, or produce superficially correct but substantively incomplete results [1][2].

The prompt engineering community has responded with an expanding toolkit of strategies, each addressing different aspects of the prompting challenge. This review organizes these strategies into a taxonomy based on what they optimize, examines their empirical support, and identifies the gaps that remain.

## Review

### Category 1: Reasoning Enhancement Strategies

These strategies improve the quality of the model's reasoning process on a well-specified input.

#### Chain-of-Thought Prompting (CoT)

**Foundational Work:** Wei et al. (2022) demonstrated that prompting LLMs to show intermediate reasoning steps ("Let's think step by step") dramatically improves performance on multi-step problems, achieving state-of-the-art results on arithmetic, commonsense, and symbolic reasoning benchmarks [3].

**Variants:**
- **Zero-Shot CoT:** Simply adding "Let's think step by step" to any prompt (Kojima et al., 2022)
- **Few-Shot CoT:** Providing examples with explicit reasoning chains
- **Auto-CoT:** Automatically generating diverse reasoning demonstrations (Zhang et al., 2022)

**Mechanism:** CoT works by encouraging the model to allocate computation to intermediate steps rather than jumping directly to an answer. The intermediate steps serve as a "scratchpad" that keeps the model's reasoning on track [4].

**Empirical Support:** Strong and consistent. CoT improves performance on virtually all multi-step reasoning tasks, with gains proportional to task complexity. The technique is most effective for models above ~100B parameters.

**Limitations:** CoT improves reasoning fidelity but does not address input completeness. If the prompt contains multiple intents, CoT may reason carefully about a subset while ignoring others. The model's selection of which intents to address remains uncontrolled [5].

#### Tree-of-Thought (ToT)

**Foundational Work:** Yao et al. (2023) extended CoT from linear reasoning to branching exploration, modeling the reasoning process as a tree where each node represents a partial solution and branches represent alternative reasoning paths [6].

**Mechanism:** ToT prompts the model to:
1. Generate multiple possible next steps at each reasoning node
2. Evaluate each possibility using a value function (often the model itself)
3. Prune unpromising branches
4. Continue exploration along promising paths

**Empirical Support:** ToT significantly outperforms CoT on problems requiring exploration—creative tasks, strategic planning, and scenarios with multiple valid approaches. The Game of 24 benchmark showed ToT solving 74% of problems vs. CoT's 4% [6].

**Limitations:** ToT is computationally expensive (multiple model calls per reasoning step), introduces additional latency, and is most beneficial for problems where exploration is genuinely valuable. For straightforward sequential tasks, CoT is sufficient and more efficient.

**Literature Context:** ToT represents a shift from prompt engineering as input formatting to prompt engineering as search algorithm design. The model becomes a component in a larger reasoning architecture rather than a standalone solution.

#### Self-Consistency

**Foundational Work:** Wang et al. (2022) proposed sampling multiple independent reasoning paths and selecting the most consistent answer—a technique analogous to ensemble methods in traditional ML [7].

**Mechanism:** The model generates N different reasoning chains for the same prompt, each potentially following a different path. The final answer is determined by majority vote across the N chains.

**Empirical Support:** Self-Consistency consistently improves upon single-chain CoT, particularly on problems where the reasoning path is ambiguous or where the model's initial reasoning may be led astray by surface-level patterns.

**Limitations:** Computational cost scales linearly with N (number of sampled chains). The technique addresses reasoning reliability but not input completeness—all N chains reason about the same (potentially incomplete) interpretation of the input.

### Category 2: Task Structure Strategies

These strategies address the organization and decomposition of the task itself.

#### Decomposed Prompting (DecomP)

**Foundational Work:** Khot et al. (2022) proposed decomposing complex questions into simpler sub-questions, each handled by specialized sub-prompts. The key innovation is that different sub-questions can be routed to different models or tools based on their requirements [8].

**Mechanism:**
1. A decomposer module breaks the complex question into sub-questions
2. Each sub-question is routed to an appropriate handler (LLM, calculator, retriever)
3. Sub-answers are composed into a final answer

**Empirical Support:** DecomP improves performance on multi-hop reasoning, compositional generalization, and long-context tasks by reducing the complexity that any single model call must handle.

**Limitations:** DecomP assumes the input question is well-specified—it decomposes the *answer strategy*, not the *question itself*. If the original question contains implicit or hedged intents, DecomP will miss them.

#### Plan-and-Solve (PS)

**Foundational Work:** Wang et al. (2023) proposed a two-stage approach: first devise a plan for solving the problem, then execute the plan step by step [9].

**Mechanism:**
1. The model generates a plan: "To solve this, I need to: (1) extract data, (2) calculate totals, (3) compare results"
2. The model executes each plan step sequentially

**Empirical Support:** PS improves performance on math word problems and multi-step reasoning tasks by making the execution strategy explicit before execution begins.

**Limitations:** The plan is only as good as the model's understanding of the input. If the input contains multiple intents, the plan may address only the salient ones.

#### Skeleton-of-Thought (SoT)

**Foundational Work:** Ning et al. (2023) proposed generating a "skeleton" answer structure first, then filling in each section in parallel, dramatically reducing latency for long-form generation.

**Mechanism:**
1. Generate a skeleton: section headers or key points
2. Fill each section independently (can be parallelized)
3. Compose the final answer

**Empirical Support:** SoT reduces latency by 2-3x with comparable or improved quality for long-form outputs.

**Relevance to Decomposition:** SoT is relevant because it demonstrates that explicit structural decomposition before generation improves both speed and quality—a principle that PDE extends from output structure to input analysis.

### Category 3: Input Completeness Strategies

This category, which PDE anchors, addresses the fidelity of intent extraction from complex inputs.

#### Prompt Decomposition Engineering (PDE)

**Foundational Context:** PDE emerges from the observation that Categories 1 and 2 both assume the model correctly identifies all intents in the input—an assumption that fails for complex, multi-intent, hedging-rich prompts.

**Mechanism:**
1. **Intent Extraction:** The complex prompt is analyzed for primary intents (explicit, unhedged), secondary intents (hedged, conditional), and implicit intents (logically entailed but unstated)
2. **Dependency Mapping:** Extracted intents are analyzed for prerequisite relationships
3. **Four Directions Organization:** Intents are organized into East (vision), South (analysis), West (implementation), North (evaluation) stacks

**Key Innovation:** PDE's treatment of hedging language as intent signal rather than uncertainty noise. When a user says "maybe also add Husky," PDE captures this as a secondary intent with medium confidence—ensuring it is not dropped during execution.

**Theoretical Foundation:** PDE draws from speech act theory (Austin, 1962; Searle, 1969) in treating utterances as actions with varying illocutionary force. "Maybe also configure X" is an indirect speech act—its surface form (suggestion) differs from its underlying intent (request). PDE's hedging detection operationalizes this insight [10].

**Empirical Support:** While PDE is newer and less empirically studied than CoT or ToT, its value proposition is validated by the well-documented phenomenon of "prompt drift"—the tendency for LLMs to lose track of secondary intents in complex prompts, a finding consistently reproduced in agent evaluation benchmarks.

### Comparative Analysis

| Strategy | Optimizes | Input Requirements | Computational Cost | Maturity |
|----------|-----------|-------------------|-------------------|----------|
| CoT | Reasoning accuracy | Well-specified question | Low (1 extra pass) | High |
| ToT | Solution exploration | Well-specified problem | High (N branches × M steps) | Medium |
| Self-Consistency | Reasoning reliability | Well-specified question | Medium (N samples) | High |
| DecomP | Complexity management | Well-specified question | Medium (sub-prompts) | Medium |
| Plan-and-Solve | Execution strategy | Well-specified problem | Low (plan + execute) | Medium |
| SoT | Generation speed | Clear output structure | Low (skeleton + fill) | Medium |
| **PDE** | **Input completeness** | **Any complexity** | **Low (one analysis pass)** | **Early** |

### Complementary Relationships

The strategies are not competing but complementary, addressing different stages of the prompt-to-output pipeline:

```
User Input → [PDE: ensure completeness] → [PS: plan strategy] → 
[CoT/ToT: reason carefully] → [Self-Consistency: verify] → Output
```

PDE operates at the earliest stage—ensuring that all intents are captured before any reasoning strategy is applied. Its output feeds into Plan-and-Solve (which creates execution plans for each extracted intent), Chain-of-Thought (which reasons carefully about each step), and Self-Consistency (which verifies the reasoning).

### Reflexion and Self-Improvement

Shinn et al. (2023) introduced Reflexion—prompting agents to reflect on their own outputs and identify errors for correction. This is relevant to the decomposition landscape because it addresses a failure mode that all prior strategies share: what happens when the model executes correctly but misinterpreted the input?

Reflexion operates as a post-hoc correction mechanism. PDE operates as a pre-hoc prevention mechanism. Both are valuable; their combination provides the strongest completeness guarantee [11].

### Meta-Prompting and Prompt Chaining

The literature also notes the importance of prompt chaining—linking multiple prompt responses into explicit multi-stage workflows. This pattern is the operational foundation for PDE: the decomposition analysis is one prompt, and each extracted intent is executed through subsequent prompts, potentially with different reasoning strategies applied to each.

## Implications for CoAiA.js

1. **PDE as session entry point.** Every CoAiA.js session begins with PDE decomposition, ensuring completeness before reasoning begins.
2. **Strategy composition.** After PDE extracts intents, each intent can use the appropriate reasoning strategy (CoT for sequential tasks, ToT for creative tasks).
3. **Four Directions alignment.** PDE's Four Directions output stack maps directly to CoAiA.js's directional agent orchestration.
4. **MMOT as Reflexion.** The MMOT evaluation cycle serves as the post-hoc completeness verification that Reflexion provides, checking whether all PDE-extracted intents were addressed.
5. **Hedging-aware agents.** CoAiA.js agents treat hedged requests as real requests with reduced confidence, preventing the intent loss that plagues naive prompt processing.

## Conclusion

The prompt decomposition literature reveals a rich but incomplete landscape. Reasoning enhancement strategies (CoT, ToT, Self-Consistency) and task structure strategies (DecomP, PS, SoT) have achieved significant advances in the quality and organization of LLM outputs. However, they share a common blind spot: the assumption that the input prompt has been correctly and completely understood. PDE addresses this blind spot by operating on the input itself—extracting all intents (including implicit and hedged ones), mapping dependencies, and organizing them for systematic execution. The combination of input completeness (PDE) with reasoning quality (CoT/ToT) and post-hoc verification (Reflexion/MMOT) provides the most robust foundation for complex AI agent operations.

## References

1. LearnPrompting.org. (2024). "Advanced Decomposition Techniques for Improved Prompting." https://learnprompting.org/docs/advanced/decomposition/introduction
2. Coupler.io. (2024). "Advanced Prompting Techniques for Complex AI Reasoning." https://blog.coupler.io/advanced-prompting-techniques/
3. Wei, J., et al. (2022). "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models." *NeurIPS 2022*.
4. Toward Data Science. (2024). "Advanced Prompt Engineering: Chain of Thought." https://towardsdatascience.com/advanced-prompt-engineering-chain-of-thought-cot-8d8b090bf699/
5. CalmOps. (2024). "Prompt Engineering Patterns: CoT, ReAct, and ToT." https://calmops.com/ai/prompt-engineering-patterns-cot-react-tot/
6. Yao, S., et al. (2023). "Tree of Thoughts: Deliberate Problem Solving with Large Language Models." *NeurIPS 2023*.
7. Wang, X., et al. (2022). "Self-Consistency Improves Chain of Thought Reasoning in Language Models." *ICLR 2023*.
8. Khot, T., et al. (2022). "Decomposed Prompting: A Modular Approach for Solving Complex Tasks." *ICLR 2023*.
9. Wang, L., et al. (2023). "Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning." *ACL 2023*.
10. Searle, J. R. (1969). *Speech Acts: An Essay in the Philosophy of Language*. Cambridge University Press.
11. Shinn, N., et al. (2023). "Reflexion: Language Agents with Verbal Reinforcement Learning." *NeurIPS 2023*.
12. Oxen.ai. (2024). "The Prompt Report Part 2." https://ghost.oxen.ai/the-prompt-report-part-2-thought-generation-tree-of-thought-and-decomposition-prompting/
13. Exploratio Journal. (2024). "Zooming-in On Prompting: A Comparative Study." https://exploratiojournal.com/zooming-in-on-prompting/
14. Metric Coders. (2024). "Complex Reasoning with Chain-of-Thought, Tree-of-Thought, and More." https://www.metriccoders.com/post/beyond-the-basics-unleashing-complex-reasoning-with-chain-of-thought-tree-of-thought-and-more
15. Fedotov, I. (2024). "Advanced Prompt Engineering Techniques: From Tree of Thoughts to Multimodal AI." https://ilyafedotov.com/advanced-prompt-engineering-techniques-from-tree-of-thoughts-to-multimodal-ai/
