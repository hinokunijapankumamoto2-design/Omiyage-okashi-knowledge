# SECURITY REPORT

Static scanning only. **Absence of findings is not evidence of safety**, and a
source with nothing scanned is `UNKNOWN`, never `PASS`.

| Repository | Data source | Artifacts scanned | Gate | Findings | In final stack |
| --- | --- | --- | --- | --- | --- |
| `dequelabs/axe-core` | live-github | 28 | REVIEW_REQUIRED | 1 | no |
| `americanexpress/jest-image-snapshot` | live-github | 11 | CONDITIONAL | 1 | yes |
| `GoogleChrome/lighthouse` | live-github | 63 | CONDITIONAL | 2 | yes |
| `microsoft/playwright` | live-github | 4 | PASS | 0 | yes |
| `microsoft/playwright-mcp` | live-github | 8 | PASS | 0 | yes |
| `pa11y/pa11y` | live-github | 18 | PASS | 0 | no |
| `db-ui/core` | live-github | 63 | PASS | 0 | no |
| `delegatexyz/delegate-javascript-sdk` | live-github | 12 | PASS | 0 | no |
| `injty/ralph-cli` | live-github | 0 | UNKNOWN | 0 | no |
| `reshotdev/screenshot` | live-github | 63 | BLOCK | 2 | no |
| `futex-ai/mokabook` | live-github | 63 | PASS | 0 | no |
| `karrot-emu/kapture` | live-github | 0 | UNKNOWN | 0 | no |
| `joshpuckett/interfacekit` | live-github | 0 | UNKNOWN | 0 | no |
| `Amsterdam/design-system` | live-github | 3 | PASS | 0 | no |
| `pegasystems/cosmos-react` | live-github | 0 | UNKNOWN | 0 | no |
| `yocontra/react-responsive` | live-github | 20 | PASS | 0 | no |
| `craigrileyuk/vue3-mq` | live-github | 17 | PASS | 0 | no |
| `AlexandreBonaventure/vue-mq` | live-github | 20 | REVIEW_REQUIRED | 1 | no |
| `DyanGalih/security-review` | live-github | 44 | PASS | 0 | no |
| `salmanabdurrahman/pi-security-review` | live-github | 29 | PASS | 0 | no |

## Unscanned sources

- `injty/ralph-cli` — nothing was available to scan, so its gate is UNKNOWN. 
- `karrot-emu/kapture` — nothing was available to scan, so its gate is UNKNOWN. 
- `joshpuckett/interfacekit` — nothing was available to scan, so its gate is UNKNOWN. 
- `pegasystems/cosmos-react` — nothing was available to scan, so its gate is UNKNOWN. 

## Findings

### `dequelabs/axe-core`

- **high** · arbitrary-command-execution · in `npm:package/axe.min.js`
  - Rule: arbitrary-eval: Evaluates code at runtime.
  - Matched: `t,text:n}}),r in o||(o[r]=n)):new Function("def","def['"+r+"']="+n)(o)),"`

### `americanexpress/jest-image-snapshot`

- **medium** · destructive-file-operations · in `npm:package/src/diff-snapshot.js`
  - Rule: recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - Matched: `eceivedPostfix}.png`); fs.rmSync(receivedSnapshotPath, { recursive: true, force: true }); const diffOutputPath`

### `GoogleChrome/lighthouse`

- **medium** · destructive-file-operations · in `npm:package/cli/test/smokehouse/frontends/smokehouse-bin.js`
  - Rule: recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - Matched: `testResultsToOutput) { fs.rmSync(smokehouseOutputDir, {recursive: true, force: true}); fs.mkdirSync(smokehous`
- **medium** · destructive-file-operations · in `npm:package/cli/test/smokehouse/lighthouse-runners/cli.js`
  - Rule: recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.
  - Matched: `.finally(() => !isDebug && fs.rm(tmpPath, {recursive: true, force: true})); } /** * Internal runner`

### `reshotdev/screenshot`

- **critical** · secret-collection · in `npm:package/src/lib/canonical-product-client.js`
  - Rule: secret-exfil: Sends something named like a secret over the network.
  - Matched: `const response = await http.request({ method, url: endpoint, data: body, headers: method === "GET" ? { Authorization: `Bearer ${apiKey}` } : headers(requestOptions.`
- **high** · credential-exposure · in `npm:package/src/lib/storage-providers.js`
  - Rule: credential-read: Reads a credential store or a secret environment variable.
  - Matched: `ariable'); } if (!process.env.AWS_SECRET_ACCESS_KEY) { errors.`

### `AlexandreBonaventure/vue-mq`

- **high** · arbitrary-command-execution · in `npm:package/examples/dist/vendors~main.7494fd97.js`
  - Rule: arbitrary-eval: Evaluates code at runtime.
  - Matched: `n(t){"function"!=typeof t&&(t=new Function(""+t));for(var e=new Array(arg`
