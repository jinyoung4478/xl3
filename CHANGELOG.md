# Changelog

All notable changes to xl3 are documented here. The npm package follows
[Semantic Versioning](https://semver.org/). The XTL language version is tracked
separately in [spec/STABILITY.md](./spec/STABILITY.md).

## [Unreleased]

## [0.13.0] - 2026-08-12

A host can now ask which engine is loaded. `VERSION` and
`getEngineInfo()` answer "which xl3 produced this output?" and "is the
optional wasm backend actually in use?" from inside the process — two
questions that had no runtime route at all, which left consumers reading
`node_modules/@xl3-lang/xl3/package.json` off disk at build time to
reconstruct the first one.

### Added

- **`VERSION` and `getEngineInfo()` — which xl3 is loaded, at runtime**
  (#103). A host that gets "this conversion looks wrong" is always asked
  which version produced it, and there was no way to answer from inside
  the process: the main entry exported no version, `version.ts` holds
  semver *helpers* only, and `exports` did not expose `./package.json`,
  so the only route left was reading
  `node_modules/@xl3-lang/xl3/package.json` off disk and injecting it at
  build time — a hardcoded path into another package's internals.

  ```ts
  import { VERSION, getEngineInfo } from '@xl3-lang/xl3';
  console.info(`xl3 v${VERSION}`);
  const { backend } = await getEngineInfo(); // 'wasm' | 'js'
  ```

  `getEngineInfo()` also answers the second question that had no runtime
  route — whether the optional `xl3-wasm` dependency is actually being
  used, which matters when a bundler is configured to exclude it. It is
  async because that dependency resolves through a runtime `import()`;
  the probe is cached, and an `engine: 'auto'` conversion pays the same
  cost anyway. It reports which backend is *available*, not which one
  ran: `'auto'` still falls back per-call on templates outside the wasm
  engine's support matrix.

  `VERSION` comes from `src/pkg-version.ts`, generated from
  `package.json` by `scripts/gen-version.mjs` (`npm run sync:version`)
  and committed. Generated rather than read at runtime because neither
  build path can read the manifest: `tsc` has no `define`, and the
  browser IIFE bundle has no `package.json` at all. Committed rather
  than git-ignored so `npm run typecheck` and `npm test` work on a fresh
  clone; `src/__tests__/pkg-version.test.ts` fails if the constant and
  the manifest disagree. The `xl3` CLI's `--version` now reads the same
  constant instead of resolving `package.json` relative to `dist/bin/`.

  Additive: the frozen export surface goes 15 → 17 (recorded in
  `spec/STABILITY.md`), no existing export is removed or re-signed, and
  no error code changes — so ROADMAP gates G3/G6 and the G24 quarter
  clock are undisturbed.

  Not done, deliberately: `exports: { "./package.json": ... }` (option B
  in the issue). Once `VERSION` exists it buys nothing, and it would add
  a resolvable subpath whose consumers must each configure JSON imports.

## [0.12.0] - 2026-08-02

Renders are now reproducible down to the bytes, and any language can drive
one: the new `xl3` CLI takes the JSON source format on stdin and writes
`.xlsx` files, so a JVM or Python service no longer needs a JS runtime — or
a throwaway `data.xlsx` — to render a template.

### Added

- **`xl3` CLI** — `xl3 render <template.xlsx> --data=<source.json|source.xlsx|->`
  writes output files; `xl3 preview` reports filenames, source shape, and
  warnings without writing; `xl3 inputs` lists a template's declared runtime
  inputs. Options: `--out`, `--zip`, `--input=k=v`, `--inputs=<path|->`,
  `--engine`, `--json`, `--quiet`. Exit codes separate the failure modes a
  caller handles differently — `2` usage, `1` conversion (carrying the stable
  `error.code`, as JSON under `--json`), `0` success. `--data=-` reads
  `xl3-source-json/0.1` on stdin, which is the path a non-JS host takes.
  Additive: no export, error-code, or API-surface change.

### Fixed

- **Output is byte-reproducible.** Rendering identical inputs twice produced
  different bytes whenever the two renders crossed a DOS-timestamp tick:
  ExcelJS appends zip entries without a date, so the zip layer stamped the
  current clock on each one. Entry dates are now pinned to 1980-01-01, and
  `packageZip` pins the archive's entries for the same reason. Document
  timestamps in `docProps/core.xml` are untouched — they come from the
  template and are preserved workbook properties (ADR-0032).

  **Output bytes therefore differ from 0.11.0 for identical inputs, while
  the workbook content does not.** Golden-file tests written against 0.11.0
  output need re-baselining; conformance is unaffected, because Stage 1
  compares cell values and Stage 2 compares canonicalized parts, and neither
  reads zip mtimes. Cost is a zip header rewrite — 2 ms at 10k cells, 7 ms
  at 500k — and `bench` moved 220→229 ms on one scenario, well under
  BENCH.md's investigation threshold.

  This makes the "same inputs, same bytes" claim in ADR-0075 and Cookbook 19
  literally true rather than true of the content only.

### Documentation

- **Cookbook 19 (JXLS → xl3)** told a JVM team to export whatever they
  `putVar`'d into a second `.xlsx` — the cost ADR-0075 removed in 0.11.0.
  The comparison table and migration checklist now name the JSON route, and
  a new "Staying on the JVM" section covers calling the CLI from Java with
  `ProcessBuilder`, including exit-code handling. All four locales.
- **ADR-0048 axis 5** ("XLSX in, XLSX out") predated ADR-0075. Amended in
  place to "XLSX or `xl3-source-json/0.1` in, XLSX out", recording what the
  amendment does not change: external I/O stays the host's responsibility,
  the template stays `.xlsx`, output stays XLSX only, and the out-of-scope
  input list (XLSB, XLS, XLTX, CSV) is unchanged.
- **Support matrix** (`/support-matrix`) — a plain-language reading of what
  survives a conversion and what does not, distilled from ADR-0036,
  ADR-0076, ADR-0032, ADR-0046, and SECURITY.md, with the deferred
  features' measured behavior and the size limits.
- Homepage now leads with the concrete promise rather than with xl3's
  status as an open standard, and three stale ADR/fixture counts were
  corrected (75/160 and 70/154 against a 77/169 corpus). A new test
  checks every published count against the repo so they cannot drift again.

## [0.11.0] - 2026-07-19

### Added

- **JSON source input (`xl3-source-json/0.1`)** — new `convertJson` and
  `previewJson` entry points accept a language-neutral JSON source instead
  of a `data.xlsx`, so non-Excel hosts (Python, DB/ETL services) skip the
  workbook round-trip (ADR-0075, #71). A JSON source renders identically to
  the equivalent `data.xlsx`; the wire format is portable across
  implementations. Malformed input raises the new `xl3/source-json/invalid`
  error code. Additive — `convert` / `preview` / the `.xlsx` path are
  unchanged.

## [0.10.0] - 2026-07-19

Repository transferred to the **xl3-lang** GitHub organization and the npm
package renamed **`@jinyoung4478/xl3` → `@xl3-lang/xl3`** (install name only;
public API, subpath exports, and the `xl3-conformance` bin are unchanged).
Also folds in `@subtotal` correctness fixes: the silent-demotion and
explicit-`@block` gaps now raise dedicated, actionable errors.

### Changed

- **Package renamed `@jinyoung4478/xl3` → `@xl3-lang/xl3`.** The npm scope
  now matches the `xl3-lang` GitHub organization the repository was
  transferred to. The public API, the CLI bin (`xl3-conformance`), and all
  behavior are unchanged — only the install name differs
  (`npm install @xl3-lang/xl3`). The old `@jinyoung4478/xl3` package is
  deprecated on npm with a pointer to the new name.

### Fixed

- **`@subtotal` rows no longer silently demote (#66, ADR-0073).** A
  `@subtotal` row that also carried a current-row `[Column]` reference
  outside an aggregate used to fall through to the data-row classifier
  and render the subtotal band after *every* data row with grand-total
  values — a spec violation with plausible-but-wrong output and no
  diagnostic. It now raises the dedicated **`xl3/subtotal/mixed-row`**
  error naming the offending cell. Bracket text inside a string literal
  (e.g. `{{ "Subtotal [Customer]" }}`) is correctly treated as literal
  text, not a current-row reference, so such labels remain valid.
- **A formula cell's cached result is no longer read as a template
  marker (#66, ADR-0073, amends ADR-0046).** `parser.ts` scanned a
  native formula's cached `<v>` result for `{{ … }}` markers, while the
  renderer never did — so a label formula whose cached value looked like
  a marker (a common Excel/LibreOffice round-trip artifact) could
  silently demote a `@subtotal` row. Marker/directive recognition now
  ignores formula cells entirely, matching the renderer and ADR-0046;
  such templates render correctly again with the formula preserved
  verbatim.
- **`@group`/`@subtotal` no longer silently drop in explicit `@block`
  mode (#69, ADR-0074).** The group + subtotal feature is wired only into
  implicit block detection; on a sheet using explicit `@block`
  declarations the subtotal band was silently omitted (no error, no
  rows). It now raises **`xl3/subtotal/explicit-block-unsupported`** at
  parse time. Implicit-mode group + subtotal is unaffected.

### Added

- **Error codes `xl3/subtotal/mixed-row`,
  `xl3/subtotal/explicit-block-unsupported`** (additive; no codes removed
  or renamed — G3 error-catalog gate unaffected).
- **Conformance fixtures 159 / 160 / 161** — the mixed-row error, the
  formula-cache-is-not-a-marker guarantee, and the explicit-block
  group/subtotal rejection.

## [0.9.0] - 2026-06-23

0.9.0 final. Adds the `xl3-wasm` acceleration path as an opt-in
dependency: when the WebAssembly package is installed, the engine
swaps in `xl3-rs`'s Rust core for the heavy parts of `convert` /
`preview`, falling back to the existing ExcelJS path otherwise. The
acceleration arrived in pieces (Phase 2 / 3 of `xl3-rs`'s `PLAN.md`);
this is the first xl3 cut that exposes it on the npm surface.

Folds in the rc-soak fixes — #50 (large-block call-stack overflow),
#52 (chained-arithmetic associativity), and the ADR-0066 ghost-style
restore — plus conformance fixtures pinning native-value preservation
(#49), grouped side cells (#51), and arithmetic associativity (#52).
The error-code catalog, public API surface, and `@stable` JSDoc
surface are unchanged from 0.8.0; the 1.0-freeze gates G3 / G6 / G7 /
G23 all ticked at this cut (see #48).

External users opting in to the acceleration:

```bash
npm install @xl3-lang/xl3 xl3-wasm
```

### Added

- **`engine: 'auto' | 'wasm' | 'js'` option** on `convert` and
  `preview` (default `'auto'`). `'auto'` tries the optional
  `xl3-wasm` dependency and silently falls back to the JS engine if
  it can't be loaded; `'wasm'` requires it and throws if missing;
  `'js'` skips the detection entirely. The wasm dependency is
  declared as an optional dynamic `import()` so consumers who don't
  install it keep the existing zero-overhead JS path.
- **`extractManifest(workbook)`** (`src/manifest.ts`) — produces the
  JSON style manifest the wasm engine consumes. Captures fonts,
  fills, alignment, per-cell numFmt, merge ranges, and column widths
  from the ExcelJS workbook so xl3-rs can reapply them on the Rust
  side without re-reading the template.
- **Conformance runner `--engine=auto|wasm|js` flag** (
  `xl3-conformance` CLI). Lets the runner exercise either path
  against the same fixtures — used by xl3-rs to measure parity
  (currently 119 / 148 fixtures pass under `--engine=wasm`).
- Conformance fixture `156-static-native-value-preservation` (#49):
  native number/boolean/date cells in static rows and outside-block
  cells must survive expansion as **typed** values, not text
  (`5500` ≠ `"5500"`). Splice-model engines get this for free (the
  OOXML cell survives untouched); compose-model implementations
  (xl3-wasm, xl3-py) re-emit every cell and must carry the native
  value through explicitly — xl3-py passed 148/148 for two releases
  while silently stringifying them. Corpus: 154 → 155 fixtures.
- Conformance fixture `157-group-block-side-cells` (#51): ADR-0066
  outside-block cells next to a `@group`/`@subtotal` block are emitted
  **exactly once** at their original (post-directive-removal) rows —
  never once per group. Pins the grouped side-summary layout the wasm
  core diverges on (xl3-rs#3): one side row lands inside group 1's
  output span, a second beyond the last subtotal row. Corpus:
  155 → 156 fixtures.
- Conformance fixture `158-chained-arithmetic-associativity` (#52):
  chained same-precedence arithmetic is LEFT-associative and `*`/`/`
  bind tighter than `+`/`-` (per `grammar.ebnf` `arith_expr`/`mul_expr`).
  `[a] / [b] * [c]` is `(a/b)*c`, not `a/(b*c)`. Data is chosen so the
  left- and right-associative groupings diverge. Corpus:
  156 → 157 fixtures.
- `conformance/runner-protocol.md`: Stage 1 value equality is now
  **normatively type-aware** — text never equals number/boolean/date
  even when display forms coincide; numeric equality is value-based
  (`1` = `1.0`); a runner that stringifies both sides before comparing
  MUST NOT claim Stage 1 conformance (#49).

### Fixed

- **#52 — chained arithmetic was evaluated right-associatively.**
  `findArithmeticOp` split on the FIRST operator and recursed
  rightward, so `a / b * c` was grouped `a / (b * c)` instead of
  `(a / b) * c`; in the function-argument path the rest of the chain
  leaked through as a raw operand. A 거래명세서 VAT cell
  (`[Total] / 1.1 * 0.1`) was silently mis-scaled ~100x (188 →
  18,764). Replaced with a precedence-aware, left-associative chain
  parser matching `grammar.ebnf` (`arith_expr` / `mul_expr`): `*`/`/`
  bind tighter than `+`/`-`, same-precedence operators fold left. Also
  normalizes `Source[Column]` / `__config__[key]` arithmetic operands,
  `(a + b) * c` grouping, and redundant parentheses wrapping a whole
  expression or value argument (`{{ ([a] + [b]) }}`, `IF(c, ([a] +
  [b]), 0)`) — previously these leaked through unnormalized. JS impl
  bug fix; no public API, spec, or error-code change.
- **#50 — `RangeError: Maximum call stack size exceeded` on 80k+ row
  blocks.** `spliceRows(start, del, ...rows)` spread the whole
  expansion as call arguments, hitting the engine's argument-count /
  stack limit (production report: 84,706 rows; measured locally:
  direct spread OK at 100k, crash at 150k — threshold depends on
  remaining stack). Rows are now inserted in bounded 2,000-row chunks
  (first chunk through `spliceRows` with the deleteCount, ascending
  tail chunks through `insertRows`); merge and outline preservation
  are unaffected. A 160k-row block that crashed before renders in
  ~3.1s. JS engine only; internal interface change, no public API
  impact.
- ADR-0066 column-scoped blocks: outside-block cells shifted by the
  expansion splice left their borders/fills behind at the shifted
  position (the restore pass cleared only the value). Large expansions
  rendered an empty, fully-bordered ghost copy of the side summary
  block below the data. The shifted cell's style is now wiped along
  with its value, in both the plain and `@group`/`@subtotal` render
  paths. (JS engine only — the wasm core composes rows and was never
  affected.)
- **wasm-bridge: Node-host init.** The web-target wasm-pack glue's
  auto-init calls `fetch(file://…)`, which Node refuses. The bridge
  now detects Node, reads the `.wasm` bytes via
  `require.resolve('xl3-wasm')`, and feeds them into
  `default({ module_or_path: bytes })`. Browser path unchanged.
- **wasm-bridge: error-code propagation.** The Rust core formats
  errors as `[xl3/<ns>/<name>] message` when an `XtlError` is
  raised, but the wasm boundary previously only carried the
  string — JS callers got a bare `Error` with no `.code`. The
  bridge now strips the bracket prefix and stamps the code back
  onto the thrown JS `Error` so the conformance runner and host
  catch sites can branch on it (ADR-0015).

## [0.8.0] - 2026-05-23

0.8.0 batch. Two-part data-block design overhaul: Phase 1 (ADR-0066)
moves the block's row-wide assumption to column-scoped detection
with outside-cell preservation; Phase 2 (ADRs 0067-0069) adds the
`@block` directive, strict multi-block detection per sheet, and
per-block directive scoping by proximity. Closes issues #46 (silent
data loss from duplicate shared-formula owners on production
templates) and #47 (formula reference staleness in shifted side
cells) by construction. Conformance corpus: 139 → 155 fixtures.

### Added

- **ADRs 0067 / 0068 / 0069 — Phase 2 multi-block per sheet.**
  - `@block` directive with three grammar forms (bare, col-range
    `A:D`, full-rect `A2:D7`) for explicit data block declaration
    (ADR-0067).
  - Multi-block detection in strict mode (ADR-0068): a sheet with
    any `@block` directive must place ALL `[Column]` cells inside
    some `@block` rectangle; mixed implicit/explicit modes are
    forbidden. Block rectangles must not overlap.
  - Per-block directive scoping by proximity (ADR-0069):
    `@filter`/`@sort`/`@top`/`@source`/`@join`/`@group`/`@repeat`
    attach to the closest data block whose column range overlaps
    the directive's column. Orphan directives raise
    `xl3/directive/orphan`.
- Conformance fixtures 146-155 covering multi-block, side-by-side
  blocks with different sources, vertically stacked blocks,
  per-block filter, per-block `ROW()` scoping, and the three new
  error paths.
- Three new error codes (G3 clock resets along with ADR-0066's
  addition): `xl3/block/overlap`, `xl3/block/empty-table`,
  `xl3/directive/orphan`.
- spec/language.md "Directives" section extended with `@block`
  grammar, mode-determination rules, and the proximity scoping
  algorithm.

- **ADR-0066 — column-scoped data block.** The data block's column
  range is now the bounding box of `{{...}}` marker cells extended
  outward through contiguous non-empty cells. Cells outside this
  range are *outside cells* — preserved at their original row
  positions, never cloned per record, never shifted by the splice
  row insertion. Adjacent native Excel formulas or static values
  inside the bracket-expression hull are still cloned per ADR-0046.
- Conformance fixtures `141-block-column-scoped-side-cells`,
  `142-block-column-scoped-side-formulas`,
  `143-block-shared-formula-side-cells`,
  `144-block-side-cells-after-block`,
  `145-block-bracket-outside-error` exercise the new contract and
  the parse-time multi-cluster error.
- Corpus is now **145 fixtures** (139 → 145, +5 ADR-0066, +1 #46
  regression — closes ROADMAP G1's `≥ 140 fixtures` floor).
- `conformance-runner` `comparable()` helper now handles
  `{ sharedFormula: '<owner>' }` cells via a stable string form so
  structurally-equal slaves match in cell-level diff.
- New error code `xl3/expression/bracket-outside-block` raised at
  parse time when a sheet has two or more disconnected `[Column]`
  clusters (single-block-per-sheet enforcement at 0.x; multi-block
  via `@block` directive deferred to Phase 2).
- Spec language.md "Data Blocks" section added with the normative
  block definition; evaluation.md "Render Phases" extended with the
  column-scoped splice + outside-cell restore contract.
- ROADMAP G1 marked DONE (`≥ 140 conformance fixtures`).

### Fixed

- **#46 — silent data loss from duplicate shared-formula owners.** When a
  template row carried an OOXML shared-formula owner cell (`{ formula,
  ref, shareType: 'shared' }`) inside or alongside the data block,
  `renderDataRows` cloned the row verbatim into the N expanded rows —
  producing N independent "owners" all claiming the same `ref` range.
  Excel saw the result as corrupt OOXML and either dropped cells or
  surfaced a repair dialog, surfacing to users as "side cells
  disappeared" / "report came out broken". The renderer now normalizes
  shared formulas to standalone `{ formula }` at capture time (owners
  drop `ref`/`shareType`; slaves resolve to the owner's formula text)
  so each expanded row carries an independent formula and ExcelJS
  re-derives the shared range during writeBuffer.
- The fix applies to both the legacy `renderDataRows` path and the
  `@group`/`@subtotal` `renderGroupedDataRows` path.

## [0.7.0] - 2026-05-22

0.7.0 batch. Spec-side audit closing 17 syntactic-conflict gaps
across the lexer, cell-classification, directive composition,
aggregate args, and reserved-sheet surfaces. 15 new ADRs (0051–
0065) plus amendments to ADR-0021 and ADR-0041. Reviewed in
parallel by claude-general (consistency) and codex (spec design).
XTL stays at 0.1 — these ADRs pin previously-impl-defined or
silent-fallthrough shapes as normative without expanding the
language surface.

### Added

- **ADR-0051** — `{{ ... }}` block delimiter rule: first `}}`
  closes; unbalanced string literal raises
  `xl3/parser/unbalanced-literal` (supersedes ADR-0028's impl-
  defined unbalanced-quote stance).
- **ADR-0052** — Single-expression vs. mixed-text classification:
  cell text is trimmed before matching; adjacent blocks
  (`{{ A }}{{ B }}`) are always mixed-text.
- **ADR-0053** — Source-side error sentinels (`#N/A`, `#VALUE!`,
  `#REF!`, `#NAME?`, `#NUM!`, `#NULL!`) flow as empty in all
  positions; first-encounter warning is normative MUST.
- **ADR-0054** — Bare names in data cells resolve via group-key /
  inputs / config shorthand; column refs MUST use `[Column]`.
  Adds `xl3/expression/unknown-name`.
- **ADR-0055** — `@top` and `@repeat right` require positive
  integers (≥1, no leading zeros); new `positive_integer`
  grammar production.
- **ADR-0056** — `__config__[system-key]` read is legal; only the
  declaration side has the system-name restriction.
- **ADR-0057** — `__lists__[name]` outside `@filter in/!in`
  raises `xl3/lists/invalid-use`.
- **ADR-0058** — Multiple `@subtotal` expressions on one row
  share the row's single nesting-level binding; mixed-level on
  one row is unsupported.
- **ADR-0059** — Aggregate arguments MUST be column refs; new
  `xl3/eval/bad-aggregate-arg`.
- **ADR-0060** — `XLOOKUP` value/fallback args follow the
  active-source rule; fallback evaluation is lazy.
- **ADR-0061** — Lexical disambiguation between `Source[` and
  `Source(`; ADR-0024's extension pass-through preserved.
- **ADR-0062** — `__inputs__` `default = ""` (or any empty
  post-evaluation value) means required.
- **ADR-0063** — `__inputs__` `options` trim + drop empties;
  duplicates preserved; empty-option intentionally inexpressible.
- **ADR-0064** — String→number coercion accepts scientific
  notation; hex / binary / octal prefixes rejected per
  Excel-default principle.
- **ADR-0065** — `@source default` explicit form is legal;
  source-name arguments are case-sensitive.
- **ADR-0021 amendment** — Group order with non-matching `@sort`
  keys is implementation-defined (catalog entry); reference impl
  uses encounter order.
- **ADR-0041 amendment** — Header cells normalize CRLF/CR/LF to
  a single space at read time; data cells preserve LF unchanged.
- Grammar additions: `positive_integer`, `non_zero_digit`,
  `group_directive`, `subtotal_directive`, `aggregate_call`,
  `aggregate_name`, `aggregate_arg`; lexical-disambiguation note.

### Error codes (4 new)

- `xl3/parser/unbalanced-literal` (ADR-0051)
- `xl3/lists/invalid-use` (ADR-0057)
- `xl3/eval/bad-aggregate-arg` (ADR-0059)
- `xl3/expression/unknown-name` (ADR-0054)

All append-only per ADR-0015.

### Changed

- `src/directive-parser.ts` — `parseTop` and `parseRepeat` add a
  shape pre-check (`/^[1-9][0-9]*$/`) rejecting leading zeros
  before `parseInt`. Previously `@top 05` parsed as 5; now raises
  `xl3/directive/invalid-syntax`.

### Breaking (narrow)

- `@top 05` / `@repeat right 05` (leading-zero directives) — now
  parse error. No production template observed using this shape.
- A cell of `  {{ [Amount] }}` (leading/trailing whitespace
  around a single block) is now a single-expression cell — numFmt
  coercion applies (per ADR-0052). Previously this was silently
  mixed-text. Behavior change is more user-helpful; no fixture
  affected.
- `SUM(literal)` / `SUM([a] + [b])` and similar non-column-ref
  aggregate arguments now raise `xl3/eval/bad-aggregate-arg`.
  Previously silently produced `literal * row_count`.
- `{{ __lists__[x] }}` (list reference outside `@filter in/!in`)
  now raises `xl3/lists/invalid-use`. Previously stringified to
  the underlying array representation.
- String coercion of `"0x10"`, `"0b101"`, `"0o17"` now raises
  `xl3/eval/operand-coercion`. Previously silently parsed via
  JavaScript `Number()`. Scientific notation (`"1e5"`) remains
  accepted.

## [0.6.0] - 2026-05-18

0.6.0 batch. Spec-side work (13 new ADRs from 0038 through 0050)
plus the runtime support, governance, and docs that 1.0 needs to
land cleanly. No 1.0 freeze yet — this batch is the audit pass that
makes the function surface, error catalog, and decision pipeline
review-ready. Reference impl is unchanged for correct templates
except where called out under **Breaking**.

### Added

- **ADR-0038** — `@group` / `@subtotal` directive accepted in spec
  (impl deferred to 0.6.0; tracked as gate G5 in ROADMAP).
- **ADR-0039** — `HYPERLINK(url, label)` function (renderer unwraps
  to ExcelJS `{ text, hyperlink }`; canonical stringification yields
  the visible label).
- **ADR-0040** — Preservation matrix amendment: CF / DV `sqref`
  range extension (impl-pending, gate G5) and **row outline-level**
  (now shipped in `spliceRowsPreservingMerges`, this release).
- **ADR-0041** — Multi-line cell text contract (`\n` preserved
  verbatim; wrap behavior author-controlled).
- **ADR-0042** — Rejected: runtime cell mutation. Rejection IS the
  contract; recorded for traceability.
- **ADR-0043** — Excel-native preference principle (process-
  normative). New gate on function additions: a function lives in
  XTL only when evaluation must happen before rendering.
- **ADR-0044** — Function batch accepted: `UPPER`, `LOWER`, `TRIM`,
  `IFERROR`, `IFS`, `DATE(y, m, d)`.
- **ADR-0045** — Function batch rejected: `SQRT`, `POWER`, `MOD`,
  `INT`, `ISNUMBER`, `ISTEXT`, `ISERROR`, `NOW`, `WEEKDAY`,
  `WEEKNUM`, `NETWORKDAYS`, `SUMIF`, `COUNTIF`, `AVERAGEIF`, and
  proposed TEXT() format-token expansions.
- **ADR-0046** — Cell formula preservation contract (rewritten in
  OOXML element terms: `<f>` and `<v>`). Cross-impl mapping section
  shows how ExcelJS- and openpyxl-shaped values translate to the
  same normative form.
- **ADR-0047** — `ISBLANK(value)` as `IFEMPTY` alias (inconvenience
  carve-out: canonical Excel entry point).
- **ADR-0048** — Final JXLS-boundary ADR (process-normative). Seven-
  axis divergence table + the *inconvenience carve-out* refining
  ADR-0043's gate + grandfather rule for pre-0048 functions.
- **ADR-0049** — Template-display vs render-output asymmetry
  (informational): templates are review artifacts, output is the
  audit artifact.
- **ADR-0050** — `__inputs__` `default` / `label` / `description` /
  `options` cells accept XTL templates. Evaluated at input-read time
  against a constrained context (`__config__` + pure scalar
  functions). Two new error codes (append-only per ADR-0015):
  `xl3/inputs/forward-reference`, `xl3/inputs/runtime-only-fn`.
- **`process-normative`** ADR status added to `0000-template.md` for
  ADRs that bind the ADR pipeline (not runtime impl).
- **`spec/README.md` + `PORTERS_GUIDE.md`** precedence sections
  harmonized: spec prose > conformance fixtures > implementations.
- **`ROADMAP.md`** single-source-of-truth gate table (G1-G24) with
  owner / artifact / criterion / fallback / target. Per-version
  step plan (0.6.0 → 1.0.0) is gate-based, not date-based.
- **Testable definitions** in ROADMAP: "external contributor",
  "breaking change", "critical bug fix", "data-loss test", "quarter
  clock start". Mirrored in `docs/internal/blueprint-to-1.0.md`.
- **`GOVERNANCE.md`** drafted (single-maintainer phase explicitly
  scoped; ADR pipeline + status-flip rules).
- **`docs/llm-template-authoring.md`** Footer escape hatch section:
  when to drop down to native Excel formulas in footer cells, the
  SUMPRODUCT pattern for "sum of A × B", and the self-column-SUM
  circular-reference pitfall.
- **Cookbook 16** — "XTL function vs Excel formula" recipe with
  ✅ / ⚠️ / ❌ markers per case.
- **Cookbook 17** — "Template-authoring display" recipe (matches
  ADR-0049).
- **Cookbook 06** — "Computed defaults and labels" section
  documenting ADR-0050 input-read-time evaluation.
- **Korean i18n** — Docusaurus `/ko/` routing + 15 cookbook recipes
  translated. README intro refreshed (en + ko) for the 0.5.x
  position.
- **Conformance fixtures 124-140** — merged source headers,
  hyperlink, date arithmetic, multiline cell text, function batch
  0044, cell-formula preservation, ISBLANK, `__inputs__` XTL
  evaluation, `@group` / `@subtotal` (single-level subtotal,
  two-level nested subtotal, grand-total-via-outermost-subtotal,
  filter composition), and negative-path coverage (136-140) for
  the five new error codes from ADR-0038 + ADR-0050.
- **`@group [Key1], [Key2], …` and `@subtotal SUM([Col])`** —
  interleaved per-customer / per-month subtotal rows in a single
  data block (ADR-0038 impl). Closes ROADMAP gate G5 partial (the
  ADR-0040 CF/DV range-extension piece remains 0.6.1). Cookbook 18
  (en + ko) walks through single-level + nested + grand-total +
  filter-composition patterns.
- **Stage 2 OOXML conformance in CI (ROADMAP G11).** New
  `npm run conformance:stage2` script + `.github/workflows/ci.yml`
  step. Every PR now exercises the 6 Stage 2 fixtures (merge /
  outline-level / styles) on top of the 128 Stage 1 fixtures —
  130/130 → 134/134 fixtures pass under both stages.
- **`SECURITY.md` (ROADMAP G20 draft).** Threat model, attack-class
  stance table, hardening checklist for host integrators, and the
  jykim@snack24h.com reporting path.
- **Resource-limit + AbortSignal stance (ROADMAP G21 draft).**
  `spec/evaluation.md` "Resource limits" split into spec-level
  implementation-defined stance + reference-impl `xl3-js` limit
  table. Streaming explicitly deferred to 1.1+; `AbortSignal` hook
  planned for 0.7-0.8 with stable `xl3/abort/cancelled` code.

### Fixed

- **`spliceRowsPreservingMerges`** now preserves `outlineLevel` on
  rows shifted by `@repeat` expansion. Previously only
  `cloneWorksheet` carried outline level, so non-grouped templates
  silently dropped it (visible in Stage 2 OOXML diff). Matches
  ADR-0040 preservation matrix entry P.
- **IFS normalizer** recurses into function-call conditions; the
  documented `IFS(c1, v1, ..., TRUE, default)` idiom previously
  worked only by accident when `TRUE` was a non-empty truthy string.
- **TRIM** honors ADR-0007's zero-width carve-out (`U+200B`,
  `U+FEFF`) — Excel-native `.trim()` would silently strip them.
- **Bare TRUE/FALSE literals** recognized case-insensitively
  (matches Excel semantics; documents prior accidental success).
- **Conformance runner** handles hyperlink and formula objects in
  `comparable()` cell stringification (previously stringified to
  `[object Object]`).
- **Site:** logo aspect ratio preserved (square-padded favicon);
  external-link arrows hidden on navbar GitHub/npm items; language
  icon next to locale dropdown removed; unused `RESULT_PREVIEW`
  workbook constant removed; result card readability improved.

### Breaking (0.6 only)

> Each item below is an *intentional* behavior change relative to
> 0.5.x. None affect correct templates that did not rely on the
> prior surprising behavior.

- **ADR-0050: `__inputs__` cells with closed `{{ ... }}` blocks now
  evaluate as expressions.** If a template was authored with the
  curly braces intended as literal text in the `default`, `label`,
  `description`, or `options` columns, the cell now throws or
  evaluates differently. Migration: most authors will not be
  affected — the prior literal-passthrough behavior left the host
  UI showing `{{ TODAY() }}` verbatim, which was uniformly reported
  as a bug. If you have a genuine literal need, split the curly
  braces across two cells or post-process in the host.
- **Status `accepted (informational + process-level normative)`
  retired in favor of the new `process-normative` status.** Any
  external port referencing the old phrasing should update.

### Changed

- **`readInputsSheet(workbook, configVars?)`** — optional second
  parameter for ADR-0050 evaluation. Calling with one argument
  keeps existing behavior for templates that don't use `{{ ... }}`
  in input cells. Frozen at 1.0.
- **`INFORMATIONAL_ADRS`** exclusion list in spec-coverage test
  trimmed where fixtures landed; ADR-0040 comment updated to
  reflect the outline-level fix.

## [0.5.1] - 2026-05-17

Patch release closing the 0.5.0 reviewer punch-list (M1/M2/M3
code-quality items). No spec change; no behavioral change for
correct templates. The error message for a specific edge case
becomes more accurate.

### Fixed

- **`reader.ts` — type-safe column pair.** `readHeaders` now returns
  `Array<{header, col}>` instead of two parallel arrays + a non-null
  assertion. The header/column-number invariant is compile-enforced;
  the `columnMap[c]!` non-null assertion is gone (M1).
- **`reader.ts` — mis-targeted error message.** When a merged header
  cell's merge master is empty, the error message no longer says
  "sits inside a merged header but is not the master" (which only
  fires for horizontal slaves, already filtered earlier). It now
  says "is in a merged region whose master is empty", matching what
  actually happened (M2). New reader test pins the message.
- **`reader.ts` — dead branch removed.** ExcelJS guarantees
  `cell.master` is non-null (returns the cell itself for unmerged
  cells); the defensive `!master` check is removed and replaced
  with a comment explaining the contract (M3).

## [0.5.0] - 2026-05-17

JXLS-absorption batch. Four new ADRs (0034–0037) settle merged-cell
semantics on both header and data rows, pin the template feature
preservation contract, and record the project's working principle for
relating to prior-art template engines. The 0.5.0 hardening pass
resolves the spec-review critical items raised against ADR-0033 (the
ADR-0032 §#2 supersession, the 2D merge amendment, the user-doc
guidance gap). The XTL language version is unchanged (still 0.1 draft).

### Added

- **ADR-0033 — Merged source-table headers.** Horizontally-merged
  header cells now read as one logical column at the merge master.
  Slave cells in the same row are transparent: no column contribution,
  no `xl3/source/duplicate-name`. Vertical merges in the header row
  read the master's text at the slave's column. Real Korean invoice
  templates (거래명세서, 정산서) become readable as-is.
- **ADR-0034 — Relationship to prior-art template engines
  (informational).** Names the working principle: borrow JXLS's
  experience, not its syntax. Three corollaries for future ADRs.
- **ADR-0035 — Data-row merged cell semantics.** Pins
  broadcast-master-to-slaves for both vertical and horizontal merges
  in source data rows. A vertical merge spanning N rows yields N data
  rows sharing the master's value.
- **ADR-0036 — Template feature preservation matrix.** Replaces
  `evaluation.md`'s "where possible" with a per-feature table covering
  nine OOXML features (images, conditional formatting, named ranges,
  print area, freeze pane, sheet protection, data validation, cell
  comments, charts). Eight items are verbatim-preserve (P); charts are
  implementation-defined (D) until a future ADR.
- **ADR-0037 — Rejected: dynamic image insertion.** Five-objection
  rejection of `jx:image`-style runtime image injection. Static image
  preservation (per ADR-0036 #1) covers the real Korean-template use
  cases; runtime binary pipelines would break the browser flow.
- **Conformance fixtures 121–123.** Merged header (121),
  data-row merge broadcast (122), feature preservation (123).
- **`docs/internal/jxls-absorption-plan.md`.** Working backlog with
  A (absorbed), B (deferred), C (rejected) categories.

### Changed

- **`evaluation.md` § Source Data Model.** New column rule 8 covering
  merged headers (ADR-0033) and merge data-row broadcast paragraph
  (ADR-0035).
- **`evaluation.md` § Styles and Workbook Structure.** Vague "where
  possible" list replaced with explicit MUST-preserve table (ADR-0036).

### Fixed

- Templates with horizontally-merged headers no longer throw
  `xl3/source/duplicate-name`. Real-world vendor templates that
  previously required manual unmerging now work as-is.
- **ADR-0032 §#2 supersession.** ADR-0032 §#2 ("Source headers in
  merged cells are not portable") is explicitly superseded by
  ADR-0033 and marked as such in the ADR text. Ports reading
  ADR-0032 first no longer get a normative contradiction.
- **2D merge handling spec'd.** ADR-0033 amendment defines how a
  merge spanning both rows and columns (e.g., J11:M12) is handled
  by the existing transparency rules without new clauses. Recommended
  pattern: pick the band's *last* row as the header so data starts
  immediately below. Fixture 124 pins this.
- **"Transparent" precision.** ADR-0033 amendment defines exactly
  what "transparent" means for a horizontal-merge slave (skip in
  iteration, exempt from empty/duplicate/reserved-name checks) and
  states that the master cell participates in those checks exactly
  as an unmerged header would.
- **Porter independence note.** ADR-0033 amendment states the rule
  is "column-skip + master-anchored read" independent of how the
  underlying library materializes merge slaves (ExcelJS broadcasts
  vs openpyxl `None`). Ports MUST identify slaves from merge-region
  metadata, not from cell-value presence.
- **User-doc guidance updated.** `docs/guides/10-styling-and-branding.md`
  and `PORTERS_GUIDE.md` no longer advise authors to remove merged
  headers; both point at ADR-0033's actual behavior.

## [0.4.1] - 2026-05-13

Packaging-only patch release. Adds a browser-ready IIFE bundle so
hosts that prefer a `<script src="...">` integration don't need a
bundler. ESM npm entry, conformance behavior, and the spec are
unchanged.

### Added

- **IIFE browser bundle.** New `dist/xl3.bundle.iife.min.js`
  (~1 MB minified, ~300 KB gzipped) exposes `window.xl3` with all
  13 public exports (`convert`, `preview`, `analyze`, etc.).
  ExcelJS + JSZip are inlined; no external deps needed. Unminified
  `xl3.bundle.iife.js` with source maps also ships for debugging.
- **Package `exports` map** adds `./bundle` (minified) and
  `./bundle/dev` (unminified) entries, plus `unpkg` and `jsdelivr`
  fields so the CDN URL
  `https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.4.1/`
  resolves to the bundle by default. (That was the package name at the
  time; the scope became `@xl3-lang` in 0.10.0, and no `@xl3-lang/xl3@0.4.1`
  was ever published.)
- **Build script:** `npm run build:bundle` (tsup, ESM→IIFE).
  `prepublishOnly` runs it automatically.

### Usage

```html
<script src="https://cdn.jsdelivr.net/npm/@jinyoung4478/xl3@0.4.1/dist/xl3.bundle.iife.min.js"></script>
<script>
  const outputs = await xl3.convert(templateBuffer, dataBuffer);
</script>
```

The ESM `import { convert } from '@xl3-lang/xl3'` form is
unchanged and remains the recommended path for bundler-driven
projects.

## [0.4.0] - 2026-05-12

Spec-audit minor release. Four new ADRs (0029–0032) close the
last "silent fallthrough" surfaces and pin existing
implementation behavior as normative. One new error code
(`xl3/filename/collision`) and six new conformance fixtures
(115, 116, 117, 118, 119, 120). With this release the XTL 0.1
spec audit pass is complete: 32 ADRs, 119 conformance fixtures,
all green at Stage 2.

### Added

- ADR-0032 "Niche limits and workbook pass-through behaviors".
  Documents four niche behaviors as normative without changing the
  reference impl, so future ports can't silently diverge:
  - **Strings longer than 32,767 chars** are written to OOXML
    as-is. Implementation-defined; xl3 does not enforce Excel's
    per-cell limit. Host code is responsible for upstream
    validation if Excel compatibility is required.
  - **Source headers in merged cells** are implementation-defined;
    portable templates do NOT merge header cells. Reader libraries
    differ on what they return per cell of a merged range; xl3
    reaches `xl3/source/duplicate-name` or
    `xl3/source/missing-header` accordingly.
  - **Workbook and sheet properties** (`tabColor`,
    `defaultRowHeight`, `pageSetup`, `views`, defined names, print
    areas) are preserved verbatim from template to output. Porters
    MUST preserve these unless an ADR overrides.
  - **Integer precision beyond 2^53** is implementation-defined
    within IEEE 754 limits. xl3 does not detect precision loss.
    Authors needing exact integer representation beyond 2^53 store
    values as strings.

  No new error codes. No impl change. Fixture 120 pins `tabColor`
  preservation as the most user-visible example.

- ADR-0031 "Output filename collision is an error". Two distinct
  file group keys that sanitize (per ADR-0002) to the same filename
  now raise `xl3/filename/collision` at convert time. Previously
  silently returned two `OutputFile` entries with the same filename,
  causing host code to overwrite the first when writing to disk.
  Example: Region values `Seoul/Korea` and `Seoul:Korea` both
  sanitize to `Seoul_Korea.xlsx`. Detection runs before any workbook
  is rendered. New error code, fixture 119.

- ADR-0030 "Unicode normalization in string comparison". Pins
  ADR-0009's existing "raw code-point order" behavior with explicit
  treatment of the NFC vs NFD trap (Korean, Japanese, Latin with
  diacritics). NFC `한` (U+D55C) and NFD `한` (U+1112 U+1161
  U+11AB) render identically but compare as different strings.
  Aligns with Excel-default principle (Excel does not normalize
  either). Authors with mixed-form data normalize upstream.
  Conformance fixture 118 pins it; `language.md` "Comparison
  Algorithm" and `PORTERS_GUIDE.md` "Language-specific gotchas"
  document the trap.

- ADR-0029 "Directive composition + source edge semantics". Closes
  four spec gaps in one ADR:
  - **Duplicate `@source`** in a data block now raises
    `xl3/directive/invalid-syntax`. Previously last-wins silently.
  - **Duplicate `@join`** raises the same code (multi-join remains
    out of scope per ADR-0014).
  - **Self-join** (`@join S on S[a]=S[b]` where `S` is the active
    source) raises `xl3/join/bad-on-clause`. Previously produced
    zero rows silently. Tree / hierarchy walks remain out of scope.
  - **Function name case-insensitivity** is now normatively pinned
    (`if`, `If`, `IF` all work). Fixture 116.
  - **Hidden source rows** are normatively included in iteration.
    Authors filter explicitly via `@filter` for visibility-aware
    behavior. Fixture 117.
- 4 new conformance fixtures (114–117).

### Changed

- README adds a "What's new" callout referencing the audit-pass
  completion and the changes accumulated since 0.3.0.

## [0.3.0] - 2026-05-09

Spec-audit minor release. Three new ADRs (0026, 0027, 0028) close
gaps that surfaced during a focused audit. Six new conformance
fixtures (107–113) pin the new behaviors. Replaces several
silent-fallthrough surfaces with coded errors — the
"silent-garbage-to-loud-error" theme that has driven this
audit pass.

### Changed (BREAKING within 0.x semantics)

- **Empty group key value** in a file or sheet name template now
  substitutes the literal token `(blank)` per Excel pivot
  convention (ADR-0026). Previously: file-level halted with
  `xl3/filename/empty`, sheet-level fell back to literal `Sheet`.
- **Source column name** colliding with an internal context key
  (`Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`, or any
  `^__[a-z]+__$` pattern) now raises
  `xl3/source/reserved-column-name` at parse (ADR-0027). Previously
  silently shadowed (or was shadowed by) the internal value,
  producing `[object Object]` cell values.
- **Empty / malformed directive bodies** (`{{ @filter }}`,
  `{{ @source }}`, `{{ @sort foo }}`, etc.) now raise
  `xl3/directive/invalid-syntax` (ADR-0027). Previously silently
  no-opped — author saw output with the directive un-applied.
- **Unary operators on non-literal expressions** (`+5`, `--5`,
  `-[col]`, `-(expr)`) now raise `xl3/eval/unsupported-syntax`
  (ADR-0028). Previously silently rendered the literal expression
  text. Workaround for column negation: `(0 - [col])` or
  `[col] * -1`. Number literals with a leading `-` (`-5`, `-3.14`)
  remain valid.

### Changed

- Conformance fixture 019 rewritten to use a `__config__` author
  key for the empty-basename error path (the empty-group-key shape
  now flows through `(blank)` per ADR-0026).

### Added

- ADR-0028 "Literal syntax constraints + unsupported-syntax detection".
  Closes the unary-operator silent-fallthrough surface:
  - **String literals** are matched-pair `"..."` only; no escape
    sequences. Backslashes pass through literally; embed quotes via
    `__config__` cells.
  - **Number literals** support a leading `-` for negation
    (`-5`, `-3.14`).
  - **Unary operators on non-literal expressions** (`+5`, `--5`,
    `-[col]`, `-(expr)`) raise `xl3/eval/unsupported-syntax`.
    Replaces the previous silent fallthrough that output the
    literal expression text. Workaround for column negation:
    `(0 - [col])` or `[col] * -1`.
  - 1 new error code, 2 new fixtures (112, 113).

- ADR-0027 "Reserved column names + directive arg validation".
  Closes two silent-fallthrough surfaces:
  - **Reserved source column names**: `Rows`, `__rownum`,
    `__activeSource__`, `__joinedRow__`, plus any `^__[a-z]+__$`
    pattern, are rejected at parse with
    `xl3/source/reserved-column-name`. Previously such columns
    silently shadowed (or were shadowed by) renderer ctx keys,
    producing `[object Object]` cell values.
  - **Empty / malformed directive bodies**:
    `{{ @filter }}`, `{{ @sort }}`, `{{ @source }}` (and friends)
    now raise `xl3/directive/invalid-syntax` at parse instead of
    silently no-opping. Authors who think they filtered see the
    error immediately rather than wondering why output has all rows.
  - 3 new conformance fixtures (109, 110, 111).

- ADR-0026 "Empty value lifecycle in cell rendering and group keys".
  Pins two previously-undefined behaviors:
  - Single-expression cell evaluating to empty produces a cell value
    of `""` (empty string) — matches Excel's `=""` formula behavior;
    the cell is present in OOXML, value is empty, re-reading via
    xl3 reads as empty per ADR-0007.
  - File- and sheet-level group keys with empty values substitute
    the literal token `(blank)` per Excel pivot table convention
    (ADR-0023 Excel-default principle). This replaces the previous
    asymmetric behavior where file-level halt-with-error and
    sheet-level fell back to the literal `Sheet`. Real reporting
    data with sloppy rows now produces a `(blank).xlsx` bucket and
    a `(blank)` sheet instead of failing the whole conversion.

### Changed

- Conformance fixture 019 (`019-filename-empty-basename-error`) was
  rewritten to exercise the empty-basename error path via a
  `__config__` author key (which ADR-0026's `(blank)` substitution
  does NOT apply to). The original empty-group-key shape now flows
  through the `(blank)` placeholder instead of erroring.

## [0.2.0] - 2026-05-08

Spec-audit minor release. Three new ADRs (0023, 0024, 0025) close
spec gaps that surfaced during a focused audit; seven new
conformance fixtures (100–106) pin them. The notable behavior
change — division by zero now produces an Excel `#DIV/0!` error
cell instead of silently rendering `0` — is what bumps this from
patch to minor.

### Changed (BREAKING within 0.x semantics — see ADR-0025)

- **Division by zero** in arithmetic produces an Excel-style
  `#DIV/0!` error cell instead of silently rendering `0`.
  Templates whose data has a zero divisor now show `#DIV/0!`
  visibly in the cell (the workbook still renders; only the
  affected cell carries the error). Aligns with Excel's behavior
  per the Excel-default principle.
- **Wrong arity** on user-facing functions (`IF`, `ROUND`,
  `XLOOKUP`, `SUM`, etc.) now raises `xl3/eval/arity-mismatch`
  at parse / normalize time. Previously fell through to a silent
  string-fallback or generic crash.
- **Non-numeric strings in arithmetic** (`"abc" + 5`) now raise
  `xl3/eval/operand-coercion`. Previously coerced silently to 0.

### Added

- ADR-0025 "Division by zero produces an Excel #DIV/0! error cell".
  Resolves ADR-0023 §"Open question". Aligns with the Excel-default
  principle: a single bad row marks one cell with `#DIV/0!`, the
  rest of the conversion proceeds. The reference impl returns a
  typed marker (`{ __xl3_error__: '#DIV/0!' }`) from the `/` operator
  on zero divisor; the renderer emits a real ExcelJS error cell.
  Conformance fixture 106 pins the behavior. Comparable() in the
  conformance runner now extracts the error code from error cells
  so output-side fixtures can pin exact errors.
- Multiple `@filter` directives normatively compose with AND
  (language.md "Filter"). Conformance fixture 104 pins it.
- `{{ }}` whitespace rule formalized in language.md "Template
  Blocks": leading/trailing whitespace inside the delimiters is
  insignificant, string-literal whitespace is preserved.
  Conformance fixture 105 pins it.

### Added

- ADR-0024 "Function arity is part of the spec". XTL 0.1 user-facing
  functions now have a normative arity table in language.md
  "Functions" and a single source of truth in `FUNCTION_ARITY` in
  the normalizer. Calls with wrong arity raise
  `xl3/eval/arity-mismatch` at normalize time instead of falling
  through to a silent string-fallback or generic crash. Conformance
  fixtures 102 (`ROUND([x])`) and 103 (`XLOOKUP(a, b)`) pin two
  common shapes; new error code added to the catalog and snapshot
  test.

### Added

- ADR-0023 "Operator coercion + Excel-as-default principle".
  Spec gaps closed:
  - **Excel-default principle** — when XTL is silent or ambiguous,
    implementations SHOULD adopt Excel's behavior (subject to existing
    overriding ADRs like 0017 UTC dates).
  - **Arithmetic operator coercion table** — `+`, `-`, `*`, `/` now
    have an explicit table for numeric-like strings (coerced),
    Booleans (TRUE→1, FALSE→0), empty values (→0), Dates (error),
    and non-numeric strings (error). Replaces the previous
    silent-`toNumber()=0` behavior.
  - New error code `xl3/eval/operand-coercion`.
  - Conformance fixtures 100 (coercion table) + 101 (non-numeric
    string error).
- Division-by-zero behavior is left as an open question in ADR-0023
  pending a follow-up ADR (options: throw, Excel-style `#DIV/0!`
  cell, or empty). Reference impl preserves prior behavior (returns
  0) until decided.

## [0.1.1] - 2026-05-08

Patch release rolling up everything that landed since `0.1.0` was
published to npm. Includes one impl crash fix surfaced by the new
boundary fixtures, the xl3-py issue #1 batch (5 findings), the
ADR-0021/0022 documentation expansion, and the `@xl3-lang/xl3`
scoped name (which was effective with the 0.1.0 publish but
documented here for completeness across the changelog timeline).

### Fixed

- Empty `{{ }}` template block (whitespace-only between delimiters)
  previously crashed with a generic `TypeError` from
  `getFunction(undefined).toUpperCase()`. ADR-0021 specified it as
  a parse error in prose; the impl now matches by raising
  `xl3/parser/empty-block` at parse time. Fixture 099 pins the
  behavior.

### Added

- Conformance fixtures pinning two of the implementation-defined
  boundaries documented by ADR-0021:
  - 097 — native Excel formula in a static template cell (not inside
    a data block) is preserved verbatim, with cached result reading
    back via Stage 1 `comparable`.
  - 099 — empty `{{ }}` template block (whitespace-only between
    delimiters) raises `xl3/parser/empty-block` at parse time.
    Previously the impl crashed with a generic `TypeError` from
    `getFunction(undefined).toUpperCase()`; ADR-0021 specified the
    behavior in prose but no fixture pinned it. Now it does, and the
    impl emits a coded error.
- New stable error code `xl3/parser/empty-block` in the catalog.

### Added

- ADR-0022 "Excel version compatibility" — informational catalog of
  which Excel-version differences XTL 0.1 is immune to, which it
  leaves implementation-defined, and which authoring patterns
  templates should avoid for portability across Excel for Windows /
  Mac / Online / 365, LibreOffice, and Numbers. README gets a short
  link-and-summary; spec/index.md gets a row in the navigation table.

### Changed

- **npm package renamed** from `xl3` to `@xl3-lang/xl3`. The
  unscoped `xl3` name was rejected by npm's typosquatting prevention
  (too similar to `xlsx`, `xml`, etc.). Project name, GitHub repo,
  and the `xl3.io` domain are unchanged — only the npm package and
  the import specifier change. Install is now
  `npm install @xl3-lang/xl3`; importing is
  `import { convert } from '@xl3-lang/xl3'`. The conformance
  CLI binary (`xl3-conformance`) keeps its name.

### Fixed (xl3-py issue #1 batch)

- **IF condition `=` operator now recognized** (issue #1 finding #5,
  the highest-value finding of the Python port). The
  `normalizeCondition` op list had `==` but not `=`, so the spec's
  equality operator silently fell through and templates like
  `IF([Amount] = 0, "zero", "non-zero")` evaluated as truthy
  regardless of `[Amount]`. Fixture 048 was authored against the
  bug; its `expected.xlsx` is re-built so D3 (Amount=1) is
  `"non-zero"` instead of `"zero"`. `==` retained as an impl-only
  tolerance — ports MAY accept `=` only.
- **U+FEFF / U+200B no longer treated as whitespace** by `isEmpty`
  (issue #1 finding #2). Native `String.prototype.trim` strips
  U+FEFF; ADR-0007 amendment explicitly excludes zero-width chars.
  `isEmpty` now pre-replaces zero-width chars with a sentinel before
  trimming. Fixture 095 pins the behavior.
- **ADR-0009 1e-4 → 1e-6 cutoff correction** (issue #1 finding #1).
  Spec text said "no scientific notation between 1e-4 and 1e21" and
  cited ECMA-262, but ECMA-262 §6.1.6.1.13 actually uses 1e-6.
  ADR-0009 + language.md "Canonical String Form" corrected to
  `[1e-6, 1e21)`. Fixture 096 covers the boundary.

### Added

- Conformance fixtures 095 (FEFF non-empty), 096 (1e-6 cutoff).
- PORTERS_GUIDE.md "Language-specific gotchas" section — Python
  `repr(float)` divergence (issue #1 finding #3), openpyxl
  `tzinfo=None` (finding #4), zero-width whitespace handling.

### Added

- ADR-0021 "Implementation-defined boundaries" — explicit catalog of
  the gray-area gaps in XTL 0.1, classified per item as
  implementation-defined or required. Covers memory model, sync vs.
  async, native Excel formulas, `TEXT()` extensions, merge cells,
  `__config__` author-defined keys, empty source, sheet-name
  collisions, empty template blocks, non-template input sheets.
  spec/index.md gets an "Implementation-defined boundaries" matrix
  mirroring the catalog.
- `evaluation.md` `@join` first-match clarified as normative —
  joined-source natural row order, top-to-bottom over `source_table`
  range. Two implementations MUST pick the same paired row when
  multiple joined rows have an equal join key.
- `grammar.ebnf` precedence disclaimer — the EBNF is non-normative;
  fixtures + spec prose win.
- `runner-protocol.md` clarifies `tags` is a runner convenience, not
  a conformance contract.

## [0.1.0] - 2026-05-08

First substantive 0.x release. Drafts the contract that a future 1.0
cut will freeze; the cut itself is deferred until external validation
accumulates — see [`spec/STABILITY.md`](./spec/STABILITY.md) "Current
state". Until 1.0, breaking changes are possible across 0.x minor
bumps. Reference docs: [`PORTERS_GUIDE.md`](./PORTERS_GUIDE.md),
[`RELEASING.md`](./RELEASING.md).

### Added — 1.0-readiness polish

- **Public API surface frozen.** `spec/STABILITY.md` "Public API
  surface" section enumerates the 13 runtime exports + 14 type
  re-exports that are stable for 1.x. Each export now carries
  `@stable` TSDoc. `src/__tests__/api-surface.test.ts` pins the
  runtime list.
- **Warning shape formalized.** `OutputFile.warnings`,
  `PreviewResult.warnings`, and `TemplateModel.warnings` are now
  `XtlWarning[]` with stable `code` (`xl3w/...`), `message`, and
  optional `location` — replacing the previous loose `string[]`.
  Two warning codes ship in 1.0: `xl3w/parser/missing-column` and
  `xl3w/filename/sanitized`.
- **Diagnostic location info.** Every cell-eval error now carries
  `(at sheet "X" cell A5)` appended to its message. Implemented via
  a new `evalCellAt(sheet, cell, ...)` wrapper in template-eval.
- **Resource limits position stated.** `spec/evaluation.md`
  "Resource Limits" section: limits are implementation-defined; the
  spec does not mandate bounds. Hosts that accept untrusted
  templates enforce their own caps.
- **Glossary** at `spec/glossary.md` — 30 core XTL terms with
  cross-links to the governing ADR / spec section.
- **Spec navigation index** at `spec/index.md` — surface ↔ ADR ↔
  fixture cross-reference table for porters and reviewers.
- **Deferral ADRs.** ADR-0019 records why date arithmetic is
  deferred to XTL 1.x; ADR-0020 does the same for locale-aware
  collation.
- **Status taxonomy.** `0000-template.md` and ADR-0004 introduce
  the `informational` status — non-normative documentation /
  audit / deferral ADRs that do not bind impl behavior.
- **`RELEASING.md`** — npm cut procedure, rc soak rule, rollback
  guide.

### Changed — 1.0-readiness polish

- **Error message wording normalized.** Capitalize first word,
  subject + verb form, no log-style `XLOOKUP:` prefixes. Two
  fixtures updated to match (067, 076). Voice rules now documented
  in `PORTERS_GUIDE.md` "Message style guide".
- **ADR-0004 reclassified** to `informational` status. The audit's
  conclusions live in the normative ADRs that followed (0007, 0009,
  0011, 0017).

## [Pre-1.0 history below]

### Added — porter and 1.0 readiness

- `PORTERS_GUIDE.md` — second-language port guide. Distinguishes
  spec-normative requirements (error codes, date UTC semantics,
  truthiness rules, reserved sheets, aggregate semantics) from
  TS-impl-incidental details (async-everywhere, WeakMap caching,
  ExcelJS workarounds), with a recommended development order keyed
  to the conformance corpus.
- `spec/grammar.ebnf` — formal EBNF grammar for `{{ ... }}` template
  block contents. Non-normative supporting material; the spec prose
  remains authoritative.
- Property-based fuzz tests
  (`src/__tests__/properties.test.ts`) — 10 invariants over the
  value model (canonicalString totality, isTruthy implications,
  compareValues totality / reflexivity / antisymmetry / sampled
  transitivity), each run over 200 random cases.
- ADR coverage matrix auto-generation
  (`conformance/coverage.md`) — every semantic ADR now has at least
  one covering fixture, and every fixture declares a `spec_section`.
  Conformance fixture 094 added to close the ADR-0011
  (reserved-sheet-name) gap.
- `npm run bench` performance baseline + reference numbers in
  `scripts/BENCH.md`. Three scenarios: wide-flat 10k row, multi-sheet
  5k×5, multi-source-join 5k×1k. A regression > 2× in any scenario
  should be investigated.

### Added

- `examples/` directory with three production-shaped templates
  (basic renewal report, sheet-per-region with list-filter,
  multi-source `@source` + `@join` + XLOOKUP + `__inputs__`). New
  npm scripts `examples:build` / `examples:run` and a vitest
  integration test pin them in CI.
- Composition conformance fixture 092 exercising
  `@source` + `@join` + `@filter` + `@sort` + `XLOOKUP` + cross-source
  `SUM` in one template; catches regressions where individually-
  correct rules interact incorrectly.
- Synthetic cross-writer Stage 2 fixture 093: `expected.xlsx` is
  the engine's output passed through
  `conformance/scripts/perturb-xlsx.mjs`, which reverses zip entry
  order, reverse-sorts XML attributes, and flips quote style on
  alternating attributes. Stage 2 passes only if the canonicalizer
  normalizes all of these (rules 1 and 3 in the runner protocol).
  The fixture's README documents the path to upgrade it into a true
  Excel-authored cross-writer test.
- CI matrix runs the conformance suite under three timezones
  (UTC, America/New_York, Asia/Seoul) so date-handling regressions
  fail at PR time. Available locally as `npm run conformance:tz`.
- 1.0 readiness tests — error-code catalog snapshot (ADR-0015),
  public API surface snapshot, and a spec-corpus lint that catches
  orphan ADRs and broken spec/ markdown links.

### Fixed

- Header cells containing only `SUM(Source[col])` /
  `XLOOKUP(..., Source[a], Source[b])` no longer trigger a data
  block. The previous `isDataExpression` heuristic detected any
  `Source[Field]` reference as iterating, so static-context
  aggregates / lookups in a header row were re-rendered once per
  data row. Source-prefixed brackets wrapped in
  `SUM`/`AVERAGE`/`AVG`/`MIN`/`MAX`/`COUNT`/`XLOOKUP` are now
  treated as static.

- **Date timezone correctness (ADR-0017).** All Date component
  extraction now uses UTC accessors so the canonical-string form
  (`YYYY-MM-DD`) round-trips identically on any host timezone.
  Previously `getFullYear`/`getMonth`/`getDate` introduced an
  off-by-one drift on non-UTC hosts. The fix touches `canonicalString`,
  `formatDate`, `today()`, `toDate()`, the renderer's strict-date
  parser, the Excel-serial-to-Date conversion, and `__inputs__` date
  validation. ADR-0017 now states UTC as normative.
- **`__sources__` value-dictionary leak.** `{{ __sources__[Customers] }}`
  used to leak the internal source descriptor; it now errors with
  `xl3/sources/not-a-dictionary`.
- **Unknown-column silent fail.** `Source[Column]` /
  `SUM(Source[Column])` / `XLOOKUP(...)` /  bare `[Column]` referencing
  an undeclared column previously aggregated to 0 / blank, masking
  typos. They now error with `xl3/source/unknown-column`. Conformance
  fixture 091 covers the SUM path.
- **Aux-sheet cleanup.** `removeAuxiliarySheets` matched only
  `_`-prefixed names; it now matches the dunder pattern from ADR-0011
  so reserved sheets don't leak into output.

### Added

- Error code coverage completed across the impl. Every spec-defined
  throw site in parser, reader, normalizer, renderer, template-eval,
  inputs, functions, and excel-document now carries an `xl3/...`
  code via `xtlError(code, message)`. Existing error fixtures (017,
  018, 019, 020, 021, 022, 032, 033, 034, 037, 042, 077, 078) gain
  `expected_error_code` assertions, joining the previously-coded
  067/072/073/076/081/082.
- ADR-0017 defines the **source value model** normatively. Source
  values are one of Missing / String / Number / Boolean / Date.
  Date canonical string form is now `YYYY-MM-DD` (midnight) or
  `YYYY-MM-DDTHH:mm:ss` (datetime), closing the ADR-0009 deferral.
  Excel error cells (`#N/A`, `#VALUE!`, `#DIV/0!`, …) read as empty
  per ADR-0007. Percentage-formatted cells continue to flow as their
  underlying Number value (50% → `0.5`); use `TEXT()` for formatted
  output. The reference impl handles `{ error }` cells in
  `parseCellValue`, extends `canonicalString` for Date, and adds a
  Date branch to `compareValues`. Conformance fixtures 087–090
  cover date concatenation, date comparison, error sentinel, and
  percentage cell flow.
- ADR-0016 locks down **ordering and sort stability**. `@sort` is
  stable; equal sort keys preserve source order. With multiple
  `@sort` directives, the **first** is the primary key and later
  sorts are tiebreakers (Excel/SQL convention). File groups and
  sheet groups within a file emit in **first-seen** order over the
  source's natural row order; the previous lexicographic sheet-group
  sort is replaced. The spec also clarifies that data blocks expand
  vertically by default (without an explicit `@repeat`). Conformance
  fixtures 083–086 cover sort stability, multi-sort priority, and
  file/sheet first-seen ordering.
- ADR-0015 adds **structured error codes** alongside the English
  messages. Spec-defined errors now carry a stable `error.code` like
  `xl3/source/undeclared` or `xl3/inputs/missing-required`. Hosts use
  the code for localization and programmatic dispatch; the English
  message remains the conformance contract. The reference impl
  exports `xtlError` / `isXtlError` / `XtlErrorCode` and wires codes
  through parser / inputs / template-eval / functions throw sites.
  Conformance protocol gains an optional `expected_error_code` in
  meta.yaml; six existing error fixtures now assert codes.
- ADR-0014 adds **`@join` block-level source pairing**. A data block
  may add one `@join SourceName on SourceName[k] = PrimarySource[k]`
  directive after `@source`. The engine pairs each primary row with
  the first matching joined row (inner-join semantics, first-match);
  unmatched primary rows are dropped. Inside the block, `[Column]` and
  `<PrimarySource>[Column]` resolve to the primary's row;
  `<JoinedSource>[Column]` resolves to the paired joined row. Multiple
  joins, left-join semantics, and multi-row matches are out of scope
  for XTL 0.1. Conformance fixtures 079–082 cover the happy path,
  inner-drop, undeclared-source error, and bad on-clause error.
- ADR-0013 adds **XLOOKUP** for cross-source lookup. Mirrors Excel's
  signature: `XLOOKUP(lookup_value, lookup_array, return_array,
  [if_not_found])`. Arrays must be `Source[Column]` from the same
  source; row-level cross-source lookup is now first-class. No-match
  without a fallback is an error with a stable diagnostic. Wildcard,
  approximate, and reverse-search modes are intentionally out of
  scope. Conformance fixtures 074–078 cover happy path, fallback,
  no-match error, source-mismatch error, and bare-bracket-arg error.
- ADR-0012 introduces a **multi-source data model**. Templates can
  declare additional named data sources in a new reserved sheet
  `__sources__` (columns: `name`, `sheet`, `table`, `description`).
  Cells reference a named source's current-row column via the Excel
  structured-ref form `Customers[Account]`. The `@source <Name>`
  directive scopes a data block to a named source so its `[Column]`
  shorthand resolves there. Aggregate functions
  (`SUM`/`COUNT`/`AVERAGE`/`MIN`/`MAX`) accept a source-prefixed
  bracket and operate on that source's full row set
  (`SUM(Renewals[Amount])`). Row-level cross-source references and
  source joins are intentionally deferred to ADR-0013/0014.
  Conformance fixtures 069–073 cover declaration, cross-source
  aggregates, the directive, undeclared-source errors, and the
  row-context cross-source error.
- **BREAKING (ADR-0011): reserved sheet naming + unified reference syntax.**
  - Reserved system sheets are now dunder-wrapped: `_config` →
    `__config__`, `_inputs` (ADR-0010) → `__inputs__`. New reserved
    sheet `__lists__` consolidates user-defined membership lists; the
    old `_<name>` arbitrary list-sheet pattern is retired.
  - User-defined values inside `__config__` no longer require a `_`
    prefix on the key; access them via `{{ __config__[key] }}`.
  - The `{{ _<name> }}` cell-reference syntax is fully retired.
    Templates now use `{{ __config__[name] }}`, `{{ __inputs__[name] }}`,
    or `{{ __lists__[name] }}` (the last only inside `@filter ... in/!in`).
  - Filter directive form is now `@filter [field] in __lists__[name]`.
  - Author-created sheet names matching `^__[a-z]+__$` are reserved
    and rejected at parse time.
  - The `__sources__` reserved sheet name is reserved for a future ADR
    (multi-source data model).
  - All conformance fixtures, the runner protocol's meta.yaml shape,
    and the browser site are migrated to the new naming.



- Stage 1 `xl3-conformance` runner with cell-value comparison.
- Bootstrap conformance fixtures covering substitution, `IF`, list-sheet filters,
  repeat-right defaults, `ROUND`, filename sanitization, and numFmt coercion.
- ADR-0004 reference implementation coupling audit, plus spec clarifications
  for cell text extraction and `source_sheet` prefix matching.
- XTL 0.1 `TEXT()` date/numeric format subset and conformance fixtures for
  `TEXT()`, rich-text cells, cached formula results, and `source_sheet` prefix
  matching, including negative half-away numeric rounding.
- `expected_error` conformance fixture mode for required failure cases.
- Source formula cells without cached results now report an error.
- Clarified that `TEXT()` formats outside the XTL 0.1 core table are
  implementation-defined extensions, not portable conformance requirements.
- Error fixtures for output filename sanitization and numFmt coercion failures.
- ADR-0005 dynamic conformance assertion protocol for render-time values such
  as `TODAY()`.
- ADR-0006 Stage 2 canonical OOXML conformance comparison design.
- `TODAY()` dynamic conformance fixture and fixture-level comparison stage
  metadata.
- Stage 2 merged-range and style/numFmt preservation fixtures plus canonical
  diff/report refinements.
- Stage 2 canonicalizer now normalizes attribute quote style, drops
  insignificant whitespace inside closing tags, and collapses empty-element
  forms (`<x></x>` ↔ `<x/>`) per ADR-0006 rule 3.
- AUTHORING.md flags the Stage 2 ExcelJS round-trip caveat and points cross-
  writer canonicalizer coverage at the unit tests until an Excel-authored
  Stage 2 fixture lands.
- `source_table` grammar is clarified and covered by conformance fixtures for
  row shorthand, open ranges, finite ranges, zero data rows, and invalid source
  column names.
- Source table header cells now have conformance coverage for rich-text and
  formula cached-result handling.
- `source_sheet` exact-match precedence, first-worksheet defaulting, hidden
  list-sheet removal, and `ROW()` repeat-block behavior now have conformance
  coverage.
- `IFEMPTY()` now has conformance coverage for empty and non-empty values.
- `@sort`/`@top` directive order now has conformance coverage.
- `@filter ... !in` and `COUNT([field])` now have conformance coverage.
- Core aggregate functions now have conformance coverage on the rendered row set.
- Comparison-boundary behavior and filename sanitization warnings now have conformance coverage.
- ADR-0007 defines a single empty-value predicate that governs `IFEMPTY`,
  `COUNT([field])`, the empty-data-row skip rule, and list-sheet
  membership filters. Whitespace-only strings are now empty; numbers
  (including `0`) and booleans (including `false`) are never empty.
  Conformance fixtures 050–054 cover each surface.
- ADR-0008 defines truthiness for `IF()` and any future Boolean-valued
  context. A value is truthy unless it is `false`, the number `0`, or
  empty per ADR-0007. **BREAKING:** the reference implementation no
  longer special-cases the strings `"0"` and `"false"`; both are
  truthy. Authors who relied on the old behavior MUST rewrite as
  explicit comparisons (e.g. `IF([flag] = "1", …)`).
  Conformance fixtures 055–058 cover each branch. **BREAKING:** the
  unreachable Go-template-style `{{ if … }} … {{ end }}` block in the
  reference impl is removed (never spec-blessed, never used).
- ADR-0009 defines a single comparison algorithm shared by `IF()`,
  `@filter`, and `@sort`, plus a canonical string form used by `&`
  concatenation, list-sheet reading, and the algorithm's string
  fallback. **BREAKING:** the reference implementation drops the
  hardcoded `localeCompare(_, 'ko')` Korean collation in favor of
  Unicode code-point order; mixed-script sort outputs change. Booleans
  now stringify to `TRUE` / `FALSE` (uppercase). Conformance fixtures
  059–063 cover the numeric/string fast path, code-point sort order,
  canonical-form concatenation, empty concatenation, and empty-vs-value
  equality.
- ADR-0007 amendment: "Unicode whitespace" matches ECMAScript
  `String.prototype.trim` (Unicode `\s`); zero-width characters
  (U+200B, U+FEFF) are explicitly **not** whitespace.
- ADR-0009 amendments: numeric comparison uses IEEE 754 equality
  (`0.1 + 0.2 = 0.3` is false; templates needing tolerance MUST
  `ROUND()`), and the Unicode minus sign (U+2212) is not parsed as a
  number. Conformance fixture 064 covers the Unicode-minus fallback.
- ADR-0010 introduces runtime user inputs. Templates declare
  per-run values in a new `_inputs` sheet (columns: `name`, `type`,
  `default`, `label`, `description`, `options`); hosts call
  `convert(template, source, { inputs })` and `preview(...)` with the
  same option, or `readTemplateInputs(template)` to introspect the
  declarations. Coercion follows ADR-0007/0009/0003 (text/number/date)
  plus a `select` enum. Missing required inputs and invalid values are
  errors with stable diagnostic substrings. The runner protocol gains
  an `inputs:` meta.yaml block. Conformance fixtures 065–068 cover
  default fallback, host-supplied values flowing into cells and
  filename patterns, the missing-required error, and `select`
  validation.

## [0.1.0-alpha.0] - 2026-05-03

Initial public draft.

### Added

- XTL 0.1 draft spec in `spec/`.
- TypeScript reference implementation in `src/`.
- Conformance corpus scaffold in `conformance/`.
- Browser and Node >=18 package entrypoint.

### Language

- Source column references use Excel-like bracket syntax: `{{ [Customer] }}`.
- Excel-style functions: `IF`, `IFEMPTY`, `SUM`, `COUNT`, `AVERAGE`, `MIN`,
  `MAX`, `ROUND`, `ABS`, `TEXT`, `ROW`, and `TODAY`.
- `_config.source_table` defines source table reads such as `1`, `A1:D`, or
  `B5:H200`.
- Single-expression cells preserve source value types and use template cell
  number/date/text formats for coercion.

[Unreleased]: https://github.com/xl3-lang/xl3/compare/v0.13.0...HEAD
[0.13.0]: https://github.com/xl3-lang/xl3/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/xl3-lang/xl3/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/xl3-lang/xl3/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/xl3-lang/xl3/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/xl3-lang/xl3/compare/v0.8.3...v0.9.0
[0.8.3]: https://github.com/xl3-lang/xl3/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/xl3-lang/xl3/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/xl3-lang/xl3/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/xl3-lang/xl3/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/xl3-lang/xl3/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/xl3-lang/xl3/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/xl3-lang/xl3/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/xl3-lang/xl3/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/xl3-lang/xl3/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/xl3-lang/xl3/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/xl3-lang/xl3/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/xl3-lang/xl3/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/xl3-lang/xl3/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xl3-lang/xl3/compare/v0.1.0-alpha.0...v0.1.0
[0.1.0-alpha.0]: https://github.com/xl3-lang/xl3/releases/tag/v0.1.0-alpha.0
