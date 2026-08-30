# Provenance evidence

## The claim

`Reused Code: None` — asserted in every generated plugin's `PROVENANCE.md` and
in the root `PROVENANCE.md`.

## The method

`tests/provenance-audit.test.ts`:

1. Run the pipeline and generate a plugin.
2. Collect **every artifact the analyser actually held** for every source it
   inspected — READMEs, licence files, `package.json`, and published source
   extracted from npm tarballs.
3. Reduce both the upstream artifacts and every generated file to **8-word
   shingles** — overlapping runs of 8 consecutive whitespace-separated words.
4. Fail if any shingle appears in both sets.

Parameters: shingle length **8 words**; whitespace normalised; comparison
case-sensitive; scope is every generated file against every held artifact.

Result at the freeze commit: **zero overlapping shingles**.

## What this does and does not establish

**Does:** no run of eight consecutive words from any inspected upstream artifact
appears verbatim in the generated output.

**Does NOT — and is not claimed to:**

- It is **not a legal determination of non-infringement.** Zero shingle overlap
  is evidence about text, not a copyright conclusion. Nothing in this project
  should be read as such a claim.
- It would not catch reformatted, reordered, translated, minified or otherwise
  transformed copying.
- It would not catch copying of **structure** — API shape, algorithm, control
  flow — which carries no shared word runs.
- It only covers artifacts the analyser **held**. Source never fetched cannot
  be compared against. Offline runs hold far less than `--live` runs.
- 8 words is an arbitrary threshold. Shorter would raise false positives on
  common phrasing; longer would miss short copied fragments. **The threshold was
  chosen, not derived.**

## What to attack

1. Is the shingle length defensible? What would a different length change?
2. Does the audit cover **every** generated file, or only some?
3. Are the upstream artifacts it compares against the right set — and how much
   is missing in an offline run?
4. Is the builder structurally incapable of copying, or does it merely happen
   not to? See `src/builder/plugin-builder.ts`.
5. Is attribution complete for concept-only sources (`zz-plant/ambit`,
   the Claude Code plugin reference)?
6. Are the "original contribution" claims supportable, or is any of them a
   rename or a wrapper? Cross-check `ORIGINAL_CONTRIBUTIONS.md` against
   `tests/ablation.test.ts` — and audit that harness too.

**Criticise the methodology, not only the result.** A green audit with a weak
method is worse than a red one with a strong method.
