# Original contributions — audit

Rule 14. Each component below is examined for whether it earns the label
"original contribution" or is a rename or a wrapper dressed up as one. A
component that only forwards to something else is **not** an original
contribution and is called out as such.

Original components are emitted **only when the stack demands them**, so this
list differs between builds. Evidence: the synthetic reference build emits five
skills (it has name collisions to resolve); the live build emits three (it has
none). See `examples/`.

---

## 1. `capability-router` — REAL

| Field | Value |
| --- | --- |
| **Why needed** | The selected capabilities come from independent projects with no shared entry point and no shared ordering. Without a router the user must know which upstream tool answers which request — the exact cost integration exists to remove. |
| **Input** | A user request, plus the plugin's capability table and the workflow order derived from the capability graph. |
| **Output** | A capability to invoke, in prerequisite-correct order, or an explicit refusal when the request needs a capability the plugin does not hold. |
| **Dependency** | The capability graph (`src/graph/capability-graph.ts`) for ordering; the generated capability table for membership. |
| **Problem it solves** | Cross-project dispatch and ordering, and a hard boundary on what the plugin will claim to do. |
| **How tested** | `tests/acceptance.test.ts` → "the generated plugin carries no dead component" asserts the router names every sibling component. Ordering is covered by `tests/unit.test.ts` → prerequisite closure and unlock tests. |
| **Verdict** | Original. It encodes an ordering that exists in none of the source projects, because none of them holds the whole capability set. |

## 2. `evidence-ledger` — REAL

| Field | Value |
| --- | --- |
| **Why needed** | Capabilities enter the stack with different gate results and different evidence classes. Without a ledger the plugin would present a REFERENCE_ONLY, never-scanned capability's output identically to an executed, gate-clean one. |
| **Input** | Per-capability evidence class, licence posture and security gate status, fixed at build time; per-result execution facts at run time. |
| **Output** | An evidence class attached to every reported result, and a refusal to report an unrun check as VERIFIED. |
| **Dependency** | `src/evidence/engine.ts` for the class ordering. |
| **Problem it solves** | Prevents the strongest claim in a mixed stack from setting the tone for the weakest. |
| **How tested** | `tests/unit.test.ts` (evidence derivation, popularity capped at UNKNOWN); `tests/real-task.test.ts` → "rubric criteria without evidence are NOT_VERIFIED, not zero". |
| **Verdict** | Original. No source project tracks per-capability evidence, because none of them is assembled from other projects. |

## 3. `namespace-guard` — REAL, but conditional

| Field | Value |
| --- | --- |
| **Why needed** | Only when sources collide on a name the host resolves globally. In the synthetic reference build all three inputs declare a `review` command and two write to `.qa/`. |
| **Input** | The conflict list from `src/compatibility/detector.ts`. |
| **Output** | One public surface, with the source-specific duplicates not re-emitted. |
| **Dependency** | The conflict detector. |
| **Problem it solves** | Stops the host silently picking a winner among colliding names. |
| **How tested** | `tests/acceptance.test.ts` → "components are emitted only when the goal needs them" asserts it appears **exactly** when conflicts exist. The live build, which has no collisions, does not emit it. |
| **Verdict** | Original where emitted. Its conditional emission is the evidence that it is not padding. |

## 4. `visual-review` — REAL, and honestly labelled

| Field | Value |
| --- | --- |
| **Why needed** | No source supplies it. The capability graph says it is UNLOCKED by holding browser automation, accessibility audit and performance audit together. |
| **Input** | Measured facts from the capabilities already in the stack. |
| **Output** | An evidence-backed readiness judgement, carrying evidence class `INFERRED`. |
| **Dependency** | The three unlocking capabilities. Without all three it is not offered. |
| **Problem it solves** | Turns a subjective "looks fine" into a judgement over measured facts, at no additional install cost. |
| **How tested** | `tests/unit.test.ts` → gap-engine test asserts an unlocked capability is reported as covered by combination rather than as a gap; `tests/acceptance.test.ts` asserts nothing the stack delivers is also reported unresolved. |
| **Verdict** | Original. Deliberately **not** claimed as VERIFIED: it is reasoned from the combination, not executed, and it is emitted with `INFERRED` and a stated limitation. |

---

## Components examined and rejected as original contributions

| Component | Why it is NOT counted |
| --- | --- |
| `build-surface` | Mostly a hand-off wrapper around capabilities that already exist in the sources. It is emitted because the Build layer needs an entry point, but it is not claimed as an original contribution. |
| `verification-runner` | Same. It sequences existing capabilities and enforces the config surface; the sequencing logic that *is* novel lives in `capability-router`, and is credited only once. |
| `unlock-advisor` | Emitted only when a near miss survives. In both reference builds none does, so it is not emitted — and it is not claimed. |

Counting these four as original contributions would have inflated the list from
four to seven. They are listed here so the exclusion is visible rather than
silent.
