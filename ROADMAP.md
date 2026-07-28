# Roadmap

What needs to happen for **XTL 1.0** (spec) and **xl3 1.0** (reference
implementation).

The current version is **0.11.0** (npm) targeting **XTL 0.1 (draft)**.
Breaking changes are still possible during 0.x. The 1.0 cut is gated on
the items below, not on a calendar date.

> **Deep version planning** lives in
> [`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
> — gap analysis, philosophy boundary (xl3 ≠ JXLS), per-version step
> plan. This document is the elevator pitch; the blueprint is the
> rationale.
>
> **Single source of truth for 1.0 gates is the table below.** When this
> file and the blueprint conflict, this table wins; the blueprint is
> updated to match.

## What 1.0 means for xl3

The 1.0 target is **operator-readable trust**: a spec that doesn't
shift, a reference impl that doesn't surprise, and a surface small
enough that an operator can review a template without reading code.
It is **not** about feature completeness vs JXLS — xl3 intentionally
ships a smaller surface (ADR-0043 + ADR-0048). The intended audience
is **Korean operations teams that manage many customer-specific
invoice formats** (거래명세서, 정산서, 발주서); the engine
generalizes beyond this niche, but the niche is the wedge.

## 1.0 gate table (single source of truth)

Each gate has an owner, the artifact that closes it, the pass-fail
criterion, a fallback if the gate is unreachable, and the target
milestone. Per-version step plan below references these gates by ID.

| ID | Gate | Owner | Artifact | Pass criterion | Fallback | Status (audited 2026-07-28) | Planned |
|----|------|-------|----------|----------------|----------|--------|---------|
| G1 | Conformance corpus ≥ 140 | maintainer | `conformance/fixtures/` | `ls conformance/fixtures/ \| wc -l` ≥ 140 | — | ✅ **DONE** — 160 fixtures | DONE (160 fixtures; ADR-0066 added 141-145 mid-0.7.x; ADRs 0067-0069 added 146-155 in 0.8.0; 156 (#49 native value preservation) + 157 (#51 grouped side cells) added post-0.8.1; 158 (#52 arithmetic associativity) in 0.9.0; 159-161 (ADR-0073/0074 subtotal errors) in 0.10.0; number 098 is unused, so the count is 160 while the highest index is 161; ADRs 0051-0065 reserved further numbers for 0.7.1) |
| G2 | Stage 2 OOXML canonicalization spec'd | maintainer | ADR-0006 + canonicalizer in src/ | covered by fixtures 024-027, 093 + ADR-0006 amendment | — | ✅ **DONE** | DONE |
| G3 | Error code catalog frozen | maintainer | `impl/js/src/__tests__/error-codes.test.ts` snapshot | no breaking catalog change for 30 days (additions allowed, logged — see "Frozen vs unchanged") | — | ✅ **DONE** — held through 0.11.0 under the amended criterion. `cabe0e1` added `xl3/source-json/invalid` (62→65 codes since `v0.9.0`); additive, so the gate stands. Last breaking catalog change: none since the gate ticked 2026-06-23 | ✅ ticked 2026-06-23 (last catalog change 2026-05-24 `a8f7ad3` +3 codes `xl3/block/overlap`·`xl3/block/empty-table`·`xl3/directive/orphan`; `89bee51` added `xl3/expression/bracket-outside-block` 2026-05-23; 30-day freeze elapsed — post-05-24 commits touched the file with comments/JSDoc only, `EXPECTED_CODES` unchanged) |
| G4 | JXLS boundary published | maintainer | ADR-0048 | file exists, references PORTERS_GUIDE | — | ✅ **DONE** | DONE |
| G5 | Deferred-impl ADRs landed | maintainer | ADR-0038 impl ✅ (2026-05-18) + ADR-0040 PE impl | ADR-0038 portion shipped (fixtures 132-135); ADR-0040 CF/DV range-extension still pending | — | ❌ **OPEN** — ADR-0040 CF/DV range-extension not implemented | 0.6 (partial) / 0.7.1 |
| G6 | Public API surface frozen | maintainer | `impl/js/src/__tests__/api-surface.test.ts` snapshot | no breaking surface change for 30 days (additions allowed, logged — see "Frozen vs unchanged") | — | ✅ **DONE** — held through 0.11.0 under the amended criterion. `cabe0e1` added `convertJson`/`previewJson`; additive, so the gate stands. Last breaking surface change: none since the gate ticked 2026-06-17 | ✅ ticked 2026-06-17 (snapshot unchanged since 2026-05-18 `16f0608`) |
| G7 | JSDoc examples on @stable exports | maintainer | TypeDoc output | every `@stable` symbol has `@example` block | — | ✅ **DONE** — re-verified 15/15 `@stable` declarations carry `@example` | ✅ DONE 2026-06-21 — 13/13 `@stable` callables carried `@example` (PR #59); re-verified at **15/15** after 0.11.0 added `convertJson` / `previewJson` (`previewJson` shipped without one and was fixed 2026-07-27) |
| G8 | Performance characterized | maintainer | `scripts/BENCH.md` | 1k/10k/100k row × 5/10/20 col matrix + memory-ceiling + parse/eval/write split published | — | ✅ **DONE** 2026-07-28 — `npm run bench:matrix` sweeps 1k/10k/100k × 5/10/20 (9 cells, all completing), with a parse/eval/write split and per-cell peak RSS. Published in `scripts/BENCH.md`. Headline: write is 61–82% of wall clock, parse is data-independent (~3 ms), and memory is the binding constraint at ~2.2 KB/cell (2M cells → 4.2 GB) | 0.7.1 |
| G9 | Perf regression guards | maintainer | `impl/js/src/__tests__/perf-regression.test.ts` | ≥ 2 large scenarios with a ratio-based assertion, running in CI | — | ✅ **DONE** 2026-07-28 — row scaling and `@join` scaling, each asserting 10× the rows costs < 20× the time. Observed 6.2× and 6.9×; a quadratic regression lands near 100× | 0.7.1 |
| G10 | Cross-browser smoke | maintainer | `ci.yml` | Safari + Firefox bundle-load + 1 convert() per run | — | ❌ **OPEN** — `ci.yml` has no Safari/Firefox/WebKit job | 0.7.1 |
| G11 | Stage 2 in CI | maintainer | `ci.yml` | `npm run conformance:stage2` runs on every PR | — | ✅ **DONE** — runs at `ci.yml:35` | 0.7.1 |
| G12 | Undecided behavior pinned (pivot/sparkline/ListObject/page break) | maintainer | conformance fixtures + ADR per item | each: fixture pinning current behavior OR ADR explicitly deferring to 1.x | defer to 1.1 with ADR | ❌ **OPEN** — sparkline has 0 ADRs and 0 fixtures; pivot / ListObject / page-break have ADR mentions but no pinning fixture | 0.7.1 / 0.8 |
| G13 | Second-language impl validation | external (xl3-py) | `conformance/reports/*.json` | xl3-py passes ≥ 80% Stage 1 OR ≥ 80% Stage 2, OR documented 50% skeleton in another language (Rust/Go/Java) within 12 months of all other gates closing | accept single-impl 1.0 via public ADR amending GOVERNANCE | ✅ **DONE** — `conformance/reports/xl3-py-0.1.0a3.json`: 133/133 Stage 1 passed, 0 failed | 0.7.x–0.8.x |
| G14 | External-contributor ADR | external | `spec/decisions/NNNN-*.md` | ≥ 1 ADR with non-maintainer as Author (≥ 60% of Context/Decision sections by line count) | 18-month time-box, then: ≥ 2 external-authored cookbook recipes OR ≥ 5 external-authored conformance fixtures | ❌ **OPEN** — no ADR in `spec/decisions/` carries an Author field | 0.8 |
| G15 | Production reference case | external (with maintainer help) | `IMPLEMENTATIONS.md` "Production users" row | ≥ 1 named user, satisfied by EITHER (a) external company with permission to list, OR (b) the maintainer's own employer running xl3 in scheduled production with a public case study | — | ❌ **OPEN** — `IMPLEMENTATIONS.md` Production users reads `_none listed yet_` | 0.8.x — **in progress** via maintainer's-employer production deployment (template setup complete 2026-05-24; live usage starts week of 2026-05-26); G15 ticks when the case study is published |
| G16 | Maintainer set widening | maintainer | `GOVERNANCE.md` | ≥ 2 people with accept/reject rights for ADRs and impl PRs | explicit accept of single-maintainer 1.0 governance shape via amendment to GOVERNANCE | ❌ **OPEN** — `GOVERNANCE.md` still describes a single maintainer | 0.8 |
| G17 | Korean cookbook i18n complete | maintainer | `website/i18n/ko/.../guides/` | all cookbook recipes have Korean translation | — | ❌ **OPEN** — `docs/guides/19-jxls-to-xl3.md` has no ko / ja / zh-CN translation | DONE (0.6) for recipes 01-18 — **open question before 1.0:** `docs/guides/19-jxls-to-xl3.md` was added later and has no ko/ja/zh translation. Decide whether a migration guide counts as a "cookbook recipe"; if yes, G17 needs re-ticking |
| G18 | Production use case in README | maintainer | `README.md` | replaces "alpha" status with concrete production reference (tied to G15) | — | ❌ **OPEN** — blocked on G15 | 1.0 (with G15) |
| G19 | Migration guide 0.x → 1.0 | maintainer | `docs/migration-0.x-to-1.0.md` | documents every behavior change or confirms additive-only | downgrade to CHANGELOG note if confirmed additive-only | ❌ **OPEN** — `docs/migration-0.x-to-1.0.md` absent; CHANGELOG fallback not yet exercised | 0.8 |
| G20 | SECURITY.md + threat model | maintainer | `SECURITY.md` + spec amendment | docs zip-bomb / oversized workbook / formula-execution stance + limits API | — | ✅ **DONE** — SECURITY.md covers zip bomb, large workbook, formula stance, and points at the limits table | 0.7.1 |
| G21 | Hard limits documented (no streaming until 1.1) | maintainer | spec/evaluation.md | row / memory hard limit values + AbortSignal API documented | — | ✅ **DONE** 2026-07-28 — `AbortSignal` shipped (`ConvertOptions.signal` on all four entry points, `xl3/abort/cancelled` catalogued, no partial output). Limits now measured rather than drafted: `spec/evaluation.md` publishes ~2.2 KB/cell memory and a verified ~2M-cell ceiling from the G8 matrix. The unmeasured 1M-row soft cap was withdrawn — it needs ~10 GB and was never reachable | 0.7.1 |
| G22 | API surface — internal model types separated | maintainer | `impl/js/src/index.ts` exports + STABILITY.md | only `convert`/`preview`/`analyze` + stable interfaces marked `@stable`; model/parser types marked `@experimental` or moved to `xl3/internal` | — | ✅ **DONE** | DONE (0.6) |
| G23 | RC soak | maintainer | git tags | RC published; ≥ 21-day soak (extended from 7 day per review feedback); 0 critical issues | — | ✅ **DONE** — ticked 2026-06-16 | ✅ ticked 2026-06-16 (21-day soak from rc.1 2026-05-26; 0 critical — soak-period fixes #49–52 folded into 0.9.0, none reset the clock per the G23 breaking-change definition) |
| G24 | "Stable quarter" post-checklist | maintainer | release calendar | 90-day window after the FINAL gate above ticks ✅; no breaking spec/API/error-code change during the window | breaking change → restart clock | ❌ **BLOCKED** — on the gates above, not on the clock. Clock question resolved 2026-07-28 (#86): the quarter runs from 2026-06-23 uninterrupted. The `data-loss` group now exists (8 fixtures, 162-169, tagged `data-loss`), covering 3 of the 4 required paths — silent-stringify, date round-trip, formula-result kind. **numFmt drop is still uncovered**: Stage 1 compares values, not formats, so that path needs a Stage 2 fixture | ⏳ quarter clock started **2026-06-23** (G3 = last gate to tick); 1.0 earliest ≈ **2026-09-21** if no breaking spec/API/error-code change in the window |

> **Status column audited 2026-07-28** against the tree at `2ca7ab0`.
> The `Planned` column is the historical milestone plan and is kept as-is;
> where the two disagree, `Status` is the current fact.
>
> **9 gates are open:** G5, G10, G12, G14, G15, G16, G17, G18, G19
> — plus G24, which cannot tick until the others do and is
> separately missing the `data-loss/` fixture group its own definition
> requires. G8 and G21 closed on 2026-07-28; G21 had been the worst of the
> optimistic drift, documenting an `AbortSignal` API and an error code that
> did not exist. Two entries were stale in the *pessimistic* direction
> (G11 and G13 were already satisfied).
>
> **The quarter clock runs from 2026-06-23, uninterrupted** (#86, decided
> 2026-07-28). 0.11.0 added an export and an error code on 2026-07-19;
> both are additive, so G3 and G6 stand. See "Frozen vs unchanged" and the
> amendment note under `Breaking change` in the Definitions below — the
> old wording made an added *export* breaking while an added *error code*
> was not, which would have reset the clock by accident.
>
> **The clock is not the binding constraint.** 1.0 is gated on the 12 open
> items, and the long pole is now the G24 `data-loss/` group, which does
> not exist yet. Any date derived from the quarter alone is
> meaningless until those land, so this file no longer asserts one.

### Definitions (testable)

- **External contributor (G14):** not in `GOVERNANCE.md` maintainer set
  AND not in `Co-authored-by` history of merged ADR commits at PR open
  time. Drive-by typo edits do not count; named Author in ADR
  front-matter; authored ≥ 60% of Context/Decision sections by line
  count.
- **Breaking change (G24, G23):** (a) removal, rename, or signature
  change of an existing export in the public API surface snapshot,
  (b) error code catalog rename / removal / repurpose, (c) ADR
  `accepted` → `rejected` or contradicting status flip. Patch releases
  and additive ADRs do NOT reset the quarter clock.

  *Amended 2026-07-28.* (a) previously read "any change to public API
  surface snapshot", which made it asymmetric with (b) — an added error
  code was additive but an added export was breaking. Read literally
  that made 0.11.0's `convertJson` / `previewJson` a clock reset, which
  contradicts the 0.11.0 note below. Both clauses are now scoped to
  changes that can break a caller. Additions remain **append-only** per
  ADR-0015 and MUST be recorded in `spec/STABILITY.md`.
- **Frozen vs unchanged (G3, G6):** these gates guarantee the surface
  does not *churn* before 1.0, not that it stops growing. Their pass
  criterion is 30 days with no **breaking** change as defined above.
  Adding an export or an error code does not un-tick them; removing,
  renaming, or re-signing one does, and restarts both the 30-day
  window and — via G24 — the quarter clock.

  Rationale for scoping it this way rather than literal "unchanged":
  under a literal reading, any additive fix delays 1.0 by up to 30 + 90
  days, so fixing a real defect is penalised. G21 is exactly that case —
  closing it requires *adding* `xl3/abort/cancelled`. A rule that
  punishes that pushes work toward not fixing it. Scoping to breaking
  changes keeps the criterion doing real work (a removal still resets
  everything) without creating that incentive.
- **Critical bug fix (G23 RC exception):** (a) silent data loss in
  `convert()`, (b) error code catalog inconsistency between docs and
  runtime, OR (c) an `accepted` ADR's MUST that cannot be implemented
  as written. Maintainer cites which of (a)/(b)/(c) in the PR.
- **Perf guards (G9), why not in the corpus:** the gate originally named
  `conformance/fixtures/` and "≥ 2 large fixtures". Both halves conflict
  with the corpus itself. `AUTHORING.md` makes "fixture file sizes should
  be tiny" a hard rule, and the corpus is the cross-implementation
  contract every port must pass to claim conformance — a Python impl being
  slower than the JS one is not an XTL conformance failure. Amended
  2026-07-28 to live as a CI test beside the reference impl, with data
  generated at run time so nothing large is committed. The ratio-based
  requirement is unchanged and is the part that mattered: an absolute
  budget encodes the machine it was written on, a ratio survives a
  hardware change.
- **Data-loss test (G24 testable form):** corpus has a dedicated
  `data-loss` fixture group (≥ 8 fixtures) exercising silent-
  stringify, numFmt drop, formula rewrite, and date round-trip paths;
  all pass on the reference impl.

  *Clarified 2026-07-28.* "Group" is the `data-loss` **tag**, not a
  subdirectory: `conformance/fixtures/` is flat and the runner treats
  every directory in it as a fixture, so a nested `data-loss/` folder
  would be read as a fixture with no `meta.yaml`. The dashboard already
  groups by tag. Note also that the numFmt-drop path cannot be pinned at
  Stage 1, which compares values and not formats — it requires a Stage 2
  fixture.
- **Quarter clock start (G24 vs G23):** the 90-day quarter starts on
  the day the LAST gate ticks ✅. RC publication does NOT start the
  clock; the clock must have started BEFORE RC publication. If a
  breaking change happens during RC soak, both the soak (G23) and the
  quarter (G24) reset.

## Per-version step plan

Gate-based, not date-based. Calendar estimates have been removed —
each milestone closes when its listed gates close.

### 0.6.0 — Deferred-impl, narrow scope

Theme: close the highest-impact deferred-impl gate cleanly.

Gates closed: **G5** (`@group`/`@subtotal` impl only — the rest of
ADR-0040 PE moves to 0.6.1), **G17** (Korean cookbook 16/17 missing
translations), **G22** (API surface cleanup before @group exposes
new internal types).

The previous "single 0.6.0 with everything" plan was scoped too
ambitiously per the engineering-feasibility review. ADR-0038 impl
alone is a full pipeline insertion (new directive, group-boundary
state machine, transform-pass partition, renderer rewrite,
group-scoped aggregate eval). Splitting 0.6.0 keeps the milestone
shippable.

### 0.6.1 — Rest of deferred-impl (planned, not yet shipped)

Gates closed: **G5** completion (ADR-0040 PE: CF/DV `sqref`
extension), pivot/page-break behavior fixtures toward **G12**.

Status as of 0.7.0 shipping: this milestone was bypassed by the
spec-audit batch (0.7.0). G5/G12 work folded into 0.7.1.

### 0.7.0 — Spec-audit batch (shipped 2026-05-22)

Theme: close 17 syntactic-conflict gaps surfaced by a deep audit
of the lexer, cell classification, directive composition,
aggregate args, and reserved-sheet semantics. Unplanned in the
original gate table; the perf/CI/limits work originally tagged
0.7.0 moves to **0.7.1**.

Shipped artifacts:

- 15 new ADRs (0051–0065) + amendments to ADR-0021 (group-order
  catalog entry) and ADR-0041 (header-cell multi-line
  normalization).
- 4 new error codes — `xl3/parser/unbalanced-literal`,
  `xl3/lists/invalid-use`, `xl3/eval/bad-aggregate-arg`,
  `xl3/expression/unknown-name`.
- Grammar additions: `positive_integer`, `group_directive`,
  `subtotal_directive`, `aggregate_call`, lexical-disambiguation
  note.
- `src/directive-parser.ts` strictness for leading-zero integers.
- Two-pass parallel review (claude-general + codex); all
  CRITICAL/HIGH findings closed before tag.

Gate impact:

- **G1** — 139 fixtures today. The 0.7.0 ADRs reserved fixture
  numbers **141–187**; impl is pending. G1 closes when those
  fixtures land in 0.7.1.
- **G3** — 30-day error-code-catalog clock **reset** on 2026-05-22
  by the 4 new codes.
- **G6** — no public API surface change; G6 clock unaffected.

### 0.7.1 — Performance + external validation begins (relabeled from old 0.7.0)

Gates closed: **G5** completion (ADR-0040 CF/DV `sqref` range),
**G8** (perf benchmarks), **G9** (perf regression fixtures),
**G10** (cross-browser), **G11** (Stage 2 in CI), **G20**
(SECURITY.md draft + threat model), **G21** (hard limits +
AbortSignal docs).

Also closes the **G1 ≥ 140 fixtures** floor by landing fixtures
141–187 reserved by the 0.7.0 ADRs.

Progress toward: **G12** (undecided behavior pinning), **G13**
(xl3-py).

Relabel: `alpha` → `beta` after G8 publishes and xl3-py reaches
≥ 50% Stage 1.

### 0.8.0 — Data-block design overhaul (shipped 2026-05-23)

Theme: unplanned in the original gate table. A late-0.7.x audit of
data-block expansion surfaced two structural bugs (#46 duplicate
shared-formula owners, #47 stale references in displaced side
cells) that needed a column-scoped rewrite before further
feature work. The original "0.8.0 = sociological gates" plan
moved to **0.8.x patches**.

Shipped artifacts:

- **ADR-0066** — data block is now column-scoped: bounding box of
  `{{...}}` markers extended through contiguous non-empty cells.
  Cells outside that range keep their row positions when the block
  expands. Closes #46 / #47 by construction.
- **ADR-0067** — explicit `@block` directive in three forms (bare,
  `A:D` column range, `A2:D7` rectangle).
- **ADR-0068** — strict multi-block detection on opt-in sheets:
  every `[Column]` marker must sit inside some block; block
  rectangles cannot overlap.
- **ADR-0069** — per-block directive scoping by proximity:
  `@filter`/`@sort`/`@top`/`@source`/`@join`/`@group`/`@repeat`
  attach to the closest data block whose column range overlaps the
  directive's column.
- 4 new error codes: `xl3/expression/bracket-outside-block`,
  `xl3/block/overlap`, `xl3/block/empty-table`,
  `xl3/directive/orphan`.
- Conformance fixtures 146-155 (multi-block, side-by-side blocks
  with different sources, vertically stacked blocks, per-block
  filter, per-block `ROW()` scoping, the three new error paths).

Gate impact:

- **G1** — corpus 139 → 154 fixtures. Floor cleared again.
- **G3** — 30-day error-code-catalog clock **reset 2026-05-23** by
  the 4 new codes. Earliest tick: 2026-06-22, contingent on no
  further code additions/renames during 0.8.x patches.

### 0.8.x — Sociological gates (in flight)

Gates closed: **G14** (external ADR), **G15** (production case;
in progress via maintainer's-employer deployment), **G16**
(maintainer widening or explicit single-maintainer acceptance),
**G19** (migration guide), **G20** completion.

The plan is to ship 0.8.x patches during the recruitment period
rather than wait silently. **G3 quarter discipline:** while
sociological gates run, error code additions and renames are
deferred — any addition resets the G3 clock and pushes the 0.9-rc
target. Only critical-bug-fix codes (per the definition in this
file) may be added during the 0.8.x window.

### 0.9.0-rc.x — Pre-1.0 freeze

Gates closed: **G3**, **G6**, **G7**, **G23** (≥ 21-day RC soak).

After G23 starts, the quarter clock for G24 begins (it must have
ticked while G3/G6/G7/etc. were closing — see definitions above).

### 0.9.0 — Final freeze cut (2026-06-23)

All four pre-1.0 freeze gates ticked: **G3** (2026-06-23 — last
catalog change 2026-05-24 + 30 days), **G6** (2026-06-17), **G7**
(2026-06-21, PR #59), **G23** (2026-06-16 — 21-day soak, 0 critical).
RC-soak fixes #49–52 folded in; #54/#56/#57 deferred to the
`post-1.0` milestone (POST-1.0 additive — the milestone was titled
"0.10.0" at this cut; renamed 2026-07-27 once 0.10.0 and 0.11.0 both
shipped without these items, and #57 was closed as superseded by the
host-driven `__inputs__` source metadata in #82). The **G24** 90-day
quarter clock starts at the last gate tick (2026-06-23 via G3); the
quarter runs uninterrupted from that date (confirmed by the 2026-07-28
audit, #86). The 1.0 date is not derived from the quarter alone — see the
audit note above the Definitions block for what actually gates it.

### 0.10.0 — Org move + `@subtotal` correctness (shipped 2026-07-19)

Repository transferred to the **xl3-lang** GitHub organization and the
npm package renamed `@jinyoung4478/xl3` → `@xl3-lang/xl3` (install name
only; the old package is deprecated on npm with a pointer to the new
one). Folds in the `@subtotal` correctness fixes #66 (ADR-0073) and
#69 (ADR-0074): a `@subtotal` row carrying a current-row `[Column]`
reference, and group + subtotal under explicit `@block` mode, both used
to fail *silently* with plausible-but-wrong output — each now raises a
dedicated error.

Gate impact:

- **G1** — corpus 157 → 160 fixtures (159 mixed-row error, 160
  formula-cache-is-not-a-marker, 161 explicit-block rejection).
- **G3 / G24** — 2 error codes **added** (`xl3/subtotal/mixed-row`,
  `xl3/subtotal/explicit-block-unsupported`); none renamed, removed, or
  repurposed. Additive per the breaking-change definition above, so the
  quarter clock does **not** reset.
- **G6** — public API surface snapshot unchanged. The rename affects the
  install name only: `convert` / `preview` / `analyze`, the subpath
  exports, and the `xl3-conformance` bin are identical.

### 0.11.0 — JSON source input (shipped 2026-07-19)

`convertJson` / `previewJson` accept the language-neutral
`xl3-source-json/0.1` wire format in place of a `data.xlsx`, so
non-Excel hosts (Python, DB/ETL services) skip the workbook round-trip
(ADR-0075, #71, implemented in #80). The JS reference impl also moved to
`impl/js/` under a root npm workspace (#79) — layout only, no behavior
change.

Gate impact:

- **G3 / G24** — 1 error code **added** (`xl3/source-json/invalid`);
  additive, clock not reset.
- **G6** — the frozen surface gains two exports (`convertJson`,
  `previewJson`, recorded in `spec/STABILITY.md`). Additive: no existing
  export removed or re-signed, and the `.xlsx` path is untouched.
- **G24 window** — both cuts landed 2026-07-19, inside the quarter that
  started 2026-06-23. Neither was breaking under the definition above, so
  the quarter is undisturbed and completes ≈ 2026-09-21. That is when the
  *clock* clears, not a ship date: 12 gates are still open, so the quarter
  stops being the binding constraint.
- **Resolved by the 2026-07-28 audit (#86)** — the conclusion above is
  correct, but it rested on a definition that did not say so. `Breaking
  change` clause (a) read "any change to public API surface snapshot",
  which made `convertJson` breaking while an added error code was not.
  Clause (a) is now scoped to removal / rename / re-signature, matching
  (b), and G3/G6 carry an explicit "additions allowed" criterion. G3 and
  G6 therefore held through this cut and the quarter was never reset.

### 1.0.0 — Final cut

Gate closed: **G24** (90-day quarter complete after last gate
ticked).

## Recruitment and outreach

Sociological gates (G13/G14/G15/G16) require people, not code. The
project has two distinct recruitment surfaces:

### Korean operations audience (G15, future cookbook contributors)

Channels: Korean developer communities (Naver Café, Kakao 오픈톡,
LinkedIn KR), internal company / vendor template-author surveys.
Each minor release publishes a Korean-language post tied to the
release moment (0.6 = `@group`/`@subtotal` demo for invoice
subtotal patterns; 0.7 = perf numbers; 0.8 = case study).

### English OSS audience (G13, G14)

Channels: HN, lobste.rs, r/excel, conference CFPs (JSConf, EuroPython
for xl3-py). Each major moment ships with one specific external
artifact:

- 0.7.0 release: "Show HN: xl3 0.7 — 100k-row Excel template engine"
- 0.8.0 release: case study + xl3-py conformance dashboard
- 1.0.0 release: spec + multi-impl validation

## Non-goals for 1.0

These are intentionally deferred. Each has an ADR explaining why:

- **Date arithmetic beyond Y/M/D/EOMONTH/EDATE/DATEDIF** — the rest of
  the family deferred per [ADR-0019 amendment](./spec/decisions/0019-deferred-date-arithmetic.md).
- **Locale-aware string collation** —
  [ADR-0020](./spec/decisions/0020-deferred-locale-collation.md).
- **Multi-join, left-join, multi-row matches** —
  [ADR-0014](./spec/decisions/0014-source-joins.md) out-of-scope section.
- **XLOOKUP wildcard / approximate / reverse search** —
  [ADR-0013](./spec/decisions/0013-xlookup-cross-source-lookup.md)
  out-of-scope section.
- **Dynamic image insertion** — [ADR-0037](./spec/decisions/0037-rejected-dynamic-image-insertion.md).
- **Runtime cell mutation** — [ADR-0042](./spec/decisions/0042-rejected-runtime-cell-mutation.md).
- **Functions rejected per ADR-0043 gate** — math expansion, type
  tests (except `ISBLANK` per ADR-0047), NOW / WEEKDAY etc., conditional
  aggregates, TEXT() format-token expansion. See
  [ADR-0045](./spec/decisions/0045-function-batch-rejected.md).
- **Streaming output / SXSSF analog.** Deferred to 1.1+. **At 1.0,
  hard memory/row limits are documented (G21) instead.**
- **Template compile caching API.** Deferred to 1.1+.
- **PDF / HTML output.** Out of scope; xl3 is xlsx-in, xlsx-out.
- **Cross-writer Stage 2 fixtures beyond `093`** —
  [ADR-0006](./spec/decisions/0006-stage-2-ooxml-conformance.md) amendment.

These remain candidates for **XTL 1.1, 1.2, 1.x** based on demand.

## How to help close items

| Item | How to help |
|---|---|
| G13 second-impl ≥ 80% | Contribute to [xl3-py](https://github.com/xl3-lang/xl3-py), or start a new port (Rust, Java, Go). See [PORTERS_GUIDE.md](./PORTERS_GUIDE.md). |
| G14 external ADR | Pick a deferred item (pivot table preservation, page-break, ADR-0045 carved-out function), draft an ADR in `spec/decisions/`. See [GOVERNANCE.md](./GOVERNANCE.md) "How changes enter the project." A few "starter ADR stubs" are available as `good-first-ADR` issues on GitHub. |
| G15 production case | Use xl3 internally, share what worked / didn't. Drop a row in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) if appropriate. The maintainer's own employer (Snack24h) qualifies if it ships a public case study. |
| G17 guide i18n | `docs/guides/19-jxls-to-xl3.md` (JXLS → xl3 migration) has no ko / ja / zh-CN translation; recipes 01-18 are done. |
| G8 benchmarks | Run `npm run bench` on representative templates, share results. |
| G10 cross-browser | Add Safari + Firefox to the bundle smoke test. |
| Function re-proposal | If you need a function rejected per ADR-0045, file the [`Function re-proposal`](https://github.com/xl3-lang/xl3/issues/new?template=function-reproposal.md) issue template. |

## How this roadmap evolves

This document is the public elevator pitch + the gate table is the
single source of truth. The deeper
[`docs/internal/blueprint-to-1.0.md`](./docs/internal/blueprint-to-1.0.md)
carries the gap analysis, philosophy boundary, and per-version
rationale. As gates tick, both documents update. As new gaps surface,
both add them.

Cuts and additions to the 1.0 gate table are discussed via the same
ADR/issue process as everything else.
