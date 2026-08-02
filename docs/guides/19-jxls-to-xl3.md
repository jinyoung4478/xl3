# 19 · JXLS to xl3 — the JavaScript alternative

## Scenario

Your team renders Excel reports with [JXLS](https://jxls.sourceforge.net/)
on the JVM, and now needs the same thing in Node.js or the browser — or
you searched "JXLS for JavaScript" and found only 8-year-old wrappers
around `node-java`. xl3 is the maintained answer: an Excel-to-Excel
template engine where the spreadsheet itself is the template.

This is not a coincidence of feature overlap. xl3's spec absorbed JXLS's
~10 years of edge-case experience item by item — merged data-row cells,
named ranges, print areas, outline levels, multi-line text all have
dedicated ADRs and conformance fixtures. The operating principle
([ADR-0034](../../spec/decisions/0034-prior-art-relationship.md)):
**borrow JXLS's experience, not its syntax.**

## The model difference in one table

| | JXLS | xl3 |
|---|---|---|
| Directives live in | Cell **comments** (`jx:each(items="rows" lastCell="D4")`) — invisible in the grid | Cell **values** (`{{ @filter [Status] = "Open" }}`) — visible, reviewable, diffable |
| Expression language | JEXL (`${employee.payment * 1.1}`) — a second language to learn | Excel syntax (`{{ [Payment] * 1.1 }}`, `IF`, `XLOOKUP`, `SUM`) — what template authors already know |
| Data comes from | Java objects bound in code (`context.putVar("employees", list)`) | A second `.xlsx`, or JSON on stdin — `render(template, data)` is a pure function: same inputs, same bytes |
| Block bounds | Explicit `lastCell="D4"` coordinates | Inferred from `{{ ... }}` markers (or explicit `{{ @block A:D }}` when you want it) |
| Escape hatch | Custom Java commands — Turing-complete, unportable | None, by design — the template stays a handover artifact any implementation can render ([ADR-0048](../../spec/decisions/0048-jxls-boundary-final.md)) |

The consequence: a JXLS template is owned by whoever can edit cell
comments and Java bindings — a developer. An xl3 template is owned by
whoever can edit a spreadsheet.

## Directive mapping

| JXLS | xl3 equivalent | Notes |
|---|---|---|
| `jx:each(items="rows" var="r" lastCell=…)` | A **data block** — a template row containing `{{ [Column] }}` markers | No loop declaration at all; the block expands one output row per source row. See [Getting started](./01-getting-started.md) |
| `${r.name}` | `{{ [Name] }}` | Column reference into the source row |
| `${r.amount * 1.1}` | `{{ [Amount] * 1.1 }}` | Excel operators, not JEXL |
| `jx:if(condition=…)` on a cell | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` | [Conditional cells](./02-conditional-cells.md) |
| `jx:if` used to drop rows | `{{ @filter [Status] = "Open" }}` | Multiple `@filter`s AND together |
| `jx:each` with `orderBy` | `{{ @sort [Total] desc }}` | |
| `jx:each` with `groupBy` | `{{ @group [Region] }}` + `{{ @subtotal SUM([Renewal]) }}` | Interleaved subtotal rows, N-level nesting — [Group and subtotal](./18-group-and-subtotal.md) |
| `jx:each(direction="RIGHT")` | `{{ @repeat right 3 }}` | |
| Multiple collections | `{{ @source Renewals }}` per block, `{{ @join Customers on Customers[Account] = Renewals[Account] }}` | [Multi-source + @join](./07-multi-source-join.md) |
| `jx:multisheet` | Put the pattern in the **sheet name**: `Region-{{ [Region] }}` | [Sheet per group](./05-sheet-per-group.md); one *file* per group via `output_file_pattern` — [File per group](./04-file-per-group.md) |
| `jx:link` | `{{ HYPERLINK(url, label) }}` | [ADR-0039](../../spec/decisions/0039-hyperlink-function.md) |
| `jx:params(formulas=…)` | Nothing to declare — native Excel formulas in the template are preserved as-is | [ADR-0046](../../spec/decisions/0046-cell-formula-preservation.md) |
| SUM over the expanded block | `{{ SUM([Renewal]) }}` aggregate, or a plain Excel `=SUM(...)` formula | [Aggregates](./03-aggregates.md) |

## What intentionally does not carry over

xl3 rejected three JXLS features with recorded reasoning, so the
boundary stays a decision rather than a gap:

- **`jx:image` (data-driven image insertion)** — rejected,
  [ADR-0037](../../spec/decisions/0037-rejected-dynamic-image-insertion.md).
  Images *placed in the template* survive rendering; inserting images
  from data does not fit the browser-safe, deterministic pipeline.
- **`jx:updateCell` (runtime cell mutation)** — rejected,
  [ADR-0042](../../spec/decisions/0042-rejected-runtime-cell-mutation.md).
  `{{ ... }}` substitution already covers the use case without making
  evaluation order observable.
- **Custom commands (host-language escape hatch)** — rejected,
  [ADR-0034](../../spec/decisions/0034-prior-art-relationship.md). A
  template that requires your Java/JS helper can't be handed to another
  team or another implementation.

If your JXLS templates lean on custom commands, that logic moves into
the **data file** (precompute the column in whatever produces the
data), not into the template.

## The render call, side by side

JXLS (Java):

```java
List<Employee> employees = loadEmployees();
Context context = new Context();
context.putVar("employees", employees);
JxlsHelper.getInstance().processTemplate(templateStream, outStream, context);
```

xl3 (Node.js or browser):

```js
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: [{ filename: 'renewal-report.xlsx', buffer }, ...]
```

There is no context object to bind. Everything the render needs is in
the inputs — which is what makes the output reproducible and the
template testable without a host program.

## Staying on the JVM

Migrating the render loop to Node is one option, not the only one. If
the service stays on the JVM, call the CLI and keep the data where it
already is — in memory, as JSON, with no intermediate workbook:

```java
// Write xl3-source-json/0.1 to the process, read the files it wrote.
Process p = new ProcessBuilder(
        "xl3", "render", "template.xlsx", "--data=-", "--out=./out/", "--json")
    .redirectErrorStream(false)
    .start();
p.getOutputStream().write(sourceJson.getBytes(StandardCharsets.UTF_8));
p.getOutputStream().close();

int exit = p.waitFor();   // 0 ok · 1 conversion error · 2 usage error
```

The JSON is column-oriented — `headers` plus array `rows` — so mapping a
`List<Employee>` onto it is a loop, not a workbook build:

```json
{
  "version": "xl3-source-json/0.1",
  "sources": {
    "default": {
      "headers": ["Employee", "Payment"],
      "rows": [["Kim", 4200], ["Lee", 3900]]
    }
  }
}
```

On a non-zero exit, `--json` puts the failure on stderr with the stable
`error.code` to switch on — see
[Cookbook 13](./13-error-handling.md) for the code catalog. Install once
(`npm i -g @xl3-lang/xl3`) rather than invoking `npx` per request, which
would pay a registry lookup every time.

This is the closest analogue to how JXLS is deployed: one artifact
installed on the server, called from application code. What does not
carry over is the SPI escape hatch — see the section above.

## Migration checklist

1. **Move data out of code.** Whatever you `putVar`'d becomes a source:
   either a sheet (one table per collection) or one `sources` entry of
   `xl3-source-json/0.1`. Serializing the collections you already hold is
   usually the only real work — and the JSON route skips writing a
   workbook just to have one read back.
2. **Delete the comments, write the cells.** Each `jx:each` region
   becomes a one-row data block of `{{ [Column] }}` markers; `lastCell`
   bounds disappear.
3. **Rewrite JEXL as Excel expressions.** `${...}` arithmetic and
   conditionals map 1:1 onto `{{ ... }}` with `IF`/operators.
4. **Re-create grouping declaratively.** `groupBy`/`orderBy` become
   `@group`/`@sort`/`@subtotal` cells inside the block.
5. **Run it and diff.** `convert()` is deterministic — identical inputs
   render identical bytes, including zip entry timestamps — so a
   golden-file test replaces visual spot-checking. Reproducible bytes
   landed in 0.12.0; against 0.11.0 or earlier, compare canonicalized
   parts instead (`npx xl3-conformance canonicalize out.xlsx`).

Try the migration on one template in the browser — no install — at
[xl3.io/try](https://xl3.io/try).

See also: [ADR-0048](../../spec/decisions/0048-jxls-boundary-final.md)
(the final JXLS boundary), [`spec/language.md`](../../spec/language.md)
"Directives".
