# Authoring Conformance Fixtures

The corpus in this directory becomes the executable definition of XTL. Fixtures encoded here outlive any single implementation. Authoring them well is more important than authoring many.

## The "JS impl as ground truth" anti-pattern

The seductive shortcut is:

1. Run the JS reference implementation
2. Save its output as `expected.xlsx`
3. Commit and call it canonical

This makes the JS implementation the de-facto specification. When a Python or Go port disagrees, who's right? Whoever runs first. The spec becomes "what the JS impl does," and standardization is dead.

**Conformance must be authored from the spec, not from the implementation.**

## Authoring procedure

### For simple fixtures

1. Read the relevant section of [`spec/`](../spec/).
2. Write `template.xlsx` and `data.xlsx` by hand in Excel (or a spreadsheet editor).
3. Compute the expected output **by hand** — open Excel, open a calculator, work cell by cell. Save as `expected.xlsx`.
4. Run the reference implementation. If it disagrees with your hand-computed expected, do **not** change the expected — open an issue: either the spec is wrong, the impl is wrong, or your hand computation is wrong.

### For complex fixtures

When hand-computation is impractical (e.g., 200-row sums, multi-sheet groupings):

1. Author template and data following the spec.
2. Compute expected via two independent paths (e.g., Excel formulas + a separate script). They must agree.
3. Run reference impl; if it agrees with both independent paths, save the impl's output as expected.
4. Document in `meta.yaml`: `verified_by: [excel-formulas, manual-script]`.

### What `meta.yaml` should contain

```yaml
description: "Basic per-row substitution with [field] syntax"
spec_section: "Cell-level variables"
spec_version: 0.1
tags: [substitution, basic]
comparison_stage: 1
verified_by: [hand]            # or [excel-formulas, manual-script], etc.
```

`comparison_stage` is optional and defaults to `1`. Use `2` only for
static-output fixtures that need canonical OOXML comparison to assert styles,
merged ranges, images, package structure, or other workbook features that Stage
1 cell-value comparison cannot observe.

`expected_error` turns the fixture into an error fixture and must not be used
with `expected.xlsx`, `expected/`, or `expected_dynamic`. `expected_dynamic`
turns the fixture into a dynamic assertion fixture and must include
`dynamic_cells`; dynamic fixtures also omit static expected outputs. Keep
`comparison_stage` for static-output fixtures only.

### Stage 2 fixture authoring caveat

Both `template.xlsx` and `expected.xlsx` for most current Stage 2 fixtures
(024-026) are built by the same `exceljs` writer the JS reference implementation
uses internally. They round-trip through one library on both sides, so they
exercise the canonicalizer's *equivalence* claim (sheet part renaming, default
page setup stripping, attribute order, quote style, empty-element form) but
not its *cross-writer* claim. A canonicalizer that only handles ExcelJS quirks
will still pass those fixtures.

Fixture 027 adds package-level writer-variance coverage by hand-rewriting the
authored expected workbook's OOXML serialization while keeping the same workbook
semantics. This is still not a substitute for a workbook saved by Excel,
LibreOffice, or another independent OOXML writer; such a fixture remains the
preferred follow-up when that authoring environment is available.

The cardinal rule still applies: a Stage 2 `expected.xlsx` authored by running
the JS implementation is forbidden. ExcelJS authoring is acceptable as
scaffolding only because the package writer is generic — it is not the XTL
implementation. Adding a Stage 2 fixture whose `expected.xlsx` is saved by
Excel itself (or by another OOXML writer) remains a stronger follow-up; until
then, cross-writer behavior is covered by fixture 027's package rewrite plus
canonicalizer unit tests in `impl/js/src/__tests__/conformance-runner.test.ts`.

For error fixtures, omit `expected.xlsx` and `expected/`, and declare the stable
part of the expected diagnostic:

```yaml
expected_error: "Source sheet"
```

For dynamic fixtures, omit `expected.xlsx` and `expected/`, declare the dynamic
assertion kind, and list the cells whose expected values are computed by the
runner:

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

## Hard rules

- **Expected outputs are authored, not generated.** If you can't hand-verify, you must independently verify. Treat `expected.xlsx` as part of the spec, not as test output.
- **Each fixture tests one concept.** Mixing repeat + filter + aggregation in one fixture makes failures hard to diagnose. Compose minimal fixtures.
- **Fixture file sizes should be tiny.** If a fixture needs 1000 rows of data, the test concept is wrong — generate small data that exercises the same property.
- **No PII or proprietary data.** Fixtures are MIT-licensed and public. Use synthetic data only.
- **Templates must be human-readable.** Avoid binary-only Excel features (custom XML, macros) in fixtures unless explicitly testing them.
- **Error fixtures assert stable diagnostics only.** Match a short substring that
  describes the contract, not volatile details such as absolute paths.
- **Dynamic fixtures assert only spec-defined dynamic values.** Do not use them
  to avoid authoring an expected workbook for static behavior.

## When the spec and a fixture disagree

The spec wins. Update the fixture.

## When a fixture and an implementation disagree

The fixture wins. Update the implementation.

## When you discover an under-specified case while authoring

Stop. Open an issue and update the spec first. Do not commit a fixture that depends on under-specified behavior — it freezes the under-specification into "what the corpus does," which the spec then has to match retroactively.
