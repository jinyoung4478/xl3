# Performance baseline

Two benchmarks, different jobs:

- **`npm run bench`** — three fixed scenarios, seconds to run. The
  regression signal. A >2× move in any scenario should be investigated
  before shipping.
- **`npm run bench:matrix`** — the published 1k/10k/100k × 5/10/20
  matrix with a phase split and a memory ceiling (ROADMAP gate G8).
  Minutes to run, so it is opt-in rather than part of `bench`.

Numbers are not part of the conformance contract.

## Reference matrix (G8)

Recorded 2026-07-28 · Apple M4 Pro (12 cores), 48 GB, Node v22.22.0,
arm64 darwin · `--max-old-space-size=4096`, one child process per cell,
median of 3 runs.

| rows | cols | cells | parse | eval | write | total | peak RSS |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 5 | 5k | 3 ms | 11 ms | 21 ms | 35 ms | 136 MB |
| 1,000 | 10 | 10k | 3 ms | 16 ms | 45 ms | 64 ms | 148 MB |
| 1,000 | 20 | 20k | 3 ms | 33 ms | 75 ms | 112 ms | 211 MB |
| 10,000 | 5 | 50k | 3 ms | 77 ms | 218 ms | 299 ms | 273 MB |
| 10,000 | 10 | 100k | 3 ms | 102 ms | 449 ms | 554 ms | 558 MB |
| 10,000 | 20 | 200k | 3 ms | 225 ms | 961 ms | 1.2 s | 760 MB |
| 100,000 | 5 | 500k | 3 ms | 654 ms | 2.2 s | 2.9 s | 2,108 MB |
| 100,000 | 10 | 1M | 3 ms | 1.1 s | 5.0 s | 6.1 s | 2,627 MB |
| 100,000 | 20 | 2M | 4 ms | 2.5 s | 10.0 s | 12.5 s | 4,243 MB |

Every cell completed. The largest is the observed ceiling, not a limit
the engine enforces.

### Phase split

`parse` / `eval` / `write` are derived from the public API rather than
from internal instrumentation:

```
parse = analyze(template)
eval  = preview(template, source) − parse
write = convert(template, source) − preview
```

`preview()` does everything `convert()` does except render and serialize
the output workbooks, so the subtraction isolates writing. Treat the
split as an attribution, not a profile — it cannot see time that moves
between phases.

### What the matrix says

**Write dominates.** Serialization is 61–82% of wall clock, and its
share grows with size. Evaluation is never the bottleneck at these
scales, so optimisation effort belongs in the writer.

**Parse is constant.** ~3 ms regardless of data volume — it depends on
template size alone. Hosts converting many data sets against one
template are not paying it repeatedly in any meaningful way.

**Scaling is near-linear in cells.** 400× the cells costs 355× the time,
so per-cell cost is flat to slightly improving. There is no cliff inside
the matrix.

**Memory, not time, is the constraint.** Peak RSS grows ~31× across a
400× cell range because fixed overhead amortizes: ~28 KB/cell at 5k
cells falls to **~2.2 KB/cell** at 2M cells. Use ~2.2 KB/cell as the
planning figure at scale; below ~100k cells the floor (~130 MB) is what
matters.

**The 1M-row soft cap in `spec/evaluation.md` was not reachable.** At
the measured rate, 1,000,000 rows × 5 columns needs roughly **10 GB** of
RSS — beyond an ordinary Node default heap. That draft figure has been
replaced with measured guidance; see "Resource limits" there.

## Reference scenarios (regression signal)

Recorded 2026-05-08 on Apple M1, Node 22, no other heavy load.

| Scenario | Median |
|---|---|
| wide-flat (10k rows × 4 cols, IF + ROUND per row) | ~220 ms |
| multi-sheet (5k rows split across 5 sheet groups) | ~70 ms |
| multi-source-join (5k Renewals × 1k Customers, inner join) | ~70 ms |

- **wide-flat** — row-iteration hot path, single source, per-cell
  template eval. Most representative of "bulk reporting" workloads.
- **multi-sheet** — group-by + per-sheet rendering overhead.
  Sheet-name rendering and per-group context build dominate.
- **multi-source-join** — `@join` index build + per-row matched
  lookup. Tests the WeakMap-cached lookup index added for ADR-0014.

## Running the matrix

```sh
npm run bench:matrix                        # full 9-cell sweep
BENCH_MAX_ROWS=10000 npm run bench:matrix   # skip the 100k tier
BENCH_HEAP_MB=2048 npm run bench:matrix     # find the ceiling sooner
```

Each cell runs in its own child process so `maxRSS` is per-cell and a
cell that exhausts the heap is recorded as a result instead of ending
the sweep. Lowering `BENCH_HEAP_MB` is the way to establish where cells
start failing on smaller hosts.

## When to update this file

- **Scenarios table** — when a correctness fix moves a median by more
  than 10% either way. Regressions >2× are bugs; improvements >2× are
  worth recording so they aren't lost.
- **Matrix** — when the reference hardware changes, or when a change
  shifts the phase split or the per-cell memory figure. The matrix is
  what `spec/evaluation.md` limits and gate G9 ratios are derived from,
  so re-run it before changing either.

Do NOT update this file every commit — the goal is a stable reference,
not a living dashboard.
