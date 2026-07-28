# Conformance dashboard

_Generated 2026-07-28T09:44:39.166Z by `conformance/scripts/dashboard.mjs`. Do not hand-edit; regenerate with `node conformance/scripts/dashboard.mjs`._

## Reference implementation

**xl3-js** 0.1.0-alpha.0 — 169/169 pass (100.0%); 0 fail, 0 error, 0 skip

## External implementations

- **xl3-py** 0.1.0a3 — 133/133 pass (100.0%); 0 fail, 0 error, 6 skip
- **xl3-wasm** 0.1.0 — 119/154 pass (77.3%); 29 fail, 0 error, 6 skip

## Breakdown by ADR (reference impl)

| ADR | Fixtures | Pass | Fail | Skip | Error |
|---|---:|---:|---:|---:|---:|
| ADR-0001 | 2 | 2 | 0 | 0 | 0 |
| ADR-0002 | 2 | 2 | 0 | 0 | 0 |
| ADR-0003 | 3 | 3 | 0 | 0 | 0 |
| ADR-0005 | 1 | 1 | 0 | 0 | 0 |
| ADR-0006 | 6 | 6 | 0 | 0 | 0 |
| ADR-0007 | 6 | 6 | 0 | 0 | 0 |
| ADR-0008 | 4 | 4 | 0 | 0 | 0 |
| ADR-0009 | 8 | 8 | 0 | 0 | 0 |
| ADR-0010 | 5 | 5 | 0 | 0 | 0 |
| ADR-0011 | 2 | 2 | 0 | 0 | 0 |
| ADR-0012 | 7 | 7 | 0 | 0 | 0 |
| ADR-0013 | 5 | 5 | 0 | 0 | 0 |
| ADR-0014 | 4 | 4 | 0 | 0 | 0 |
| ADR-0016 | 4 | 4 | 0 | 0 | 0 |
| ADR-0017 | 4 | 4 | 0 | 0 | 0 |
| ADR-0019 | 1 | 1 | 0 | 0 | 0 |
| ADR-0021 | 2 | 2 | 0 | 0 | 0 |
| ADR-0023 | 2 | 2 | 0 | 0 | 0 |
| ADR-0024 | 2 | 2 | 0 | 0 | 0 |
| ADR-0025 | 1 | 1 | 0 | 0 | 0 |
| ADR-0026 | 2 | 2 | 0 | 0 | 0 |
| ADR-0027 | 3 | 3 | 0 | 0 | 0 |
| ADR-0028 | 2 | 2 | 0 | 0 | 0 |
| ADR-0029 | 4 | 4 | 0 | 0 | 0 |
| ADR-0030 | 1 | 1 | 0 | 0 | 0 |
| ADR-0031 | 1 | 1 | 0 | 0 | 0 |
| ADR-0032 | 1 | 1 | 0 | 0 | 0 |
| ADR-0033 | 2 | 2 | 0 | 0 | 0 |
| ADR-0035 | 1 | 1 | 0 | 0 | 0 |
| ADR-0036 | 2 | 2 | 0 | 0 | 0 |
| ADR-0038 | 11 | 11 | 0 | 0 | 0 |
| ADR-0039 | 1 | 1 | 0 | 0 | 0 |
| ADR-0041 | 1 | 1 | 0 | 0 | 0 |
| ADR-0043 | 2 | 2 | 0 | 0 | 0 |
| ADR-0044 | 1 | 1 | 0 | 0 | 0 |
| ADR-0046 | 2 | 2 | 0 | 0 | 0 |
| ADR-0047 | 1 | 1 | 0 | 0 | 0 |
| ADR-0050 | 3 | 3 | 0 | 0 | 0 |
| ADR-0058 | 1 | 1 | 0 | 0 | 0 |
| ADR-0066 | 8 | 8 | 0 | 0 | 0 |
| ADR-0067 | 4 | 4 | 0 | 0 | 0 |
| ADR-0068 | 5 | 5 | 0 | 0 | 0 |
| ADR-0069 | 4 | 4 | 0 | 0 | 0 |
| ADR-0073 | 2 | 2 | 0 | 0 | 0 |
| ADR-0074 | 1 | 1 | 0 | 0 | 0 |
| *(no ADR)* | 49 | 49 | 0 | 0 | 0 |

## Per-fixture status

| Fixture | xl3-js | xl3-py | xl3-wasm |
|---|---|---|---|
| 001-bracket-substitution | pass | pass | pass |
| 002-if-function | pass | pass | pass |
| 003-list-sheet-filter | pass | pass | pass |
| 004-repeat-right-default | pass | pass | pass |
| 005-round-half-away-from-zero | pass | pass | pass |
| 006-filename-forbidden-chars | pass | pass | pass |
| 007-filename-reserved-name | pass | pass | fail |
| 008-numfmt-numeric-string-coercion | pass | pass | pass |
| 009-numfmt-date-string-coercion | pass | pass | pass |
| 010-numfmt-text-format-coercion | pass | pass | pass |
| 011-text-date-format | pass | pass | pass |
| 012-text-number-format | pass | pass | pass |
| 013-rich-text-template-expression | pass | pass | pass |
| 014-source-formula-cached-result | pass | pass | pass |
| 015-source-sheet-prefix-first-match | pass | pass | pass |
| 016-text-number-negative-rounding | pass | pass | pass |
| 017-source-sheet-prefix-no-match-error | pass | pass | pass |
| 018-source-formula-missing-cached-result-error | pass | pass | fail |
| 019-filename-empty-basename-error | pass | pass | fail |
| 020-filename-length-overflow-error | pass | pass | fail |
| 021-numfmt-number-coercion-error | pass | pass | fail |
| 022-numfmt-date-coercion-error | pass | pass | fail |
| 023-today-utc-dynamic | pass | pass | fail |
| 024-stage2-merge-preservation | pass | skip | skip |
| 025-stage2-style-numfmt-preservation | pass | skip | skip |
| 026-stage2-splice-merge-style-preservation | pass | skip | skip |
| 027-stage2-cross-writer-canonicalization | pass | skip | skip |
| 028-source-table-row-shorthand | pass | pass | pass |
| 029-source-table-open-range | pass | pass | pass |
| 030-source-table-finite-range | pass | pass | pass |
| 031-source-table-zero-data-range | pass | pass | fail |
| 032-source-table-empty-column-name-error | pass | pass | fail |
| 033-source-table-duplicate-column-name-error | pass | pass | fail |
| 034-source-table-invalid-selector-error | pass | pass | fail |
| 035-source-table-rich-text-header | pass | pass | pass |
| 036-source-table-formula-header | pass | pass | pass |
| 037-source-table-formula-header-missing-cache-error | pass | pass | fail |
| 038-source-sheet-exact-match-beats-prefix | pass | pass | pass |
| 039-source-sheet-default-first-worksheet | pass | pass | pass |
| 040-list-sheet-hidden-states-removed | pass | pass | pass |
| 041-row-function-inside-repeat-block | pass | pass | pass |
| 042-row-function-outside-repeat-block-error | pass | pass | fail |
| 043-ifempty-function | pass | pass | pass |
| 044-sort-and-top-order | pass | pass | pass |
| 045-list-sheet-not-in-filter | pass | pass | pass |
| 046-count-field-non-empty | pass | pass | pass |
| 047-aggregate-functions | pass | pass | pass |
| 048-if-and-comparison-boundaries | pass | pass | pass |
| 049-filename-sanitization-warning | pass | pass | pass |
| 050-empty-ifempty-whitespace-only | pass | pass | pass |
| 051-empty-ifempty-zero-not-empty | pass | pass | pass |
| 052-empty-count-field-whitespace-zero-false | pass | pass | pass |
| 053-empty-row-skip-whitespace-only | pass | pass | pass |
| 054-empty-list-membership | pass | pass | pass |
| 055-if-truthy-zero-and-empty | pass | pass | pass |
| 056-if-truthy-string-zero-not-special | pass | pass | pass |
| 057-if-truthy-boolean | pass | pass | pass |
| 058-if-comparison-result | pass | pass | pass |
| 059-compare-numeric-string-vs-number | pass | pass | pass |
| 060-compare-string-codepoint-order | pass | pass | pass |
| 061-concat-canonical-form | pass | pass | pass |
| 062-concat-empty-stringifies-to-empty | pass | pass | pass |
| 063-compare-empty-vs-value | pass | pass | fail |
| 064-compare-unicode-minus-not-numeric | pass | pass | pass |
| 065-input-text-default-applied | pass | pass | pass |
| 066-input-text-host-supplied | pass | pass | pass |
| 067-input-missing-required-error | pass | pass | fail |
| 068-input-select-host-supplied | pass | pass | pass |
| 069-source-multi-declaration | pass | pass | pass |
| 070-source-aggregate-cross-source | pass | pass | pass |
| 071-source-directive-active | pass | pass | pass |
| 072-source-undeclared-error | pass | pass | pass |
| 073-source-row-cross-error | pass | pass | fail |
| 074-xlookup-basic | pass | pass | pass |
| 075-xlookup-fallback | pass | pass | pass |
| 076-xlookup-no-match-error | pass | pass | fail |
| 077-xlookup-source-mismatch-error | pass | pass | pass |
| 078-xlookup-bare-bracket-error | pass | pass | pass |
| 079-join-basic-inner | pass | pass | pass |
| 080-join-no-match-dropped | pass | pass | pass |
| 081-join-undeclared-source-error | pass | pass | pass |
| 082-join-bad-on-clause-error | pass | pass | pass |
| 083-sort-stable-equal-keys | pass | pass | pass |
| 084-sort-multi-stable-priority | pass | pass | pass |
| 085-file-group-first-seen-order | pass | pass | pass |
| 086-sheet-group-first-seen-order | pass | pass | pass |
| 087-date-canonical-string-concat | pass | pass | pass |
| 088-date-comparison-equality | pass | pass | pass |
| 089-error-sentinel-empty | pass | pass | pass |
| 090-percentage-numeric-flow | pass | pass | pass |
| 091-source-unknown-column-error | pass | pass | fail |
| 092-composed-multi-source-join-filter-sort | pass | pass | pass |
| 093-stage2-excel-authored-expected | pass | skip | skip |
| 094-reserved-sheet-name-error | pass | pass | pass |
| 095-empty-fefff-not-whitespace | pass | pass | pass |
| 096-canonical-number-scientific-boundary | pass | pass | pass |
| 097-native-formula-static-cell-preserved | pass | pass | pass |
| 099-empty-template-block-error | pass | pass | fail |
| 100-arithmetic-string-coerces-to-number | pass | pass | pass |
| 101-arithmetic-non-numeric-string-error | pass | pass | fail |
| 102-function-arity-round-missing-arg | pass | pass | pass |
| 103-function-arity-xlookup-too-few-args | pass | pass | pass |
| 104-multiple-filter-directives-and | pass | pass | pass |
| 105-template-block-whitespace-insignificant | pass | pass | pass |
| 106-division-by-zero-produces-error-cell | pass | pass | fail |
| 107-group-key-empty-blank-placeholder-file | pass | pass | fail |
| 108-group-key-empty-blank-placeholder-sheet | pass | pass | pass |
| 109-source-column-reserved-name-error | pass | pass | fail |
| 110-directive-empty-filter-error | pass | pass | pass |
| 111-directive-empty-source-error | pass | pass | pass |
| 112-literal-signed-number | pass | pass | pass |
| 113-unsupported-unary-on-column-ref-error | pass | pass | fail |
| 114-duplicate-source-directive-error | pass | pass | pass |
| 115-self-join-error | pass | pass | pass |
| 116-function-name-case-insensitive | pass | pass | pass |
| 117-hidden-source-rows-included | pass | pass | pass |
| 118-unicode-normalization-not-applied | pass | pass | pass |
| 119-output-filename-collision-error | pass | pass | fail |
| 120-workbook-properties-preserved | pass | skip | skip |
| 121-source-merged-header | pass | pass | pass |
| 122-source-data-row-merge-broadcast | pass | pass | pass |
| 123-feature-preservation | pass | pass | pass |
| 124-source-2d-merge-header | pass | pass | pass |
| 125-hyperlink-function | pass | pass | fail |
| 126-date-arithmetic-functions | pass | pass | fail |
| 127-multiline-cell-text | pass | pass | pass |
| 128-function-batch-0044 | pass | pass | pass |
| 129-cell-formula-preservation | pass | pass | pass |
| 130-isblank-function | pass | pass | pass |
| 131-inputs-with-xtl-default | pass | pass | pass |
| 132-group-single-level-subtotal | pass | pass | pass |
| 133-group-two-level-nested-subtotal | pass | pass | pass |
| 134-group-grand-total-via-outermost-subtotal | pass | pass | pass |
| 135-group-filter-composition | pass | pass | pass |
| 136-group-missing-key | pass | pass | pass |
| 137-subtotal-outside-group | pass | pass | fail |
| 138-subtotal-bad-aggregate | pass | pass | pass |
| 139-inputs-forward-reference | pass | pass | pass |
| 140-inputs-runtime-only-fn | pass | pass | pass |
| 141-block-column-scoped-side-cells | pass | — | pass |
| 142-block-column-scoped-side-formulas | pass | — | pass |
| 143-block-shared-formula-side-cells | pass | — | fail |
| 144-block-side-cells-after-block | pass | — | pass |
| 145-block-bracket-outside-error | pass | — | pass |
| 146-multi-block-explicit-two-tables | pass | — | pass |
| 147-multi-block-different-sources | pass | — | pass |
| 148-multi-block-different-start-rows | pass | — | pass |
| 149-block-col-range-explicit | pass | — | pass |
| 150-block-full-rect-explicit | pass | — | pass |
| 151-block-overlap-error | pass | — | pass |
| 152-block-empty-table-error | pass | — | pass |
| 153-directive-orphan-error | pass | — | pass |
| 154-multi-block-per-block-filter | pass | — | pass |
| 155-multi-block-row-function-scope | pass | — | pass |
| 156-static-native-value-preservation | pass | — | — |
| 157-group-block-side-cells | pass | — | — |
| 158-chained-arithmetic-associativity | pass | — | — |
| 159-subtotal-mixed-row-error | pass | — | — |
| 160-subtotal-formula-cache-not-marker | pass | — | — |
| 161-explicit-block-subtotal-unsupported | pass | — | — |
| 162-data-loss-number-type-preserved | pass | — | — |
| 163-data-loss-zero-is-not-empty | pass | — | — |
| 164-data-loss-leading-zero-string-stays-string | pass | — | — |
| 165-data-loss-boolean-type-preserved | pass | — | — |
| 166-data-loss-percent-flows-as-underlying-number | pass | — | — |
| 167-data-loss-date-serial-nondate-format-is-number | pass | — | — |
| 168-data-loss-date-time-component-round-trip | pass | — | — |
| 169-data-loss-formula-cached-result-kind | pass | — | — |
| 170-data-loss-numfmt-preserved-across-expansion | pass | — | — |

## How to add a port

1. Make your port emit a JSON report in the format documented in [`conformance/runner-protocol.md`](./runner-protocol.md) "JSON report format".
2. Save it under `conformance/reports/<impl>-<version>.json`.
3. Run `node conformance/scripts/dashboard.mjs` from the repo root to regenerate this file.

