# Decisions

Decisions that shaped the release gate, with the evidence behind each and what
would overturn it.

---

## D1. The `Distinct Upstream Projects` regression is NOT fixable without breaking a rule

**Decision:** accept it as a material regression and ship with it disclosed.

**Evidence — capability ownership of every project in the stack** (live run):

| Project | Licence / policy | Security | Capabilities supplied | Unique? | Alternatives (with their gate) |
| --- | --- | --- | --- | --- | --- |
| `americanexpress/jest-image-snapshot` | Apache-2.0 / REUSE_WITH_CONDITIONS | CONDITIONAL (1) | image-comparison, visual-regression | **yes** | none |
| `GoogleChrome/lighthouse` | Apache-2.0 / REUSE_WITH_CONDITIONS | CONDITIONAL (2) | performance-audit | **yes** | none |
| `microsoft/playwright` | Apache-2.0 / REUSE_WITH_CONDITIONS | PASS (0) | testing | **yes** | none |
| `microsoft/playwright-mcp` | Apache-2.0 / REUSE_WITH_CONDITIONS | PASS (0) | browser-automation, screenshot-capture, accessibility-audit | no | playwright (PASS) for the first two; for a11y only axe-core (REVIEW_REQUIRED), lighthouse (CONDITIONAL) or pa11y (PASS but **LGPL-3.0-only**) |
| the generated plugin itself | MIT | PASS | orchestration, evidence, visual-review | — | — |

**Classification:**

| Project | Class | Why |
| --- | --- | --- |
| jest-image-snapshot | `ESSENTIAL` | Sole supplier of two required capabilities. |
| lighthouse | `ESSENTIAL` | Sole supplier of performance-audit. |
| playwright | `ESSENTIAL` | Sole supplier of testing. |
| playwright-mcp | `ESSENTIAL` | Not for browser-automation or screenshot-capture, which playwright covers — but it is the **only PASS-grade, permissively-licensed** supplier of accessibility-audit. |
| the plugin itself | `INTEGRATION_OVERHEAD`, unavoidable | It is the artifact being shipped. |

**Why the count cannot go below 5:**

Every route to 4 breaks a rule the project holds above project count:

1. Move accessibility-audit to **axe-core** → security gate PASS → REVIEW_REQUIRED. **Forbidden** (§4: never weaken the security gate to reduce project count).
2. Move it to **lighthouse** → PASS → CONDITIONAL. Same rule. The optimizer attempted exactly this and refused; the refusal is visible in the run.
3. Move it to **pa11y** → security PASS, but LGPL-3.0-only → licence policy REUSE_WITH_CONDITIONS → LEGAL_REVIEW. Weakening the licence gate for tidiness is the same error in a different gate. It also adds a project rather than removing one.
4. **Vendoring** — considered and rejected under §5, see D2.
5. Drop a capability → the goal is no longer met.

**Overturned by:** a permissively-licensed, PASS-grade accessibility engine that
another already-selected project also supplies. None exists in the searched
sources today.

---

## D2. Vendoring is REJECTED, even where the licence permits it

**Decision:** do not vendor, although three of the four upstreams are
Apache-2.0 and formally `REUSE_WITH_CONDITIONS`.

| Upstream | Licence | Reuse status | Notice | Attribution | Modification | Distribution | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| playwright | Apache-2.0 | REUSE_WITH_CONDITIONS | NOTICE must ship | required | must state changes | permitted | vendoring legal |
| playwright-mcp | Apache-2.0 | REUSE_WITH_CONDITIONS | NOTICE must ship | required | must state changes | permitted | vendoring legal |
| jest-image-snapshot | Apache-2.0 | REUSE_WITH_CONDITIONS | NOTICE must ship | required | must state changes | permitted | vendoring legal |
| lighthouse | Apache-2.0 | REUSE_WITH_CONDITIONS | NOTICE must ship | required | must state changes | permitted | vendoring legal |
| axe-core | MPL-2.0 | REUSE_WITH_CONDITIONS | file-level copyleft | required | copied files stay MPL | source must be offered | **not vendored** |
| pa11y | LGPL-3.0-only | LEGAL_REVIEW | linking obligations | required | relinking rights preserved | needs a human decision | **BLOCKED from vendoring** |

**Why reject it anyway:**

- **It does not even fix the metric.** Vendoring copies code; it does not remove
  the project from the supply chain. The provenance record would still name
  every source, and the security surface would be identical — now frozen at the
  version copied, with upstream fixes no longer arriving.
- **Security responsibility transfers to us.** Today a CVE in playwright is
  fixed by `npm update`. Vendored, it is fixed by us noticing.
- **`Reused Code: None` would become false**, and that claim is currently
  verified from the artifacts by shingle comparison.
- §5 forbids vendoring that raises supply-chain risk, maintenance cost, licence
  complexity or security responsibility **for project count alone**. It raises
  all four.

**Overturned by:** a requirement that the plugin work fully offline, which would
change the trade-off entirely.

---

## D3. The `Execution Time` regression is real work, not overhead — proven, not argued

**Decision:** keep the raw regression in the verdict; add normalized metrics
beside it; do not claim it away.

**Evidence 1 — the profile accounts for the whole delta.** Per pass, the
integrated plugin does this and the baselines cannot do any of it:

| Extra work | ms |
| --- | --- |
| `axe:inject` + `axe:run` | ~186 |
| `pixel:diff` | ~76 |
| one extra screenshot for the regression baseline | ~53 |
| **total** | **~315** |

Measured difference, integrated minus best baseline: **~316 ms**.

**Evidence 2 — SAME-TASK comparison.** Restricted to the four tasks the
realistic alternative can attempt, with capability sets intersected so nobody
does extra work:

| | originals-union | integrated |
| --- | --- | --- |
| Execution Time | 248 ms | **247 ms** |

At identical work the integrated plugin is **not slower**. There is no
orchestration overhead to remove.

**What was optimized anyway** (§7 levers 1, 3, 6, and a fairness fix):

| Change | Lever | Effect |
| --- | --- | --- |
| One browser for the whole suite, one context per subject | remove duplicated work | 15 launches → 1 |
| Warm-up pass outside all timing | *fairness*, not speed | cold start stopped landing on whichever subject ran first — an ordering effect, not a capability effect |
| axe-core source read once and cached | avoid repeated filesystem reads | 15 reads → 1 |
| Reuse the 1440×900 viewport capture as the regression baseline | remove duplicated work | one fewer screenshot per pass |

Result: **844 ms → 579 ms (−31%)**, with no check skipped, no validation
shortened and no capability disabled. The regression persists because the
remaining time is the accessibility and visual-regression work itself.

**Overturned by:** nothing available. Reducing it further means doing less
checking.

---

## D4. `--live` is the correct operating mode

**Decision:** treat offline as the reproducible test mode, `--live` as the real one.

**Evidence:** `Unscanned Dependencies` — added in policy v0.1.1 as the component
of supply-chain risk that actually carries risk:

| Mode | Unscanned dependencies in the integrated stack |
| --- | --- |
| offline (synthetic) | **2** — material regression |
| `--live` | **0** — every source fetched and scanned |

An unscanned dependency is not a safe one; it is an unknown one. The offline
regression is an artifact of having nothing to scan, and `--live` removes it by
actually looking.

---

## D5. All four original contributions are kept — because ablation proved them

**Decision:** keep all four. No component is kept for being original.

Each was built out and the difference measured (`tests/ablation.test.ts`):

| Component | Without it | With it | Verdict |
| --- | --- | --- | --- |
| `capability-router` | no ordering stated anywhere; sibling components indexed by nothing but themselves | workflow order + component index | **KEEP** |
| `namespace-guard` | collision documentation for `review` / `.qa/` drops | collisions named and owned | **KEEP** (emitted only when collisions exist — the live build has none and does not emit it) |
| `evidence-ledger` | no runtime component states the VERIFIED rule; gate-posture statements drop | rules stated to the model | **KEEP** |
| `visual-review` | measured Task Completion **drops** | T9 completable | **KEEP** |

A control case confirms the harness would catch a component that changed
nothing. Three further components (`build-surface`, `verification-runner`,
`unlock-advisor`) were examined and are **not** claimed as original
contributions — see `ORIGINAL_CONTRIBUTIONS.md`.

---

## D6. The v0.1 verdict is not retroactively changed

**Decision:** `benchmark/baseline-v0.1.json` is frozen at commit `a5507ae`, and
v0.1's `REGRESSION` / `CONDITIONAL` stands.

Policy changes went into `BENCHMARK_POLICY_v0.1.1.md` as additions. Old results
are not recomputed. The policy document states, in writing, both how v0.1.1
could favour the integrated plugin and how it could hurt it.
