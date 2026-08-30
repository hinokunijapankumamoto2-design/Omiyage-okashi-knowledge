# LIVE REPOSITORY REPORT

Classification of every repository in this run. **Synthetic fixture data is
never reported as a fact about a real project**, and live findings are never
mixed into the synthetic regression baseline.

| Classification | Count | Repositories |
| --- | --- | --- |
| `LIVE_VERIFIED` | 20 | `dequelabs/axe-core`, `americanexpress/jest-image-snapshot`, `GoogleChrome/lighthouse`, `microsoft/playwright`, `microsoft/playwright-mcp`, `pa11y/pa11y`, `db-ui/core`, `delegatexyz/delegate-javascript-sdk`, `injty/ralph-cli`, `reshotdev/screenshot`, `futex-ai/mokabook`, `karrot-emu/kapture`, `joshpuckett/interfacekit`, `Amsterdam/design-system`, `pegasystems/cosmos-react`, `yocontra/react-responsive`, `craigrileyuk/vue3-mq`, `AlexandreBonaventure/vue-mq`, `DyanGalih/security-review`, `salmanabdurrahman/pi-security-review` |
| `SEED_REGISTRY` (curated notes, not fetched this run) | 0 | — |
| `SYNTHETIC` (local fixture, not a real project) | 0 | — |

## What the live path can and cannot reach

The GitHub REST API is **not reachable** from this environment (HTTP 403 through
the egress proxy), so repository existence, default branch and the latest commit
SHA cannot be read from it. The live path therefore uses:

- `raw.githubusercontent.com` — licence file, README, `package.json`.
- `registry.npmjs.org` — published version, publish time, dependencies,
  install scripts, and the published tarball, which is what gives the security
  gate real source to scan.

Anything neither source establishes is recorded as `UNKNOWN`. In particular
the **latest commit SHA is always UNKNOWN**, and the default branch is the one
that served content rather than a confirmed default.

## Fetch log

### `dequelabs/axe-core`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/dequelabs/axe-core/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/dequelabs/axe-core/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/dequelabs/axe-core/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/dequelabs/axe-core/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/dequelabs/axe-core/master/README.md` | ✅ | 10500 bytes |
| default branch | `https://raw.githubusercontent.com/dequelabs/axe-core/master/README.md` | ✅ | resolved to "master" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/dequelabs/axe-core/master/LICENSE` | ✅ | 15921 bytes |
| package.json | `https://raw.githubusercontent.com/dequelabs/axe-core/master/package.json` | ✅ | 7140 bytes |
| npm metadata for axe-core | `https://registry.npmjs.org/axe-core` | ✅ | 9940204 bytes |
| published tarball | `https://registry.npmjs.org/axe-core/-/axe-core-4.13.0.tgz` | ✅ | 627805 bytes |
| tarball extraction | `https://registry.npmjs.org/axe-core/-/axe-core-4.13.0.tgz` | ✅ | 30 files in archive, 25 decoded for scanning |

**Established from the network:** licence `MPL-2.0` (evidence SUPPORTED), release `4.13.0`, last publish `2026-08-25`, tests PRESENT, 0 declared dependency/ies.

**Artifacts scanned:** 28 — security gate REVIEW_REQUIRED.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `americanexpress/jest-image-snapshot`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/README.md` | ✅ | 17611 bytes |
| default branch | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/LICENSE` | ❌ | HTTP 404 |
| licence:LICENSE.md | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/LICENSE.md` | ❌ | HTTP 404 |
| licence:LICENSE.txt | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/LICENSE.txt` | ✅ | 10283 bytes |
| package.json | `https://raw.githubusercontent.com/americanexpress/jest-image-snapshot/main/package.json` | ✅ | 2862 bytes |
| npm metadata for jest-image-snapshot | `https://registry.npmjs.org/jest-image-snapshot` | ✅ | 196583 bytes |
| published tarball | `https://registry.npmjs.org/jest-image-snapshot/-/jest-image-snapshot-6.5.2.tgz` | ✅ | 27735 bytes |
| tarball extraction | `https://registry.npmjs.org/jest-image-snapshot/-/jest-image-snapshot-6.5.2.tgz` | ✅ | 17 files in archive, 8 decoded for scanning |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `6.5.2`, last publish `2026-03-09`, tests PRESENT, 7 declared dependency/ies.

**Artifacts scanned:** 11 — security gate CONDITIONAL.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `GoogleChrome/lighthouse`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md` | ✅ | 36043 bytes |
| default branch | `https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/readme.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/LICENSE` | ✅ | 11358 bytes |
| package.json | `https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/package.json` | ✅ | 11679 bytes |
| npm metadata for lighthouse | `https://registry.npmjs.org/lighthouse` | ✅ | 23485381 bytes |
| published tarball | `https://registry.npmjs.org/lighthouse/-/lighthouse-13.4.1.tgz` | ✅ | 3562319 bytes |
| tarball extraction | `https://registry.npmjs.org/lighthouse/-/lighthouse-13.4.1.tgz` | ✅ | 972 files in archive, 60 decoded for scanning (truncated at the scan cap) |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `13.4.1`, last publish `2026-08-26`, tests PRESENT, 26 declared dependency/ies.

**Artifacts scanned:** 63 — security gate CONDITIONAL.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `microsoft/playwright`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/microsoft/playwright/main/README.md` | ✅ | 11262 bytes |
| default branch | `https://raw.githubusercontent.com/microsoft/playwright/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/microsoft/playwright/main/LICENSE` | ✅ | 11601 bytes |
| package.json | `https://raw.githubusercontent.com/microsoft/playwright/main/package.json` | ✅ | 7223 bytes |
| npm metadata for playwright-internal | `https://registry.npmjs.org/playwright-internal` | ✅ | 1648 bytes |
| published tarball | `https://registry.npmjs.org/playwright-internal/-/playwright-internal-0.0.1-security.tgz` | ✅ | 403 bytes |
| tarball extraction | `https://registry.npmjs.org/playwright-internal/-/playwright-internal-0.0.1-security.tgz` | ✅ | 2 files in archive, 1 decoded for scanning |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `0.0.1-security`, last publish `2023-10-02`, tests PRESENT, 0 declared dependency/ies.

**Artifacts scanned:** 4 — security gate PASS.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `microsoft/playwright-mcp`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/microsoft/playwright-mcp/main/README.md` | ✅ | 61982 bytes |
| default branch | `https://raw.githubusercontent.com/microsoft/playwright-mcp/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/microsoft/playwright-mcp/main/LICENSE` | ✅ | 11552 bytes |
| package.json | `https://raw.githubusercontent.com/microsoft/playwright-mcp/main/package.json` | ✅ | 1530 bytes |
| npm metadata for @playwright/mcp | `https://registry.npmjs.org/@playwright%2fmcp` | ✅ | 1251484 bytes |
| published tarball | `https://registry.npmjs.org/@playwright/mcp/-/mcp-0.0.79.tgz` | ✅ | 22712 bytes |
| tarball extraction | `https://registry.npmjs.org/@playwright/mcp/-/mcp-0.0.79.tgz` | ✅ | 7 files in archive, 5 decoded for scanning |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `0.0.79`, last publish `2026-08-27`, tests PRESENT, 2 declared dependency/ies.

**Artifacts scanned:** 8 — security gate PASS.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `pa11y/pa11y`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/pa11y/pa11y/main/README.md` | ✅ | 32608 bytes |
| default branch | `https://raw.githubusercontent.com/pa11y/pa11y/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/pa11y/pa11y/main/LICENSE` | ✅ | 7651 bytes |
| package.json | `https://raw.githubusercontent.com/pa11y/pa11y/main/package.json` | ✅ | 2343 bytes |
| npm metadata for pa11y | `https://registry.npmjs.org/pa11y` | ✅ | 307233 bytes |
| published tarball | `https://registry.npmjs.org/pa11y/-/pa11y-10.0.0.tgz` | ✅ | 30796 bytes |
| tarball extraction | `https://registry.npmjs.org/pa11y/-/pa11y-10.0.0.tgz` | ✅ | 18 files in archive, 15 decoded for scanning |

**Established from the network:** licence `LGPL-3.0-only` (evidence SUPPORTED), release `10.0.0`, last publish `2026-08-28`, tests PRESENT, 9 declared dependency/ies.

**Artifacts scanned:** 18 — security gate PASS.

**Still UNKNOWN:** architecture, sourceCommit (the API that serves it is unreachable here)

### `db-ui/core`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/db-ui/core/main/README.md` | ✅ | 11870 bytes |
| default branch | `https://raw.githubusercontent.com/db-ui/core/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/db-ui/core/main/LICENSE` | ✅ | 11358 bytes |
| package.json | `https://raw.githubusercontent.com/db-ui/core/main/package.json` | ✅ | 6003 bytes |
| npm metadata for @db-ui/core | `https://registry.npmjs.org/@db-ui%2fcore` | ✅ | 644869 bytes |
| published tarball | `https://registry.npmjs.org/@db-ui/core/-/core-3.3.7.tgz` | ✅ | 2545709 bytes |
| tarball extraction | `https://registry.npmjs.org/@db-ui/core/-/core-3.3.7.tgz` | ✅ | 3645 files in archive, 60 decoded for scanning (truncated at the scan cap) |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `3.3.7`, last publish `2026-02-18`, tests PRESENT, 2 declared dependency/ies.

**Artifacts scanned:** 63 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `delegatexyz/delegate-javascript-sdk`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/delegatexyz/delegate-javascript-sdk/main/README.md` | ✅ | 4825 bytes |
| default branch | `https://raw.githubusercontent.com/delegatexyz/delegate-javascript-sdk/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/delegatexyz/delegate-javascript-sdk/main/LICENSE` | ✅ | 1095 bytes |
| package.json | `https://raw.githubusercontent.com/delegatexyz/delegate-javascript-sdk/main/package.json` | ✅ | 1389 bytes |
| npm metadata for @delegatexyz/sdk | `https://registry.npmjs.org/@delegatexyz%2fsdk` | ✅ | 12552 bytes |
| published tarball | `https://registry.npmjs.org/@delegatexyz/sdk/-/sdk-0.6.0.tgz` | ✅ | 14933 bytes |
| tarball extraction | `https://registry.npmjs.org/@delegatexyz/sdk/-/sdk-0.6.0.tgz` | ✅ | 11 files in archive, 9 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `0.6.0`, last publish `2026-06-27`, tests PRESENT, 1 declared dependency/ies.

**Artifacts scanned:** 12 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `injty/ralph-cli`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/injty/ralph-cli/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/injty/ralph-cli/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/injty/ralph-cli/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/injty/ralph-cli/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/injty/ralph-cli/master/README.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/injty/ralph-cli/master/readme.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/injty/ralph-cli/master/README.rst` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/injty/ralph-cli/master/README` | ❌ | HTTP 404 |
| default branch | `https://raw.githubusercontent.com/injty/ralph-cli/{main,master}/README.md` | ❌ | No README on main or master. Repository existence is UNKNOWN from this route. |

**Established from the network:** licence `UNKNOWN` (evidence UNKNOWN), release `UNKNOWN`, last publish `UNKNOWN`, tests UNKNOWN, 0 declared dependency/ies.

**Artifacts scanned:** 0 — security gate UNKNOWN.

**Still UNKNOWN:** latestRelease, lastMeaningfulUpdate, architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `reshotdev/screenshot`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/reshotdev/screenshot/main/README.md` | ✅ | 14960 bytes |
| default branch | `https://raw.githubusercontent.com/reshotdev/screenshot/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/reshotdev/screenshot/main/LICENSE` | ✅ | 10367 bytes |
| package.json | `https://raw.githubusercontent.com/reshotdev/screenshot/main/package.json` | ✅ | 2106 bytes |
| npm metadata for @reshotdev/screenshot | `https://registry.npmjs.org/@reshotdev%2fscreenshot` | ✅ | 158022 bytes |
| published tarball | `https://registry.npmjs.org/@reshotdev/screenshot/-/screenshot-0.0.1-beta.56.tgz` | ✅ | 238351 bytes |
| tarball extraction | `https://registry.npmjs.org/@reshotdev/screenshot/-/screenshot-0.0.1-beta.56.tgz` | ✅ | 65 files in archive, 60 decoded for scanning (truncated at the scan cap) |

**Established from the network:** licence `Apache-2.0` (evidence SUPPORTED), release `0.0.1-beta.56`, last publish `2026-08-23`, tests PRESENT, 19 declared dependency/ies.

**Artifacts scanned:** 63 — security gate BLOCK.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `futex-ai/mokabook`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/futex-ai/mokabook/main/README.md` | ✅ | 21261 bytes |
| default branch | `https://raw.githubusercontent.com/futex-ai/mokabook/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/futex-ai/mokabook/main/LICENSE` | ✅ | 1062 bytes |
| package.json | `https://raw.githubusercontent.com/futex-ai/mokabook/main/package.json` | ✅ | 2848 bytes |
| npm metadata for mokabook | `https://registry.npmjs.org/mokabook` | ✅ | 52046 bytes |
| published tarball | `https://registry.npmjs.org/mokabook/-/mokabook-0.6.0.tgz` | ✅ | 593028 bytes |
| tarball extraction | `https://registry.npmjs.org/mokabook/-/mokabook-0.6.0.tgz` | ✅ | 522 files in archive, 60 decoded for scanning (truncated at the scan cap) |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `0.6.0`, last publish `2026-08-26`, tests PRESENT, 4 declared dependency/ies.

**Artifacts scanned:** 63 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `karrot-emu/kapture`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/karrot-emu/kapture/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/karrot-emu/kapture/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/karrot-emu/kapture/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/karrot-emu/kapture/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/karrot-emu/kapture/master/README.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/karrot-emu/kapture/master/readme.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/karrot-emu/kapture/master/README.rst` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/karrot-emu/kapture/master/README` | ❌ | HTTP 404 |
| default branch | `https://raw.githubusercontent.com/karrot-emu/kapture/{main,master}/README.md` | ❌ | No README on main or master. Repository existence is UNKNOWN from this route. |

**Established from the network:** licence `UNKNOWN` (evidence UNKNOWN), release `UNKNOWN`, last publish `UNKNOWN`, tests UNKNOWN, 0 declared dependency/ies.

**Artifacts scanned:** 0 — security gate UNKNOWN.

**Still UNKNOWN:** latestRelease, lastMeaningfulUpdate, architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `joshpuckett/interfacekit`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/joshpuckett/interfacekit/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/joshpuckett/interfacekit/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/joshpuckett/interfacekit/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/joshpuckett/interfacekit/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/joshpuckett/interfacekit/master/README.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/joshpuckett/interfacekit/master/readme.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/joshpuckett/interfacekit/master/README.rst` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/joshpuckett/interfacekit/master/README` | ❌ | HTTP 404 |
| default branch | `https://raw.githubusercontent.com/joshpuckett/interfacekit/{main,master}/README.md` | ❌ | No README on main or master. Repository existence is UNKNOWN from this route. |

**Established from the network:** licence `UNKNOWN` (evidence UNKNOWN), release `UNKNOWN`, last publish `UNKNOWN`, tests UNKNOWN, 0 declared dependency/ies.

**Artifacts scanned:** 0 — security gate UNKNOWN.

**Still UNKNOWN:** latestRelease, lastMeaningfulUpdate, architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `Amsterdam/design-system`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/Amsterdam/design-system/main/README.md` | ✅ | 2843 bytes |
| default branch | `https://raw.githubusercontent.com/Amsterdam/design-system/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/Amsterdam/design-system/main/LICENSE` | ❌ | HTTP 404 |
| licence:LICENSE.md | `https://raw.githubusercontent.com/Amsterdam/design-system/main/LICENSE.md` | ✅ | 13746 bytes |
| package.json | `https://raw.githubusercontent.com/Amsterdam/design-system/main/package.json` | ✅ | 3836 bytes |
| npm metadata for @amsterdam/design-system | `https://registry.npmjs.org/@amsterdam%2fdesign-system` | ❌ | HTTP 404 |

**Established from the network:** licence `EUPL-1.2` (evidence SUPPORTED), release `UNKNOWN`, last publish `UNKNOWN`, tests PRESENT, 0 declared dependency/ies.

**Artifacts scanned:** 3 — security gate PASS.

**Still UNKNOWN:** latestRelease, lastMeaningfulUpdate, architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `pegasystems/cosmos-react`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/pegasystems/cosmos-react/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/pegasystems/cosmos-react/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/pegasystems/cosmos-react/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/pegasystems/cosmos-react/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/pegasystems/cosmos-react/master/README.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/pegasystems/cosmos-react/master/readme.md` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/pegasystems/cosmos-react/master/README.rst` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/pegasystems/cosmos-react/master/README` | ❌ | HTTP 404 |
| default branch | `https://raw.githubusercontent.com/pegasystems/cosmos-react/{main,master}/README.md` | ❌ | No README on main or master. Repository existence is UNKNOWN from this route. |

**Established from the network:** licence `UNKNOWN` (evidence UNKNOWN), release `UNKNOWN`, last publish `UNKNOWN`, tests UNKNOWN, 0 declared dependency/ies.

**Artifacts scanned:** 0 — security gate UNKNOWN.

**Still UNKNOWN:** latestRelease, lastMeaningfulUpdate, architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `yocontra/react-responsive`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/yocontra/react-responsive/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/yocontra/react-responsive/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/yocontra/react-responsive/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/yocontra/react-responsive/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/yocontra/react-responsive/master/README.md` | ✅ | 8949 bytes |
| default branch | `https://raw.githubusercontent.com/yocontra/react-responsive/master/README.md` | ✅ | resolved to "master" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/yocontra/react-responsive/master/LICENSE` | ✅ | 1065 bytes |
| package.json | `https://raw.githubusercontent.com/yocontra/react-responsive/master/package.json` | ✅ | 2796 bytes |
| npm metadata for react-responsive | `https://registry.npmjs.org/react-responsive` | ✅ | 263813 bytes |
| published tarball | `https://registry.npmjs.org/react-responsive/-/react-responsive-10.0.1.tgz` | ✅ | 11769 bytes |
| tarball extraction | `https://registry.npmjs.org/react-responsive/-/react-responsive-10.0.1.tgz` | ✅ | 21 files in archive, 17 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `10.0.1`, last publish `2025-03-01`, tests PRESENT, 4 declared dependency/ies.

**Artifacts scanned:** 20 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `craigrileyuk/vue3-mq`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/craigrileyuk/vue3-mq/main/README.md` | ✅ | 2880 bytes |
| default branch | `https://raw.githubusercontent.com/craigrileyuk/vue3-mq/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/craigrileyuk/vue3-mq/main/LICENSE` | ✅ | 1076 bytes |
| package.json | `https://raw.githubusercontent.com/craigrileyuk/vue3-mq/main/package.json` | ✅ | 2413 bytes |
| npm metadata for vue3-mq | `https://registry.npmjs.org/vue3-mq` | ✅ | 67687 bytes |
| published tarball | `https://registry.npmjs.org/vue3-mq/-/vue3-mq-4.1.0.tgz` | ✅ | 13852 bytes |
| tarball extraction | `https://registry.npmjs.org/vue3-mq/-/vue3-mq-4.1.0.tgz` | ✅ | 24 files in archive, 14 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `4.1.0`, last publish `2026-01-25`, tests PRESENT, 0 declared dependency/ies.

**Artifacts scanned:** 17 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `AlexandreBonaventure/vue-mq`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/main/README.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/main/readme.md` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/main/README.rst` | ❌ | HTTP 404 |
| README on main | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/main/README` | ❌ | HTTP 404 |
| README on master | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/master/README.md` | ✅ | 3488 bytes |
| default branch | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/master/README.md` | ✅ | resolved to "master" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/master/LICENSE` | ✅ | 1088 bytes |
| package.json | `https://raw.githubusercontent.com/AlexandreBonaventure/vue-mq/master/package.json` | ✅ | 1314 bytes |
| npm metadata for vue-mq | `https://registry.npmjs.org/vue-mq` | ✅ | 27134 bytes |
| published tarball | `https://registry.npmjs.org/vue-mq/-/vue-mq-1.0.1.tgz` | ✅ | 301525 bytes |
| tarball extraction | `https://registry.npmjs.org/vue-mq/-/vue-mq-1.0.1.tgz` | ✅ | 29 files in archive, 17 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `1.0.1`, last publish `2022-05-23`, tests PRESENT, 1 declared dependency/ies.

**Artifacts scanned:** 20 — security gate REVIEW_REQUIRED.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `DyanGalih/security-review`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/DyanGalih/security-review/main/README.md` | ✅ | 4756 bytes |
| default branch | `https://raw.githubusercontent.com/DyanGalih/security-review/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/DyanGalih/security-review/main/LICENSE` | ✅ | 1066 bytes |
| package.json | `https://raw.githubusercontent.com/DyanGalih/security-review/main/package.json` | ✅ | 1470 bytes |
| npm metadata for security-review | `https://registry.npmjs.org/security-review` | ✅ | 7740 bytes |
| published tarball | `https://registry.npmjs.org/security-review/-/security-review-2.0.0.tgz` | ✅ | 1164594 bytes |
| tarball extraction | `https://registry.npmjs.org/security-review/-/security-review-2.0.0.tgz` | ✅ | 64 files in archive, 41 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `2.0.0`, last publish `2026-08-20`, tests PRESENT, 2 declared dependency/ies.

**Artifacts scanned:** 44 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)

### `salmanabdurrahman/pi-security-review`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
| README on main | `https://raw.githubusercontent.com/salmanabdurrahman/pi-security-review/main/README.md` | ✅ | 23440 bytes |
| default branch | `https://raw.githubusercontent.com/salmanabdurrahman/pi-security-review/main/README.md` | ✅ | resolved to "main" by probing; the API that reports the true default branch was not reachable, so this is the branch that served content, not a confirmed default |
| licence:LICENSE | `https://raw.githubusercontent.com/salmanabdurrahman/pi-security-review/main/LICENSE` | ✅ | 1075 bytes |
| package.json | `https://raw.githubusercontent.com/salmanabdurrahman/pi-security-review/main/package.json` | ✅ | 1723 bytes |
| npm metadata for pi-security-review | `https://registry.npmjs.org/pi-security-review` | ✅ | 29575 bytes |
| published tarball | `https://registry.npmjs.org/pi-security-review/-/pi-security-review-0.1.1.tgz` | ✅ | 67314 bytes |
| tarball extraction | `https://registry.npmjs.org/pi-security-review/-/pi-security-review-0.1.1.tgz` | ✅ | 32 files in archive, 26 decoded for scanning |

**Established from the network:** licence `MIT` (evidence SUPPORTED), release `0.1.1`, last publish `2026-06-26`, tests PRESENT, 0 declared dependency/ies.

**Artifacts scanned:** 29 — security gate PASS.

**Still UNKNOWN:** architecture, primaryCapability, sourceCommit (the API that serves it is unreachable here)
