# ADR 0076 - Preservation matrix amendment: pivot tables, sparklines, structured tables, page breaks deferred to 1.1

- **Status:** accepted (deferral; behavior deliberately left
  implementation-defined for XTL 1.0)
- **Date:** 2026-07-28
- **Spec target:** XTL 0.1 → 1.0
- **Affects:** ADR-0036 (template feature preservation matrix),
  ADR-0046 § 5 (structured-table references),
  evaluation.md § "Styles and Workbook Structure",
  ROADMAP gate G12

## Context

ROADMAP gate **G12** requires each of four Excel features to be pinned
before 1.0, by *either* a conformance fixture recording current behavior
*or* an ADR explicitly deferring the feature to 1.x: **pivot tables**,
**sparklines**, **structured tables (ListObject)**, and **page breaks**.

None of the four is resolved today:

- ADR-0036's matrix has nine rows and covers none of them.
- ADR-0046 § 5 forward-references *"ADR-0036's pivot/ListObject row
  (still undefined as of 2026-05-18; see G12 in ROADMAP)"*. That row was
  intended and never written, so a normative document points at a rule
  that does not exist.
- ADR-0034 mentions page-break handling only as prior-art prose.
- `sparkline` appears nowhere in `spec/`.

The gate offers "defer to 1.1 with ADR" as its fallback. This ADR takes
it, and closes the dangling reference at the same time.

## Observed reference-impl behavior (non-normative)

Measured against the reference impl at 0.11.0, so the deferral is made
with the facts rather than around them. **None of this is normative** —
a conformant 1.0 implementation may do otherwise, which is what
"deferred" means.

| Feature | Reference impl today | How established |
|---|---|---|
| **Pivot table** | Cannot be authored or preserved. ExcelJS exposes no pivot API (`addPivotTable`, `pivotTables` are both `undefined`), so the part is not carried through. | Library surface inspection |
| **Sparkline** | Same — no ExcelJS API (`addSparkline`, `sparklines` both `undefined`). | Library surface inspection |
| **Structured table (ListObject)** | `xl/tables/tableN.xml` **is** carried through to the output. Its `ref` is **not** extended: a table authored `ref="A1:A2"` over a `@repeat` row still reads `ref="A1:A2"` after the sheet expands to five rows, so the table covers the header and first data row only. | Round-trip probe through `convert()`, reading the output package |
| **Page break** | **Dropped.** A template whose sheet XML contains `rowBreaks` produces output with no `rowBreaks`. | Round-trip probe comparing template and output sheet XML |

Two of these are worth naming plainly, because a reader of ADR-0036
would predict the opposite:

**Structured tables are the misleading case.** "Preserved" is true of the
part and false of the intent. After expansion the table no longer covers
the data it was authored around, which is consistent with ADR-0036's
"ranges are not auto-extended" rule but is not what an author who wrapped
a repeat row in a table expects to get.

**Page breaks contradict a neighbouring row.** ADR-0036 row 5 preserves
*print area and print titles*. An author reasonably reads that as "my
print setup survives" — but page breaks, which are part of the same
mental model, do not.

## Decision

1. **All four features are implementation-defined for XTL 1.0.** A
   conformant implementation MAY preserve, drop, or partially preserve
   pivot tables, sparklines, structured tables, and page breaks. Nothing
   in the corpus asserts any of the four, and a port that behaves
   differently from the reference impl is still conformant.

2. **Normative definition is deferred to XTL 1.1.** Each feature is
   revisited when Stage 2 conformance reaches it, on the same schedule as
   charts (ADR-0036 item 3).

3. **ADR-0036's matrix is amended** with four rows, so the matrix stops
   being silent on features that ADR-0046 already points at:

   | # | Feature | Decision | Rationale |
   |---|---|---|---|
   | 10 | **Pivot tables** | **D** | Deferred. Depends on library pivot support, which ExcelJS lacks entirely; other-language ports vary widely. Revisit with charts when Stage 2 reaches them. |
   | 11 | **Sparklines** | **D** | Deferred, same reasoning. An `x14` extension feature with no ExcelJS support. |
   | 12 | **Structured tables (ListObject)** | **D** | Deferred. The reference impl carries the table part but not its `ref` extension, so "preserve" and "preserve-and-extend" give materially different results and the choice needs the PE analysis ADR-0040 applied to CF/DV. |
   | 13 | **Page breaks** | **D** | Deferred. Distinct from print area / print titles (row 5) despite the adjacency, and dropped by the reference impl today. |

4. **ADR-0046 § 5's forward reference resolves here.** Structured-table
   *references inside formulas* (`<f>Table1[Amount]</f>`) remain
   preserved verbatim per ADR-0046; whether the underlying table survives
   is implementation-defined per this ADR.

5. **No conformance fixture is added.** A fixture pinning "page breaks
   are dropped" would assert the behavior this ADR explicitly declines to
   assert, and would have to be deleted in 1.1. G12's criterion is
   satisfied by the deferral arm, not the fixture arm.

## Consequences

**For template authors.** Do not rely on any of the four surviving a
conversion. Concretely: put pivot tables and sparklines in a workbook
the host builds *after* conversion rather than in the template; if a
structured table must cover expanded data, widen its `ref` to the sheet's
full column range in the template (the same workaround ADR-0036
recommends for conditional formatting); set page breaks host-side.

**For porters.** These four are outside 1.0 conformance. Passing the
corpus does not require handling them, and handling them does not risk
failing it. Do not infer a requirement from the reference impl's
behavior — the table in this ADR is a record, not a target.

**For 1.1.** Structured tables are the strongest candidate to promote
first: the part already survives, so only range extension is missing, and
ADR-0040 has already worked out the PE pattern for CF and DV ranges.
Pivot tables and sparklines are blocked on library support rather than on
design.

**Risk accepted.** Four features stay unspecified through 1.0, so two
conformant implementations can differ visibly on the same template. This
is the same trade ADR-0036 made for charts, for the same reason: pinning
a behavior nobody can implement portably would either freeze an ExcelJS
artifact into the spec or block 1.0 on library work outside the project's
control.
