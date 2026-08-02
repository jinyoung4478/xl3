# ADR 0048 - Relationship to JXLS — final boundary and inconvenience refinement

- **Status:** process-normative
- **Date:** 2026-05-18
- **Spec target:** XTL 1.0 (boundary definition)
- **Affects:** ADR-0034 (extends), ADR-0043 (refines), all future feature
  ADRs (binds the scope question)

> The earlier compound `accepted (informational + process-level normative)`
> status was replaced 2026-05-18 with the new `process-normative` status
> added to `0000-template.md`. Semantics identical: future ADR authors
> MUST cite this ADR; impl authors need not honor it at runtime.

## Context

ADR-0034 named the "borrow JXLS's experience, not its syntax" working
principle and established three corollaries. ADR-0043 then added a
fourth: the Excel-native preference principle, which gates function
additions on whether evaluation must happen before rendering.

Two questions remain that have surfaced repeatedly:

1. **Where does xl3 *deliberately* diverge from JXLS?** Authors and
   porters need a single document they can cite when "JXLS has X — why
   doesn't xl3?" comes up. Otherwise every feature request reopens the
   same conversation.
2. **When *is* it acceptable to add XTL surface even when Excel can
   technically do it?** ADR-0043's "Excel can do it" test is too strict
   for cases where the Excel-native path is *technically possible but
   so inconvenient that authors will routinely make errors trying to
   use it.* HYPERLINK with a dynamic URL is the canonical example.

This ADR settles both. It is the *final* JXLS-boundary ADR — feature
ADRs after this one cite this document when explaining what is in,
what is out, and why.

## Decision — Part 1: The seven-axis boundary

xl3 is intentionally not JXLS-compatible. The seven divergences below
are *thesis-driven*, not gaps. A re-proposal to close any of them
must address the thesis cost, not just the feature ask.

| # | Axis | JXLS | xl3 | Thesis reason |
|---|---|---|---|---|
| 1 | **Expression language** | JEXL (Java-flavored mini-language) | Excel formula syntax | "Operators already know Excel formula — second language = second learning curve. Lower the barrier." (README § "Why xl3 exists") |
| 2 | **Directive placement** | Cell comments | Cell value `{{ @... }}` | "Template = handover artifact." Authors must SEE the directive when opening the file. Cell comments are hidden by default in Excel UI. |
| 3 | **Host extension (escape hatch)** | Java SPI custom commands | None (TypeScript host API only) | Escape hatches are not portable. Any port that doesn't expose the same SPI shape produces non-interchangeable templates. ADR-0034 Corollary 3. |
| 4 | **Function surface** | JEXL's entire library + Excel's full catalog | Minimal, ADR-0043-gated | Smaller spec → faster ports → faster ecosystem alignment. Surface bloat is the opposite of the "single source of truth" goal. |
| 5 | **External data sources** | JDBC / REST / arbitrary inputs via custom commands | XLSX in, XLSX out | "Templates = files, not host environments." External I/O is the host's responsibility, not the template's. **"XLSX"** here means OPC-packaged SpreadsheetML (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). **XLSM** is accepted on input as XLSX-with-macros-stripped and a warning is emitted; macros never execute. **XLSB, XLS (legacy), XLTX, CSV** are out of scope — a re-proposal must address conformance corpus + porter cost. |
| 6 | **Output formats** | XLSX + PDF + HTML (via Apache POI) | XLSX only | Browser-first design (xl3.io playground). PDF conversion in-browser is infeasible. Single output format also simplifies the conformance corpus. |
| 7 | **Library-vs-spec primacy** | Java library is the de-facto spec | `spec/` + `conformance/` is the spec; impl is fourth tiebreaker | Multi-language port viability. ADR-0034 + PORTERS_GUIDE.md make this explicit, but it bears repeating: xl3 will NEVER make its JavaScript impl the contract. |

Each row is a deliberate choice. Re-opening any row requires
revisiting the thesis itself — not just the feature.

## Decision — Part 2: The inconvenience refinement to ADR-0043

ADR-0043's gate (function lives in XTL only when evaluation must
happen before rendering) is sharpened with one carve-out:

> **A function MAY also live in XTL when the Excel-native path is
> *technically possible* but *so inconvenient that authors would
> routinely make errors* trying to use it. The threshold for
> "routine errors" is empirical (real-world template review evidence
> required), not theoretical.**

### Examples of the inconvenience carve-out

| Function | Excel-native path | Why it qualifies as inconvenient |
|---|---|---|
| `HYPERLINK(url, label)` | `=HYPERLINK("..." & [Url] & "...", "..." & [Label] & "...")` after escaping inner quotes | Nested quoting is error-prone. Authors will write subtly wrong escapes. XTL function makes intent obvious. |
| `IFS(c1, v1, c2, v2, ...)` | Nested `IF(...IF(...IF(...)))` chains | Above ~3 branches the nesting becomes unreadable. `IFS` flat structure is the Excel-native answer too — both work, but the deeply-nested form is the "routinely make errors" case. |
| `EOMONTH`, `EDATE` | `=EOMONTH(B2, 0)` etc. as cell formula | For pure cell-display: Excel-native works. The carve-out is for *render-time uses* (filter, filename) where Excel can't reach. Documented as 🟡 borderline in ADR-0043 table. |
| `ISBLANK` | `=ISBLANK(B2)` | The 🟡 borderline case from ADR-0047 — Excel-native works, but the function name is *the canonical Excel entry point* and rejecting it forces every Excel user to learn `IFEMPTY` first. The inconvenience is the learning curve, not the syntax. |

### Examples where inconvenience does NOT justify XTL addition

| Function | Excel-native path | Why inconvenience doesn't apply |
|---|---|---|
| `SQRT`, `POWER`, `MOD`, `INT` | Cell formula `=SQRT(B2)` etc. | Single function call, no quoting, no nesting. Convenient. ADR-0045 rejection stands. |
| `ISNUMBER`, `ISTEXT`, `ISDATE` | Cell formula `=ISNUMBER(B2)` etc. | Same — single function call. Author-error risk is low. ADR-0045 stands. |
| `NOW`, `WEEKDAY`, `WEEKNUM` | Cell formula | Same. ADR-0045 stands. |
| `TEXT()` format-token expansion to currency `₩`, percent `%`, accounting parens | Cell `numFmt` does it more *conveniently* than `TEXT()` (output stays numeric for downstream operations) | The Excel-native path is MORE convenient. Adding tokens to `TEXT()` would be the inconvenient path. ADR-0045 stands. |

### How to apply the carve-out

When proposing a new function under the inconvenience carve-out:

1. **Show the Excel-native path explicitly.** Write the formula the
   author would have to write. If it requires nested quoting, deep
   IF chains, or unusual cell-reference manipulation, that's
   evidence.
2. **Cite at least two real-world template examples** where the
   inconvenience would matter. Speculation doesn't count.
3. **Confirm the function still satisfies ADR-0043's five
   render-time-critical categories** for at least one use case —
   the inconvenience carve-out is a *bonus reason*, not a
   replacement for the original gate.

A proposal that fails (1) or (2) is rejected by default. A proposal
that passes (1) and (2) but fails (3) becomes a borderline case
documented in ADR-0043's retroactive table (the 🟡 marker).

## Grandfather rule (added 2026-05-18 per reviewer feedback)

Functions that landed before ADR-0043 / ADR-0048 (marked 🟡 in
ADR-0043's retroactive table — TEXT, HYPERLINK, YEAR, MONTH, DAY,
EOMONTH, EDATE, DATEDIF) were **not** required to clear the gate
in this ADR. They carry a "documented-choice" tag, NOT a
"passed-the-gate" tag. Concretely:

- They MUST NOT be cited as precedent in future re-proposals.
- A future proposer who matches a 🟡 function's strength of
  justification is not entitled to acceptance.
- The post-ADR-0048 evidence bar (two real-world templates
  authored by distinct people; at least one of the five
  render-time-critical categories from ADR-0043) applies uniformly
  to all post-0048 proposals.

This avoids the asymmetric situation where TEXT cleared no
evidence bar but a future SUMIF proposer is held to one.

## Consequences

- Future "JXLS has X, why doesn't xl3?" issues have a documented
  one-line answer: cite the relevant axis row in Part 1.
- ADR-0044's IFERROR/IFS/UPPER/LOWER/TRIM/DATE acceptance is
  reaffirmed under the refined principle — they survive the gate
  via render-time-critical context AND avoid the inconvenience
  trap (filename composition for DATE/UPPER, deep-nesting for
  IFS, error-cell guard for IFERROR).
- ADR-0047's ISBLANK acceptance is reaffirmed as the *canonical
  inconvenience carve-out* — Excel users reach for `ISBLANK`
  first; forcing them to learn `IFEMPTY` is the "routine error"
  case.
- The cookbook gains a "Why doesn't xl3 have X?" Q&A
  (placement TBD — likely a new recipe or appendix).
- xl3-py and any future ports cite this ADR as the source of
  truth for "where does xl3 stop matching JXLS."

## References

- ADR-0034 — Relationship to prior-art template engines (the
  framework this ADR closes)
- ADR-0043 — Excel-native preference principle (this ADR refines
  its gate)
- ADR-0044 — Function batch accepted (use cases for the
  inconvenience carve-out)
- ADR-0045 — Function batch rejected (re-validated under refined
  principle)
- ADR-0047 — ISBLANK as IFEMPTY alias (the canonical
  inconvenience case)
- README § "Why xl3 exists" — the thesis the seven-axis boundary
  protects
- PORTERS_GUIDE.md § "What you MUST match" / § "Function table is
  bounded" — porter consequences

## Amendment (2026-08-02) — axis 5 admits a JSON source, and a CLI reaches it

Axis 5 reads **"XLSX in, XLSX out"** and enumerates what is out of scope
(XLSB, XLS, XLTX, CSV). It was written before **ADR-0075**, which added
`xl3-source-json/0.1` and shipped `convertJson` / `previewJson` in
0.11.0. The row's input half is therefore incomplete: a **source** may
also arrive as the language-neutral JSON wire format.

What this amendment does **not** change:

- **The thesis stands.** Axis 5's point is that external I/O belongs to
  the host, not the template — no JDBC, no REST, no fetching from inside
  a template. Accepting typed rows the host already holds is the same
  boundary, not a relaxation of it. xl3 still performs no I/O of its own.
- **The template is still XLSX.** Only the source input gained a second
  spelling. The template is the operator-authored artifact and that is
  the whole positioning; `.xlsx` remains its only form.
- **Output is still XLSX only** (axis 6, unchanged).
- **The out-of-scope list is unchanged.** XLSB, XLS, XLTX, and CSV remain
  out of scope, and a re-proposal still owes conformance-corpus and
  porter cost.

Axis 5 should now be read as: **XLSX or `xl3-source-json/0.1` in, XLSX
out.**

Related, and the reason this was noticed: 0.12.0 adds an `xl3` bin, so a
host in any language can pipe the wire format in and get `.xlsx` files
out without embedding a JS runtime. That closes the practical gap for
JVM teams that axis 5's wording implied — they no longer have to build a
workbook to hand xl3 their data. **Axis 3 (no host extension / SPI
escape hatch) is untouched**: a JXLS deployment that depends on custom
Java commands still has no migration path, by design.

