# XTL Evaluation

This document defines how an XTL implementation reads inputs and produces outputs.

## Inputs and Outputs

An XTL conversion takes:

```text
template.xlsx
data.xlsx
```

and produces one or more `.xlsx` output files.

The template workbook defines the output workbook shape, template expressions, grouping rules, directives, and configuration. The source workbook provides tabular data.

## Reserved Sheets

xl3 defines four reserved sheet names. Any sheet whose name matches
the dunder-wrapped pattern `__<name>__` is reserved for engine use.
Authors MUST NOT create sheets with that shape; everything else is
template content.

| Sheet | Purpose |
|---|---|
| `__config__` | Single configuration object — engine metadata + author-defined values |
| `__inputs__` | Runtime input declarations (collection; see [Inputs](#inputs)) |
| `__sources__` | Named external data source declarations (collection; see [External Data Sources](#external-data-sources), per ADR-0012) |
| `__lists__` | Author-defined membership lists (collection; see [List Sheets](#list-sheets)) |

References to reserved-sheet contents from cell expressions use Excel
structured-reference form `__sheet__[key]` — the same form used for
multi-source columns in a future ADR. The legacy `_<name>` reference
syntax is retired in this version.

## Template Configuration

A hidden sheet named `__config__` MAY provide metadata and author-
defined values. Column A holds the key, column B holds the value.

| Key | Meaning | Example |
|---|---|---|
| `name` | Template display name | `Order summary` |
| `description` | Free text | `Monthly order summary` |
| `source_sheet` | Source sheet name, or prefix pattern ending with `*` | `Orders`, `Data_*` |
| `source_table` | Source table selector. The first selected row contains column names; rows below are data. | `1`, `A1:D`, `B5:H200` |
| `output_file_pattern` | Output filename template | `{{ __config__[customer] }}_report.xlsx` |
| `match_pattern` | Batch matching pattern | `Orders*` |
| any other key | Author-defined value | `title = Q2 Sales` |

`source_table` is the only source table selector.

Author-defined values use any key not listed in the system table
above. They are referenced from cells via `{{ __config__[key] }}`.
For example, a row `title = Q2 Sales` is referenced as
`{{ __config__[title] }}`. Authors MUST NOT reuse system key names
for author-defined values.

Per ADR-0056, the `__config__[key]` read form resolves to the cell
value regardless of whether `key` is a system slot or an
author-defined slot. `{{ __config__[name] }}`, `{{ __config__[
output_file_pattern] }}`, etc. are legal reads. The write-side
restriction (authors cannot DECLARE a row with a system key name)
is unchanged. Reading an unknown key raises
`xl3/expression/unknown-name`.

Templates that need *per-run* values use the `__inputs__` sheet
instead (see [Inputs](#inputs)).

## External Data Sources

A template MAY declare additional named data sources beyond the
default by providing the reserved sheet `__sources__`. Row 1 is the
header; each subsequent row declares one source.

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Source name. Letters, digits, and underscores only. MUST NOT start with `__` and MUST NOT be `default` (reserved for the implicit source). |
| `sheet` | yes | Source worksheet name in the data workbook, or prefix pattern ending with `*`. |
| `table` | no | Source-table selector for that sheet, defaulting to `1`. Same syntax as `source_table` in `__config__`. |
| `description` | no | Free-form note. |

Implementations MUST identify columns by header text, case-insensitive.

The implicit **default** source — declared via `source_sheet` and
`source_table` rows in `__config__` — is always named `default`. It
cannot be redeclared in `__sources__`.

### Cell references

`[Column]` continues to mean "the active source's current row's
column." `Source[Column]` is the structured-reference form for a
named source:

```
{{ [Account] }}                   active source's current row
{{ Customers[Account] }}          Customers' current row (only when active)
{{ SUM(Renewals[Amount]) }}       aggregate over Renewals' full row set
```

Row-level `Source[Column]` is valid only when `Source` is the active
source for the surrounding data block. Inside an aggregate function,
`Source[Column]` always operates on `Source`'s full row set
independent of the active block.

### `@source` directive

A data block MAY scope its iteration to a named source:

```
{{ @source Customers }}
{{ @filter [Region] = "Seoul" }}
{{ [Account] }}
{{ [Region] }}
```

The data block above expands vertically by default — one rendered
row per source row — without an explicit `@repeat` directive (see
[Directives](#directives)).

Without `@source`, the active source is `default`. `@source` MUST
appear before `@filter`/`@sort`/`@top` directives of the same block
(it determines which row set those operate on).

Referencing an undeclared source — either via `@source <Unknown>` or
via `Unknown[Column]` — is an error.

### `@join` directive

A data block MAY add **one** `@join` directive immediately after
`@source` to pair each primary-source row with a row of a second
source:

```
{{ @source Renewals }}
{{ @join Customers on Customers[Account] = Renewals[Account] }}
{{ [Account] }} | {{ Customers[Name] }} | {{ [Amount] }}
```

For each primary row, the engine finds the **first** matching joined
row (per [Comparison Algorithm](./language.md#comparison-algorithm))
and renders the pair. "First" is defined by the joined source's
natural row order — top-to-bottom over its `source_table` range.
This is normative: when multiple joined rows have an equal join key,
two implementations MUST pick the same paired row.

If no match is found, the primary row is **dropped** (inner-join
semantics).

Inside the block, `[Column]` and `<PrimarySource>[Column]` resolve
to the primary row; `<JoinedSource>[Column]` resolves to the paired
joined row. References to other sources at row level remain an error.

Multiple `@join` directives, left-join semantics, and multi-row
matches are out of scope for XTL 0.1.

## Inputs

A template MAY declare runtime inputs by providing a reserved sheet
named `__inputs__`. The first row is a header; each subsequent row
declares one input.

| Column | Required | Meaning |
|---|---|---|
| `name` | yes | Input name. Must consist of letters, digits, and underscores only. |
| `type` | yes | One of `text`, `number`, `date`, `select`. |
| `default` | no | If non-empty, used when the host omits the input. The default value is parsed by the input's `type`. |
| `label` | no | Human-facing prompt text. Hosts SHOULD use it as the form label. |
| `description` | no | Optional longer-form help. |
| `options` | no | Required when `type = select`. Pipe-separated allowed values, e.g. `Seoul\|Busan\|Daegu`. |

Implementations MUST identify columns by header text, case-insensitive.
Columns beyond those listed above are reserved and MUST be ignored.

An input is **required** when its row has no `default`. Hosts MUST
supply every required input; omitting one is an error.

Resolved input values are referenced from cells via
`{{ __inputs__[name] }}`. For example, an input declared with
`name = month` is referenced as `{{ __inputs__[month] }}`.
`__inputs__[name]` resolves to the resolved + coerced value; there
is no spec form for reading an input's `label`, `default`, or
`type` from inside a template (hosts use the `readTemplateInputs()`
API).

Input names MUST NOT collide with author-defined values declared as
non-system rows in `__config__`; this is an error at parse time.

Per ADR-0062, an input is **required** when the `default` cell —
*after* ADR-0050 evaluation — produces an empty value per ADR-0007.
The shapes "blank cell," `default = ""`, `default = "   "`, and
`default = {{ "" }}` all collapse to "required."

Per ADR-0063, the `options` cell is split on `|` after evaluation;
each element is trimmed of Unicode whitespace and empty elements
are dropped. `options = "Seoul | Busan"` yields
`["Seoul", "Busan"]`; `options = "a||b"` yields `["a", "b"]`;
`options = "||"` raises `xl3/inputs/missing-options`. Duplicate
options are preserved. Host-supplied `select` values match
case-sensitively against the resulting array.

Inputs are coerced from host-supplied values:

- `text` — passes the host string through. Non-string host values
  stringify via canonical string form (see
  [Comparison and String Coercion](./language.md#comparison-and-string-coercion)).
- `number` — parsed via "trim, then `Number()` without producing
  `NaN`." Failure is an error.
- `date` — coerced by the same rules as date-format single-expression
  cells. Failure is an error.
- `select` — host value MUST equal one of the declared `options` after
  canonical-string-form normalization. Failure is an error.

Coerced input values participate in `IF()`, `@filter`, `&`,
comparisons, and `TEXT()` like any other value.

### Template evaluation in `default` / `label` / `description` / `options`

Per ADR-0050, cells in the `default`, `label`, `description`, and
`options` columns are XTL templates: contiguous text plus zero or
more `{{ ... }}` blocks, evaluated at input-read time (before any
source row is loaded). The evaluation context is intentionally
constrained.

Available bindings:

- `__config__[key]` — author-defined values from the `__config__`
  sheet (parsed before `__inputs__`).
- Pure scalar functions: `TODAY`, `DATE`, `IF`, `IFEMPTY`, `IFS`,
  `IFERROR`, `UPPER`, `LOWER`, `TRIM`, `TEXT`, `YEAR`, `MONTH`,
  `DAY`, `EOMONTH`, `EDATE`, `DATEDIF`, `ROUND`, `ABS`.

Forbidden bindings (raise stable error codes):

- Bare `[Column]` or `Source[Column]` refs — no source row context
  yet at input-read time. Error: `xl3/inputs/forward-reference`.
- `__sources__[…]` or `__inputs__[name]` — sources not loaded;
  input rows are independent declarations. Error:
  `xl3/inputs/forward-reference`.
- `ROW()`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP` —
  render-time or source-data dependent. Error:
  `xl3/inputs/runtime-only-fn`.

The post-evaluation canonical-string form (see ADR-0009) is what
flows back through the host UI as `InputSpec.default` /
`InputSpec.label` / `InputSpec.description`. For `options`, the
evaluated string is then split on `|` to produce the array.

For `default`, the evaluated string is subsequently coerced by the
input's declared `type` per the rules above. So `default = {{
TODAY() }}` with `type = date` yields the render-time ISO date in
the post-coercion default.

## Source Data Model

The source data model is an ordered list of rows. Each row is a mapping from
source column name to cell value.

`source_sheet` selects the worksheet. If omitted, the first worksheet is used.
If `source_sheet` ends with `*`, it is a prefix pattern. The implementation MUST
select the first worksheet, in workbook order, whose name starts with the prefix
before `*`. If no worksheet matches, this is an error. Exact sheet-name matches
take precedence over prefix matching.

`source_table` is interpreted within the selected worksheet:

| Form | Meaning |
|---|---|
| `N` | Row `N` contains source column names. The source columns are the non-empty cells from the first non-empty cell through the last non-empty cell. Rows below `N` are data rows through the worksheet's used row end. |
| `A1:D` | Cells `A1:D1` contain source column names. Rows below are data rows through the worksheet's used row end. |
| `A1:D200` | Cells `A1:D1` contain source column names. Rows `2:200` in columns `A:D` are data rows. |

If `source_table` is omitted, it defaults to `1`.

`N` MUST be a 1-based positive integer. Range forms MUST use absolute Excel A1
coordinates with a left column, first row, right column, and optional end row.
The left column MUST NOT be to the right of the right column. The optional end
row MUST NOT be above the first row.

When a range form includes an end row equal to the first row, such as
`A1:D1`, the source table contains column names and zero data rows. This is
valid.

Source table column-name cells use the same effective text/value extraction as
source data cells before trimming.

Column name rules:

1. Source column name cell values are converted to strings and trimmed.
2. Source column names are case-sensitive.
3. Rich-text source column name cells are read by concatenating text runs.
4. Formula source column name cells use the cached formula result. If no cached
   result is available, this is an error.
5. Empty column names inside the selected source table are errors.
6. Duplicate source column names are errors.
7. Empty data rows are skipped.
8. Horizontally-merged header cells form one column at the merge master's
   column index (per ADR-0033). Slave cells in the same row but a different
   column from the master are transparent: they contribute no column and do
   not cause a duplicate-name error. Vertical merges in the header row read
   the master's text at the slave's column unchanged. If the selected range
   contains only slave cells of a merge (no master in the window), this is
   an error (`xl3/source/missing-header`); widen the range to include the
   merge master.
9. Newlines inside header-cell text (CRLF, CR, or LF — including
   those authored via Alt+Enter) are normalized to a **single space**
   (U+0020) at read time per the ADR-0041 amendment. Multiple
   consecutive newlines collapse to one space. The space-collapsed
   form is the column name; templates reference it via the same
   space form (`{{ [단위: 원] }}`). Trim and empty-after-trim
   detection (rule 5) apply *after* newline normalization. Header
   normalization is asymmetric with data rows, where LF is
   preserved verbatim per ADR-0041's original scope.

Merged cells in **data rows** (rows below the header row) follow a
separate rule per ADR-0035: a merge slave's value is the merge master's
value. A vertical merge spanning *N* data rows yields *N* data rows, each
sharing the master's value at that column. A horizontal merge in a data
row gives every slave column the master's value at that row. Empty-data-row
skip is evaluated *after* merge broadcast. Authors who want a vertical
merge to count as one logical record SHOULD unmerge the source data region.

For row-number shorthand (`source_table = N`), gaps between the first and last
non-empty column name cell are therefore errors after the source column span is
inferred.

### JSON source input (`xl3-source-json/0.1`)

A source MAY be supplied as a language-neutral JSON document instead of a
`.xlsx` workbook (ADR-0075), via the `convertJson` / `previewJson` entry
points. The `xl3-source-json/0.1` format carries the same Source Data Model
described above — one or more named sources, each a header list plus data
rows — so a JSON source and its equivalent `data.xlsx` produce identical
output.

- `sources.default` is required; every source declared in `__sources__`
  MUST be present, and no undeclared source may appear.
- Cell values map to the model in this spec: `null` and error values are
  empty (see "Empty Values" below), `{ "type": "date", … }` is a UTC Date
  (ADR-0017), and numbers/strings/booleans pass through. All-empty rows are
  skipped.
- In JSON mode, `source_sheet` / `source_table` are ignored for data
  selection (the JSON already carries headers and rows).

The wire format is normative and portable; see ADR-0075 and
PORTERS_GUIDE.md.

## Empty Values

A value is **empty** if it is missing — the source column does not exist
on this row, or the cell is blank — or if it is a string whose contents
are entirely Unicode whitespace.

Numbers, including `0`, are never empty. Booleans, including `false`,
are never empty. Dates are never empty. Non-empty strings are never
empty. A formula whose cached result is the empty string is empty by
this rule.

Excel error cells (`#N/A`, `#VALUE!`, `#DIV/0!`, `#REF!`, `#NAME?`,
`#NUM!`, `#NULL!`) — whether static or carried as a formula cached
result — are also empty per this rule (ADR-0017). Implementations MAY
emit a warning when they encounter one; warnings MUST NOT change
output semantics.

The empty predicate governs every place the spec refers to an empty
value:

- `IFEMPTY(value, fallback)` returns `fallback` when `value` is empty.
- `COUNT([field])` counts a row when its `[field]` value is non-empty.
- A source row is empty when every cell in the source-table column span
  is empty. Empty data rows are skipped before grouping and rendering.
- List-sheet entries are read by dropping empty cells from the sheet's
  first column.
- A source-row value that is empty never matches `@filter [field] in
  __lists__[name]`. The same value always matches `@filter [field]
  !in __lists__[name]`.

## List Sheets

A template MAY declare named membership lists by providing a reserved
sheet named `__lists__`. Row 1 is the header; each header cell is the
name of one list. Below row 1, each column holds that list's values.

```
__lists__:
| fruits | allowed_status | excluded_regions |
|--------|----------------|------------------|
| apple  | open           | test             |
| banana | pending        | internal         |
| cherry | reviewing      |                  |
```

The `__lists__` sheet:

- MAY be visible, hidden, or very hidden in the template.
- MUST be removed from output workbooks.
- Each cell is converted to its canonical string form per
  [Comparison and String Coercion](./language.md#comparison-and-string-coercion)
  and trimmed of Unicode whitespace. Cells empty after trimming (per
  [Empty Values](#empty-values)) are skipped.
- Order within each column is preserved. Duplicate entries are not removed.

Lists are referenced from filter directives:

```
{{ @filter [Fruit] in __lists__[fruits] }}
{{ @filter [Status] !in __lists__[allowed_status] }}
```

`__lists__[name]` is a list array. It is valid only inside `@filter
... in` and `@filter ... !in`; using it elsewhere raises
`xl3/lists/invalid-use` per ADR-0057. This covers list references
in cell expressions, as operands of `=`/`!=`/etc., as function
arguments, and as `@sort`/`@top` arguments.

Referencing a list name not declared in `__lists__` (or referencing
`__lists__[name]` when no `__lists__` sheet exists) raises
`xl3/lists/missing-reference`.

## Render Phases

Implementations MUST render in this conceptual order:

1. Parse `__config__`, `__inputs__`, `__lists__`, sheet templates, directives, and variables.
2. Read source rows.
3. Resolve source columns referenced by template expressions.
4. Split source rows into file groups from `output_file_pattern`.
5. Split file groups into sheet groups from sheet-name group keys.
6. Apply directives to the current row set.
7. Expand repeat blocks.
8. Evaluate static cells and data cells.
9. Remove reserved `__<name>__` sheets and directive rows from output.
10. Write output files.

The exact implementation strategy may differ, but observable output MUST match this order.

### Block expansion — column-scoped splice (ADR-0066)

Step 7 ("Expand repeat blocks") is normative on the **column scope**
of the splice. Given a data block with row range `[r_start..r_end]`
and column range `[c_start..c_end]` (see `language.md` "Data Blocks"
for derivation), expanding the block to `N` records does the
following:

- **Inside cells** (column in `[c_start..c_end]`):
  - For rows in `[r_start..r_end]`: clone per record into rows
    `r_start..r_start + N * (r_end - r_start + 1) - 1`.
  - For rows `r > r_end`: shift down by
    `(N - 1) * (r_end - r_start + 1)` rows.
- **Outside cells** (column outside `[c_start..c_end]`):
  - Stay at their original `(r, c)` position regardless of
    expansion factor `N`.
  - Their cell value, formula text, and style MUST be preserved
    verbatim.

The row-shift effect of the splice is therefore **column-scoped**:
the same OOXML row insertion only shifts inside-column cells, and
the renderer restores outside-column cells to their original row
positions in the same render phase. Implementations that perform a
row-wide splice MUST follow it with an outside-cell restore pass to
satisfy this contract.

## Ordering

Output ordering is deterministic and source-driven:

- **File groups** appear in **first-seen** order. The engine walks
  source rows in the source's natural order; the first row whose
  `output_file_pattern` evaluates to filename `X` causes that group
  to be emitted first.
- **Sheet groups within a file** appear in **first-seen** order over
  the file group's row list. The first matching row determines the
  sheet's position.
- The single-source iteration order is `source_table` reading
  top-to-bottom. With multi-source data (see [External Data
  Sources](#external-data-sources)) the rule applies to the
  *primary* source's rows; named sources contribute to aggregates
  and joins but do not affect output ordering.

Sort stability is defined under
[`@sort`](./language.md#sort): equal sort keys preserve source order.

## Directives

Directives apply in this order:

```text
source -> join -> filter -> sort -> group -> top -> repeat
```

Multiple filters are combined with logical AND. With multiple sorts,
the first `@sort` is the primary key and later sorts are tiebreakers.

`@group` (ADR-0038) partitions the post-filter / post-sort row set
into N-level nested groups and drives interleaved `@subtotal` row
emission inside a single data block. Group order is encounter order
*after* `@sort`; `@group` itself does not reorder. `@top` applies
after grouping at the row level — subtotal rows emit only for
groups whose data rows survived the `@top` cut.

`@repeat right` changes block expansion direction and is not a data
filtering directive. Without an explicit `@repeat`, data blocks
expand vertically (downward) — one rendered row per source row.

## Cell Text Extraction

Template expression parsing and source-row reading operate on each cell's
effective text/value:

- Plain string, number, boolean, and date cells are read as their cell values.
- Rich-text cells are read as the concatenation of their text runs, in order.
- Formula cells are not recalculated by XTL. If the workbook contains a cached
  formula result, that cached result is used. If a formula cell is read as a
  source data value and no cached result is available, this is an error.

## Source Value Model

A source value is one of the following kinds (per ADR-0017):

| Kind | Notes |
|---|---|
| Missing | Source column does not exist on this row, or the cell is blank. Empty per [Empty Values](#empty-values). |
| String | Unicode text. Empty per ADR-0007 only when entirely whitespace. |
| Number | IEEE 754 double. `NaN` and infinities are not produced by spec-conformant operations; they stringify to `""` and flow as empty. |
| Boolean | `TRUE` / `FALSE`. |
| Date | A calendar instant; may or may not carry a time component. |

Excel cell shapes map onto kinds:

| Excel cell | XTL kind |
|---|---|
| Blank | Missing |
| String / inline / shared string | String |
| Number (incl. dates stored as serials with non-date format) | Number |
| Date-formatted cell | Date |
| Boolean | Boolean |
| Formula with cached result | The result's kind |
| Error cell (`#N/A`, `#VALUE!`, `#DIV/0!`, …) | Missing (per [Empty Values](#empty-values)) |

A percentage-formatted Excel cell flows as its underlying Number
value (50% → `0.5`). Templates that need formatted output use
`TEXT(value, "0%")` (an extension format outside the XTL 0.1 core
table) or rely on the template cell's number format being preserved.

## Cell Evaluation

### Single-Expression Cells

A cell whose complete content is one template expression is a single-expression cell:

```text
{{ [OrderDate] }}
```

Per ADR-0052, "complete content" is evaluated against the cell's
text after **trimming leading and trailing Unicode whitespace**.
A cell of `  {{ [OrderDate] }}  ` (surrounding whitespace only) is
a single-expression cell. The trimmed whitespace is not part of the
rendered value.

Adjacent template blocks with no separator — `{{ [A] }}{{ [B] }}`
— are NOT a single-expression cell. They are mixed-text cells per
the rule below; their results are joined as canonical strings.
Authors who want type-preserving single-expression behavior use the
explicit `&` form: `{{ [A] & [B] }}`.

Single-expression cells preserve the evaluated value type where possible.

If the template cell has a number/date/text format, the implementation MUST coerce string source values to match that format:

- Date-like formats coerce supported date strings or Excel serial numbers to dates.
- Number-like formats coerce numeric strings to numbers.
- Text format `@` coerces to string.

If coercion fails, the implementation MUST report an error.

The minimum set of supported date formats and numeric format tokens is not normatively defined by XTL 0.1 and is left to each implementation. Implementations that support fewer formats than another implementation may declare partial conformance.

### Mixed Text Cells

A cell containing literal text around one or more expressions is a mixed text cell:

```text
Order date: {{ [OrderDate] }}
```

A cell containing adjacent template blocks with no separator
(`{{ [A] }}{{ [B] }}`) is also a mixed-text cell per ADR-0052.

Mixed text cells render as strings. Template number/date formats do not coerce mixed text cells. Empty values per [Empty Values](#empty-values) (including the six source-side Excel error sentinels per ADR-0053) contribute `""` at their position; the engine-produced `#DIV/0!` substitutes the literal string `"#DIV/0!"` at its position (ADR-0025).

### TEXT Function

For XTL 0.1 core formats, `TEXT(value, format)` returns a string. It is intended
for filenames and explicit display strings, not for cells that should remain
numeric/date values.

Formats outside the XTL 0.1 core `TEXT()` table are implementation-defined
extensions. The conformance corpus does not assert a specific result for those
formats.

## Output Filenames

Each output filename produced by `output_file_pattern` evaluation MUST be sanitized in this order:

1. **Replace forbidden characters** with `_`:
   - The set `< > : " / \ | ? *`
   - ASCII control characters in the range `0x00`-`0x1F`.
2. **Trim** leading and trailing whitespace and trailing `.` characters.
3. **Reserved name guard:** if the resulting basename (before the `.xlsx` extension), case-insensitive, equals one of `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, append a single `_` to the basename.
4. If steps 1-3 yield an empty filename or empty basename, this is an error.
5. If the UTF-8 byte length of the resulting filename exceeds 255, this is an error. Implementations MUST NOT silently truncate.
6. Implementations SHOULD emit a warning when any of steps 1-3 changed the rendered string, including the original and the sanitized filename. Warnings MUST NOT change output semantics.

These rules apply to filenames only. Sheet names follow Excel's own forbidden set and 31-character length limit, defined separately by the implementation.

Unicode characters (e.g., CJK, accented letters, emoji) are not restricted: any code point outside the explicitly forbidden set is preserved.

## Styles and Workbook Structure

Implementations MUST preserve the following template features verbatim
in the rendered output (per ADR-0036):

- Cell style (font, fill, border, alignment)
- Number/date format
- Row height and column width
- Merged cells in both the template and source data rows (per ADR-0033
  for source headers and ADR-0035 for source data rows)
- Images and their anchor ranges
- Conditional formatting rules and their `sqref` ranges
- Named ranges / defined names (workbook-scope and sheet-scope)
- Print area and print titles (repeating rows / columns)
- Freeze pane / split (sheet `views`)
- Sheet protection state and per-cell locked / hidden flags
- Data validation rules (dropdowns, range constraints) and their ranges
- Cell comments (notes)

These are preserved **verbatim**. Ranges, anchors, and references are
**not** auto-extended when `@repeat` expands rows: the engine carries
the template's encoding through to the output unchanged. Authors who
need a rule (e.g., conditional formatting) to cover repeat-expanded
rows SHOULD anchor it with whole-column references in the template
(e.g., `$A:$A`) rather than relying on engine-side extension.

Charts are **implementation-defined** in XTL 0.1 (per ADR-0036 item 3
and ADR-0006); a port may preserve, lose, or partially preserve chart
objects. A future ADR will normatively pin chart behavior when Stage 2
conformance reaches charts.

Style preservation does not override value semantics. For example, a
string returned by `TEXT()` remains a string even if the template cell
has a date format.

## Errors

The following conditions are errors:

- Referencing a source column that does not exist (`xl3/source/unknown-column`).
- Referencing a source not declared in `__sources__` (`xl3/source/undeclared`).
- Referencing a list inside `__lists__` that does not exist
  (`xl3/lists/missing-reference`).
- Using an invalid directive.
- Using an invalid `source_table`.
- Using empty or duplicate source column names.
- Author-created sheets matching the reserved dunder pattern
  `^__[a-z]+__$` (per ADR-0011, `xl3/sheet/reserved-name`).
- Referencing the `__sources__` declaration sheet as a value
  dictionary (e.g., `__sources__[Customers]`,
  `xl3/sources/not-a-dictionary`); use the source name directly.
- Failing to coerce a single-expression cell value to its template
  cell format (`xl3/cell/numfmt-coercion`).
- Producing an invalid output filename after sanitization rules are
  applied (`xl3/filename/empty`, `xl3/filename/too-long`).
- Calling `ROW()` outside a repeat block (`xl3/cell/row-outside-repeat`).
- Source formula cells without cached results (`xl3/cell/formula-no-cache`).
- Missing required `__inputs__` (`xl3/inputs/missing-required`),
  invalid input value, or `select` value not in `options`
  (see ADR-0010 for the full input error catalog).
- XLOOKUP with no match and no fallback (`xl3/xlookup/no-match`),
  bare-bracket arg (`xl3/xlookup/bare-bracket`), or source-mismatched
  arrays (`xl3/xlookup/source-mismatch`).
- `@join` referencing an undeclared source
  (`xl3/join/undeclared-source`) or a malformed `on` clause
  (`xl3/join/bad-on-clause`).
- Row-level reference to a non-active source's column
  (`xl3/source/row-cross-block`).
- Unsupported expression syntax — unary `+`/`--`, or unary `-` on a
  non-literal (column reference, reserved-sheet reference, or
  sub-expression) (`xl3/eval/unsupported-syntax`, per ADR-0028).
- Invalid directive syntax — duplicate `@source` or `@join` in the
  same data block, or an empty directive body
  (`xl3/directive/invalid-syntax`, per ADR-0029); `@top` or
  `@repeat right` whose integer is not ≥ 1 (per ADR-0055).
- Template block with an unbalanced string literal — usually a
  `}}` embedded inside `"..."` (`xl3/parser/unbalanced-literal`,
  per ADR-0051).
- Bare identifier in a data cell that does not resolve to a
  boolean literal (`xl3/expression/unknown-name`, per ADR-0054).
- `__lists__[name]` reference used outside `@filter ... in` /
  `@filter ... !in` positions (`xl3/lists/invalid-use`, per
  ADR-0057).
- Aggregate function (`SUM`, `AVERAGE`, `MIN`, `MAX`, 1-arg
  `COUNT`) whose argument is not a `[Column]` or `Source[Column]`
  reference (`xl3/eval/bad-aggregate-arg`, per ADR-0059).

Per ADR-0015, every spec-defined error carries a stable `error.code`
of the form `xl3/<category>/<id>`. Hosts use the code for
localization and programmatic dispatch; the English `Error.message`
remains the conformance contract.

Implementations MAY provide warnings for non-fatal portability issues, but warnings MUST NOT change output semantics.

## Resource limits

### Spec-level stance

Resource limits — maximum input template size, maximum source row
count, maximum output workbook size, maximum iteration count for
`@repeat`, maximum recursion depth — are **implementation-defined**.
The XTL 0.1 spec does not mandate specific bounds. Implementations
SHOULD document their limits and SHOULD raise a stable
`xl3/limits/...` error code when a limit is hit, but the codes
themselves are not part of the spec contract because hosts vary
widely in deployment shape (browser, CLI, server) and threat model.

Hosts that accept untrusted templates (e.g., a SaaS that accepts
user-uploaded `.xlsx`) MUST enforce their own limits at a layer
above the engine — sandboxing, request size caps, timeouts — and
SHOULD NOT rely on the engine to detect malicious inputs.

### Implementation limits — reference impl (xl3-js)

The reference impl publishes the following soft caps (ROADMAP gate
G21). These are *correctness boundaries*, not security boundaries —
hosts that accept untrusted input MUST add their own enforcement
layer per [`SECURITY.md`](../SECURITY.md). The values below are
draft for 0.6.0 and tightened as the bench corpus (G8) lands.

| Dimension | Soft cap (draft) | Behavior at limit |
|---|---|---|
| Source rows per block | 1,000,000 | implementation-defined; ExcelJS in-memory model is the bottleneck |
| Total cells per output sheet | Excel's 17,179,869,184 (the 1,048,576 × 16,384 hard ceiling) | xl3 does not synthesize cells past Excel's sheet ceiling; an output that would exceed it raises an error |
| `@repeat` iteration count | bounded by source row count | no separate iteration cap; the source itself is the throttle |
| `__sources__` count | implementation-defined; no spec limit | declared upper bound surfaced via warnings only |
| File-group output count | implementation-defined | reference impl emits one file per group; host SHOULD cap externally |

### Streaming policy

The reference impl loads templates and data fully into memory in
1.x. **Streaming I/O is explicitly deferred to 1.1+**: it requires
canonicalization, watermarking, and a back-pressure API that would
change the public surface. Hosts that need conversion at scale
SHOULD shard at the *source* boundary (split a 10M-row table into
10 × 1M-row converts) rather than wait for streaming.

### AbortSignal

`convert()`, `preview()`, `convertJson()`, and `previewJson()` accept an
optional `AbortSignal` as `options.signal`. When the signal has aborted,
the in-flight conversion raises the stable error code
`xl3/abort/cancelled`; no partial output is emitted. Hosts that race
conversions against a wall-clock budget use this hook to enforce
timeouts deterministically.

A conversion is CPU-bound and single-threaded, so the signal is observed
at the pipeline's existing suspension points — on entry, after the
template parses, after sources are read, and between file groups — and
not mid-row. An abort therefore cancels at a group boundary rather than
part-way through a sheet. Implementations MUST NOT emit a partially
rendered file group.

Reference impl: the file-group loop accumulates into a local array and
returns only after the loop completes, so a caller that observes the
rejection provably received nothing. Implementations SHOULD get the
same guarantee structurally rather than by cleanup after the fact.

This API is **forward-compatible** — adding the optional argument
to `ConvertOptions` does not affect existing callers; the error
code is append-only per ADR-0015.
