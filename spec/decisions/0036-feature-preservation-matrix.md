# ADR 0036 - Template feature preservation matrix

- **Status:** accepted
- **Date:** 2026-05-17
- **Spec target:** XTL 0.1
- **Affects:** evaluation.md § "Styles and Workbook Structure",
  ADR-0034 (absorption framework)

## Context

`evaluation.md` § "Styles and Workbook Structure" currently says:

> Implementations SHOULD preserve template workbook structure and
> formatting, including:
> - Cell style
> - Number/date format
> - Font, fill, border, alignment
> - Row height and column width
> - Merged cells where possible
> - Images where possible

This list is intentionally short, but the SHOULD-where-possible
phrasing leaves nine common Excel features undefined:

1. Image anchor behavior across `@repeat` row expansion
2. Conditional formatting (rules and ranges)
3. Chart objects and chart data ranges
4. Named ranges / defined names
5. Print area and print titles (repeating rows/columns)
6. Freeze pane / split
7. Sheet protection and cell locking
8. Data validation (dropdowns, range constraints)
9. Cell comments (notes)

Each of these is something a vendor template can ship with, and a
second-language port could silently lose any of them without
failing a fixture. Per ADR-0034 Corollary 1, this is an
absorption-of-experience moment: name each, choose XTL's answer,
pin it.

This ADR bundles all nine into one matrix rather than nine
separate ADRs because the underlying decision is the same for
most of them — preserve the template's own value, do not
auto-extend across `@repeat`. Bundling keeps the corpus
navigable.

## Considered Options

For each feature, three classes of answer:

- **Preserve verbatim (P).** Template feature survives to the
  output unchanged. Auto-extension across `@repeat` is *not*
  attempted.
- **Preserve and extend (PE).** Template feature survives *and*
  the engine adjusts its range/anchor when `@repeat` expands
  rows above or through it.
- **Deferred (D).** Out of scope for XTL 0.1. Behavior is
  implementation-defined until a later ADR.

## Decision

The per-feature decisions:

| # | Feature | Decision | Rationale |
|---|---|---|---|
| 1 | **Images** (anchored to ranges) | **P** | Preserve the template's image and its anchor range verbatim. `@repeat` does **not** shift image anchors. Authors who need images inside a repeat block should design the template so the image sits outside the block (header/footer/sidebar). |
| 2 | **Conditional formatting** | **P** | Preserve rules; ranges are kept as authored. Auto-extending CF ranges through `@repeat` is deferred — see Consequences. |
| 3 | **Charts** | **D** | Deferred. Chart object preservation depends on ExcelJS chart support (incomplete as of 2026-05); ports based on other libraries vary widely. A future ADR will revisit when Stage 2 conformance reaches charts. |
| 4 | **Named ranges / defined names** | **P** | Preserve workbook-scope and sheet-scope named ranges verbatim. References to ranges expanded by `@repeat` are **not** auto-adjusted. |
| 5 | **Print area / print titles** | **P** | Preserve as authored. Authors who want the print area to cover a repeat-expanded range should set it to the template's full sheet column (e.g., `$A:$Z`) or to repeating header rows (`$1:$1`). |
| 6 | **Freeze pane / split** | **P** | Already preserved via `views` forwarding (see `src/excel-document.ts:71`). This ADR pins that behavior as normative. |
| 7 | **Sheet protection / cell locking** | **P** | Preserve protection state and per-cell locked/hidden flags. Engine-written cells inherit the template cell's lock state, not a synthesized one. |
| 8 | **Data validation** | **P** | Preserve validation rules at the cell/range level. Ranges are not auto-extended. |
| 9 | **Cell comments** (notes) | **P** | Preserve verbatim. Comments on cells that get substituted (`{{ [Col] }}`) survive on the rendered cell. |

### Why P, not PE, for the items that could be auto-extended

Auto-extension (PE) is conceptually appealing — "the CF rule
should cover all `@repeat`-generated rows" — but the cross-impl
cost is high:

- Each feature has its own range-encoding format in OOXML (CF
  uses `sqref`, named ranges use `Sheet!$A$1:$B$10`, data
  validation uses `sqref`, print area uses workbook-scope defined
  names). Porting nine extension behaviors is nine ports' worth
  of work.
- Authors can usually achieve the same effect by anchoring the
  range with whole-column references (`$A:$A`) or by using
  Excel's "include only data rows" patterns. The need for
  engine-side extension is real but narrow.
- Silent extension is dangerous — a CF rule that auto-extends
  might bleed into a footer row the author meant to exclude.
  Authors are better served by explicit author-side patterns.

XTL 0.1 ships with all of these as P. PE for selected features
becomes a candidate for XTL 0.2+ if production users report it as
the dominant authoring pain point.

### Normative spec addition

`evaluation.md` § "Styles and Workbook Structure" is amended to
state each item explicitly. The current "where possible"
phrasing is replaced with concrete rules.

## Consequences

- A port that uses ExcelJS for I/O gets most of these for free
  (P via load→save round-trip). A port using a different library
  must verify that each feature in the table survives its
  load→save cycle and add explicit code paths where it doesn't.
- **Corrected 2026-08-02 — see the Amendment below.** Fixture
  coverage for this matrix is narrower than this bullet claimed, and
  the fixture it cited for image anchors is a different ADR's. The
  original text is retained for the record:

  > ~~Conformance fixture 123 (`123-template-feature-preservation`)
  > exercises items 1, 2, 4, 5, 6, 7, 8, 9 in Stage 2 OOXML
  > comparison. Item 3 (charts) is excluded per the **D**
  > decision. Image anchor across `@repeat` is exercised by
  > fixture 124.~~
- Adding "preserve and extend" semantics to any item is a
  *separate* future ADR. This ADR does not preclude PE for any
  item; it pins the 0.1 contract as P.
- Authors writing templates can rely on the table above as a
  promise: items marked P will survive to output. Items marked D
  may or may not.

## References

- ADR-0034 — Relationship to prior-art template engines (this
  ADR is the first batch absorption following Corollary 1)
- ADR-0033 — Merged source-table headers (Stage 2 pass-through
  pattern reused)
- ADR-0006 — Stage 2 OOXML conformance (where most of these are
  observed)
- ADR-0022 — Excel version compatibility (related catalog of
  what is and isn't portable)
- `evaluation.md` § "Styles and Workbook Structure"
- `src/excel-document.ts:65-75` (current `cloneWorksheet`
  pass-through path)

## Amendment (2026-08-02) — what the corpus actually covers for this matrix

The Consequences bullet above described fixture coverage that does not
exist. Two claims, both wrong:

**1. Fixture 123 is Stage 1 and covers two of the nine items, not eight
in Stage 2.**

The directory is `123-feature-preservation` — the name in the bullet,
`123-template-feature-preservation`, has never existed. Its `meta.yaml`
says what it does:

> Template features (named ranges, cell comments) are preserved verbatim
> … **Stage 1** cell-value comparison validates that the row data
> anchored by the named range and the cell carrying the comment survive
> the render cycle. **Full Stage 2 canonical comparison of every
> preservation feature awaits ADR-0006 canonicalizer updates.**

So it covers items **4** (named ranges) and **9** (cell comments). The
runner agrees, and says so even when asked for Stage 2:

```console
$ npx xl3-conformance --comparison-stage=2 --filter=adr-0036
  PASS  123-feature-preservation [stage 1]
```

**2. No fixture covers image anchors across `@repeat`.**

The bullet cited fixture 124, which is `124-source-2d-merge-header` — an
ADR-0033 fixture for merged source headers, as `conformance/coverage.md`
lists it. No fixture in the corpus references images at all.

### Actual coverage today

| Matrix item | Fixture | Stage |
|---|---|---|
| 4 — named ranges | `123-feature-preservation` | 1 |
| 9 — cell comments | `123-feature-preservation` | 1 |
| 1 — images / anchors | none | — |
| 2 — conditional formatting | none | — |
| 5 — print area / titles | none | — |
| 6 — freeze pane / split | none | — |
| 7 — sheet protection / lock flags | none | — |
| 8 — data validation | none | — |
| 3 — charts | none, per the **D** decision | — |

Related but outside the nine: `170-data-loss-numfmt-preserved-across-expansion`
checks in Stage 2 that a template row's number format reaches every
`@repeat`-expanded row, which is the per-cell half of
`evaluation.md` § "Styles and Workbook Structure".

### What this does and does not change

- **The decisions are untouched.** Every item stays **P**; the matrix in
  the Decision section is unchanged. This amendment corrects a claim
  about the *test corpus*, not about behavior.
- **The final Consequences bullet still stands**: an author can rely on
  the table as a promise. It is a spec promise, which is what the last
  bullet says — it was the *preceding* bullet that implied the promise
  was machine-verified across the board.
- **Landing the missing fixtures remains open**, blocked on the
  ADR-0006 canonicalizer work that fixture 123's own metadata points at.
  A Stage 2 comparison is what these items need: preservation is
  invisible to a Stage 1 cell-value diff, which is why 123 can only
  reach the two items whose effect shows up in values.

### Why it was written this way

Best guess, recorded so the pattern is recognizable rather than
mysterious: the bullet describes the fixture that *was intended* when
the ADR was drafted — eight items compared in Stage 2 — and the fixture
that landed was the subset achievable without the canonicalizer. The
Consequences text was never revised to match. The directory name in the
bullet (`123-template-feature-preservation`) reads like the planned name,
which supports that reading.

Found while writing `docs/support-matrix.md`, the user-facing reading of
this matrix. That page deliberately did not repeat these claims; it
states what fixture 123 checks and names the rows that are spec promises
rather than verified ones. This amendment brings the ADR into agreement
with it. Tracked as xl3#108.
