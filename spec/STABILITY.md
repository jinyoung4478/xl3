# XTL Stability Policy

## Current state

XTL is at version **0.1**. The reference impl ships XTL 0.1 as
`@xl3-lang/xl3` on npm; its package version moves on a timeline
independent of the spec version (see
[RELEASING.md](../RELEASING.md)), so it is not pinned here.
The 1.0 cut is deliberately deferred until external
validation accumulates — at minimum, a second-language port that
passes the conformance corpus and one production adopter. Until
then, breaking changes are possible across 0.x minor bumps and
SHOULD be documented in the affected ADR(s).

The contract that 1.0 will freeze is already drafted (see "Path to
1.0" below); the deferral is about the level of external signal
required to commit, not about the spec being incomplete.

## During 0.x

- Spec breaking changes are documented in the affected ADR(s) and reflected in the conformance corpus before the next minor release.
- The reference implementation (`xl3` on npm) follows SemVer for its own API; spec breakages bump the spec minor version.
- Implementations should declare which spec version they target (e.g., `XTL 0.2 partial`, `XTL 0.3 full`).

## At 1.0

- The spec freezes for backwards-compatible evolution only.
- Breaking spec changes require XTL 2.0 with public discussion and a migration guide.
- The reference implementation follows SemVer strictly.

## Path to 1.0

The 1.0 cut closes XTL's first portability contract. The intent is
that any conforming implementation produces identical output (Stage
1) and identical canonical OOXML (Stage 2) for the frozen fixture
corpus, on any host timezone, locale, or byte order.

### Public API surface (xl3 reference impl)

The TypeScript reference impl freezes the following 15 runtime
exports at 1.0 (13 through 0.10.0, plus `convertJson` / `previewJson`
added in 0.11.0 per ADR-0075). Adding a new export is backwards-compatible;
removing or renaming any of them is a 2.0-only change.

**Conversion entry points**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `convertJson(template, sourceJson, options?) → Promise<OutputFile[]>` (ADR-0075)
- `previewJson(template, sourceJson, options?) → Promise<PreviewResult>` (ADR-0075)
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**Lower-level helpers**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook, configVars?) → InputSpec[]` (the
  optional `configVars` argument was added in 0.6.0 per ADR-0050;
  one-argument calls remain valid)
- `batchMatch(...)` — file-pattern matching helper
- `toTemplateModel(parsed) → TemplateModel`

**Error helpers (ADR-0015)**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**Stable type re-exports** — frozen at 1.0:
`TemplateMeta`, `TemplateModel`, `OutputFile`, `PreviewResult`,
`PreviewSource`, `PreviewFile`, `PreviewSheet`, `ConvertOptions`,
`InputSpec`, `InputType`, `SourceSpec`, `XtlError`, `XtlErrorCode`,
`XtlWarning`, `XtlWarningCode`.

**Additive changes log.** ROADMAP gates G3 and G6 allow additions and
require them recorded here. Adding an optional option property or an
error code is backwards-compatible; removing, renaming, or re-signing
one is 2.0-only and resets both gates.

| Added | Change | Reference |
|---|---|---|
| 0.6.0 | `readInputsSheet` optional `configVars` argument | ADR-0050 |
| 0.11.0 | `convertJson`, `previewJson` exports | ADR-0075 |
| 0.11.0 | `xl3/source-json/invalid` error code | ADR-0075 |
| unreleased | `ConvertOptions.signal` (`AbortSignal`) | ROADMAP G21, `spec/evaluation.md` "AbortSignal" |
| unreleased | `xl3/abort/cancelled` error code | ROADMAP G21 |

The export count is unchanged by the G21 work — `signal` is a property on
the already-frozen `ConvertOptions`, not a new export.

**Experimental type re-exports** (ROADMAP G22) — exported for
tooling, but their shape MAY change between minor versions:
`ParsedTemplate`, `SheetTemplate`, `TemplateVariable`, `DataBlock`,
`Directive`, `FilterDirective`, `FilterOp`, `SortDirective`,
`TopDirective`, `RepeatDirective`, `SourceDirective`,
`JoinDirective`.

Each experimental type carries an `@experimental` JSDoc tag. Hosts
that hold one of these objects SHOULD dispatch on `kind` (for
directives) or treat the shape as opaque, and SHOULD pin a specific
xl3 minor version if they rely on a particular field set. The
serializable, slower-moving alternative for most tooling needs is
`TemplateModel` (returned by `analyzeModel`).

The snapshot test in `impl/js/src/__tests__/api-surface.test.ts` pins the
runtime list and fails CI on silent changes. New exports require
deliberately updating the snapshot AND a CHANGELOG entry.

### What 1.0 freezes

Surface area covered by the following ADRs is part of the 1.0
contract. Breaking changes require an XTL 2.0 cut.

- ADR-0001 — `TODAY()` UTC semantics
- ADR-0002 — output filename sanitization
- ADR-0003 — numFmt-driven coercion
- ADR-0005 — dynamic conformance assertion protocol
- ADR-0006 — Stage 2 canonical OOXML comparison (rules 1-8 + the
  amendment listing the gap items)
- ADR-0007 — empty-value predicate
- ADR-0008 — truthiness rules
- ADR-0009 + ADR-0017 — comparison algorithm and source value
  model (read together as one contract)
- ADR-0010 + ADR-0011 — runtime inputs and reserved sheet naming
- ADR-0012 — multi-source data model
- ADR-0013 — XLOOKUP cross-source lookup
- ADR-0014 — `@join` block-level pairing (single inner join,
  deterministic first-match)
- ADR-0015 — structured error reporting (`xl3/...` codes + English
  conformance messages)
- ADR-0016 — ordering and sort stability
- ADR-0033 — merged-cell source headers
- ADR-0035 — data-row merge-cell broadcast
- ADR-0036 — template feature preservation matrix
- ADR-0038 — `@group` + `@subtotal` directives (interleaved
  subtotal emission)
- ADR-0039 — `HYPERLINK` cell output
- ADR-0040 — preservation matrix amendment (outline level shipped;
  CF/DV range PE pending 0.6.1)
- ADR-0041 — multi-line cell text contract
- ADR-0044 — function batch (UPPER, LOWER, TRIM, IFERROR, IFS, DATE)
- ADR-0046 — cell formula preservation (OOXML element contract)
- ADR-0047 — `ISBLANK` as `IFEMPTY` alias
- ADR-0050 — `__inputs__` `default`/`label`/`description`/`options`
  as XTL templates
- ADR-0051 — `{{ ... }}` block delimiter boundary + unbalanced-
  literal detection
- ADR-0052 — Single-expression vs. mixed-text cell classification
  (trim then anchored match; adjacent blocks always mixed-text)
- ADR-0053 — Mixed-text propagation of Excel error sentinels
- ADR-0054 — Bare names in cells / file / sheet patterns
  (shorthand resolution + `xl3/expression/unknown-name`)
- ADR-0055 — `@top` / `@repeat right` positive-integer grammar
- ADR-0056 — `__config__[system-key]` read policy
- ADR-0057 — `__lists__[name]` outside `@filter in/!in` rejection
- ADR-0058 — `@subtotal` row composition (same-row level binding)
- ADR-0059 — Aggregate argument shape (column ref only)
- ADR-0060 — `XLOOKUP` value / fallback arg rules (lazy fallback)
- ADR-0061 — Source-name vs. function-name lexical
  disambiguation (preserves ADR-0024 extension pass-through)
- ADR-0062 — `__inputs__` `default = ""` semantics
- ADR-0063 — `__inputs__` `options` pipe-split rules
- ADR-0064 — String→number coercion scope (scientific notation
  accepted; hex / binary / octal rejected)
- ADR-0065 — `@source default` explicit form + source-name case
  sensitivity
- ADR-0021 (group-order amendment) — group order under non-
  matching `@sort` is implementation-defined
- ADR-0041 (header amendment) — header-cell newline normalization

ADR-0043 and ADR-0048 are **process-normative** — they bind future
ADR authors but not the runtime contract. ADR-0034 and ADR-0049 are
informational. ADR-0004 is informational (reference-impl coupling
audit). ADR-0037, ADR-0042, ADR-0045 are rejected (rejection IS the
contract).

### What 1.0 does NOT include

The following are intentionally deferred. Adding them is
backwards-compatible and does not require a new spec major.

- Multiple `@join` directives in a single block, `@join … left`
  semantics, multi-row joined matches (ADR-0014 explicit
  out-of-scope list).
- XLOOKUP wildcard, approximate, and reverse-search modes
  (ADR-0013 explicit out-of-scope list).
- Locale-aware string collation. Sort uses Unicode code-point
  order; hosts that need locale collation pre-sort upstream.
- Date/datetime arithmetic functions (no `EOMONTH`, `EDATE`,
  `DATEDIF`, etc.).
- Cross-writer canonicalization for the gap items in ADR-0006
  amendment (default attribute equivalence, color hex case,
  namespace prefix bindings).
- A normative wire format for inputs, sources, or outputs beyond
  the host API surface in ADR-0010 / ADR-0012.

### Conformance baseline

The 1.0 conformance corpus is the union of fixtures tagged with
`spec_version: "0.1"` plus any added before the 1.0 cut. The corpus
must pass:

1. Stage 1 cell-value comparison.
2. Stage 2 canonical OOXML comparison for fixtures declaring
   `comparison_stage: 2`.
3. Stage 1 under at least three timezones (`UTC`,
   `America/New_York`, `Asia/Seoul`) — the reference repo's CI
   workflow runs this matrix; ports SHOULD do the same.

A 1.0-claiming implementation MUST report its conformance run
against this corpus and MUST NOT skip fixtures except those
declared at a higher comparison stage than its runner supports.

## Core vs. extensions

The spec distinguishes:

- **Core** — language features required for conformance. Summarized in [`README.md`](./README.md) and defined in [`language.md`](./language.md) and [`evaluation.md`](./evaluation.md). Breaking changes here are spec-version events.
- **Extensions** — implementation-specific or domain-specific additions. May vary across implementations. Documented in implementation READMEs, not in the spec.

Implementations MAY add extensions but MUST NOT silently change core semantics.

For example, implementations may support additional `TEXT()` formats beyond the
XTL 0.1 core table. Such formats are extensions: portable templates should not
depend on them, and conformance fixtures do not require identical output for
them.

## Conformance corpus versioning

The conformance corpus version tracks the spec version. A fixture added in spec 0.3 is tagged accordingly; implementations declare which fixtures they pass and, in turn, which spec version they conform to.

## Deprecation policy (post-1.0)

When a feature is to be removed in a future major version:

1. The feature is marked **deprecated** in the spec for at least one minor version before removal.
2. Conformance fixtures using the deprecated feature gain a `deprecated` tag.
3. Implementations are encouraged to emit warnings when the deprecated feature is used.
4. Removal happens in the next major (e.g., deprecated in 1.3 → removed in 2.0).
