# Reddit r/dataengineering draft — xl3 0.4.0

**Subreddit candidates:** r/dataengineering (primary), r/programming
(if it gets traction), r/excel (focus on the operator narrative there).

**Title (≤300 chars):**

> xl3 — open-source Excel template language (XTL) with a 119-fixture
> conformance corpus

**Body:**

Posting this for feedback from people who actually run recurring
Excel reporting workflows in production.

## The problem

Half the "data pipelines" inside finance and ops teams are still:

> Operator drops `raw.xlsx` into a folder → Python script reads it,
> renames columns, computes a few derived fields, writes
> `report-2026-05.xlsx` → emails it to a stakeholder.

When the rules change (a new tier threshold, a renamed status,
a different region grouping), the operator can't touch the rule
because it lives in code. The engineer becomes a bottleneck for what
is conceptually a spreadsheet edit.

## The shape xl3 takes

The transformation rules live **inside an Excel template**:

- `__config__` sheet declares `source_sheet`, `output_file_pattern`,
  named values.
- Template cells contain expressions like
  `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` — same `IF`
  the operator already knows.
- Directives like `{{ @filter [Region] = "Seoul" }}`,
  `{{ @sort [Amount] desc }}`, `{{ @top 10 }}` shape the row set.
- Multi-source joins (`@source`, `@join`), `XLOOKUP`, runtime inputs
  (`__inputs__`) cover the more involved cases.

The engine in code shrinks to one line:

```ts
import { convert } from '@xl3-lang/xl3';
const outputs = await convert(templateBuffer, dataBuffer);
```

## What's actually shipped

- A language-neutral **spec** (XTL 0.1) with 32 ADRs. Everything
  spec-defining is in `spec/`, not in the impl source.
- A **conformance corpus** of 119 fixtures, all green at Stage 2
  (OOXML-canonical comparison). Stage 1 (cell-value) runs across
  three timezones in CI.
- A **TypeScript reference implementation** on npm
  (`@xl3-lang/xl3`) plus a browser demo at https://xl3.io.
- A **porter's guide** that catalogs the gotchas a second-language
  port hits (Unicode normalization, IEEE 754 precision, timezone
  handling, etc.). A Python port is in progress.

## What I want feedback on

1. **Patterns missing from the language.** The spec is 0.1 and small
   on purpose. If there's a recurring shape in your reports that
   doesn't fit, that's exactly the kind of feedback I want.
2. **The "rules in the workbook" idea itself.** Have you seen this
   pattern work or fail at scale? What broke it?
3. **The spec → port boundary.** The porter's guide is meant to be
   readable in one sitting. If anything in it is unclear or feels
   wrong, please say so.

Repo: https://github.com/xl3-lang/xl3
Spec: https://github.com/xl3-lang/xl3/tree/main/spec
Guides: https://github.com/xl3-lang/xl3/tree/main/docs/guides
npm: `npm install @xl3-lang/xl3`

Status: alpha. The audit pass that just landed in 0.4.0 closed every
"silent fallthrough" the corpus exposed — either an error code or a
normatively-pinned behavior. Breaking changes possible until 1.0;
they'll be in CHANGELOG.
