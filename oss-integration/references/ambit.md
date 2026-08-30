# Reference — zz-plant/ambit

- **Repository**: https://github.com/zz-plant/ambit
- **Licence**: MIT (read from the repository landing page, 2026-08-30)
- **Read on**: 2026-08-30
- **What was read**: the public repository landing page only. **No source file
  was opened and no code was copied.**
- **v0.1 policy**: `REFERENCE_ONLY` — pinned in `data/oss-registry.json` via
  `referenceOnlyByPolicy: true`, independent of its permissive licence.

## What Ambit is

A meta-MCP server that maps and audits an AI agent's own infrastructure by
building a capability DAG. Its landing page describes prerequisite modelling
and near-miss detection, combo unlocks, single-point-of-failure analysis,
frontier calculation (reached / frontier / locked), goal-path routing, agent
self-introspection, and attention economics.

## Concepts acknowledged as prior art

| Concept | Where it appears here | Relationship |
| --- | --- | --- |
| Capability DAG | `src/graph/capability-graph.ts` | Independent implementation over this project's own relation set (REQUIRES / COMPLEMENTS / ALTERNATIVE_TO / CONFLICTS_WITH / UNLOCKS). |
| Prerequisite graph | `CapabilityGraph.prerequisiteClosure` | Independent implementation, cycle-safe BFS. |
| Combo / unlock | `CapabilityGraph.unlocked` | Independent implementation. |
| Near-miss detection | `CapabilityGraph.nearMisses` | Independent implementation with an explicit distance bound. |
| Goal routing | `src/goal/engine.ts`, `designWorkflow` in the architect | Independent implementation; here it routes a *goal* to capabilities to acquire, not to capabilities already installed. |
| Alternative paths | `CapabilityGraph.alternatives`, the duplicate detector's winner selection | Independent implementation. |
| Impact analysis | Partially — the conflict detector and the stack optimizer. SPOF analysis is **not** implemented in v0.1. | Not adopted. |
| Lifecycle / health | `src/health/engine.ts` | Independent implementation that returns `null` rather than a fabricated score. |

## The important difference

Ambit asks:

```
WHAT CAN MY CURRENT AGENT ENVIRONMENT DO?
```

This project asks the inverse:

```
WHAT CAPABILITIES SHOULD I GET
FROM THE GLOBAL OSS ECOSYSTEM
FOR MY GOAL?

AND

HOW SHOULD THEY BE INTEGRATED
INTO ONE OPTIMAL PLUGIN?
```

Ambit takes an environment as given and reports its frontier. This project
takes a *goal* as given and goes shopping — then has to solve everything
shopping creates: licence, security, duplication, conflict, and whether the
result is actually better than what the user already had. Those problems do
not arise when the capability set is fixed, which is why this is an
independent implementation rather than a fork.

## Reused code

**None.**
