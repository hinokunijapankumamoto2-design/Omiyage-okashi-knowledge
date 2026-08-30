# INTEGRATION REPORT — live-web-quality

## 1. Goal

```
GOAL                 : Claude Codeで最高品質のWebサイトを作れるPluginを作って
TARGET ENVIRONMENT   : Claude Code
REQUIRED CAPABILITIES: frontend-implementation, visual-review, visual-design, responsive-design, accessibility-audit, browser-automation, screenshot-capture, performance-audit, testing, security-review
OPTIONAL CAPABILITIES: image-comparison, visual-regression, code-review
CONSTRAINTS          : UNKNOWN
USER-SUPPLIED OSS    : https://github.com/dequelabs/axe-core, https://github.com/americanexpress/jest-image-snapshot, https://github.com/GoogleChrome/lighthouse
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
| `dequelabs/axe-core` | live-github | library | MPL-2.0 | CONDITIONAL (REUSE_WITH_CONDITIONS) | REVIEW_REQUIRED | 5 | 2.87 | no |
| `americanexpress/jest-image-snapshot` | live-github | library | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | CONDITIONAL | 4 | 3.27 | no |
| `GoogleChrome/lighthouse` | live-github | cli | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | CONDITIONAL | 5 | 3.78 | no |
| `microsoft/playwright` | live-github | framework | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | PASS | 3 | 3.90 | no |
| `microsoft/playwright-mcp` | live-github | mcp-server | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 4.20 | no |
| `pa11y/pa11y` | live-github | cli | LGPL-3.0-only | REVIEW_REQUIRED (LEGAL_REVIEW) | PASS | 5 | 3.28 | no |
| `db-ui/core` | live-github | unknown | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | PASS | 4 | 1.40 | no |
| `delegatexyz/delegate-javascript-sdk` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 1.50 | no |
| `injty/ralph-cli` | live-github | unknown | UNKNOWN | UNKNOWN (REFERENCE_ONLY) | UNKNOWN | UNKNOWN | 0.50 | no |
| `reshotdev/screenshot` | live-github | unknown | Apache-2.0 | PASS (REUSE_WITH_CONDITIONS) | BLOCK | 5 | 1.50 | **YES** |
| `futex-ai/mokabook` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 1.50 | no |
| `karrot-emu/kapture` | live-github | unknown | UNKNOWN | UNKNOWN (REFERENCE_ONLY) | UNKNOWN | UNKNOWN | 0.50 | no |
| `joshpuckett/interfacekit` | live-github | unknown | UNKNOWN | UNKNOWN (REFERENCE_ONLY) | UNKNOWN | UNKNOWN | 0.50 | no |
| `Amsterdam/design-system` | live-github | unknown | EUPL-1.2 | REVIEW_REQUIRED (LEGAL_REVIEW) | PASS | 5 | 1.50 | no |
| `pegasystems/cosmos-react` | live-github | unknown | UNKNOWN | UNKNOWN (REFERENCE_ONLY) | UNKNOWN | UNKNOWN | 0.50 | no |
| `yocontra/react-responsive` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 3 | 1.30 | no |
| `craigrileyuk/vue3-mq` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 4 | 1.40 | no |
| `AlexandreBonaventure/vue-mq` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | REVIEW_REQUIRED | 3 | 1.30 | no |
| `DyanGalih/security-review` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 1.50 | no |
| `salmanabdurrahman/pi-security-review` | live-github | unknown | MIT | PASS (REUSE_WITH_CONDITIONS) | PASS | 5 | 1.50 | no |

**Security findings — `dequelabs/axe-core`**

- `high` arbitrary-command-execution in npm:package/axe.min.js — arbitrary-eval: Evaluates code at runtime.
  - matched: `t,text:n}}),r in o||(o[r]=n)):new Function("def","def['"+r+"']="+n)(o)),"`

**Security findings — `americanexpress/jest-image-snapshot`**

- `medium` destructive-file-operations in npm:package/src/diff-snapshot.js — recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - matched: `eceivedPostfix}.png`); fs.rmSync(receivedSnapshotPath, { recursive: true, force: true }); const diffOutputPath`

**Security findings — `GoogleChrome/lighthouse`**

- `medium` destructive-file-operations in npm:package/cli/test/smokehouse/frontends/smokehouse-bin.js — recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - matched: `testResultsToOutput) { fs.rmSync(smokehouseOutputDir, {recursive: true, force: true}); fs.mkdirSync(smokehous`
- `medium` destructive-file-operations in npm:package/cli/test/smokehouse/lighthouse-runners/cli.js — recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - matched: `.finally(() => !isDebug && fs.rm(tmpPath, {recursive: true, force: true})); } /** * Internal runner`

**Security findings — `reshotdev/screenshot`**

- `critical` secret-collection in npm:package/src/lib/canonical-product-client.js — secret-exfil: Sends something named like a secret over the network.
  - matched: `const response = await http.request({ method, url: endpoint, data: body, headers: method === "GET" ? { Authorization: `Bearer ${apiKey}` } : headers(requestOptions.`
- `high` credential-exposure in npm:package/src/lib/storage-providers.js — credential-read: Reads a credential store or a secret environment variable.
  - matched: `ariable'); } if (!process.env.AWS_SECRET_ACCESS_KEY) { errors.`

**Security findings — `AlexandreBonaventure/vue-mq`**

- `high` arbitrary-command-execution in npm:package/examples/dist/vendors~main.7494fd97.js — arbitrary-eval: Evaluates code at runtime.
  - matched: `n(t){"function"!=typeof t&&(t=new Function(""+t));for(var e=new Array(arg`

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
- **Held after gates**: accessibility-audit, image-comparison, visual-regression, performance-audit, browser-automation, screenshot-capture, testing
- **Missing**: frontend-implementation, visual-design, responsive-design, security-review
- **Covered by unlock (no extra source needed)**: visual-review

### Near misses

_(none)_

## 5. Duplicates

- **accessibility-audit**: dequelabs/axe-core, GoogleChrome/lighthouse, microsoft/playwright-mcp, pa11y/pa11y → winner `microsoft/playwright-mcp` on BEST_INTEGRATION_VALUE.
  - Highest Scout Score (4.20) among candidates tied on evidence and licence.
- **browser-automation**: microsoft/playwright, microsoft/playwright-mcp, pa11y/pa11y → winner `microsoft/playwright-mcp` on BEST_INTEGRATION_VALUE.
  - Highest Scout Score (4.20) among candidates tied on evidence and licence.
- **screenshot-capture**: microsoft/playwright, microsoft/playwright-mcp → winner `microsoft/playwright-mcp` on BEST_INTEGRATION_VALUE.
  - Highest Scout Score (4.20) among candidates tied on evidence and licence.

## 6. Conflicts

_No conflicts detected._

## 7. KEEP / REPLACE / ADD / REMOVE

### KEEP

- **image-comparison** ← `americanexpress/jest-image-snapshot`
  - Supplied by the user, passes the gates, and is the strongest source for "image-comparison" (sole candidate).
- **visual-regression** ← `americanexpress/jest-image-snapshot`
  - Supplied by the user, passes the gates, and is the strongest source for "visual-regression" (sole candidate).
- **performance-audit** ← `GoogleChrome/lighthouse`
  - Supplied by the user, passes the gates, and is the strongest source for "performance-audit" (sole candidate).

### REPLACE

_(none)_

### ADD

- **testing** ← `microsoft/playwright`
  - Added by discovery to close the "testing" gap; sole gated-clean candidate found.
- **browser-automation** ← `microsoft/playwright-mcp`
  - Added by discovery to close the "browser-automation" gap; Highest Scout Score (4.20) among candidates tied on evidence and licence..
- **screenshot-capture** ← `microsoft/playwright-mcp`
  - Added by discovery to close the "screenshot-capture" gap; Highest Scout Score (4.20) among candidates tied on evidence and licence..
- **accessibility-audit** ← `microsoft/playwright-mcp`
  - Added by discovery to close the "accessibility-audit" gap; Highest Scout Score (4.20) among candidates tied on evidence and licence..
- **visual-review** ← `(combination)`
  - Unlocked by the selected combination (GoogleChrome/lighthouse + microsoft/playwright-mcp + microsoft/playwright-mcp). Adding another repository for it would be buying something the stack already produces.

### REMOVE

- **accessibility-audit** ← `dequelabs/axe-core` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **accessibility-audit** ← `GoogleChrome/lighthouse` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **browser-automation** ← `microsoft/playwright` → `microsoft/playwright-mcp`
  - Duplicate of "browser-automation"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **screenshot-capture** ← `microsoft/playwright` → `microsoft/playwright-mcp`
  - Duplicate of "screenshot-capture"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **accessibility-audit** ← `pa11y/pa11y` → `microsoft/playwright-mcp`
  - Duplicate of "accessibility-audit"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.
- **browser-automation** ← `pa11y/pa11y` → `microsoft/playwright-mcp`
  - Duplicate of "browser-automation"; microsoft/playwright-mcp won the comparison. Only one implementation per capability enters the stack.

### WATCH

_(none)_

### REJECT

_(none)_

### UNKNOWN

- **frontend-implementation** ← `(none found)`
  - Required capability "frontend-implementation" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.
- **visual-design** ← `(none found)`
  - Required capability "visual-design" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.
- **responsive-design** ← `(none found)`
  - Required capability "responsive-design" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.
- **security-review** ← `(none found)`
  - Required capability "security-review" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.


## 8. Best Capability Stack

| Capability | Concept source | Origin | Selection axis | Evidence | Confidence | Licence posture | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
| image-comparison | `americanexpress/jest-image-snapshot` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | CONDITIONAL |
| visual-regression | `americanexpress/jest-image-snapshot` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | CONDITIONAL |
| performance-audit | `GoogleChrome/lighthouse` | user-supplied | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | CONDITIONAL |
| testing | `microsoft/playwright` | discovered | BEST_EVIDENCE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| browser-automation | `microsoft/playwright-mcp` | discovered | BEST_INTEGRATION_VALUE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| screenshot-capture | `microsoft/playwright-mcp` | discovered | BEST_INTEGRATION_VALUE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| accessibility-audit | `microsoft/playwright-mcp` | discovered | BEST_INTEGRATION_VALUE | SUPPORTED | 0.75 | REUSE_WITH_CONDITIONS | PASS |
| visual-review | `(combination)` | original | ORIGINAL | INFERRED | 0.5 | REUSE_OK | PASS |

## 9. Integration architecture

### Orchestration

Route a request to the right capability, sequence verification after implementation, and degrade explicitly when a capability is unavailable.

- Capabilities: (orchestration only)
- Components: skill:capability-router, config:plugin config

### Verify

Turn claims about the artifact into measured facts.

- Capabilities: browser-automation, screenshot-capture, image-comparison, visual-regression, performance-audit, testing, accessibility-audit
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

- `@paulirish/trace_engine` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `@sentry/node` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `axe-core` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `chalk` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `chrome-launcher` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `configstore` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `csp_evaluator` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `devtools-protocol` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `enquirer` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `get-stdin` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `glur` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `http-link-header` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `intl-messageformat` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `jpeg-js` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `js-library-detector` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `lighthouse-logger` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `lighthouse-stack-packs` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `lodash` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `lodash-es` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `lookup-closest-locale` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `open` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `pixelmatch` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `playwright` — required by microsoft/playwright-mcp. Single consumer: declared as an optional peer of that capability only.
- `playwright-core` — required by microsoft/playwright-mcp. Single consumer: declared as an optional peer of that capability only.
- `pngjs` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `puppeteer-core` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `robots-parser` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `speedline-core` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `ssim.js` — required by americanexpress/jest-image-snapshot. Single consumer: declared as an optional peer of that capability only.
- `third-party-web` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `tldts-icann` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `web-features` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `ws` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `yargs` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.
- `yargs-parser` — required by GoogleChrome/lighthouse. Single consumer: declared as an optional peer of that capability only.

### Workflow

- 1. Image Comparison (image-comparison)
- 2. Testing (testing)
- 3. Browser Automation (browser-automation)
- 4. Screenshot Capture (screenshot-capture)
- 5. Accessibility Audit (accessibility-audit)
- 6. Visual Review (visual-review)
- 7. Visual Regression Testing (visual-regression)
- 8. Performance Audit (performance-audit)

## 9b. Stack optimization

Selection picks the strongest source per capability in isolation, which can
scatter the stack across more projects than it needs. This pass consolidates
onto sources the stack already carries, and never trades evidence for tidiness.

- Distinct external sources before: **4**
- Distinct external sources after: **4**

_No consolidation was possible without weakening evidence._

## 10. Original layer

### Capability Router (`capability-router`)

The selected capabilities come from independent projects with no shared entry point. Without a router the user has to know which source tool answers which request, which is exactly the cost integration is supposed to remove.

Justified by:
- 8 capabilities drawn from 5 sources

### Evidence Ledger (`evidence-ledger`)

Some capabilities entered the stack as concept references or with a non-clean gate result. The ledger keeps that distinction visible at runtime instead of letting the plugin present every result as equally verified.

Justified by:
- image-comparison from americanexpress/jest-image-snapshot: licence=REUSE_WITH_CONDITIONS, security=CONDITIONAL
- visual-regression from americanexpress/jest-image-snapshot: licence=REUSE_WITH_CONDITIONS, security=CONDITIONAL
- performance-audit from GoogleChrome/lighthouse: licence=REUSE_WITH_CONDITIONS, security=CONDITIONAL

## 11. Discovery notes

- Registry seeded 2026-08-30: Public GitHub repository landing page read over HTTPS. No source tree was downloaded, so no capability here is class VERIFIED.
- Live npm-registry search supplied candidates for "frontend-implementation"; their capability mapping is UNKNOWN because nothing curated it.
- Live npm-registry search supplied candidates for "visual-review"; their capability mapping is UNKNOWN because nothing curated it.
- Live npm-registry search supplied candidates for "visual-design"; their capability mapping is UNKNOWN because nothing curated it.
- Live npm-registry search supplied candidates for "responsive-design"; their capability mapping is UNKNOWN because nothing curated it.
- Live npm-registry search supplied candidates for "security-review"; their capability mapping is UNKNOWN because nothing curated it.

## 12. UNKNOWN

- Goal: CONSTRAINTS: none stated.
- Goal: COMMERCIAL USE: not stated. Licence gate will assume nothing and stay conservative.
- Licence of `injty/ralph-cli` is UNKNOWN; no code from it may be copied.
- Licence of `karrot-emu/kapture` is UNKNOWN; no code from it may be copied.
- Licence of `joshpuckett/interfacekit` is UNKNOWN; no code from it may be copied.
- Licence of `pegasystems/cosmos-react` is UNKNOWN; no code from it may be copied.
