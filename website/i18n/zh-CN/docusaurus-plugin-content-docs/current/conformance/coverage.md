# ADR 覆盖矩阵

由 `impl/js/src/__tests__/spec-coverage.test.ts` 自动生成。请勿手工编辑。

| ADR | 标题 | 覆盖的 fixture |
|---|---|---|
| 0001 | ADR 0001 — `TODAY()` returns UTC date | `23-today-utc-dynamic` |
| 0002 | ADR 0002 — Output filename sanitization rules | `6-filename-forbidden-chars`, `7-filename-reserved-name` |
| 0003 | ADR 0003 — Single-expression cell numFmt coercion is MUST | `10-numfmt-text-format-coercion`, `8-numfmt-numeric-string-coercion`, `9-numfmt-date-string-coercion` |
| 0004 | Reference implementation coupling audit | _(信息性)_ |
| 0005 | Dynamic conformance assertions | `23-today-utc-dynamic` |
| 0006 | Stage 2 OOXML conformance comparison | `24-stage2-merge-preservation`, `25-stage2-style-numfmt-preservation`, `26-stage2-splice-merge-style-preservation`, `27-stage2-cross-writer-canonicalization`, `93-stage2-excel-authored-expected` |
| 0007 | Empty value definition | `50-empty-ifempty-whitespace-only`, `51-empty-ifempty-zero-not-empty`, `52-empty-count-field-whitespace-zero-false`, `53-empty-row-skip-whitespace-only`, `54-empty-list-membership`, `95-empty-fefff-not-whitespace` |
| 0008 | Truthiness rules for `IF()` and `@filter` | `55-if-truthy-zero-and-empty`, `56-if-truthy-string-zero-not-special`, `57-if-truthy-boolean`, `58-if-comparison-result` |
| 0009 | Comparison operators and string coercion for `&` | `58-if-comparison-result`, `59-compare-numeric-string-vs-number`, `60-compare-string-codepoint-order`, `61-concat-canonical-form`, `62-concat-empty-stringifies-to-empty`, `63-compare-empty-vs-value`, `64-compare-unicode-minus-not-numeric`, `96-canonical-number-scientific-boundary` |
| 0010 | Runtime user inputs | `131-inputs-with-xtl-default`, `65-input-text-default-applied`, `66-input-text-host-supplied`, `67-input-missing-required-error`, `68-input-select-host-supplied` |
| 0011 | Reserved sheet naming and unified reference | `131-inputs-with-xtl-default`, `94-reserved-sheet-name-error` |
| 0012 | Multi-source data model | `69-source-multi-declaration`, `70-source-aggregate-cross-source`, `71-source-directive-active`, `72-source-undeclared-error`, `73-source-row-cross-error`, `91-source-unknown-column-error`, `92-composed-multi-source-join-filter-sort` |
| 0013 | XLOOKUP cross-source lookup | `74-xlookup-basic`, `75-xlookup-fallback`, `76-xlookup-no-match-error`, `77-xlookup-source-mismatch-error`, `78-xlookup-bare-bracket-error` |
| 0014 | Source joins via `@join` | `79-join-basic-inner`, `80-join-no-match-dropped`, `81-join-undeclared-source-error`, `82-join-bad-on-clause-error` |
| 0015 | Structured error reporting + i18n direction | `17`, `18`, `19`, `20`, `21`, `22`, `32`, `33`, `34`, `37`, `42`, `67`, `72`, `73`, `76`, `77`, `78`, `81`, `82`, `91` |
| 0016 | Ordering and stability | `83-sort-stable-equal-keys`, `84-sort-multi-stable-priority`, `85-file-group-first-seen-order`, `86-sheet-group-first-seen-order` |
| 0017 | Source value model | `87-date-canonical-string-concat`, `88-date-comparison-equality`, `89-error-sentinel-empty`, `90-percentage-numeric-flow` |
| 0018 | reserved (gap placeholder) | _(信息性)_ |
| 0019 | Deferred: date arithmetic functions | `126-date-arithmetic-functions` |
| 0020 | Deferred: locale-aware collation | _(信息性)_ |
| 0021 | Implementation-defined boundaries | `97-native-formula-static-cell-preserved`, `99-empty-template-block-error` |
| 0022 | Excel version compatibility | _(信息性)_ |
| 0023 | Operator coercion + Excel-as-default principle | `100-arithmetic-string-coerces-to-number`, `101-arithmetic-non-numeric-string-error` |
| 0024 | Function arity is part of the spec | `102-function-arity-round-missing-arg`, `103-function-arity-xlookup-too-few-args` |
| 0025 | Division by zero produces an Excel #DIV/0! error cell | `106-division-by-zero-produces-error-cell` |
| 0026 | Empty value lifecycle in cell rendering and group keys | `107-group-key-empty-blank-placeholder-file`, `108-group-key-empty-blank-placeholder-sheet` |
| 0027 | Reserved column names + directive arg validation | `109-source-column-reserved-name-error`, `110-directive-empty-filter-error`, `111-directive-empty-source-error` |
| 0028 | Literal syntax constraints + unsupported-syntax detection | `112-literal-signed-number`, `113-unsupported-unary-on-column-ref-error` |
| 0029 | Directive composition + source edge semantics | `114-duplicate-source-directive-error`, `115-self-join-error`, `116-function-name-case-insensitive`, `117-hidden-source-rows-included` |
| 0030 | Unicode normalization in string comparison | `118-unicode-normalization-not-applied` |
| 0031 | Output filename collision is an error | `119-output-filename-collision-error` |
| 0032 | Niche limits and workbook pass-through behaviors | `120-workbook-properties-preserved` |
| 0033 | Merged source-table headers | `121-source-merged-header`, `124-source-2d-merge-header` |
| 0034 | Relationship to prior-art template engines | _(信息性)_ |
| 0035 | Data-row merged cell semantics | `122-source-data-row-merge-broadcast` |
| 0036 | Template feature preservation matrix | `123-feature-preservation` |
| 0037 | Rejected: dynamic image insertion | _(信息性)_ |
| 0038 | `@group` and `@subtotal` directives | `132-group-single-level-subtotal`, `133-group-two-level-nested-subtotal`, `134-group-grand-total-via-outermost-subtotal`, `135-group-filter-composition`, `136-group-missing-key`, `137-subtotal-outside-group`, `138-subtotal-bad-aggregate` |
| 0039 | HYPERLINK() function | `125-hyperlink-function` |
| 0040 | Preservation matrix amendment: CF / DV range extension + outline level | _(信息性)_ |
| 0041 | Multi-line cell text | `127-multiline-cell-text` |
| 0042 | Rejected: runtime cell mutation (`jx:updateCell` style) | _(信息性)_ |
| 0043 | Excel-native preference principle | _(信息性)_ |
| 0044 | Function batch — accepted per ADR-0043 | `128-function-batch-0044` |
| 0045 | Function batch — rejected per ADR-0043 | _(信息性)_ |
| 0046 | Cell formula preservation contract | `129-cell-formula-preservation` |
| 0047 | `ISBLANK` as `IFEMPTY` predicate alias | `130-isblank-function` |
| 0048 | Relationship to JXLS — final boundary and inconvenience refinement | _(信息性)_ |
| 0049 | Template-display vs render-output: intentional asymmetry | _(信息性)_ |
| 0050 | ADR 0050 — Template inputs accept XTL expressions in `default` / `label` / `description` | `131-inputs-with-xtl-default`, `139-inputs-forward-reference`, `140-inputs-runtime-only-fn` |
| 0051 | ADR 0051 — String literals and template-block delimiter boundary | _(信息性)_ |
| 0052 | ADR 0052 — Cell expression classification: single vs mixed text | _(信息性)_ |
| 0053 | ADR 0053 — Mixed-text propagation of Excel error sentinels | _(信息性)_ |
| 0054 | ADR 0054 — Bare name in cell context | _(信息性)_ |
| 0055 | ADR 0055 — Directive integer arguments: positive-integer bounds | _(信息性)_ |
| 0056 | ADR 0056 — Reading reserved-sheet system keys | _(信息性)_ |
| 0057 | ADR 0057 — `__lists__[name]` outside `@filter in` / `!in` | _(信息性)_ |
| 0058 | ADR 0058 — `@subtotal` row composition: same-row level binding | _(信息性)_ |
| 0059 | ADR 0059 — Aggregate function argument shape | _(信息性)_ |
| 0060 | ADR 0060 — `XLOOKUP` value-argument cross-source rules | _(信息性)_ |
| 0061 | ADR 0061 — Source name lexical disambiguation | _(信息性)_ |
| 0062 | ADR 0062 — `__inputs__` `default = ""` semantics | _(信息性)_ |
| 0063 | ADR 0063 — `__inputs__` `options` pipe-split rules | _(信息性)_ |
| 0064 | ADR 0064 — String-to-number coercion: scientific-notation scope | _(信息性)_ |
| 0065 | ADR 0065 — `@source default` explicit reference | _(信息性)_ |
