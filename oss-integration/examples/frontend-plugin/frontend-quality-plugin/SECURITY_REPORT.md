# SECURITY REPORT

Static scanning only. **Absence of findings is not evidence of safety**, and a
source with nothing scanned is `UNKNOWN`, never `PASS`.

| Repository | Data source | Artifacts scanned | Gate | Findings | In final stack |
| --- | --- | --- | --- | --- | --- |
| `fixture-org/frontend-craft-plugin` | fixture | 3 | PASS | 0 | yes |
| `fixture-org/browser-qa-plugin` | fixture | 3 | PASS | 0 | yes |
| `fixture-org/a11y-guard-plugin` | fixture | 3 | BLOCK | 3 | no |
| `dequelabs/axe-core` | registry-seed | 0 | UNKNOWN | 0 | no |
| `pa11y/pa11y` | registry-seed | 0 | UNKNOWN | 0 | no |
| `microsoft/playwright-mcp` | registry-seed | 0 | UNKNOWN | 0 | no |
| `GoogleChrome/lighthouse` | registry-seed | 0 | UNKNOWN | 0 | yes |
| `americanexpress/jest-image-snapshot` | registry-seed | 0 | UNKNOWN | 0 | yes |

## Unscanned sources

- `dequelabs/axe-core` — nothing was available to scan, so its gate is UNKNOWN. Run with `--live` to fetch and scan its real artifacts.
- `pa11y/pa11y` — nothing was available to scan, so its gate is UNKNOWN. Run with `--live` to fetch and scan its real artifacts.
- `microsoft/playwright-mcp` — nothing was available to scan, so its gate is UNKNOWN. Run with `--live` to fetch and scan its real artifacts.
- `GoogleChrome/lighthouse` — nothing was available to scan, so its gate is UNKNOWN. Run with `--live` to fetch and scan its real artifacts.
- `americanexpress/jest-image-snapshot` — nothing was available to scan, so its gate is UNKNOWN. Run with `--live` to fetch and scan its real artifacts.

## Findings

### `fixture-org/a11y-guard-plugin`

- **medium** · untrusted-install-script · in `package.json > scripts.postinstall`
  - Rule: install-script: "postinstall" runs automatically when the package is installed.
  - Matched: `node ./scripts/setup.js`
- **critical** · untrusted-install-script · in `README.md`
  - Rule: shell-pipe-installer: Pipes a network-fetched script straight into a shell.
  - Matched: `your pages. ## Install ``` curl -sL https://a11y-guard.example.com/install.sh | sudo bash ````
- **high** · unsafe-shell-execution · in `scripts/setup.js`
  - Rule: shell-exec-interpolated: Builds a shell command from interpolated input.
  - Matched: `} = require('child_process'); execSync(`node ${process.env.A11Y_PLUGIN_DIR}/b`
