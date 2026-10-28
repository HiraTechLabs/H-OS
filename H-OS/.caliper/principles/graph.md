# Graph Principles (GRAPH)

The Graph documents the architecture and the relations between components. It lives in `.caliper/graph/`.

### GRAPH-001 [must|ci] graph
The Graph is machine-readable (`graph.json`) with generated Mermaid views. Node types: app, module, service, datastore, event, contract, external-system. Edge types: depends-on, publishes, subscribes, owns-data, calls.

### GRAPH-002 [must|ci] graph
Structural facts are generated from code and config (dependency-cruiser, event schema registry, OpenAPI, database schema). Hand-written content is limited to descriptions and ownership. CI fails when the committed Graph differs from the generated one.

### GRAPH-003 [must|ci] graph
A PR that adds or removes a module, event, contract, table ownership or dependency updates the Graph in the same PR.

### GRAPH-004 [must|review] graph
Every node has an id, type, owning app, one-line description, owned data and public contract. Every edge has a type and a reason.

### GRAPH-005 [must|review] graph
The Graph is queried, not loaded: ask for the neighbors of a node and the impact of changing it. Only load more than that when the task is about the Graph itself.

### GRAPH-006 [must|ci] graph, domain
Graph validation rejects edges that violate architecture rules, for example an app depending on another app's internals or a cross-schema data dependency.

### GRAPH-007 [should|review] graph
Provide layered views: system context, apps, modules per app, event flow.
