# ADR 0070 — Derived columns (operator-authored computed group keys)

- **Status:** proposed
- **Date:** 2026-06-10
- **Spec target:** XTL 1.x (additive; backward-compatible, deferred from the 0.1 → 1.0 freeze per STABILITY.md "intentionally deferred")
- **Affects:** language.md (Group Keys, new "Derived Columns" section); evaluation.md (reserved sheets, render phases); impl (parser, grouper/pre-pass, renderer naming); new reserved sheet + new error codes
- **Issue:** #54

## Context

Operators want output **sheet/file names** driven by a lookup — e.g. a
거래처/지점 code mapped to a human display name, or one output per entry
of an operator-maintained table. Two hard limits block this today:

1. **Sheet-name patterns cannot contain `[` or `]`** (language.md
   "Group Keys"). The pattern lives in the worksheet **tab name**, and
   Excel forbids `[`/`]` in tab names — so `{{ [Col] }}` or
   `{{ XLOOKUP([code], Map[code], Map[name]) }}` is impossible to even
   author there. Sheet names accept only **bare group keys**
   (sheet group key → `__inputs__` → `__config__`, per ADR-0054).
2. **Group keys are column names.** `grouper.ts` partitions by reading
   `row[key]` directly; a key must be a real column on the source row.
   There is no way to group by, or name by, a value that is *computed*
   (looked up, concatenated, formatted) rather than stored.

`__lists__` does not help: it is a membership **array** (`name → string[]`),
valid only as the RHS of `@filter … in/!in` (ADR-0057), and the
normalizer rejects it everywhere else (`xl3/lists/invalid-use`). It is
not a `key → value` map and cannot be referenced in a name.

The current spec-clean workaround is to materialize the display value as
a **real source column** — authored upstream, or via a `source_table`
Excel formula column whose cached result is read as data (ADR-0046,
fixtures 014/036) — then group by that column. This works but forces the
mapping into the **data**. The xl3 positioning is *operator-authored
rules + dev-owned engine*: the operator should be able to declare the
mapping **in the template**, not require it baked into every data export.

## Decision

Introduce **derived columns**: named expressions, authored by the
operator in the template, evaluated **once per source row** and
**materialized onto the row** before grouping and rendering. A derived
column is indistinguishable from a real column downstream — it can be a
**group key** (hence usable bare in sheet *and* file names), read in a
cell as `{{ [Name] }}`, etc.

This sidesteps limit (1) entirely: the lookup expression is authored
where brackets are legal (a reserved cell), and the tab name references
only the **bare** derived name. It dissolves limit (2): grouping/naming
keep reading `row[key]` — the engine just populated that key first.

### Declaration surface (RECOMMENDED — see Alternatives)

A new reserved sheet `__derived__`, parallel to `__lists__`/`__sources__`:

| name        | expression                                         |
|-------------|----------------------------------------------------|
| RegionName  | `XLOOKUP([region_code], Regions[code], Regions[name])` |
| Period      | `TEXT(TODAY(), "YYYY-MM")`                          |

- Row 1 = headers `name`, `expression` (fixed).
- Each subsequent row declares one derived column.
- The `expression` cell is an ordinary cell → **brackets and function
  calls are legal** (the whole point — it is NOT a tab name).
- Evaluated per source row with the row context + reserved sheets
  (`__sources__`, `__config__`, `__inputs__`) in scope, exactly like a
  data-cell expression. `XLOOKUP(Source[…])` is therefore the map
  primitive — **no new `key→value` map structure is introduced**;
  a lookup table is just a declared source (ADR-0013).

### Semantics

- **Evaluation order:** after sources are read and `@join` applied,
  before `@filter` / grouping. A derived column MAY reference real
  columns of its own row and other reserved sheets; it MUST NOT
  reference another derived column (no forward/inter-derived refs in
  1.x — keeps evaluation a single pass; revisit if needed).
- **Row-local only:** a derived expression MUST NOT reference an
  aggregate function (`SUM`, `COUNT`, `AVERAGE`, …). The pre-pass
  evaluates one row at a time and has no set to aggregate over: it runs
  *before* `@filter` and grouping, so the row set an aggregate would
  read does not exist yet. Violation is a declaration-time error
  (`xl3/derived/aggregate-reference`), detected by inspecting the parsed
  expression, not at eval time. Resolved 2026-08-03 — see **Resolved
  before implementation**.
- **Materialization:** `row[name] = eval(expression, rowCtx)`. The name
  occupies the same namespace as source columns. A derived name MUST be
  unique across the whole bare-resolution surface, enforced at
  **declaration time** (`xl3/derived/name-collision`) — see **Name
  collision** below.
- **Naming and reference surface:** no change to the naming or reference
  layer. A derived name is referenced **exactly like a source column** —
  bare in sheet/file-name patterns (`extractGroupKeys` already picks it
  up; grouping reads the materialized value) and `{{ [Name] }}` in cells
  / directives. There is **no** `__derived__[Name]` reference form: once
  declaration-time uniqueness (below) holds, a bare/`[Name]` reference is
  already unambiguous, so a qualifier would add a second spelling with
  zero correctness gain — and could not be applied in sheet names anyway
  (`[`/`]` forbidden), producing inconsistent spellings for one key.
  Keeping references identical to source columns preserves this ADR's
  "indistinguishable from a real column" property (see Alternatives 5).
- **Errors:** a derived expression that throws surfaces with the
  derived column's name and the offending row context.

### Name collision (declaration-time uniqueness)

*(Scope and identity below resolved in #54 review.)*

Because a derived name is referenced bare, and **sheet-tab names cannot
carry a qualifier** (`[`/`]` forbidden — limit (1) above), a name clash
cannot be disambiguated at the reference site. A derived name materialized
as a group key sits **first** in the bare sheet-name chain (group key →
`__inputs__` → `__config__`, ADR-0054), so a clash would **silently
shadow** the other binding rather than error. Namespacing the reference
therefore cannot be the safety mechanism; the only sound guard is to make
the name **unique at declaration time**, mirroring evaluation.md's
"Authors MUST NOT reuse system key names".

A derived name is a **declaration error** (`xl3/derived/name-collision`)
when it equals any of:

1. a source column in the **post-`@join` combined row schema** (wider than
   a single source's columns — the row a derived expression sees);
2. another derived name (`__derived__` internal duplicate);
3. an `__inputs__` key or a `__config__` key (the rest of the bare
   sheet-name chain);
4. an **engine-reserved context identifier** injected into the row/name
   context — `Rows`, `__rownum`, `__activeSource__`, `__joinedRow__`.
   (`Rows` in particular is spread onto the row context *after* the row's
   own keys, so a derived `Rows` would be silently clobbered, not errored
   — hence a declaration guard.) Reserved **sheet** names (`__config__`,
   `__lists__`, …) are already rejected by `xl3/sheet/reserved-name`.

`__sources__` and `__lists__` names are **not** in this set: a source name
appears only as the `Source[col]` prefix (distinct syntax from a bare/
`[Name]` reference) and a list name only as the `@filter … in __lists__[X]`
RHS (`xl3/lists/invalid-use` blocks it elsewhere, ADR-0057) — neither lies
on any bare-resolution path, so a derived name cannot shadow them.

**Identity for the comparison:** trimmed, **byte-exact (case-sensitive,
no NFC folding)** — the same identity every resolver in the engine uses
for column / group-key / `__config__`-key lookup (`ctx[column]`,
`row[key]`, `sheetKey.values[name.trim()]`). NFC normalization is applied
**only** to filename↔template matching (`match_pattern`), not to name
resolution, so the guard must not fold case or normalize either, on pain
of false collisions or a gap versus the resolver. (Engine-wide
case/Unicode folding, if ever wanted, is a separate decision, not this
ADR's.)

## Scope

- **In scope (this ADR, the #54(A) slice):** derived columns +
  their use as group keys / in names / in cells.
- **Out of scope (deferred to a follow-up, #54(B)):** list/table-driven
  **fan-out** — emitting an output per *declared* entry even when the
  data has zero matching rows, and ordering outputs by a declared list.
  That changes the output-generation axis (grouper/renderer emit
  outputs only for groups that exist in the data today) and warrants its
  own ADR.

## Consequences

- Operators express mapping/derivation **in the template**, matching the
  product positioning. Lookups reuse `XLOOKUP` + a source — one mental
  model, no new map type.
- Implementation is contained and low-risk: a **pre-pass** that stamps
  derived values onto rows; grouping, naming, and cell eval are
  unchanged because they already operate on `row[col]`.
- Files: `parser.ts` (read `__derived__`, validate the declaration-time
  uniqueness guard over the full bare-resolution surface, collect into the
  template model), a grouper/render pre-pass (materialize per row),
  `normalizer`/`extractColumnRefs` (derived names resolve as columns —
  no new reference syntax), `types.ts`, new error codes, spec text, and
  stage-1 conformance fixtures (derived-key sheet name, derived-key
  filename, lookup via source, and `name-collision` errors covering each
  bucket: source column, duplicate derived, `__inputs__`/`__config__`
  key, reserved identifier such as `Rows`).
- Additive only: no existing template changes behavior. No public API
  break; new reserved sheet + new error codes (catalog addition, not a
  G3-resetting change — additions are allowed).

## Alternatives considered

1. **Declare in `__config__` rows** (`derived.RegionName = …`). Rejected:
   `__config__` is flat fixed-key metadata; overloading it with an
   open-ended `name → expression` map is muddier than a dedicated sheet.
2. **A `@derive Name = expr` directive in-sheet.** Viable, but couples a
   sheet-level construct to a workbook-global concern (the same derived
   key is wanted across sheets/files) and complicates per-sheet scoping.
   A reserved sheet is workbook-global by nature.
3. **A new `key→value` map sheet (`__maps__`) + a bare-free `LOOKUP`
   function.** Rejected as redundant: `XLOOKUP` against a source already
   is the map; adding a second lookup mechanism + data type is surface we
   do not need.
4. **Allow brackets in sheet-name patterns.** Impossible: the constraint
   is Excel's (tab names cannot contain `[`/`]`), not ours.
5. **A `__derived__[Name]` reference form** (an explicit qualifier in
   bracket-legal contexts, for self-documentation). Rejected: with
   declaration-time uniqueness (Name collision) a bare / `[Name]`
   reference is already unambiguous, so the qualifier adds no
   correctness; it cannot appear in sheet names (`[`/`]` forbidden), so a
   single key would be spelled two different ways across contexts; and a
   second reference spelling is precisely the surplus surface the
   small-surface thesis (ADR-0043, README "boring runtime") avoids.
   Derived columns therefore stay referenced identically to source
   columns, preserving the "indistinguishable from a real column"
   property. (Debuggability — telling a derived `{{ [X] }}` from a source
   one — is served by the single `__derived__` declaration site plus the
   uniqueness guard, not by a reference marker.)

## Resolved before implementation (2026-08-03)

Both open questions are closed. The alternatives are kept visible rather
than deleted, so a re-proposal argues against a recorded reason instead of
a blank.

### Reserved sheet name — `__derived__`

Kept, over `__columns__` and `__keys__`.

The existing four reserved sheets name their contents with a plural noun
(`__config__`, `__inputs__`, `__sources__`, `__lists__`), and `__derived__`
is an adjective, so it does break the pattern. The alternatives break
something worse:

- `__columns__` reads as "the columns", but source columns are not
  declared there — only the computed ones. A sheet named for the general
  case that holds the special case invites the reader to look for source
  columns in it.
- `__keys__` collides conceptually with **group keys**, which is exactly
  the neighbouring idea a derived column is most often used for
  (ADR-0054's bare sheet-name chain). Two meanings of "key" one hop
  apart is worse than one broken naming pattern.

Precision about what the sheet holds beats consistency of part-of-speech.

### Aggregate references — not permitted in 1.x

Confirmed as proposed. `SUM([Amount])` in a derived expression is a
declaration error, not a runtime one.

The reason is structural rather than a scope judgement: the pre-pass runs
**after** `@join` but **before** `@filter` and grouping, so at the moment a
derived expression is evaluated there is no row set for an aggregate to
read. The rows that survive filtering, and the partitions grouping will
form, are both still undetermined. An aggregate here would have to mean
"over the unfiltered source", which is almost never what an author means
and cannot be told apart from what they do mean.

Deferring is cheap and reversible: the restriction is a MUST NOT on a
surface that does not exist yet, so lifting it later is additive. Opening
it now would fix an evaluation order before anyone has asked for it — the
ADR-0043 small-surface bar, and the ADR-0045 pattern of rejecting a
capability until a real template needs it.

The error code `xl3/derived/aggregate-reference` follows the
`xl3/inputs/forward-reference` pattern: name the offending construct, not
the rule it breaks. Nothing enters the error catalog until the
implementation lands, so this costs no G3 surface today.

## Still required for `accepted`

`GOVERNANCE.md` § Acceptance sets three conditions: a conformance fixture
demonstrating the behavior, the reference-impl change, and maintainer
sign-off. None of the first two exist — no `*derived*` fixture, and no
`derived` reference anywhere in `impl/js/src` — so the status stays
**proposed**. Resolving these two questions removes the design blockers;
it does not promote the ADR.

The work that would: `parser.ts` reads and validates the `__derived__`
declaration (both guards above), the grouper pre-pass materializes the
values, and at least one fixture exercises a lookup-driven sheet name.
Per the **Spec target** above this lands after the 1.0 freeze, so the
sequencing is deliberate, not neglect.
