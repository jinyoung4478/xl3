# xl3 — a standard for declarative Excel transformation

> Jinja made HTML executable as templates; **xl3 makes Excel workbooks
> executable as templates** — as an open, implementation-independent
> standard, not a single library.

**Status:** alpha · **XTL spec 0.1 (draft)** · reference implementation
`@xl3-lang/xl3` 0.11.0 · breaking changes possible until 1.0

**xl3** is an open standard for turning an ordinary `.xlsx` workbook into a
deterministic, declarative transformation template: the layout, styles,
merged cells, and rules live *inside the workbook*, and any conforming
engine executes it against supplied data — same inputs, same output, every
time. This repository *defines* the standard, in three parts:

- **[Spec](./spec/)** — the normative definition, including **XTL**, the
  small embedded expression language for what must be decided *before* the
  workbook is written (filters, groups, aggregates, filename patterns),
  plus the design record (ADRs).
- **[Conformance suite](./conformance/)** — language-neutral fixtures that
  every implementation runs to prove it conforms.
- **Reference implementation** —
  [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3)
  (TypeScript, in [`impl/js/`](./impl/js/)) — one of several
  [implementations](./IMPLEMENTATIONS.md) (Rust/WASM and Python in progress).

**Three names, one stack:** **xl3** is the standard (this format) · **XTL**
is its embedded expression language · **`@xl3-lang/xl3`** is the
TypeScript reference implementation of it.

It fits when recurring Excel documents — invoices, settlement statements,
monthly reports, financial workbooks — must stay editable in Excel while
execution remains deterministic, inspectable, and verifiable. AI authoring
is a strong fit too: an LLM can emit a compact template contract more
reliably than hundreds of lines of workbook-API code.

**English** · [한국어](./README.ko.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## The split: Excel is the template, xl3 executes it

```text
  ┌──────────────────────────┐
  │  Business user / designer│
  │  edits layout in Excel   │
  └─────────────┬────────────┘
                │ template.xlsx
                ▼
  ┌──────────────────────────┐       ┌──────────────────────────┐
  │      Developer app       │       │           xl3            │
  │  supplies data + inputs  ├──────►│  executes the template   │
  └──────────────────────────┘       └─────────────┬────────────┘
                                                    │
                                                    ▼
                                             result.xlsx
```

Workbook APIs are the DOM APIs of spreadsheets: powerful, but verbose.
For recurring documents, the workbook itself should be the view and the
template contract. xl3 lets the application supply data while Excel keeps
the layout and business-facing rules.

This split is what [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md),
the 160-fixture conformance corpus, and the intentionally small XTL
surface are designed for.

## Quick example

A template can contain ordinary Excel content, `__config__`, and xl3 expressions:

| `__config__` key | Value |
|---|---|
| `source_sheet` | `Raw` |
| `source_table` | `1` |
| `output_file_pattern` | `customer-renewal-report.xlsx` |

| Cell | Template value |
|---|---|
| A5 | `{{ [Account] }}` |
| B5 | `{{ [Region] }}` |
| C5 | `{{ [Renewal] }}` |
| E5 | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` |

Given this data workbook:

| Account | Region | Renewal | Owner |
|---|---|---:|---|
| Acme Logistics | Seoul | 18400 | Mina |
| Beta Works | Busan | 7200 | Joon |

xl3 renders:

| Account | Region | Renewal | Owner | Tier |
|---|---|---:|---|---|
| Acme Logistics | Seoul | 18400 | Mina | Priority |
| Beta Works | Busan | 7200 | Joon | Standard |

…with the template's number formats, fills, borders, merged headers, and
footer rows preserved verbatim. The output is an `.xlsx` you can open in
Excel, Numbers, or Google Sheets without conversion.

See [`spec/`](./spec) for the language draft and [`conformance/`](./conformance) for the implementation-neutral fixture corpus and runner protocol.

## Why Excel should be the template

The pitch in one paragraph: **Excel is already the place where report
layout lives.** Moving that layout into code makes every row insertion,
style tweak, merge change, or subtotal rule a deployment. xl3 keeps the
layout in Excel and makes the workbook executable: the application owns
data and deployment; the template owns the recurring document contract.

Concretely:

- **A small, auditable XTL surface (ADR-0043).** A function lives in
  XTL only when its value must be known *before* the workbook is
  written. Everything else is a normal Excel cell formula and Excel
  evaluates it at open time. The smaller the language, the easier it is
  for humans to review — and for AI systems to draft. See [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)
  for the side-by-side guide.
- **Conformance corpus.** 160 fixtures, all green, across 74 ADRs.
  This is the test bed for the transformation contract.
- **One implementation, one spec.** The [`spec/`](./spec) directory
  defines XTL independently of this TypeScript reference. Ports to
  other runtimes are welcome; the corpus is the contract.
- **No macros, no vendor cloud.** A template is an ordinary `.xlsx`.
  You can diff it, review it in a pull request, and hand it to a
  human reviewer who has never heard of xl3.

The same properties make xl3 useful even **without an LLM in the loop**:
operators and analysts can read and edit templates directly, because
expressions are written with the same `IF`, `SUM`, and column references
they already use day to day. AI friendliness is a consequence of the
same design choice: small, declarative, reviewable rules.

## Responsibility-driven document automation

Most Excel automation tools improve developer productivity. xl3 aims at a
different outcome: moving recurring document changes out of the
developer-only queue.

In the usual model, every layout change, column addition, repeat rule, or
output-format tweak becomes a development request and a deployment. xl3
separates those responsibilities:

```text
Developer  -> Runtime maintenance
Operator   -> Template maintenance
Business   -> Result usage
```

The developer keeps the engine, validation, integration, and deployment
reliable. The operator edits the Excel template, including document-level
transformation rules. The business consumes the generated workbook.

This is not only a theory. xl3 was shaped by an internal service where,
over months of operation, non-developers maintained templates and
conversion rules directly in Excel while developers focused almost
entirely on the runtime. The important reduction was not just code
volume; it was the amount of work that had to be done by developers.

That is why XTL keeps Excel syntax wherever possible. The intended
experience is not "learn a new programming language", but "use Excel a
little more powerfully." xl3 is not a project to replace developers:
developers own the runtime, operators own the templates, and document
automation becomes an organizational capability.

## How it compares

| Approach | Best at | Tradeoff |
|---|---|---|
| **xl3** | Declarative Excel template execution. The workbook already exists; xl3 runs it with data. | Alpha; one maintainer; the XTL surface is intentionally small and still evolving until 1.0. |
| Workbook APIs (ExcelJS / SheetJS / openpyxl / Apache POI) | Low-level or full-featured workbook generation from code. | Layout, styles, merges, loops, and business rules become application code. Non-developers cannot safely edit the template. |
| Python / VBA scripts | Fast one-off automation close to existing spreadsheets. | Rules live in code or one maintainer's memory; layout changes still need code changes. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 workflows, data shaping, and action automation inside the Excel ecosystem. | Tenant-bound; the workflow rules don't travel with the workbook. |
| JXLS / xltpl / jsreport xlsx recipe | Server-side report generation from spreadsheet-like templates. | Useful prior art, but often tied to one runtime and not positioned as a small, portable Excel rule format. |
| Document-generation SaaS (Plumsail, Conga, Formstack) | Managed document workflows, integrations, approvals, and delivery. | Rules live in a vendor service, not in a portable workbook template you can review and run yourself. |
| Direct LLM → xlsx | Quick exploratory drafting, one-off charts. | Not a deterministic transformation contract for recurring operations. |

## Install

```bash
npm install @xl3-lang/xl3
```

Optional acceleration (rc):

```bash
npm install @xl3-lang/xl3@rc xl3-wasm
```

## Usage

```ts
import { convert } from '@xl3-lang/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — one or more .xlsx, depending on grouping rules in the template
```

Runs in browsers and Node (≥20.12).

### Acceleration (opt-in)

`convert` and `preview` accept an `engine` option that selects the
rendering backend:

```ts
await convert(templateBuffer, dataBuffer, { engine: 'auto' });
//   'auto' (default): try xl3-wasm if installed, fall back to JS silently
//   'wasm'          : require xl3-wasm; throw if missing or unsupported feature
//   'js'            : force the ExcelJS path
```

Install [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) alongside
xl3 to activate the auto path; the JS engine remains the canonical
reference, and the wasm engine falls back to it for any template it
can't yet handle. Available in 0.9.0-rc.1 onwards.

### Browser via `<script>` (no bundler)

For projects that don't use a bundler, a self-contained IIFE bundle
exposes `window.xl3`:

```html
<script src="https://cdn.jsdelivr.net/npm/@xl3-lang/xl3@0.11.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

Bundle is ~1 MB minified (~300 KB gzipped). ExcelJS + JSZip are inlined;
no other dependencies are needed.

You can try the browser flow on [xl3.io](https://xl3.io): run the attached
sample files as-is, download the raw/template workbooks, or replace either file
with your own.

### Excel version compatibility

xl3 reads `.xlsx` files via OOXML and is largely version-agnostic by design — it reads cached formula results, normalizes dates in UTC, and ignores OOXML serialization differences at the cell-value layer. See [ADR-0022](./spec/decisions/0022-excel-version-compatibility.md) for the full matrix; the short form is: stick to XTL's `{{ ... }}` syntax for anything dynamic, avoid charts/pivots/native formulas inside data blocks, and pick one date system (1900) per organization.

Templates choose the source table in the hidden `__config__` sheet:

| Key | Example | Meaning |
|---|---|---|
| `source_sheet` | `Raw` | source worksheet name, or prefix pattern ending with `*` |
| `source_table` | `1` | row 1 contains column names; rows below are data |
| `source_table` | `A1:D` | A1-D1 contain column names; rows below are data |
| `source_table` | `A1:D200` | A1-D1 contain column names; A2-D200 are data |

Use `source_table = N` for the common case where row `N` contains the raw
column names. Use a range form when the table starts in a later column or needs
a bounded end row.

### Reserved sheets

Templates use four reserved dunder-wrapped sheets (per ADR-0011):

| Sheet | Purpose |
|---|---|
| `__config__` | author-defined configuration and value dictionary; access via `{{ __config__[name] }}` |
| `__inputs__` | per-run host-supplied values (ADR-0010); declared with `name`/`type`/`default`/`label`/`description`/`options` columns |
| `__sources__` | additional named data sources beyond the default `source_sheet` (ADR-0012); declared with `name`/`sheet`/`table`/`description` columns |
| `__lists__` | membership lists for `@filter [field] in __lists__[name]` |

Author sheets matching `^__[a-z]+__$` are reserved and rejected at parse time.

### Multi-source data

Beyond the default `source_sheet`, templates can declare named sources in
`__sources__` and reference them with the Excel structured-ref form:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` scopes a data block so the bare bracket shorthand
(`[Column]`) resolves against `<Name>` instead of the default. `@join`
pairs primary rows with rows from a second source by key (inner-join,
first-match). See [`spec/language.md`](./spec/language.md) for full
directive syntax.

### Runtime inputs

Templates that need per-run values (a target month, a customer
filter, a label) declare them in `__inputs__` and the host passes
them to `convert(...)`:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: 'Seoul' },
});
```

Inputs flow into cells (`{{ __inputs__[month] }}`), filename patterns,
and group keys.

## Examples

Four production-shaped templates live in [`examples/`](./examples):
basic renewal report, sheet-per-region with list-filter, a
multi-source join with runtime inputs, and a cafe weekly report
showcasing `@group` + `@subtotal` per-category subtotals. Run them
with `npm run examples:build && npm run examples:run`.

## Guides

Short, copy-paste recipes for common workflows live in
[`docs/guides/`](./docs/guides). Eighteen recipes covering getting
started, conditionals, aggregates, file/sheet grouping, runtime
inputs, joins, `XLOOKUP`, sort/top, styling, multi-line text, empty
values, error handling, `__config__` values, directive composition,
XTL vs Excel-formula, template-authoring display, and `@group` /
`@subtotal`.

## Spec

The XTL spec is language-neutral and lives in [`spec/`](./spec). This repo provides the TypeScript reference implementation. Other-language ports are welcome — see [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md).

Run the conformance corpus locally:

```bash
npm run conformance
npm run conformance:stage2
```

A summary of the latest reference-impl run — plus columns for any
external port reports dropped under
[`conformance/reports/`](./conformance/reports/) — lives in
[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md). Regenerate
with `npm run conformance:dashboard`.

## Project structure

- `spec/` — normative XTL language draft.
- `conformance/` — implementation-neutral fixture corpus and runner protocol.
- `src/` — TypeScript reference implementation.

The spec is the source of truth. Conformance fixtures make spec behavior executable. The reference implementation is useful, but not normative.

## License

- Code (`src/`, `conformance/`): [MIT](./LICENSE)
- XTL spec (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft and Excel are trademarks of Microsoft Corporation. xl3 is not affiliated with Microsoft. The Office Open XML format (`.xlsx`) is published as ISO/IEC 29500.
