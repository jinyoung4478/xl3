# What xl3 preserves — and what it doesn't

One question decides whether xl3 fits your template: **does the workbook
come out the other side intact?** This page answers it feature by
feature.

Everything below is a spec decision, not a quirk of one implementation.
The rows marked *deferred* are deferred on purpose, with an ADR saying
so — that is different from "nobody checked."

## The three verdicts

| Verdict | What it means |
|---|---|
| **Preserved** | Comes out identical to the template. Every conforming implementation must do this. |
| **Preserved, range not extended** | The feature survives, but its range keeps the coordinates the template gave it. If `@repeat` grows the sheet from 1 row to 50, the range still covers the 1 row. There is an author-side fix for each — see the notes. |
| **Deferred** | XTL 0.1 asserts nothing. It may survive, it may be dropped, and two conforming implementations may disagree. Don't build on it before 1.1. |

## Layout and formatting

| Feature | Verdict | Notes |
|---|---|---|
| Cell style — font, fill, border, alignment | **Preserved** | |
| Number and date formats | **Preserved** | Also inherited by every `@repeat`-expanded row, not just the first — see [Formatting inside a repeat block](#formatting-inside-a-repeat-block). |
| Row height, column width | **Preserved** | |
| Merged cells | **Preserved** | In the template and in source data rows (ADR-0033, ADR-0035). |
| Images and their anchors | **Preserved** | The anchor does **not** shift when `@repeat` inserts rows above it. Put images in a header, footer, or sidebar — outside the block. |
| Freeze panes and splits | **Preserved** | |
| Cell comments (notes) | **Preserved** | A comment on a `{{ [Column] }}` cell survives onto the rendered cell. |
| Sheet protection, per-cell lock/hidden flags | **Preserved** | Engine-written cells inherit the template cell's lock state rather than a synthesized default. |
| Workbook properties — theme, document properties | **Preserved** | Fixture `120-workbook-properties-preserved`. |
| Native Excel formulas in static cells | **Preserved** | A formula xl3 didn't generate is carried through untouched (ADR-0046). Use this for anything Excel can compute at open time — see [Cookbook 16](./guides/16-xtl-vs-excel-formula.md). |

## Rules with ranges

These survive, but their ranges stay where the template put them. The
engine does not silently widen a rule to cover rows it never mentioned —
a conditional-format rule that auto-extended could bleed into a footer
row the author meant to exclude.

| Feature | Verdict | Author-side fix |
|---|---|---|
| Conditional formatting | **Preserved, range not extended** | Anchor the rule to a whole column (`$A:$A`) in the template. Measured today: a 1-row block that expands to 3 rows leaves the rule on `A2:A2`. |
| Data validation (dropdowns, constraints) | **Preserved, range not extended** | Same fix. Measured today: validation authored on `B2` stays on `B2` alone after expansion. |
| Named ranges / defined names | **Preserved, range not extended** | Workbook-scope and sheet-scope both survive; references into a repeat-expanded area are not re-pointed. |
| Print area, print titles | **Preserved, range not extended** | Set the print area to a full column span (`$A:$Z`) or repeating header rows (`$1:$1`). |

## Deferred to 1.1

Four features are deliberately left implementation-defined for 1.0
(ADR-0076). The reference implementation's current behavior is recorded
below so you can plan around it, but **none of it is a promise** — that
is what deferred means.

| Feature | Reference implementation today |
|---|---|
| Pivot tables | Not carried through. Cannot be authored or preserved. |
| Sparklines | Not carried through. |
| Structured tables (ListObject) | The table part **survives**, but its `ref` is not extended: a table authored over a `@repeat` row still covers only the rows it originally spanned. Widen the `ref` to a whole column in the template. |
| Page breaks | **Dropped.** Despite sitting next to "print area" conceptually, page breaks are not covered by it. Set them host-side after conversion. |
| Charts | Implementation-defined (ADR-0036 item 3). The reference implementation reads and writes through ExcelJS, whose chart support is incomplete — do not rely on charts surviving. |

## Removed on purpose

| Feature | Behavior |
|---|---|
| Macros (VBA, XLM) | **Stripped, always.** An `.xlsm` input is accepted as XLSX-with-macros-removed and a warning is emitted. Macros never execute, and no host or template can opt back in during 1.x. See [SECURITY.md](../SECURITY.md). |

## Formatting inside a repeat block

Ranges and per-cell formatting behave in opposite directions, and the
difference catches people out.

A range anchored at `A2:A2` in the template is still `A2:A2` after ten
rows are emitted. But all ten of those rows carry `A2`'s number format
and cell style — engine-written cells take the template cell's
formatting, every row, not only the first.

That second half matters more than it sounds. Losing the format on rows
2..N is silent data loss: a column whose first row reads `1,234.50` and
whose remainder reads `1234.5` looks like a styling slip and is
indistinguishable from one. Nine fixtures tagged `data-loss` exist to
keep that from regressing.

## Size limits

| Limit | Value |
|---|---|
| Memory | **~2.2 KB per output cell** at scale, on a ~130 MB floor. 2M cells needs roughly 4.2 GB peak RSS. |
| Cells per conversion | ~2,000,000 verified end to end; ~500,000 fits in a 2 GB host. Size the host at 2.2 KB/cell before assuming a bigger job runs. |
| Cell string length | xl3 writes what you give it. Excel rejects cells over 32,767 characters on read, and xl3 does **not** pre-validate — check length upstream if the output must open in Excel (ADR-0032). |

Exceeding available memory surfaces as a host-level out-of-memory, not
as an xl3 error — xl3 cannot catch it. Long conversions accept an
`AbortSignal`.

## Where these decisions live

This page is a plain-language reading of the normative sources. When
they disagree, they win:

- [`spec/evaluation.md` § Styles and Workbook Structure](../spec/evaluation.md) — the normative rules
- [ADR-0036](../spec/decisions/0036-feature-preservation-matrix.md) — the nine-feature preservation matrix and why each is preserve-verbatim rather than preserve-and-extend
- [ADR-0076](../spec/decisions/0076-pivot-sparkline-listobject-pagebreak-deferred.md) — pivot / sparkline / ListObject / page break deferred to 1.1, with measured behavior
- [ADR-0046](../spec/decisions/0046-cell-formula-preservation.md) — native Excel formulas in static cells
- [ADR-0032](../spec/decisions/0032-niche-limits-and-pass-through.md) — string length and other niche limits
- [ADR-0022](../spec/decisions/0022-excel-version-compatibility.md) — Excel version compatibility
- [SECURITY.md](../SECURITY.md) — the macro, network, and filesystem stance

## How much of this is machine-checked

Partly, and it is worth knowing which parts.

- `123-feature-preservation` checks named ranges and cell comments
  surviving the render cycle, as a Stage 1 cell-value comparison.
- `170-data-loss-numfmt-preserved-across-expansion` checks, in Stage 2,
  that number formats survive `@repeat` expansion — the trap described
  above.
- A full Stage 2 canonical comparison of *every* row in the tables above
  is still pending canonicalizer work under ADR-0006.

So the rows without a fixture behind them are spec promises rather than
machine-verified ones. Every implementation runs the same [conformance
corpus](../conformance/README.md), so what is checked is checked
everywhere — but the corpus does not yet cover the whole matrix, and
this page would rather say so than imply otherwise.
