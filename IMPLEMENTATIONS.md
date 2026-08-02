# XTL Implementations

Implementations of the [XTL spec](./spec/). xl3 is the reference implementation.

| Language | Repo | Package | Spec version | Conformance | Notes |
|---|---|---|---|---|---|
| TypeScript | [`xl3-lang/xl3`](https://github.com/xl3-lang/xl3) | [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3) | XTL 0.1 (draft) | reference; **160/160** fixtures pass (154 Stage 1 + 6 Stage 2 only) | Browser + Node ≥ 20.12; runner via `npx xl3-conformance`; 3-TZ matrix in CI |
| Rust (WASM) | [`xl3-lang/xl3-rs`](https://github.com/xl3-lang/xl3-rs) | [`xl3-core`](https://crates.io/crates/xl3-core) + [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) | XTL 0.1 (draft) | **partial 119/148** Stage 1 (see freshness note below) | Pure-Rust acceleration core (calamine + rust_xlsxwriter) wrapped for browser / Node hosts. Drives the opt-in `engine: 'wasm'` path introduced in xl3 0.9.0. Outstanding gaps: HYPERLINK function, shared formulas, ~20 validation error sites |
| Python | [`xl3-lang/xl3-py`](https://github.com/xl3-lang/xl3-py) | _(unpublished)_ | XTL 0.1 (draft) | **133/133** Stage 1 on the corpus it ran (see freshness note below) | Tracked alongside the reference impl; drop a `--report=json` artifact under [`conformance/reports/`](./conformance/reports/) and `npm run conformance:dashboard` will pick it up |

### Report freshness

The two figures above come from the JSON reports committed under
[`conformance/reports/`](./conformance/reports/), and **both predate the
current corpus**. The live corpus size is in
[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md), which is
generated — this section deliberately does not repeat it, because a
hardcoded count goes stale every time a fixture lands.

| Report | Ran against | Result |
|---|---|---|
| `xl3-wasm-0.1.0.json` (2026-06-08) | 154 fixtures | 119 passed, 29 failed, 6 skipped |
| `xl3-py-0.1.0a3.json` (2026-05-23) | 133 fixtures | 133 passed, 0 failed, 6 skipped |

**Read the "Ran against" column before the "Result" column.** A report
saying `133/133` means 100% *of what that report ran*, not of the corpus.
Both reports are tens of fixtures behind — the corpus has grown in 0.9.0,
0.10.0, and again on 2026-07-28 (fixtures 162-170, the `data-loss` group).

So a port's standing against **today's** corpus is unknown until it
submits a fresh report. ROADMAP **G13** is judged on a current report, not
on these. This is not hypothetical: the 2026-07-28 gate audit ticked G13
off `133/133` without checking the denominator, and it was reverted on
2026-07-30.

## Production users

ROADMAP gate **G15** points at this section. It ticks when there is at
least one named user — either an external company that has given
permission to be listed, or the maintainer's own employer running xl3
in scheduled production with a public case study.

| Organization | Since | Workload | Case study |
|---|---|---|---|
| _none listed yet_ | — | — | — |

G15 is **in progress**, not blocked: a production deployment at the
maintainer's employer has been running since the week of 2026-05-26.
The gate ticks when the case study is published and a row lands here —
a running deployment alone does not satisfy it, because the gate's
point is a reference a third party can verify.

If you run xl3 in production and are willing to be named, open a PR
adding a row. Partial detail is fine (organization + workload, no case
study link) — say so in the PR and we will mark the row accordingly.

## Adding an implementation

Read [`PORTERS_GUIDE.md`](./PORTERS_GUIDE.md) first — it distinguishes
spec-normative requirements from TS-impl-incidental details and gives
a recommended development order keyed to the conformance corpus.

To list a port here:

1. Implement enough of XTL 0.1 to pass the [conformance fixtures](./conformance/fixtures/) you target.
2. Run your impl against [`conformance/`](./conformance/) following [`conformance/runner-protocol.md`](./conformance/runner-protocol.md).
3. Open a PR adding a row to the table above with: language, package URL, spec version targeted, conformance status (full / partial / N of M fixtures).

Ports under active development are welcome — link your in-progress repo even if conformance is partial.

## Spec compliance levels

- **reference** — this implementation. Definitionally conformant for its declared spec version.
- **full** — passes all conformance fixtures for the declared spec version.
- **partial (N/M)** — passes N of M fixtures. List the categories of fixtures not yet supported.
- **draft** — early WIP, not yet running conformance.
