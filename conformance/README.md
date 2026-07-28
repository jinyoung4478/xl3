# XTL Conformance Suite

This directory holds the **conformance corpus** — the test fixtures that any implementation of XTL must pass to claim conformance. The corpus is the executable definition of XTL behavior.

## Layout

```
conformance/
├── README.md            ← this file
├── AUTHORING.md         ← how to add fixtures (avoid the JS-as-truth trap)
├── runner-protocol.md   ← how implementations should run the suite
└── fixtures/
    └── <NNN>-<slug>/
        ├── template.xlsx
        ├── data.xlsx
        ├── expected.xlsx        ← canonical expected output (single-file case)
        ├── expected/            ← OR a directory of files (multi-file or zero-output case)
        │   └── *.xlsx
        ├── no expected output   ← for expected_error fixtures
        ├── no static expected   ← for expected_dynamic fixtures
        └── meta.yaml            ← description, spec section refs, tags
```

## What "passing" means

A static-output fixture passes if the implementation, given `template.xlsx` and
`data.xlsx`, produces output(s) that match `expected.xlsx` (or the contents of
`expected/`). Stage 1 runners may compare higher-level worksheet/cell values.
Stage 2 runners compare byte-equivalent workbook content after **canonical
normalization** of the OOXML zip:

- Files within the zip sorted by name
- XML serialized in deterministic canonical form
- Text-run whitespace preserved
- Generator metadata stripped (creator, modifiedBy, lastModified)

See [`runner-protocol.md`](./runner-protocol.md) for the comparison stage and
canonicalization rules.

An error fixture passes when the implementation reports an error containing the
fixture's `expected_error` text. Error fixtures do not include `expected.xlsx`
or an `expected/` directory.

A dynamic fixture passes when the implementation's output matches the dynamic
assertions declared by `expected_dynamic` in `meta.yaml`. Dynamic fixtures do
not include `expected.xlsx` or an `expected/` directory.

## Versioning

Each fixture directory contains `meta.yaml` declaring the minimum spec version it requires (`spec_version: 0.1`). Implementations report which spec version they target; the suite filters fixtures accordingly.

Static-output fixtures may also declare `comparison_stage`. The field defaults
to `1`; fixtures that require canonical OOXML comparison declare
`comparison_stage: 2`.

## Fixture Metadata

`meta.yaml` fields used by the corpus:

| Field | Required | Applies to | Meaning |
|---|---:|---|---|
| `description` | yes | all fixtures | One-line contract the fixture asserts. |
| `spec_section` | yes | all fixtures | Spec or ADR section that defines the behavior. |
| `spec_version` | yes | all fixtures | Minimum XTL version required by the fixture. |
| `tags` | yes | all fixtures | Filterable categories for reports and focused runs. |
| `verified_by` | no | all fixtures | How the expected output was independently arrived at — `hand`, `excel-formulas`, `manual-script`, `spec-derivation`, `synthetic-perturbation`. See `runner-protocol.md` for what each means. |
| `expected_warnings` | no | all fixtures | Stable warning substrings the implementation should emit. |
| `expected_error` | no | error fixtures | Stable error substring; omit static expected outputs. |
| `expected_dynamic` | no | dynamic fixtures | Dynamic assertion kind; currently `utc_today`. |
| `dynamic_cells` | with `expected_dynamic` | dynamic fixtures | Sheet/cell/format assertions computed by the runner. |
| `comparison_stage` | no | static-output fixtures | Minimum comparison stage; defaults to `1`, use `2` for OOXML-sensitive checks. |
| `skip_reason` | no | all fixtures | Temporary reason a known-broken fixture is skipped. |

`expected_error` and `expected_dynamic` are mutually exclusive. Static-output
fixtures use `expected.xlsx` or `expected/`; an empty `expected/` directory
means zero output files. Error and dynamic fixtures omit static expected
outputs.

## Fixture Catalog

The XTL 0.1 bootstrap corpus currently contains these fixtures:

| ID | Fixture | Contract |
|---|---|---|
| 001 | `bracket-substitution` | Single bracketed source-column expressions render one output row per source row. |
| 002 | `if-function` | `IF(condition, then, else)` evaluates comparisons inside the current data row. |
| 003 | `list-sheet-filter` | `@filter [field] in _ListSheet` keeps matching rows and removes the list sheet from output. |
| 004 | `repeat-right-default` | `@repeat right` without an explicit count defaults to `colSpan = 1`. |
| 005 | `round-half-away-from-zero` | `ROUND()` uses Excel-style half-away-from-zero rounding. |
| 006 | `filename-forbidden-chars` | Forbidden filename characters are replaced with `_`. |
| 007 | `filename-reserved-name` | Windows reserved device basenames get a single trailing `_`. |
| 008 | `numfmt-numeric-string-coercion` | Numeric template formats coerce numeric strings to numbers. |
| 009 | `numfmt-date-string-coercion` | Date template formats coerce date-like strings to date values. |
| 010 | `numfmt-text-format-coercion` | Text format `@` coerces a single-expression value to a string. |
| 011 | `text-date-format` | `TEXT(date, "YYYY-MM-DD")` returns a string using XTL date tokens. |
| 012 | `text-number-format` | `TEXT(number, format)` supports the minimum XTL 0.1 numeric format subset. |
| 013 | `rich-text-template-expression` | Rich-text template cells are parsed by concatenating text runs before expression detection. |
| 014 | `source-formula-cached-result` | Source formula cells use cached results and are not recalculated by XTL. |
| 015 | `source-sheet-prefix-first-match` | `source_sheet` prefix patterns select the first matching worksheet in workbook order. |
| 016 | `text-number-negative-rounding` | Numeric `TEXT()` formats round negative `.5` boundaries half away from zero. |
| 017 | `source-sheet-prefix-no-match-error` | Missing `source_sheet` prefix matches report a stable error. |
| 018 | `source-formula-missing-cached-result-error` | Source formula cells without cached results report a stable error. |
| 019 | `filename-empty-basename-error` | Filename sanitization reports an error for an empty basename. |
| 020 | `filename-length-overflow-error` | Filename sanitization reports an error above the 255-byte limit. |
| 021 | `numfmt-number-coercion-error` | Numeric template formats report an error when coercion fails. |
| 022 | `numfmt-date-coercion-error` | Date template formats report an error when coercion fails. |
| 023 | `today-utc-dynamic` | `TODAY()` renders the runner-start UTC date through a dynamic assertion. |
| 024 | `stage2-merge-preservation` | Stage 2 comparison verifies merged ranges below expanded data blocks are preserved. |
| 025 | `stage2-style-numfmt-preservation` | Stage 2 comparison verifies rendered cells preserve template style and numFmt. |
| 026 | `stage2-splice-merge-style-preservation` | Stage 2 comparison verifies row expansion preserves both shifted merges and styled/number-formatted rendered cells. |
| 027 | `stage2-cross-writer-canonicalization` | Stage 2 comparison verifies known OOXML writer differences canonicalize to the same workbook content. |
| 028 | `source-table-row-shorthand` | `source_table = N` selects row `N` as source column names and reads rows below it. |
| 029 | `source-table-open-range` | `source_table = B3:D` selects a column window and reads rows below through the used row end. |
| 030 | `source-table-finite-range` | `source_table = B3:D4` stops reading at the declared end row. |
| 031 | `source-table-zero-data-range` | `source_table = B3:D3` is valid and produces zero source rows. |
| 032 | `source-table-empty-column-name-error` | Empty source column names inside the selected span report a stable error. |
| 033 | `source-table-duplicate-column-name-error` | Duplicate source column names report a stable error. |
| 034 | `source-table-invalid-selector-error` | Invalid selectors such as row zero report a stable error. |
| 035 | `source-table-rich-text-header` | Rich-text source column-name cells are concatenated before source_table parsing. |
| 036 | `source-table-formula-header` | Formula source column-name cells use cached results. |
| 037 | `source-table-formula-header-missing-cache-error` | Formula source column-name cells without cached results report a stable error. |
| 038 | `source-sheet-exact-match-beats-prefix` | Exact `source_sheet` matches take precedence over prefix patterns. |
| 039 | `source-sheet-default-first-worksheet` | If `source_sheet` is omitted, the first worksheet in workbook order is used. |
| 040 | `list-sheet-hidden-states-removed` | Hidden and very hidden list sheets are still removed from output workbooks. |
| 041 | `row-function-inside-repeat-block` | `ROW()` returns the 1-based index of the current rendered data row inside a repeat block. |
| 042 | `row-function-outside-repeat-block-error` | Calling `ROW()` outside a repeat block reports a stable error. |
| 043 | `ifempty-function` | `IFEMPTY()` returns the fallback for empty values and passes through non-empty values. |
| 044 | `sort-and-top-order` | `@sort` runs before `@top`, so the top N rows come from the sorted set. |
| 045 | `list-sheet-not-in-filter` | `@filter ... !in _Sheet` keeps rows whose values are not present in the list sheet and removes the list sheet from output. |
| 046 | `count-field-non-empty` | `COUNT([field])` counts non-empty values in the current row set. |
| 047 | `aggregate-functions` | Core aggregates operate on the current rendered row set. |
| 048 | `if-and-comparison-boundaries` | Comparison operators drive `IF()` and `@filter` behavior around the zero boundary. |
| 049 | `filename-sanitization-warning` | Sanitizing a rendered filename emits a warning without changing output semantics. |
| 050 | `empty-ifempty-whitespace-only` | IFEMPTY treats whitespace-only strings as empty per ADR-0007. |
| 051 | `empty-ifempty-zero-not-empty` | IFEMPTY preserves the number 0; numbers are never empty per ADR-0007. |
| 052 | `empty-count-field-whitespace-zero-false` | COUNT([field]) counts non-empty values per ADR-0007 — whitespace empty, 0 and FALSE non-empty. |
| 053 | `empty-row-skip-whitespace-only` | A source row whose every cell is empty per ADR-0007 is skipped, including whitespace-only cells. |
| 054 | `empty-list-membership` | List sheets drop empty entries on read; an empty source-row value never matches `@filter ... in _Sheet` per ADR-0007. |
| 055 | `if-truthy-zero-and-empty` | IF treats 0 and empty values as falsy; non-zero numbers, non-empty strings, and TRUE are truthy per ADR-0008. |
| 056 | `if-truthy-string-zero-not-special` | `IF("0", …)` and `IF("false", …)` take the truthy branch — no special case for stringly-typed flag values. |
| 057 | `if-truthy-boolean` | A Boolean source cell drives IF truthiness directly per ADR-0008. |
| 058 | `if-comparison-result` | A comparison expression's Boolean result feeds IF truthiness directly per ADR-0008. |
| 059 | `compare-numeric-string-vs-number` | Comparison parses numbers and numeric strings under the shared `compareValues` per ADR-0009. |
| 060 | `compare-string-codepoint-order` | String fallback comparison uses Unicode code-point order — no locale-aware collation per ADR-0009. |
| 061 | `concat-canonical-form` | `&` stringifies operands using the canonical string form per ADR-0009 (booleans uppercase, integers without decimal). |
| 062 | `concat-empty-stringifies-to-empty` | `&` over an empty operand contributes the empty string per ADR-0009. |
| 063 | `compare-empty-vs-value` | Two empty operands compare equal; exactly one empty makes `=` false per ADR-0009 rules 1 and 2. |
| 064 | `compare-unicode-minus-not-numeric` | A string with Unicode minus (U+2212) is not parsed as a number; comparison falls through to the canonical-string fallback per ADR-0009. |
| 065 | `input-text-default-applied` | A `__inputs__` text input default fills in when the host omits the value (ADR-0010). |
| 066 | `input-text-host-supplied` | Host-supplied input flows through cells, sheet names, and the output filename pattern (ADR-0010). |
| 067 | `input-missing-required-error` | A required `__inputs__` declaration (no default) that the host omits is an error (ADR-0010). |
| 068 | `input-select-host-supplied` | A `select` input accepts a host value listed in the declared pipe-separated options (ADR-0010). |
| 069 | `source-multi-declaration` | A `__sources__` sheet declares an additional named source; aggregates over it operate on its full row set per ADR-0012. |
| 070 | `source-aggregate-cross-source` | COUNT/MIN/MAX over a named source operate on its full row set per ADR-0012. |
| 071 | `source-directive-active` | `@source SourceName` scopes a data block; inside it `[Column]` resolves to that source per ADR-0012. |
| 072 | `source-undeclared-error` | `@source` referencing a source not declared in `__sources__` is a parse-time error per ADR-0012. |
| 073 | `source-row-cross-error` | Row-level reference to a non-active source's column is an error per ADR-0012. |
| 074 | `xlookup-basic` | 3-arg XLOOKUP returns the matched return-array column for the first row whose lookup-array matches per ADR-0013. |
| 075 | `xlookup-fallback` | 4-arg XLOOKUP returns the fallback when no row matches per ADR-0013. |
| 076 | `xlookup-no-match-error` | 3-arg XLOOKUP without a fallback errors when no row matches per ADR-0013. |
| 077 | `xlookup-source-mismatch-error` | XLOOKUP arg 2 and arg 3 must reference the same source per ADR-0013. |
| 078 | `xlookup-bare-bracket-error` | XLOOKUP arg 2 / arg 3 require a source-prefixed bracket reference per ADR-0013. |
| 079 | `join-basic-inner` | `@join` pairs each primary row with the first matching joined row per ADR-0014. |
| 080 | `join-no-match-dropped` | `@join` uses inner semantics — primary rows without a match are dropped per ADR-0014. |
| 081 | `join-undeclared-source-error` | `@join` referencing a source not declared in `__sources__` is a parse-time error per ADR-0014. |
| 082 | `join-bad-on-clause-error` | `@join` on-clause must reference the joined source and the block's primary source per ADR-0014. |
| 083 | `sort-stable-equal-keys` | `@sort` is stable — rows with equal keys preserve source order per ADR-0016. |
| 084 | `sort-multi-stable-priority` | Multiple `@sort` directives apply with first = primary key, later directives as tiebreakers per ADR-0016. |
| 085 | `file-group-first-seen-order` | File groups emit in first-seen order over the source rows per ADR-0016. |
| 086 | `sheet-group-first-seen-order` | Sheet groups within a file emit in first-seen order per ADR-0016. |
| 087 | `date-canonical-string-concat` | A Date in `&` produces YYYY-MM-DD (midnight) or YYYY-MM-DDTHH:mm:ss per ADR-0017. |
| 088 | `date-comparison-equality` | Date values compare via canonical string form against a string filter value per ADR-0017. |
| 089 | `error-sentinel-empty` | Excel error cells (`#N/A`, `#VALUE!`, …) read as empty per ADR-0017. |
| 090 | `percentage-numeric-flow` | Percentage-formatted cells flow as their underlying Number per ADR-0017 (50% → 0.5). |

## Status

XTL 0.1 corpus is **bootstrap state**. Fixtures should be added only for behavior already stated in [`spec/README.md`](../spec/README.md), following the same pattern used by standards projects such as CommonMark: prose defines the rule, fixtures make the rule executable, and implementations report which fixtures they pass.

The reference implementation does not make its own behavior normative. When a fixture and the implementation disagree, update the implementation or the fixture according to the spec precedence in [`spec/README.md`](../spec/README.md).

Fixtures for XTL 0.1 core behavior avoid implementation-defined extensions such
as `TEXT()` formats outside the minimum table in [`spec/language.md`](../spec/language.md).
