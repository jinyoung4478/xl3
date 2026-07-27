# 13 · Error handling for hosts

## Scenario

Your app calls `convert(templateBuffer, dataBuffer)`. The template has
a typo, or the data is missing a required column. Now what?

xl3 raises **structured errors** (per ADR-0015) with a stable
`error.code` string. Hosts dispatch on the code — for localization,
retry logic, or operator-friendly messages.

## Catch + dispatch

```ts
import { convert, isXtlError } from '@xl3-lang/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // ship outputs
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('Your data file is missing required columns.', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('Two output files would have the same name. Check your data.', err.message);
      default:
        return showOperator('Conversion failed.', err.message);
    }
  }
  // Non-xl3 error: probably a system fault. Re-throw.
  throw err;
}
```

`isXtlError(value)` returns `true` only for `Error` instances whose
`code` starts with `xl3/`. Plain `Error` or DOMException etc. won't
match.

## The error code catalog

Stable. Append-only. Renames are breaking changes per ADR-0015. The
current set:

- **`xl3/cell/*`** — cell-level failures (`formula-no-cache`, `numfmt-coercion`, `row-outside-repeat`)
- **`xl3/eval/*`** — expression evaluation (`arity-mismatch`, `operand-coercion`, `unsupported-syntax`)
- **`xl3/config/*`** — `__config__` issues
- **`xl3/inputs/*`** — runtime input failures
- **`xl3/source/*`** — source data issues (missing headers, undeclared sources, reserved column names)
- **`xl3/sources/*`** — `__sources__` sheet issues
- **`xl3/sheet/*`** — sheet-name issues
- **`xl3/directive/*`** — directive syntax
- **`xl3/join/*`** — `@join` clause issues
- **`xl3/xlookup/*`** — `XLOOKUP` failures
- **`xl3/filename/*`** — output filename issues
- **`xl3/parser/*`** — parser failures
- **`xl3/lists/*`** — `__lists__` reference issues
- **`xl3/expression/*`** — expression-level rejections (`bracket-outside-block`, `unknown-name`)
- **`xl3/block/*`** — data-block layout (`overlap`, `empty-table`)
- **`xl3/group/*`** — `@group` issues (`missing-key`)
- **`xl3/subtotal/*`** — `@subtotal` issues (`outside-group`, `bad-aggregate`, `mixed-row`, `explicit-block-unsupported`)
- **`xl3/source-json/*`** — JSON source input (`invalid`) — only reachable via `convertJson` / `previewJson`

Full list in [`impl/js/src/error-codes.ts`](https://github.com/xl3-lang/xl3/blob/main/impl/js/src/error-codes.ts).

## Common cases worth handling explicitly

**Missing required input** (`xl3/inputs/missing-required`):
The template declares an input as `required: true` and the host didn't
supply it. Show a form, ask the operator, retry.

**Filename collision** (`xl3/filename/collision`):
Two distinct file group keys sanitized to the same filename
(e.g., `Seoul/Korea` and `Seoul:Korea` both → `Seoul_Korea.xlsx`). The
operator usually needs to clean their data, not the template.

**Source mismatch in XLOOKUP** (`xl3/xlookup/source-mismatch`):
The template author wrote `XLOOKUP(x, A[k], B[v])` where `A` and `B`
are different sources. Template needs fixing — not an operator issue.

**No match in XLOOKUP** (`xl3/xlookup/no-match`):
The lookup value isn't in the lookup column. Either the operator's
data is incomplete, or the template should use `@join` instead (drops
unmatched rows).

## Locale

`error.message` is English. To localize, dispatch on `error.code` in
your host and provide your own messages — do NOT translate the
engine's English strings. The English text is part of the conformance
contract (fixtures match on substrings of it).

## Preview before convert

`preview(template, data, options)` runs the same parse + dispatch as
`convert` but doesn't render the workbooks. If your host has a "Validate"
button before "Convert", call `preview` — fast, catches the same errors,
no wasted xlsx generation.

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings: non-fatal issues
// preview.inputs: resolved input values (after defaults + coercion)
// preview.files / preview.sources: what convert() would produce
```

## Spec pointers

- ADR-0015 — Structured error reporting.
- [`spec/evaluation.md`](../../spec/evaluation.md) "Errors".
- [Cookbook 06](./06-runtime-inputs.md) for input-related errors.
