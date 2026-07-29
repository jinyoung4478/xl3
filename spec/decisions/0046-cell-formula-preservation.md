# ADR 0046 - Cell formula preservation contract

- **Status:** accepted
- **Date:** 2026-05-18
- **Spec target:** XTL 0.1
- **Affects:** ADR-0036 (preservation matrix), ADR-0040 (range PE),
  ADR-0043 (the Excel-native preference principle relies on this
  ADR's contract being normative)
- **Amended by:** ADR-0073 (a formula cell's cached `<v>` result is
  never interpreted as template text — marker/directive recognition
  ignores formula cells)

## Context

ADR-0043 (Excel-native preference principle) advises authors to put
computations in cell formulas when the value only matters at
workbook-open time. The principle relies on the reference impl's
behavior of preserving template cell formulas through render. That
behavior was never normatively pinned — it was implicit in
ADR-0036's "preserve verbatim" matrix but the matrix didn't single
out formulas, and no conformance fixture exercises them.

A porter reading ADR-0043 needs a precise contract: what survives,
what gets adjusted, what gets lost. Without this ADR, the
Excel-native preference principle is asking porters to honor an
unspecified behavior.

## What the contract is (in OOXML terms)

Two observations, stated in OOXML element terms so any port
matches the contract regardless of which XLSX library it uses:

1. **The `<f>` element text is preserved verbatim** across
   `@repeat` row expansion. A template cell with `<f>B2*2</f>` is
   cloned into every row produced by `@repeat`; the `<f>` text is
   copied byte-for-byte.

2. **References inside the `<f>` element text are NOT adjusted.**
   When the `@repeat` block expands from 1 template row to N
   rendered rows, each cloned cell's `<f>` text keeps the original
   reference. A formula `<f>B2*2</f>` on the template row 2 stays
   `<f>B2*2</f>` on rendered rows 2, 3, 4, … — every row
   references row 2's `B`, not its own row's `B`.

   Similarly, a footer formula `<f>SUM(B2:B5)</f>` placed below a
   `@repeat` block that expands from 4 rows to 10 rows stays
   `<f>SUM(B2:B5)</f>` — the range is not extended.

### How specific impls satisfy the OOXML contract

The contract is OOXML-element-level. Implementations may use any
library, but the I/O round-trip must produce equivalent `<f>` /
`<v>` element text. Two example mappings:

- **ExcelJS (xl3-js):** template cells with shape
  `{ formula: "B2*2" }` round-trip to `<f>B2*2</f>` in OOXML
  output. Cached results, if present in source `{ formula, result }`,
  emit a `<v>` element on the template row; cloned rows omit `<v>`
  (Excel re-evaluates at open time).
- **openpyxl (xl3-py):** template cells with shape
  `cell.value = "=B2*2"` plus `cell.data_type = 'f'` round-trip
  identically. Cloned cells set `cell.value = "=B2*2"` and do not
  set a cached result attribute.

Implementations using library-specific shapes (ExcelJS objects,
openpyxl attributes, OOXML element types in Rust crates, …) MUST
translate to/from the OOXML element form at their I/O boundary.
The normative form is the OOXML XML; library shapes are
convenience.

## Decision

### What is normative (preserved verbatim) — MUST

Per ADR-0036 plus this ADR's amendment, stated in OOXML element
terms:

1. **`<f>` element text** is preserved through `convert()`,
   byte-for-byte. A formula cell in the template appears with the
   same `<f>` text in every rendered row that the cell
   participates in (the template row itself when no `@repeat`
   touches it; every cloned row when `@repeat` does).

2. **`<v>` element (cached result)** is preserved on the template
   row only. Cloned rows MAY omit `<v>` (Excel re-evaluates at
   open time). Whether cloned rows omit or copy `<v>` is
   implementation-defined; impls MUST NOT compute new `<v>`
   values for cloned rows from the source data — that would
   silently diverge from the formula's intent.

3. **Cross-sheet `<f>` references** (e.g., `<f>Data!B2</f>`) are
   preserved verbatim, including the sheet-name quoting form the
   author wrote.

4. **Defined-name references inside `<f>` text** are preserved
   verbatim. Whether the defined name still resolves correctly
   depends on whether the defined name was preserved (ADR-0036
   matrix item 4: yes, verbatim).

5. **Structured-table references** (e.g., `<f>Table1[Amount]</f>`)
   are preserved verbatim. Whether the underlying table is
   preserved is **implementation-defined** per ADR-0076, which added the
   pivot / sparkline / ListObject / page-break rows this clause was
   waiting on and deferred all four to XTL 1.1. (Until 2026-07-28 this
   pointed at an ADR-0036 row that had been intended but never written.)

### What is intentionally NOT yet adjusted — MUST NOT silently change

Per the principle in this ADR: implementations MUST NOT silently
rewrite formula references. Failed silently-correct behavior is
worse than honestly-unchanged behavior because the author can see
the unchanged formula and decide to use whole-column references
or rewrite.

1. **Relative cell references inside formulas are NOT adjusted to
   match the cloned row's position.** A template formula `=B2*2`
   on a `@repeat down` row stays `=B2*2` on every cloned row.
   Authors who want per-row arithmetic SHOULD either:
   - Use whole-column or absolute references that remain correct
     regardless of position (`=$B$2*2` is still wrong; there is
     no good single-formula solution in this case).
   - Use an XTL expression (`{{ [Column] * 2 }}`) which evaluates
     per-row at render time and produces a value, not a formula.
   - Author the template such that the formula references its
     own row symbolically — currently not possible without
     impl-side reference adjustment.

2. **Range references in formulas are NOT extended when `@repeat`
   expands the block.** A footer `=SUM(B2:B5)` placed below a
   4-row template block that expands to 10 rows remains
   `=SUM(B2:B5)`. Authors who want a sum across the expanded
   block SHOULD use whole-column references (`=SUM(B:B)` with a
   `@filter` upstream removing the header) or use an XTL
   aggregate (`{{ SUM([Column]) }}`).

### Why no auto-adjustment yet

Auto-adjusting formula references is *non-trivial*:

- Excel's formula grammar is rich (relative `B2`, absolute `$B$2`,
  mixed `$B2` / `B$2`, range `B2:B5`, structured table refs
  `Table1[Amount]`, cross-sheet `'Sheet 1'!B2`, defined names,
  array formulas).
- The right "shift" depends on whether the formula is on a
  cloned row (per-row context) vs in a footer cell after the
  block (range-extension context).
- Different implementations of XLSX writers have different
  formula AST representations; xl3-py (openpyxl) and xl3-js
  (ExcelJS) would need separate AST handling.

The principled response: document current behavior as the 0.x
contract; a follow-up ADR (placeholder ADR-0047) defines the
preserve-and-extend variant for formulas, parallel to ADR-0040
for CF/DV ranges.

## How this relates to ADR-0043

ADR-0043's "use the Excel-formula path for cell-output values"
advice is sound **for formulas that do not depend on per-row
reference adjustment**:

- ✅ `=UPPER("acme")` (literal) — works.
- ✅ `=NOW()` / `=TODAY()` — works.
- ✅ `=A1+1` referencing a fixed cell — works.
- ✅ `=HYPERLINK("https://...", "label")` (static) — works.
- ⚠️ `=B2*2` referencing the row's own column — works on the
  *first* rendered row only; remaining cloned rows reference
  the wrong row.
- ⚠️ `=SUMIF(B:B, "VIP", C:C)` whole-column — works (no row
  dependence).
- ❌ `=SUM(B2:B5)` where 2-5 was the original template span — the
  range does not extend.

Cookbook 16 will be updated (next commit) to use ✅ / ⚠️ / ❌
markers per case so authors know which Excel-formula path is
safe today.

## Conformance fixture

Fixture 129 (`129-cell-formula-preservation`) pins both the
present-tense MUSTs (text preservation, cached-result on
template row) and the present-tense MUST-NOTs (no silent
reference adjustment). Two cell cases:

- `C2: { formula: "B2*2" }` template — every rendered row
  carries the same `B2*2`.
- `B5 (post-block footer): { formula: "SUM(B2:B2)" }` template —
  shifted to its post-expansion row position, formula text
  unchanged.

## Consequences

- Porters have a precise contract: preserve text, do not adjust.
- ADR-0043's advice surface narrows: cookbook 16 (this commit's
  follow-up) explicitly flags which formula shapes work.
- Future ADR-0047 (placeholder) covers formula PE (preserve-and-
  extend). It pairs with ADR-0040 for CF/DV ranges — the same
  row-delta tracking machinery applies.

## References

- ADR-0036 — Template feature preservation matrix (which this
  ADR sharpens for the cell-formula row)
- ADR-0040 — Preservation extension (CF/DV range PE; this ADR
  defers the formula PE counterpart to ADR-0047)
- ADR-0043 — Excel-native preference principle (which relies on
  this ADR's contract)
- `evaluation.md` § "Styles and Workbook Structure" — adds
  formula-preservation row to the MUST list
