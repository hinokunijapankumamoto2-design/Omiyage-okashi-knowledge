# Finding schema

Use this shape for **every** finding, in all four reviews. The importer parses
it; fields it cannot find are left blank rather than guessed.

```
ID                 e.g. SR-1, ADV-3, BM-2, SLP-4
REVIEW_TYPE        STANDARD | ADVERSARIAL | BENCHMARK | SEC_LIC_PROV
SEVERITY           CRITICAL | HIGH | MEDIUM | LOW | INFO
CATEGORY           architecture | correctness | type-safety | error-handling |
                   tests | security | licence | provenance | benchmark |
                   reproducibility | claims | supply-chain
CLAIM_ATTACKED     which of evidence/claims-to-audit.md, or "none"
FINDING            one sentence: what is wrong
EVIDENCE           what you observed that shows it
FILE               repo-relative path
LINE               line number or component name
REPRODUCTION       exact steps or command
EXPECTED           what should happen
ACTUAL             what does happen
IMPACT             what breaks, for whom, when
CONFIDENCE         high | medium | low
RECOMMENDATION     smallest change that would fix it
```

## Severity, as this project uses it

| Severity | Meaning here |
| --- | --- |
| `CRITICAL` | Security or licence defect, data loss, or a claim that is materially false. Blocks release. |
| `HIGH` | Correctness or benchmark-validity defect that changes a release decision. Blocks release until reproduced and resolved. |
| `MEDIUM` | Real defect that does not change the release decision on its own. |
| `LOW` | Worth fixing, no release impact. |
| `INFO` | Observation, not a defect. |

`CRITICAL` and `HIGH` carry a release consequence, so state your `CONFIDENCE`
honestly — a low-confidence HIGH is more useful labelled as such than upgraded
or withheld.

## Notes

- **Reporting no finding in an area is a valid, useful result.** Say so
  explicitly rather than padding with `INFO` items.
- If a claim in `evidence/claims-to-audit.md` survives your attack, record that too — an
  attack that fails is evidence.
- Do not modify any source file. See the read-only rule in `REVIEW_BRIEF.md`.
