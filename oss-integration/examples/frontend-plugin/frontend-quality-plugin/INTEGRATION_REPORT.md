# INTEGRATION REPORT — frontend-quality-plugin

## 1. Goal

```
GOAL                 : Claude Codeで最高品質のWebサイトを作れるPluginを作って
TARGET ENVIRONMENT   : Claude Code
REQUIRED CAPABILITIES: frontend-implementation, visual-review, visual-design, responsive-design, accessibility-audit, browser-automation, screenshot-capture, performance-audit, testing, security-review
OPTIONAL CAPABILITIES: image-comparison, visual-regression, code-review
CONSTRAINTS          : UNKNOWN
USER-SUPPLIED OSS    : https://github.com/fixture-org/frontend-craft-plugin, https://github.com/fixture-org/browser-qa-plugin, https://github.com/fixture-org/a11y-guard-plugin
COMMERCIAL USE       : UNKNOWN
EVIDENCE STANDARD    : SUPPORTED
EXPANDED BY ARCHETYPE:
  - high-quality-website: 'Quality' for a web artifact is not a single capability. Shipping a page at production quality means designing it, implementing it responsively, and then proving it against a11y, performance and visual criteria. This archetype makes that expansion explicit and auditable instead of leaving it to the model's mood; the matched archetype is recorded on the GoalSpec so the user can reject it.
UNKNOWN              :
  - CONSTRAINTS: none stated.
  - COMMERCIAL USE: not stated. Licence gate will assume nothing and stay conservative.
```

## 2. Repositories analysed

| Repository | Source of data | Kind | Licence | Licence gate | Security gate | Health | Scout Score | Blocked |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fixture-org/frontend-craft-plugin` | fixture | claude-plugin | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 4.22 | no |
| `fixture-org/browser-qa-plugin` | fixture | claude-plugin | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 4.05 | no |
| `fixture-org/a11y-guard-plugin` | fixture | claude-plugin | UNKNOWN | UNKNOWN (REFERENCE_ONLY) | BLOCK | 1.3 | 2.33 | **YES** |
| `dequelabs/axe-core` | registry-seed | library | MPL-2.0 | CONDITIONAL (REUSE_WITH_CONDITIONS) | UNKNOWN | UNKNOWN | 2.37 | no |
| `pa11y/pa11y` | registry-seed | cli | LGPL-3.0-only | REVIEW_REQUIRED (LEGAL_REVIEW) | UNKNOWN | UNKNOWN | 2.68 | no |
| `microsoft/playwright-mcp` | registry-seed | mcp-server | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | UNKNOWN | UNKNOWN | 3.70 | no |
| `GoogleChrome/lighthouse` | registry-seed | cli | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | UNKNOWN | UNKNOWN | 3.28 | no |
| `americanexpress/jest-image-snapshot` | registry-seed | library | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | UNKNOWN | UNKNOWN | 2.87 | no |

**Security findings — `fixture-org/a11y-guard-plugin`**

- `medium` untrusted-install-script in package.json > scripts.postinstall — install-script: "postinstall" runs automatically when the package is installed.
  - matched: `node ./scripts/setup.js`
- `critical` untrusted-install-script in README.md — shell-pipe-installer: Pipes a network-fetched script straight into a shell.
  - matched: `your pages. ## Install ``` curl -sL https://a11y-guard.example.com/install.sh | sudo bash ````
- `high` unsafe-shell-execution in scripts/setup.js — shell-exec-interpolated: Builds a shell command from interpolated input.
  - matched: `} = require('child_process'); execSync(`node ${process.env.A11Y_PLUGIN_DIR}/b`

## 3. Capability graph (selected scope)

```
screenshot-capture --REQUIRES--> browser-automation   # A screenshot of a rendered page needs a driven browser.
visual-regression --REQUIRES--> screenshot-capture
visual-regression --REQUIRES--> image-comparison
accessibility-audit --REQUIRES--> browser-automation   # Automated WCAG checks run against a rendered DOM.
performance-audit --REQUIRES--> browser-automation
responsive-design --REQUIRES--> frontend-implementation
accessibility-audit --COMPLEMENTS--> visual-review
visual-design --COMPLEMENTS--> frontend-implementation
performance-audit --COMPLEMENTS--> code-review
security-review --COMPLEMENTS--> code-review
browser-automation + screenshot-capture + image-comparison --UNLOCKS--> visual-regression   # The three together make automated visual regression possible.
browser-automation + accessibility-audit + performance-audit --UNLOCKS--> visual-review   # Machine-checkable page facts make a visual review evidence-based rather than impressionistic.
```

## 4. Gap analysis

- **Required (closed over prerequisites)**: frontend-implementation, visual-review, visual-design, responsive-design, accessibility-audit, browser-automation, screenshot-capture, performance-audit, testing, security-review
- **Held after gates**: frontend-implementation, visual-design, responsive-design, browser-automation, screenshot-capture, testing, accessibility-audit, performance-audit, image-comparison, visual-regression
- **Missing**: security-review
- **Covered by unlock (no extra source needed)**: visual-review

### Near misses

_(none)_

## 5. Duplicates

- **browser-automation**: fixture-org/browser-qa-plugin, pa11y/pa11y, microsoft/playwright-mcp → winner `fixture-org/browser-qa-plugin` on BEST_EVIDENCE.
  - Strongest evidence class (VERIFIED) among 3 candidates.
- **screenshot-capture**: fixture-org/browser-qa-plugin, microsoft/playwright-mcp → winner `fixture-org/browser-qa-plugin` on BEST_INTEGRATION_VALUE.
  - Highest Scout Score (4.05) among candidates tied on evidence and licence.
- **accessibility-audit**: fixture-org/a11y-guard-plugin, dequelabs/axe-core, pa11y/pa11y, microsoft/playwright-mcp, GoogleChrome/lighthouse → winner `microsoft/playwright-mcp` on BEST_INTEGRATION_VALUE.
  - Highest Scout Score (3.70) among candidates tied on evidence and licence.

## 6. Conflicts

- ✅ **command-namespace** on `review` (fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)
  - 3 sources declare the same command "review".
  - Resolution: Namespaced under the generated plugin: "review" is re-exposed once, owned by the orchestration layer, and the source-specific variants are not re-emitted.
- ✅ **duplicate-hook** on `PostToolUse:Write` (fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)
  - 2 sources declare the same hook "PostToolUse:Write".
  - Resolution: Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on "PostToolUse:Write" no longer exists.
- ✅ **configuration-conflict** on `viewports` (fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin)
  - 2 sources declare the same config key "viewports".
  - Resolution: Namespaced under the generated plugin: "viewports" is re-exposed once, owned by the orchestration layer, and the source-specific variants are not re-emitted.
- ✅ **configuration-conflict** on `baseUrl` (fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)
  - 2 sources declare the same config key "baseUrl".
  - Resolution: Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on "baseUrl" no longer exists.
- ✅ **filesystem-conflict** on `.qa/` (fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)
  - 2 sources declare the same write path ".qa/".
  - Resolution: Resolved by selection: only fixture-org/browser-qa-plugin entered the stack, so the collision on ".qa/" no longer exists.
- ✅ **incompatible-dependency** on `node` (fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin, pa11y/pa11y, microsoft/playwright-mcp, GoogleChrome/lighthouse)
  - "node" is declared at different versions (20, 18), but these are runtime floors rather than pinned majors.
  - Resolution: Resolved: require node >= 20, which satisfies every declared floor. No capability is dropped.

## 7. KEEP / REPLACE / ADD / REMOVE

### KEEP

- **frontend-implementation** ← `fixture-org/frontend-craft-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "frontend-implementation" (sole candidate).
- **visual-design** ← `fixture-org/frontend-craft-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "visual-design" (sole candidate).
- **responsive-design** ← `fixture-org/frontend-craft-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "responsive-design" (sole candidate).
- **browser-automation** ← `fixture-org/browser-qa-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "browser-automation" (BEST_EVIDENCE).
- **screenshot-capture** ← `fixture-org/browser-qa-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "screenshot-capture" (BEST_INTEGRATION_VALUE).
- **testing** ← `fixture-org/browser-qa-plugin`
  - Supplied by the user, passes the gates, and is the strongest source for "testing" (sole candidate).

### REPLACE

- **accessibility-audit** ← `fixture-org/a11y-guard-plugin` → `dequelabs/axe-core`
  - Hard gate BLOCK on fixture-org/a11y-guard-plugin (licence: REFERENCE_ONLY, security: BLOCK). A gated-clean source supplies the same capability.
- **accessibility-audit** ← `microsoft/playwright-mcp` → `GoogleChrome/lighthouse`
  - Stack optimization. GoogleChrome/lighthouse is already in the stack and supplies "accessibility-audit" at evidence SUPPORTED (not weaker than SUPPORTED from microsoft/playwright-mcp). Consolidating removes one install source without weakening the claim.

### ADD

- **accessibility-audit** ← `microsoft/playwright-mcp`
  - Added by discovery to close the "accessibility-audit" gap; Highest Scout Score (3.70) among candidates tied on evidence and licence..
- **performance-audit** ← `GoogleChrome/lighthouse`
  - Added by discovery to close the "performance-audit" gap; sole gated-clean candidate found.
- **image-comparison** ← `americanexpress/jest-image-snapshot`
  - Added by discovery to close the "image-comparison" gap; sole gated-clean candidate found.
- **visual-regression** ← `americanexpress/jest-image-snapshot`
  - Added by discovery to close the "visual-regression" gap; sole gated-clean candidate found.
- **visual-review** ← `(combination)`
  - Unlocked by the selected combination (fixture-org/browser-qa-plugin + microsoft/playwright-mcp + GoogleChrome/lighthouse). Adding another repository for it would be buying something the stack already produces.

### REMOVE

- **accessibility-audit** ← `dequelabs/axe-core` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **accessibility-audit** ← `pa11y/pa11y` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **browser-automation** ← `pa11y/pa11y` → `fixture-org/browser-qa-plugin`
  - Duplicate of "browser-automation"; fixture-org/browser-qa-plugin won the comparison. Only one implementation per capability enters the stack.
- **browser-automation** ← `microsoft/playwright-mcp` → `fixture-org/browser-qa-plugin`
  - Duplicate of "browser-automation"; fixture-org/browser-qa-plugin won the comparison. Only one implementation per capability enters the stack.
- **screenshot-capture** ← `microsoft/playwright-mcp` → `fixture-org/browser-qa-plugin`
  - Duplicate of "screenshot-capture"; fixture-org/browser-qa-plugin won the comparison. Only one implementation per capability enters the stack.
- **accessibility-audit** ← `GoogleChrome/lighthouse` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.

### WATCH

_(none)_

### REJECT

- **code-review** ← `fixture-org/a11y-guard-plugin`
  - Hard gate BLOCK (licence: REFERENCE_ONLY, security: BLOCK). A BLOCK outranks any score, and no clean alternative was found.

### UNKNOWN

- **security-review** ← `(none found)`
  - Required capability "security-review" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.


## 8. Best Capability Stack

| Capability | Concept source | Origin | Selection axis | Evidence | Confidence | Licence posture | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| frontend-implementation | `fixture-org/frontend-craft-plugin` | user-supplied | BEST_EVIDENCE | VERIFIED | 0.95 | REUSE_WITH_CONDITIONS | PASS |
| visual-design | `fixture-org/frontend-craft-plugin` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| responsive-design | `fixture-org/frontend-craft-plugin` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| browser-automation | `fixture-org/browser-qa-plugin` | user-supplied | BEST_EVIDENCE | VERIFIED | 0.95 | REUSE_WITH_CONDITIONS | PASS |
| screenshot-capture | `fixture-org/browser-qa-plugin` | user-supplied | BEST_INTEGRATION_VALUE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| testing | `fixture-org/browser-qa-plugin` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| accessibility-audit | `GoogleChrome/lighthouse` | discovered | BEST_INTEGRATION_VALUE | SUPPORTED | 0.6 | REUSE_WITH_CONDITIONS | UNKNOWN |
| performance-audit | `GoogleChrome/lighthouse` | discovered | BEST_EVIDENCE | SUPPORTED | 0.6 | REUSE_WITH_CONDITIONS | UNKNOWN |
| image-comparison | `americanexpress/jest-image-snapshot` | discovered | BEST_EVIDENCE | SUPPORTED | 0.6 | REUSE_WITH_CONDITIONS | UNKNOWN |
| visual-regression | `americanexpress/jest-image-snapshot` | discovered | BEST_EVIDENCE | SUPPORTED | 0.6 | REUSE_WITH_CONDITIONS | UNKNOWN |
| visual-review | `(combination)` | original | ORIGINAL | INFERRED | 0.5 | REUSE_OK | PASS |

## 9. Integration architecture

### Orchestration

Route a request to the right capability, sequence verification after implementation, and degrade explicitly when a capability is unavailable.

- Capabilities: (orchestration only)
- Components: skill:capability-router, config:plugin config

### Build

Produce and modify the artifact the goal is about.

- Capabilities: visual-design, frontend-implementation, responsive-design
- Components: skill:build-surface

### Verify

Turn claims about the artifact into measured facts.

- Capabilities: browser-automation, screenshot-capture, testing, accessibility-audit, performance-audit, image-comparison, visual-regression
- Components: skill:verification-runner, agent:verification-agent

### Judge

Review the measured facts against the goal and report defects with evidence.

- Capabilities: visual-review
- Components: agent:review-agent

### Evidence

Record, per capability, what was measured versus what was assumed, so the plugin output can be trusted or challenged.

- Capabilities: (orchestration only)
- Components: skill:evidence-ledger, doc:PROVENANCE.md

### Normalized dependencies

- `chromium` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `jest` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `node` — required by GoogleChrome/lighthouse, fixture-org/browser-qa-plugin, fixture-org/frontend-craft-plugin. Shared: declared once at the plugin level instead of once per capability.
- `pixelmatch` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `playwright` — required by fixture-org/browser-qa-plugin. Single consumer: declared as an optional peer of that capability only.

### Workflow

- 1. Frontend Implementation (frontend-implementation)
- 2. Visual Design (visual-design)
- 3. Responsive Design (responsive-design)
- 4. Browser Automation (browser-automation)
- 5. Screenshot Capture (screenshot-capture)
- 6. Testing (testing)
- 7. Accessibility Audit (accessibility-audit)
- 8. Performance Audit (performance-audit)
- 9. Image Comparison (image-comparison)
- 10. Visual Regression Testing (visual-regression)
- 11. Visual Review (visual-review)

## 9b. Stack optimization

Selection picks the strongest source per capability in isolation, which can
scatter the stack across more projects than it needs. This pass consolidates
onto sources the stack already carries, and never trades evidence for tidiness.

- Distinct external sources before: **5**
- Distinct external sources after: **4**

- `accessibility-audit`: microsoft/playwright-mcp → GoogleChrome/lighthouse
  - GoogleChrome/lighthouse is already in the stack and supplies "accessibility-audit" at evidence SUPPORTED (not weaker than SUPPORTED from microsoft/playwright-mcp). Consolidating removes one install source without weakening the claim.

## 10. Original layer

### Capability Router (`capability-router`)

The selected capabilities come from independent projects with no shared entry point. Without a router the user has to know which source tool answers which request, which is exactly the cost integration is supposed to remove.

Justified by:
- 11 capabilities drawn from 5 sources

### Namespace Guard (`namespace-guard`)

Sources collided on names that the host resolves globally. The guard owns the single public surface and refuses to re-emit a source-specific duplicate.

Justified by:
- command-namespace: review (fixture-org/frontend-craft-plugin, fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)
- duplicate-hook: PostToolUse:Write (fixture-org/browser-qa-plugin, fixture-org/a11y-guard-plugin)

### Evidence Ledger (`evidence-ledger`)

Some capabilities entered the stack as concept references or with a non-clean gate result. The ledger keeps that distinction visible at runtime instead of letting the plugin present every result as equally verified.

Justified by:
- accessibility-audit from GoogleChrome/lighthouse: licence=REUSE_WITH_CONDITIONS, security=UNKNOWN
- performance-audit from GoogleChrome/lighthouse: licence=REUSE_WITH_CONDITIONS, security=UNKNOWN
- image-comparison from americanexpress/jest-image-snapshot: licence=REUSE_WITH_CONDITIONS, security=UNKNOWN
- visual-regression from americanexpress/jest-image-snapshot: licence=REUSE_WITH_CONDITIONS, security=UNKNOWN
- rejected fixture-org/a11y-guard-plugin: licence=REFERENCE_ONLY, security=BLOCK
- rejected fixture-org/a11y-guard-plugin: licence=REFERENCE_ONLY, security=BLOCK

## 11. Discovery notes

- Registry seeded 2026-08-30: Public GitHub repository landing page read over HTTPS. No source tree was downloaded, so no capability here is class VERIFIED.
- Live GitHub search was not enabled, so discovery was limited to the seed registry. Missing capabilities below are "not found in the seed registry", not "do not exist".

## 12. UNKNOWN

- Goal: CONSTRAINTS: none stated.
- Goal: COMMERCIAL USE: not stated. Licence gate will assume nothing and stay conservative.
- No candidate found for required capability `security-review`.
- Licence of `fixture-org/a11y-guard-plugin` is UNKNOWN; no code from it may be copied.
