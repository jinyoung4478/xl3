# Migrating from 0.x to 1.0

ROADMAP gate **G19**. Every behavior change across 0.x that can affect an
existing template or host, with what to do about it.

## Short version

**If your templates convert cleanly on 0.11.0, 1.0 changes nothing for
you.** 1.0 is a stability commitment, not a redesign — it freezes the
surface that 0.11.0 already has.

The work of migrating is therefore *getting to 0.11.0*, not getting from
0.11.0 to 1.0. Two things to do:

1. If you are on `@jinyoung4478/xl3`, switch to `@xl3-lang/xl3`
   (install name only — see [Package rename](#package-rename-0100)).
2. Run `convert()` over your real templates on 0.11.0. If they all
   succeed and the output looks right, you are done.

## The pattern worth knowing

Almost every behavior change in 0.x did the same thing: **replaced
silently-wrong output with a stable error code.**

That shapes the risk. Upgrading is unlikely to quietly change a report —
it is likely to make a bad template *start failing*, at convert time,
with a code naming the cell. A template that was producing plausible but
wrong numbers is the one that breaks, which is the outcome you want.

Three changes are the exception and can alter output without raising
anything. Those are worth reading closely.

## Changes that alter output without erroring

These are the only ones that can change a report you already trust. Check
these first.

### Division by zero renders `#DIV/0!` (0.2.0, ADR-0025)

A zero divisor used to render `0`. It now produces an Excel-style
`#DIV/0!` error cell. The workbook still renders and the other rows are
unaffected — only that cell carries the error.

**What to do:** if a `0` in a computed column was actually a
divide-by-zero, it will now be visible. That is a correction, but
downstream consumers that sum the column will see an error cell instead
of a zero. Guard the divisor in the template (`IF([Qty] = 0, 0, [Total] /
[Qty])`) if you want the old value.

### Empty group key renders `(blank)` (0.3.0, ADR-0026)

When a file- or sheet-name template substitutes a group key whose value
is empty:

- **File names** used to fail with `xl3/filename/empty`. They now emit
  the literal token `(blank)`, matching Excel's pivot convention.
- **Sheet names** used to fall back to the literal `Sheet`. They now emit
  `(blank)` too.

**What to do:** nothing, unless you were relying on the failure to catch
empty keys upstream. A conversion that used to stop now produces a file
named with `(blank)` in it.

### Whitespace around a single block makes it a single-expression cell (0.7.0, ADR-0052)

A cell containing `␣␣{{ [Amount] }}␣␣` — one block with surrounding
whitespace and nothing else — used to count as *mixed text*, so the
template cell's number format did not apply and the result was a string.
It is now a single-expression cell: the value keeps its type and the
cell's number format coerces it.

**What to do:** this usually fixes such cells rather than breaking them.
But if a template relied on getting a string out of a number-formatted
cell, the output type changes. Search your templates for blocks with
stray leading or trailing spaces.

### Formula cached results are no longer scanned for markers (0.10.0, ADR-0073)

A native formula cell whose cached `<v>` result happened to look like
`{{ … }}` — a common Excel/LibreOffice round-trip artifact — could
silently demote a `@subtotal` row. Marker recognition now ignores formula
cells entirely.

**What to do:** nothing. Templates affected by this rendered wrongly
before and render correctly now.

## Changes that turn silent-wrong into an error

Each of these used to produce output. It now raises at parse or eval time,
naming the cell. If none of them fire on your templates, none of them
affect you.

| Version | What changed | Raises |
|---|---|---|
| 0.2.0 | Wrong argument count on `IF`, `ROUND`, `XLOOKUP`, `SUM`, … — previously a silent string fallback or a crash | `xl3/eval/arity-mismatch` |
| 0.2.0 | Non-numeric string in arithmetic (`"abc" + 5`) — previously coerced to `0` | `xl3/eval/operand-coercion` |
| 0.3.0 | Source column named like an internal context key (`Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`, or any `__name__`) — previously shadowed silently and rendered `[object Object]` | `xl3/source/reserved-column-name` |
| 0.3.0 | Empty or malformed directive body (`{{ @filter }}`, `{{ @sort foo }}`) — previously no-opped, so the directive silently did nothing | `xl3/directive/invalid-syntax` |
| 0.3.0 | Unary operator on a non-literal (`-[col]`, `+5`, `-(expr)`) — previously rendered the expression literally | `xl3/eval/unsupported-syntax` |
| 0.6.0 | `__inputs__` `default` / `label` / `description` / `options` cells containing `{{ … }}` are now evaluated, not passed through as literal text | varies by expression |
| 0.7.0 | Leading-zero directive forms (`@top 05`, `@repeat right 05`) | parse error |
| 0.7.0 | Non-column-ref aggregate argument (`SUM(literal)`, `SUM([a] + [b])`) — previously produced `literal × row_count` | `xl3/eval/bad-aggregate-arg` |
| 0.7.0 | `{{ __lists__[x] }}` outside `@filter in` / `!in` — previously stringified the underlying array | `xl3/lists/invalid-use` |
| 0.7.0 | String coercion of `"0x10"`, `"0b101"`, `"0o17"` — previously parsed via JavaScript `Number()`. Scientific notation (`"1e5"`) is still accepted | `xl3/eval/operand-coercion` |
| 0.10.0 | A `@subtotal` row that also carries a current-row `[Column]` reference outside an aggregate — previously rendered the subtotal band after *every* data row with grand-total values | `xl3/subtotal/mixed-row` |
| 0.10.0 | `@group` / `@subtotal` on a sheet using explicit `@block` declarations — previously the subtotal band was silently omitted entirely | `xl3/subtotal/explicit-block-unsupported` |

For the 0.6.0 `__inputs__` change specifically: the prior behavior showed
the host UI `{{ TODAY() }}` verbatim, which was reported as a bug every
time. If you genuinely need literal curly braces there, split them across
two cells or post-process in the host.

## Package rename (0.10.0)

`@jinyoung4478/xl3` → **`@xl3-lang/xl3`**, matching the `xl3-lang` GitHub
organization the repository moved to.

```sh
npm uninstall @jinyoung4478/xl3
npm install @xl3-lang/xl3
```

Install name only. The public API, the `xl3-conformance` bin, and all
behavior are identical. The old package is deprecated on npm with a
pointer to the new one.

## For porters and spec consumers

Two changes affect implementations rather than templates.

**0.5.0 tightened feature preservation from advisory to normative.**
`evaluation.md` "Styles and Workbook Structure" previously listed
preserved features "where possible"; that was replaced with an explicit
MUST-preserve table (ADR-0036). A port that treated the old wording as
best-effort now has a concrete list to satisfy. `evaluation.md` "Source
Data Model" also gained merged-header rules (ADR-0033) and the merge
data-row broadcast paragraph (ADR-0035) in the same release.

**0.6.0 retired an ADR status string.** `accepted (informational +
process-level normative)` became `process-normative`. If your tooling
matches on ADR status text, update it. No template is affected.

## How to check before upgrading

```sh
npm install @xl3-lang/xl3@0.11
```

Then run `convert()` over your real templates with real data. The errors
above all fire at parse or eval time and name the offending cell, so a
clean run over representative templates is a strong signal.

Worth doing on the *output* as well as the exit code, because of the four
changes in [the section above](#changes-that-alter-output-without-erroring)
— those do not raise. In particular, diff a before/after workbook if any
of your templates divide, group on a column that can be empty, or have
blocks with stray whitespace.

## What 1.0 itself changes

Nothing in the areas above. 1.0 freezes:

- the public API surface (`spec/STABILITY.md` "Public API surface")
- the error code catalog (ADR-0015) — additive only after 1.0
- the ADR set listed under `spec/STABILITY.md` "What 1.0 freezes"

Additions after 1.0 remain possible; removals, renames, and signature
changes become 2.0-only. See `spec/STABILITY.md` for the full policy and
`ROADMAP.md` for what still gates the 1.0 cut.
