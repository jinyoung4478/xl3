# Blueprint: 0.6.0 → 1.0

> **Working doc, not normative.** Lives in `docs/internal/` because
> it captures the maintainer's roadmap and gap analysis, not the
> spec. The normative artifacts are the ADRs (`spec/decisions/`)
> and the public roadmap (`ROADMAP.md`); this document is the
> *background* behind both.

This document settles the version-management question for
xl3 0.6.0 → 1.0. Five parts:

1. Current state audit
2. Philosophy conflicts with JXLS (the deliberate boundary)
3. Detailed gap list to reach JXLS-level maturity
4. Per-version step plan (0.6 / 0.7 / 0.8 / 0.9-rc / 1.0)
5. Sharpened 1.0 cut criteria

The target maturity for xl3 1.0 is "JXLS-class" — the same kind
of trust JXLS earned over ten years of production use, in a
fraction of the surface area.

---

## Part 1 — Current state audit (as of 0.6.0)

### IN (implemented + spec'd + fixture-pinned)

**Directives:** `@filter`, `@sort`, `@top`, `@repeat`, `@source`,
`@join`.

**Functions:**
- Logic: `IF`, `IFEMPTY`, `IFERROR`, `IFS`, `ISBLANK`
- Aggregates (over source data): `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`
- Math: `ROUND`, `ABS`
- String: `UPPER`, `LOWER`, `TRIM`
- Date: `TODAY`, `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`,
  `DATE`
- Conversion: `TEXT`, `HYPERLINK`
- Lookup: `XLOOKUP` (cross-source)
- Context: `ROW`

**Operators:** `+`, `-`, `*`, `/`, `&`, `=`, `<>`, `<`, `>`, `<=`,
`>=`, `in`, `!in`.

**Reserved sheets:** `__config__`, `__inputs__`, `__sources__`,
`__lists__`.

**Cell features preserved through render:**
- Cell style, font, fill, border, alignment
- Number / date format (`numFmt`)
- Row height, column width
- Horizontal-merged source headers (ADR-0033)
- Source-data row merges broadcast master to slaves (ADR-0035)
- Static images, conditional formatting, named ranges, print area,
  freeze pane, sheet protection, data validation, cell comments
  (ADR-0036)
- Cell formula text preserved verbatim (ADR-0046)
- Outline level (ADR-0040 / 0036)

**Output shapes:** single file, file-per-group, sheet-per-group,
multi-source merge via `@join`.

**Spec / process:**
- 18 absorption-era ADRs (0033-0050)
- 133 conformance fixtures (Stage 1) + 6 Stage-2-only = 139 total
- Error code catalog with snapshot pinning (ADR-0015)
- Spec / language / evaluation / glossary / stability docs
- Multi-language docs (English source + Korean i18n for landing,
  Try-it, 404, 18 cookbook recipes)

**Runtime:**
- TypeScript reference impl (`@xl3-lang/xl3` v0.6.0 on npm)
- xl3-py port (draft — % unknown, target 80% Stage 1 for 1.0)
- Browser IIFE bundle (~1 MB minified, ~300 KB gzipped)
- Node ≥ 20.12

### DEFERRED (spec accepted, impl pending — to be closed in 0.6)

| ADR | Item | Impact |
|---|---|---|
| 0038 | `@group` + `@subtotal` (multi-level grouping with interleaved subtotal rows) | **HIGH** — Korean B2B invoice / settlement workbooks need this. Currently the largest single user-visible gap. |
| 0040 (PE part) | Conditional formatting + data validation `sqref` auto-extension across `@repeat` | MEDIUM — visual polish; current P-only preservation works without it. |
| 0036 (item 3, charts) | Chart data range expansion | LOW — deferred indefinitely per ADR-0036. |
| (proposed 0050) | Cell formula reference adjustment (formula PE) | MEDIUM — natural follow-up to ADR-0046; defer to 1.1. |

### REJECTED (deliberately out of scope — will not be added)

| ADR | Item | Reason |
|---|---|---|
| 0037 | Dynamic image insertion (`jx:image` style) | Five-objection rejection; static image preservation covers the real use case. |
| 0042 | Runtime cell mutation (`jx:updateCell`) | "Template = handover artifact" violation; substitution already covers the case. |
| 0045 | Math expansion (SQRT/POWER/MOD/INT etc.), most type tests (ISNUMBER/ISTEXT/ISDATE/ISERROR), NOW/WEEKDAY/WEEKNUM/NETWORKDAYS, SUMIF/COUNTIF/AVERAGEIF, TEXT() format-token expansion, FIND/SEARCH, VALUE, SUMPRODUCT, statistical/financial functions | Fails ADR-0043's gate: Excel-formula path in the output cell handles each, conveniently. |

### Not yet decided (decide before 1.0)

These cases haven't been tested or pinned by a fixture; current
behavior is implementation-defined. Each needs a fixture and a
status decision (preserve verbatim / deferred / rejected) before
1.0:

- Pivot table preservation
- Sparkline preservation
- Excel `ListObject` (structured tables)
- Page break preservation
- 100k+ row stream-rendering memory budget

---

## Part 2 — xl3 ≠ JXLS: the deliberate boundary

ADR-0048 (this commit) is the permanent record. Summary of the
seven axes:

| Axis | JXLS | xl3 |
|---|---|---|
| Expression language | JEXL | Excel formula syntax |
| Directive placement | Cell comments | Cell value `{{ @... }}` |
| Host extension | Java SPI custom commands | TypeScript host API only — no template-side escape hatch |
| Function surface | JEXL library + Excel catalog | Minimal, ADR-0043-gated |
| External data sources | JDBC / REST via custom commands | XLSX in, XLSX out only |
| Output formats | XLSX + PDF + HTML (via Apache POI) | XLSX only |
| Library-vs-spec primacy | Java library is de-facto spec | `spec/` + `conformance/` is the spec |

The seven-axis boundary protects xl3's three thesis pillars:

1. **Excel syntax inside Excel** (axis 1, 4)
2. **Template = handover artifact** (axis 2)
3. **Multi-language portability via spec-first design** (axis 3, 7)

A re-proposal to close any axis must address the thesis cost,
not just the feature ask. The "inconvenience refinement"
(ADR-0048 Part 2) allows narrow exceptions when the Excel-native
path is technically possible but error-prone in practice — the
HYPERLINK / IFS / DATE / IFERROR / ISBLANK acceptances all fit
this carve-out.

### The philosophy in one sentence (added 2026-05-18)

> *"Excel-native if convenient; XTL function if the Excel-native
> path is inconvenient enough that authors will routinely make
> errors trying to use it."*

This refinement of ADR-0043 is the practical filter for "should
this be in XTL or in the cell?"

---

## Part 3 — Detailed gap list to JXLS maturity

JXLS at version 2.x (after ~10 years of production) has the
following surface beyond what xl3 ships. The gap analysis below
classifies each item as MUST / SHOULD / MAY for xl3 1.0.

### A. User-visible features

| # | Item | Status | 1.0 priority |
|---|---|---|---|
| F1 | `@group` + `@subtotal` impl | spec accepted, impl pending (ADR-0038) | **MUST** |
| F2 | CF/DV `sqref` PE | spec accepted, impl pending (ADR-0040) | SHOULD |
| F3 | Cell formula reference auto-adjustment | explicitly NOT done per ADR-0046 | DEFER to 1.1 |
| F4 | Pivot table preservation | undefined | SHOULD — fixture only |
| F5 | Sparkline preservation | undefined | DEFER to 1.1 |
| F6 | Excel `ListObject` | undefined | DEFER to 1.1 |
| F7 | Page break preservation | undefined | SHOULD — fixture only |
| F8 | Dynamic outline level | static preservation only | DEFER |

### B. Quality / engineering

| # | Item | Status | 1.0 priority |
|---|---|---|---|
| Q1 | Perf characterized at 1k / 10k / 100k rows | `bench.mjs` exists, results unpublished | **MUST** (ROADMAP gate) |
| Q2 | Memory profiling published | not done | SHOULD |
| Q3 | Streaming output (SXSSF analog) | not implemented | DEFER to 1.1 |
| Q4 | Template compile caching API | not exposed | DEFER to 1.1 |
| Q5 | Cross-browser smoke (Safari, Firefox) | Chrome only | SHOULD |
| Q6 | Perf regression fixtures | not in corpus | SHOULD |
| Q7 | Fuzz testing | not done | DEFER |
| Q8 | Error code message stability | snapshot test pins it | DONE |

### C. Process / governance

| # | Item | Status | 1.0 priority |
|---|---|---|---|
| P1 | Second impl ≥ 80% Stage 1 | xl3-py draft | **MUST** (ROADMAP gate) |
| P2 | External-contributor ADR | 0 | **MUST** (ROADMAP gate) |
| P3 | Production reference case | 0 | **MUST** (ROADMAP gate) |
| P4 | Maintainer set widening | single maintainer | **MUST** (ROADMAP gate) |
| P5 | Migration guide (0.x → 1.0) | not written | **MUST** |
| P6 | CHANGELOG completeness | 0.1.0-alpha → 0.6.0 covered | DONE |
| P7 | Korean i18n (cookbook 100%) | 18 recipes + landing/try/404 ko | DONE |
| P8 | 0.x stability for ≥ 1 quarter post-checklist-complete | 5월 시작 — 7월 말 earliest | **MUST** (ROADMAP gate) |

### D. Documentation

| # | Item | Status | 1.0 priority |
|---|---|---|---|
| D1 | Cookbook ≥ 15 recipes | 18 | DONE |
| D2 | TypeDoc API pages | 43 | DONE |
| D3 | Reading-order guide for porters | PORTERS_GUIDE | DONE |
| D4 | Interactive demo (xl3.io playground) | live | DONE |
| D5 | Migration guide between 0.x versions | not written | SHOULD |
| D6 | Production case study | not written | tied to P3 |
| D7 | Examples gallery expansion (currently 3) | thin | SHOULD — 6-8 production-shaped |
| D8 | LLM-authoring guide | live (`docs/llm-template-authoring.md`) | DONE |

---

## Part 4 — Per-version step plan

Each step is gate-based (release when items complete), not
date-based. Estimated relative timing in parentheses.

### 🟢 0.6.0 — Deferred-impl cleanup (~6–8 weeks)

**Theme:** close the gap between accepted spec and implemented
behavior. Everything that has an ADR but isn't impl-complete.

**MUST:**
- F1 `@group` + `@subtotal` parser + renderer + conformance fixture
- F2 CF/DV `sqref` auto-extension impl (ADR-0040 PE part)
- F4/F7 pivot table + page break behavior pinned by fixture
  (whatever the current impl does, documented)

**SHOULD:**
- Korean cookbook 16 + 17 translations (currently English only
  for these two newest recipes)
- One Korean B2B invoice production-shaped example using
  `@group`/`@subtotal`

**Cut criteria for 0.6.0:**
- `INFORMATIONAL_ADRS` no longer contains 0038 (impl landed,
  fixture covers it)
- Conformance corpus reaches ~135 fixtures
- 0.5.x users have a clear migration note in CHANGELOG

### 🟡 0.7.0 — Performance + xl3-py 80% (~3 months)

**Theme:** answer ROADMAP's "Performance characterized" gate +
push xl3-py over the 80%-Stage-1 threshold that ROADMAP makes a
1.0 prerequisite.

**MUST:**
- Q1 perf benchmarks published in `scripts/BENCH.md` covering
  1k / 10k / 100k rows × 5 / 10 / 20 columns
- Q6 perf regression fixtures (1-2 large stress fixtures)
- **P1: xl3-py ≥ 80% Stage 1** — the maintainer of xl3-py
  publishes a conformance report under `conformance/reports/`

**SHOULD:**
- Q2 memory profile screenshot/README card
- Q5 Safari + Firefox smoke test in CI
- D7 examples expanded to 6 production-shaped templates

**Cut criteria for 0.7.0:**
- `scripts/BENCH.md` has numbers + commentary
- xl3-py conformance % visible to spec readers
- Examples cover at least: invoice with subtotals, settlement
  multi-sheet, dashboard with IFERROR-wrapped formulas

### 🟠 0.8.0 — External validation (~3 months, sociological)

**Theme:** the work that requires people, not code. This is the
explicit ROADMAP "next phase is sociological" gate.

**MUST:**
- **P2 external-contributor ADR merged** — at least one ADR
  proposed and authored by someone other than the maintainer
- **P3 production reference case** — one named user (with
  permission) listed in `IMPLEMENTATIONS.md`'s "Production
  users" section
- **P5 migration guide 0.x → 1.0** — what's stable, what's
  changing, what's deprecated

**SHOULD:**
- **P4 maintainer set widening** — try to onboard one
  additional reviewer for impl PRs
- D6 case study writeup (blog or `docs/case-studies/`)

**Cut criteria for 0.8.0:**
- `spec/decisions/` has at least one ADR whose author isn't the
  current maintainer
- `IMPLEMENTATIONS.md` has a non-empty "Production users" row

### 🔵 0.9.0-rc.x — Pre-1.0 freeze (~1 month)

**Theme:** lock everything down for the 1.0 cut.

**MUST:**
- Spec freeze — new ADRs deferred to 1.1 unless critical bug
- Public API surface frozen — `impl/js/src/__tests__/api-surface.test.ts`
  snapshot becomes the gate
- Error code catalog frozen — no new codes for the duration
- RC published with `--tag rc` (per `RELEASING.md`)
- 21-day soak with no critical issues (ROADMAP G23; extended from 7 days per review feedback)

**Cut criteria for 0.9.0-rc:**
- All MUSTs from 0.6 / 0.7 / 0.8 satisfied
- ROADMAP's 1.0 checklist fully ✅
- RC published; community pinged

### ⚪ 1.0.0 — Final cut

Cut criteria: see Part 5.

---

## Part 5 — Sharpened 1.0 cut criteria

xl3 cuts 1.0 when **all** of the following hold:

### Spec / language

- [ ] All ADRs (0001 - whatever-latest) are `accepted`,
      `informational`, `rejected`, or `superseded`. No
      `proposed`, no `deferred` without explicit ADR pointer.
- [ ] No `INFORMATIONAL_ADRS` exception for an ADR that should
      be covered by a fixture but isn't.
- [ ] Spec `language.md` function table matches the impl
      exactly (no documented function missing from impl;
      no impl function missing from spec).
- [ ] ADR-0048 (JXLS boundary) is published and cited from
      PORTERS_GUIDE.

### Implementation

- [ ] All ROADMAP 1.0 checklist items ✅
- [ ] `INFORMATIONAL_ADRS` does not contain any ADR that
      represents impl-pending work
- [ ] No known data-loss bug in `convert()` (silent
      stringification, format loss, etc.)
- [ ] Conformance corpus ≥ 140 fixtures
- [ ] Stage 1 and Stage 2 conformance both green on the
      reference impl

### External validation

- [ ] xl3-py (or any second impl) passes ≥ 80% Stage 1
- [ ] At least one production user is listed in
      `IMPLEMENTATIONS.md` (with permission)
- [ ] At least one ADR has been authored by a non-maintainer

### Process

- [ ] CHANGELOG covers every minor version since 0.1.0
- [ ] Migration guide 0.x → 1.0 published
- [ ] Performance benchmarks published with at least
      1k / 10k / 100k row measurements
- [ ] RC has soaked ≥ 21 days with no critical issues (G23)
- [ ] 0.x has had ≥ 1 quarter of stable behavior since the
      checklist became complete (per existing ROADMAP rule)

### Governance

- [ ] At least 2 people have merge / accept rights, OR the
      single-maintainer status is explicitly accepted in
      `GOVERNANCE.md` as the 1.0 governance shape
- [ ] Backward-compatibility commitments in `GOVERNANCE.md`
      reflect the frozen 1.0 surface

### Final sentence

> *xl3 1.0 is cut when the function surface, directive set,
> preservation matrix, error code catalog, and public API are
> all frozen; when at least one second-language port has
> validated the spec at ≥ 80% Stage 1; when at least one
> production user is publicly listed; and when at least one
> external contributor has driven an ADR end-to-end.*

### Definitions (mirror of ROADMAP)

The terms below are the testable forms used by the public ROADMAP's
gate table. This doc and `ROADMAP.md` MUST agree on these; if they
drift, fix `ROADMAP.md` first (it is the public commitment) and then
update here. The exact wording lives in `ROADMAP.md` under
"Definitions (testable)" — these are paraphrased pointers:

- **External contributor (G14):** non-maintainer (per GOVERNANCE.md)
  who is the named Author in an ADR front-matter and authored ≥ 60%
  of the Context / Decision sections by line count. Typo-only PRs do
  not count.
- **Breaking change (G23, G24):** change to (a) the public API
  surface snapshot, (b) the error-code catalog (rename / removal /
  repurpose), or (c) an `accepted` ADR's MUST flipping to `rejected`
  or contradicting status. Patch releases and additive ADRs do NOT
  reset the quarter clock.
- **Critical bug fix (G23 RC-soak exception):** (a) silent data loss
  in `convert()`, (b) catalog-vs-runtime error-code drift, or (c) an
  `accepted` ADR MUST that cannot be implemented as written. The
  maintainer cites which of (a)/(b)/(c) in the PR.
- **Data-loss test (G24):** a dedicated `data-loss/` fixture group
  (≥ 8 fixtures) exercising silent-stringify, numFmt drop, formula
  rewrite, and date round-trip paths; all pass on the reference impl.
- **Quarter clock start (G24 vs G23):** the 90-day quarter starts
  the day the LAST G1-G22 gate ticks ✅. RC publication does NOT
  start the clock; the clock must have started BEFORE RC. A breaking
  change during RC soak resets BOTH the soak (G23) and the quarter
  (G24).

The 1.0 cut is **not** about feature completeness vs JXLS — xl3
intentionally ships a smaller surface. It is about earning the
same kind of trust JXLS earned: a spec that doesn't shift, a
reference impl that doesn't surprise, and an ecosystem big
enough that the project isn't single-maintainer-fragile.

---

## How this doc evolves

- When an item moves status (e.g., F1 from "spec accepted, impl
  pending" → "DONE"), update Part 3.
- When a 1.0 checklist item is satisfied, tick it in Part 5.
- When a new gap surfaces (e.g., from a production user report),
  add it to Part 3.
- Mirror major status changes into `ROADMAP.md` (the public
  view).

This doc and `ROADMAP.md` are linked but separate: `ROADMAP.md`
is the elevator pitch + checklist; this doc is the rationale +
gap detail. Both should stay in sync at each minor release.

## References

- `ROADMAP.md` — public-facing checklist
- `GOVERNANCE.md` — how decisions get made
- `RELEASING.md` — release procedure for each step
- ADR-0034 — Relationship to prior-art template engines
- ADR-0043 — Excel-native preference principle
- ADR-0048 — JXLS boundary final + inconvenience refinement
- ADR-0049 — Template-display vs render-output asymmetry
- Cookbook 16 — XTL function vs Excel formula
- Cookbook 17 — Template-authoring display
