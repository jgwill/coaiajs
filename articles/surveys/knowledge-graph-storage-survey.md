# Survey of Knowledge Graph Storage Approaches for AI Agent Systems

> Academic survey for the CoAiA.js project — Comparative analysis of property graphs, RDF triples, JSONL entity-relation models, and vector embeddings as lightweight, agent-compatible knowledge representation formats.

## Abstract

AI agent systems require persistent knowledge representation that balances expressiveness, performance, and operational simplicity. This survey examines four primary approaches to knowledge graph storage—property graphs, RDF triple stores, JSONL entity-relation models, and vector embedding databases—with particular focus on their suitability for lightweight, agent-compatible deployments. We analyze each approach across seven dimensions: expressive power, query capabilities, operational complexity, portability, temporal modeling, concurrency support, and ecosystem maturity. Our findings indicate that no single approach dominates all dimensions; rather, the optimal choice depends on the agent's operational context. For single-agent session workloads with moderate graph sizes (under 100K entities), JSONL entity-relation models offer the best balance of simplicity and capability. For multi-agent systems requiring concurrent access and complex traversals, property graph databases remain superior. Vector embeddings complement rather than replace structured graph storage, excelling at semantic retrieval within graph-structured knowledge. The survey concludes with recommendations for hybrid architectures that combine multiple storage approaches based on workload characteristics.

## Introduction

Knowledge graphs have emerged as the preferred representation for structured knowledge in AI systems, encoding entities, their properties, and the relationships between them in a format amenable to both human understanding and machine reasoning. The knowledge graph storage landscape, however, presents a dizzying array of options—from enterprise-grade graph databases to lightweight file-based formats, from semantically-rich RDF stores to embedding-only vector databases [1][2].

For AI agent developers, the selection criteria differ significantly from traditional enterprise knowledge management. Agents need:
- **Rapid deployment:** Zero-config or minimal-config storage that works immediately
- **Session-scoped data:** Most agent knowledge is session-specific, not enterprise-wide
- **Temporal evolution:** Knowledge evolves throughout a session; history matters
- **Portability:** Storage must be transferable between environments
- **Moderate scale:** Agent sessions typically produce thousands, not millions, of facts [3]

This survey evaluates the major storage approaches against these agent-specific requirements.

## Survey of Approaches

### 1. Property Graph Databases

**Representative systems:** Neo4j, Memgraph, KuzuDB (archived, forked), FalkorDB, Amazon Neptune

**Data Model:** Nodes and edges, each with typed key-value properties. Nodes represent entities; edges represent relationships. Both nodes and edges can carry arbitrary property maps.

```cypher
CREATE (s:Server {name: "mcp-server", version: "2.0"})
CREATE (l:Library {name: "langfuse", license: "MIT"})
CREATE (s)-[:DEPENDS_ON {since: "2025-01"}]->(l)
```

**Query Language:** Cypher (Neo4j, Memgraph, KuzuDB) or Gremlin (Apache TinkerPop). Both support pattern matching, path queries, and graph algorithms.

**Strengths:**
- Native graph traversal with optimized algorithms (shortest path, community detection, centrality)
- Flexible schema evolution—new properties and relationships added without migration
- Mature ecosystem with visualization tools, bulk import, and enterprise features
- KuzuDB (embedded fork by Vela Engineering) claims 374x path query speedup vs. Neo4j for embedded workloads [4]

**Weaknesses:**
- Operational overhead: Neo4j requires JVM server; Memgraph requires separate process
- Licensing complexity: Neo4j Community vs. Enterprise; varying open-source commitments
- Heavyweight for session-scoped data: designed for persistent, multi-user access patterns
- Not naturally append-only; mutations can lose temporal history without explicit versioning

**Agent Suitability:** Best for multi-agent systems requiring concurrent access, complex graph queries, or enterprise-scale knowledge. Overkill for single-agent sessions.

### 2. RDF Triple Stores

**Representative systems:** Apache Jena/Fuseki, GraphDB, Blazegraph, Amazon Neptune (RDF mode), Virtuoso

**Data Model:** Subject-Predicate-Object triples with URI-based identification, conforming to W3C standards. Supports ontological reasoning through RDFS and OWL.

```turtle
<http://coaia.js/server/mcp> <http://coaia.js/schema/dependsOn> <http://coaia.js/library/langfuse> .
<http://coaia.js/server/mcp> <http://coaia.js/schema/version> "2.0" .
<http://coaia.js/library/langfuse> <http://coaia.js/schema/license> "MIT" .
```

**Query Language:** SPARQL, supporting complex graph pattern matching, aggregation, and federated queries across multiple endpoints.

**Strengths:**
- Formal semantics enabling automated reasoning and inference
- Interoperability through standardized vocabularies and ontologies
- Federated query capability across distributed data sources
- W3C standardization ensures long-term ecosystem stability [5][6]

**Weaknesses:**
- Verbose data representation; high overhead per fact
- SPARQL learning curve significantly steeper than Cypher
- Performance challenges for analytics and complex traversals at scale
- Schema rigidity through ontological constraints can impede agile development
- Few lightweight/embedded implementations suitable for agent deployment

**Agent Suitability:** Best when semantic reasoning, data interoperability, or integration with linked data ecosystems is required. Poor fit for lightweight, session-scoped agent memory.

### 3. JSONL Entity-Relation Models

**Representative systems:** CoAiA memory (coaia-narrative), Memento MCP, custom implementations

**Data Model:** Line-delimited JSON where each line encodes an entity, relation, or observation. Typically uses a `type` field for discrimination:

```jsonl
{"type":"entity","name":"mcp_server","entityType":"component","observations":["Handles tool dispatch"]}
{"type":"relation","from":"mcp_server","to":"langfuse","relationType":"depends_on"}
{"type":"observation","entityName":"mcp_server","content":"Added v2 transport support","timestamp":"2026-03-10T14:00:00Z"}
```

**Query Mechanism:** No native query language. Queries are implemented through:
- Full file load into in-memory graph structure
- Streaming filter (grep, jq) for simple lookups
- Application-level query APIs built on top of in-memory data

**Strengths:**
- Zero operational overhead: no server, no driver, no configuration
- Natural append-only semantics: history is never lost
- Human-readable and debuggable with standard text tools
- Git-friendly: clean diffs, version-controllable
- Portable: copy a single file to transfer knowledge
- Schema-flexible: new entity and relation types added without migration [7]

**Weaknesses:**
- No native query language; all queries require application code
- Linear scan for complex queries without in-memory indexing
- No concurrent write safety without external locking
- No built-in integrity constraints or validation
- Performance degrades for large graphs (>100K records) without indexing

**Agent Suitability:** Excellent for single-agent session workloads with moderate graph sizes. The dominant choice for development, edge deployment, and scenarios prioritizing simplicity over query power.

### 4. Vector Embedding Databases

**Representative systems:** Pinecone, Weaviate, Chroma, Milvus, Qdrant, pgvector

**Data Model:** Dense vector representations of entities, with metadata for filtering. Each record is an embedding (typically 256–4096 dimensions) associated with source text and structured metadata.

```json
{
  "id": "doc_001",
  "embedding": [0.012, -0.034, 0.891, ...],
  "metadata": {"source": "mcp_server", "type": "documentation"},
  "text": "The MCP server handles JSON-RPC 2.0 tool invocations..."
}
```

**Query Mechanism:** Approximate Nearest Neighbor (ANN) search returning top-k results by cosine similarity or other distance metrics, with optional metadata filtering.

**Strengths:**
- Semantic search: find conceptually similar entities regardless of lexical overlap
- Integration with LLM workflows: embeddings are native to the LLM pipeline
- Scalable to millions of vectors with sub-millisecond search
- Effective for Retrieval-Augmented Generation (RAG) patterns [8]

**Weaknesses:**
- No explicit relational structure: relationships must be inferred from proximity
- Loss of precision: embedding compression loses fine-grained factual detail
- No temporal modeling: similarity search doesn't naturally order by time
- Embedding model dependency: changing the embedding model invalidates all vectors
- Not a knowledge graph: lacks the entity-relation structure essential for agent reasoning

**Agent Suitability:** Excellent as a complementary retrieval layer within a graph-structured knowledge system. Should not be used as the sole knowledge representation for agents that need explicit relational reasoning.

## Comparative Analysis

### Seven-Dimension Comparison

| Dimension | Property Graph | RDF Triple | JSONL E-R | Vector DB |
|-----------|---------------|------------|-----------|-----------|
| **Expressive Power** | High | Very High | Moderate | Low (semantic only) |
| **Query Capability** | High (Cypher) | High (SPARQL) | Low (app code) | Moderate (ANN+filter) |
| **Operational Complexity** | High | High | Minimal | Moderate |
| **Portability** | Low | Moderate | Very High | Low |
| **Temporal Modeling** | Manual | Manual | Native (append) | Manual |
| **Concurrency** | High (ACID) | Moderate | Low (single writer) | Moderate |
| **Ecosystem Maturity** | High | High | Low | Growing |

### Workload-Based Recommendations

**Single-agent session memory (dominant case):**
→ JSONL entity-relation model. Zero-config, portable, temporally-native, adequate performance.

**Multi-agent shared knowledge:**
→ Property graph (KuzuDB embedded or Neo4j). Concurrent access, graph algorithms, path queries.

**Semantic retrieval within agent context:**
→ Vector database as retrieval layer, with JSONL or property graph as structural backbone.

**Knowledge interoperability across systems:**
→ RDF triple store. Standardized vocabularies enable cross-system integration.

**Hybrid agent architecture:**
→ JSONL for session state + vector DB for semantic retrieval + property graph for persistent cross-session knowledge.

## Implications for CoAiA.js

CoAiA.js adopts a layered storage architecture based on this survey:

1. **Primary storage: JSONL entity-relation.** Session state, structural tension charts, and agent observations are stored in append-only JSONL files.
2. **Semantic retrieval: Optional vector layer.** When enabled, entity observations are embedded and stored in a vector index for semantic search.
3. **Cross-session knowledge: Optional graph database.** For multi-agent deployments, a property graph database can aggregate knowledge across sessions.
4. **Export capability: RDF.** For interoperability with external knowledge systems, JSONL can be exported to RDF triples.

This layered approach ensures minimal operational complexity for simple deployments while enabling richer capabilities when needed.

## Conclusion

The knowledge graph storage landscape offers no universal solution—each approach optimizes for different dimensions of the expressiveness-simplicity trade-off. For AI agent systems, where operational simplicity and session-scoped temporal modeling are paramount, JSONL entity-relation models provide the best default choice, with property graphs, vector databases, and RDF stores serving as complementary layers for specific capability needs.

## References

1. Neo4j. (2024). "RDF Triple Stores vs. Property Graphs." https://neo4j.com/blog/knowledge-graph/rdf-vs-property-graphs-knowledge-graphs/
2. Enterprise Knowledge. (2024). "Cutting Through the Noise: An Introduction to RDF & LPG Graphs." https://enterprise-knowledge.com/cutting-through-the-noise-an-introduction-to-rdf-lpg-graphs/
3. Graphlit Blog. (2024). "Survey of AI Agent Memory Frameworks." https://www.graphlit.com/blog/survey-of-ai-agent-memory-frameworks
4. Vela Partners. (2025). "KuzuDB for Production AI Agents." https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database
5. Ontotext. (2024). "Choosing A Graph Data Model." https://www.ontotext.com/blog/choosing-a-graph-data-model-to-best-serve-your-use-case/
6. TigerGraph. (2024). "RDF vs. Property Graph." https://www.tigergraph.com/blog/rdf-vs-property-graph-choosing-the-right-foundation-for-knowledge-graphs/
7. Memento MCP. (2024). "A Knowledge Graph Memory System for LLMs." https://github.com/gannonh/memento-mcp
8. SAP Community. (2025). "Choosing Between Knowledge Graphs and Property Graphs in SAP HANA Cloud." https://community.sap.com/t5/technology-blog-posts-by-sap/choosing-between-knowledge-graphs-and-property-graphs-in-sap-hana-cloud-and/ba-p/14074575
9. Memgraph. (2024). "LPG vs. RDF." https://memgraph.com/docs/data-modeling/graph-data-model/lpg-vs-rdf
10. DataWalk. (2024). "Best of Property Graph & RDF for Powerful Analytics." https://datawalk.com/property-graph-vs-rdf/
