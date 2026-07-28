import type ExcelJS from 'exceljs';

export interface TemplateMeta {
  name: string;
  description: string;
  source_sheet: string;
  source_table?: string;
  output_file_pattern: string;
  match_pattern: string;
}

// ADR-0010: a runtime input declaration parsed from the `__inputs__`
// sheet. Hosts surface these to operators and pass collected values
// back through ConvertOptions.inputs.
export type InputType = 'text' | 'number' | 'date' | 'select';

export interface InputSpec {
  name: string;
  type: InputType;
  required: boolean;
  default?: string;
  label?: string;
  description?: string;
  options?: string[]; // populated when type === 'select'
}

export interface ConvertOptions {
  /** Host-provided values for inputs declared in the template's `__inputs__` sheet. */
  inputs?: Record<string, unknown>;
  /**
   * Which render engine to use.
   * - `'auto'` (default) — try `xl3-wasm` if it's installed and
   *   instantiable; otherwise fall back to the ExcelJS path. Falls
   *   through to ExcelJS on any wasm-side error too.
   * - `'wasm'` — require `xl3-wasm`; throw if it's not available or
   *   the call errors. Useful in tests that need to assert the wasm
   *   path is the one being exercised.
   * - `'js'` — force the original ExcelJS path. Useful as a kill
   *   switch when a wasm regression is suspected.
   *
   * @stable Frozen at 1.0 — `auto` is the default and SHOULD remain
   *   so for forward compatibility.
   */
  engine?: 'auto' | 'wasm' | 'js';
  /**
   * Host-supplied cancellation signal. When it aborts, the in-flight
   * conversion raises `xl3/abort/cancelled` and emits no partial output.
   *
   * A conversion is CPU-bound and single-threaded, so the signal is
   * observed at the pipeline's await boundaries — after the template
   * parses, after sources are read, and between file groups — not
   * mid-row. Hosts racing against a wall-clock budget get deterministic
   * cancellation at those points rather than a torn result.
   *
   * @stable Frozen at 1.0 per `spec/STABILITY.md`. Additive: existing
   *   callers that omit it are unaffected.
   */
  signal?: AbortSignal;
}

// ADR-0012: an external data source declaration parsed from
// `__sources__`. The implicit default source uses the special name
// "default" and is configured via `__config__.source_sheet` and
// `source_table`; it is not represented here.
export interface SourceSpec {
  name: string;
  sheet: string;
  table: string;
  description?: string;
}

// ADR-0075: the `xl3-source-json/0.1` wire format — a language-neutral
// JSON source input consumed by `convertJson` / `previewJson`. The
// *format* is normative (portable across implementations); the internal
// `SourceData` the reader produces is not (see PORTERS_GUIDE.md).
export type Xl3SourceJsonValue =
  | null
  | string
  | number
  | boolean
  | { type: 'date'; value: string }
  | { type: 'error'; value: string };

export interface Xl3SourceJsonSource {
  headers: string[];
  rows: Xl3SourceJsonValue[][];
}

export interface Xl3SourceJson {
  version: string;
  sources: Record<string, Xl3SourceJsonSource>;
}

/** Accepted input shapes for `convertJson` / `previewJson` (ADR-0075). */
export type Xl3SourceJsonInput = string | ArrayBuffer | Uint8Array | object;

/**
 * A parsed template-expression reference inside a single cell.
 * Returned indirectly via {@link analyze} (`ParsedTemplate.variables`).
 *
 * The concrete shape is TypeScript-impl-specific; porters should NOT
 * copy this structure (see PORTERS_GUIDE.md "What you MUST NOT copy
 * from the TS impl"). Tooling that inspects templates can rely on it,
 * but it's not normatively part of the XTL spec.
 */
export interface TemplateVariable {
  expression: string;
  columns: string[];
  location: string;
}

// --- Directive types ---
//
// ADR-0048 / ROADMAP gate G22 (API surface): the Directive union and
// its variants are part of the **experimental** internal model that
// `analyze()` returns. They MAY change shape between minor versions
// even though `convert()` / `preview()` / `analyzeModel()` remain
// stable. Hosts that hold a directive object should treat it as
// opaque (read `kind` for dispatch; do not store shape-dependent
// references). Tooling that depends on the field set should pin a
// specific xl3 version.
//
// The stable serializable counterpart is `TemplateModel` (returned by
// `analyzeModel()`), which intentionally exposes the same fields but
// behind a slower-moving compatibility commitment in STABILITY.md.

/** @experimental — see G22 note above. */
export type FilterOp = '>' | '<' | '>=' | '<=' | '=' | '!=' | 'in' | '!in';

/** @experimental */
export interface FilterDirective {
  kind: 'filter';
  field: string;
  op: FilterOp;
  value: string | number;
  listRef?: string;
}

/** @experimental */
export interface SortDirective {
  kind: 'sort';
  field: string;
  order: 'asc' | 'desc';
}

/** @experimental */
export interface TopDirective {
  kind: 'top';
  count: number;
}

/** @experimental */
export interface RepeatDirective {
  kind: 'repeat';
  direction: 'right';
  colSpan: number;
}

// ADR-0012: scopes the surrounding data block to a named source.
/** @experimental */
export interface SourceDirective {
  kind: 'source';
  name: string;
}

// ADR-0014: pair the primary source's row with one row of the joined
// source whose `joinedKey` column equals the primary's `primaryKey`.
/** @experimental */
export interface JoinDirective {
  kind: 'join';
  joinedSource: string;
  joinedKey: string;
  primarySource: string;
  primaryKey: string;
}

// ADR-0038: partition the active row set into N-level nested groups
// for interleaved @subtotal emission. Group identity uses ADR-0009's
// canonical string equality; group order is encounter order after
// @filter / @sort.
/** @experimental */
export interface GroupDirective {
  kind: 'group';
  keys: string[]; // column references, outermost first
}

// ADR-0067: explicit data-block declaration. Three grammar forms:
//   bare       — `@block` (col-range from {{...}} markers below)
//   col-range  — `@block A:D` (start row auto, col-range explicit)
//   full-rect  — `@block A2:D7` (start/end row + col-range explicit)
//
// `colStart` / `colEnd` are 1-based column numbers (1 = A); `rowStart`
// / `rowEnd` are 1-based row numbers and 0 means "auto-detect from
// marker cells below the directive". For the col-range form,
// rowStart/rowEnd are both 0; for full-rect form, both are set.
/** @experimental */
export interface BlockDirective {
  kind: 'block';
  colStart: number; // 0 = auto-detect from markers
  colEnd: number;   // 0 = auto-detect from markers
  rowStart: number; // 0 = auto-detect (first marker row below)
  rowEnd: number;   // 0 = auto-detect (gap row or next @block)
}

/** @experimental */
export type Directive =
  | FilterDirective
  | SortDirective
  | TopDirective
  | RepeatDirective
  | SourceDirective
  | JoinDirective
  | GroupDirective
  | BlockDirective;

// --- Template types ---

/** @experimental — block layout / range shape may change between minor versions. */
export interface DataBlock {
  direction: 'down' | 'right';
  startRow: number;
  endRow: number;
  templateColStart: number;
  templateColEnd: number;
  directives: Directive[];
  directiveRows: number[];
  // ADR-0012: source name this block iterates over. Defaults to
  // "default" (the implicit `__config__.source_sheet`-driven source).
  source: string;
  // ADR-0014: optional single join — pairs each primary row with one
  // matching joined row.
  join?: JoinDirective;
  // ADR-0038: row offsets (relative to startRow) of @subtotal rows
  // inside the block, in source-template order. The level binding is
  // inferred from order: index 0 → innermost group, increasing
  // outward. Emitted at each group boundary at the bound level.
  subtotalRowOffsets?: number[];
}

/**
 * A single sheet within a parsed template — its directives, group
 * keys, and data blocks. Returned indirectly via {@link analyze}
 * (`ParsedTemplate.sheetTemplates`).
 *
 * TypeScript-impl-specific shape. Porters should NOT copy this
 * structure into their own internal model (see PORTERS_GUIDE.md "What
 * you MUST NOT copy from the TS impl"); use it only to inspect the TS
 * impl's parsed output.
 */
/** @experimental — internal sheet template structure. */
export interface SheetTemplate {
  originalName: string;
  groupKeys: string[];
  dataStartRow: number;
  dataEndRow: number;
  directives: Directive[];
  directiveRows: number[];
  blocks: DataBlock[];
}

export interface TemplateModel {
  meta: TemplateMeta;
  variables: TemplateVariable[];
  fileGroupKeys: string[];
  sheetTemplates: SheetTemplate[];
  listSheets: Record<string, string[]>;
  configVars: Record<string, string>;
  inputs: InputSpec[];
  // ADR-0011: host-supplied input values resolved against `inputs`.
  // Populated by the convert/preview entry points; absent before
  // resolution.
  resolvedInputs?: Record<string, string>;
  // ADR-0012: external data source declarations from `__sources__`.
  sources: SourceSpec[];
  warnings: XtlWarning[];
}

// Stable warning shape (1.0). Hosts dispatch on `code` for
// programmatic handling and localization; the English `message` is
// the conformance-corpus contract for `expected_warnings` matching.
// `location` is a free-form string ("sheet \"Report\" cell A5",
// "__inputs__ row 3", filename) — present when known, omitted when
// the warning is global.
/** @stable */
export type XtlWarningCode =
  | 'xl3w/parser/missing-column'
  | 'xl3w/filename/sanitized';

export interface XtlWarning {
  code: XtlWarningCode;
  message: string;
  location?: string;
}

/**
 * The full template parse output, including the live ExcelJS workbook.
 *
 * @experimental — the `workbook` field leaks the underlying library;
 * any non-trivial use of this type couples host code to ExcelJS. Hosts
 * SHOULD prefer `TemplateModel` (returned by {@link analyzeModel}) for
 * a serializable workbook-free view. `ParsedTemplate.workbook` is
 * subject to library upgrades and may change shape across xl3 minor
 * versions.
 */
export interface ParsedTemplate extends TemplateModel {
  workbook: ExcelJS.Workbook;
}

export type Row = Record<string, unknown>;

export interface GroupKey {
  values: Record<string, string>;
}

export interface SheetGroup {
  key: GroupKey;
  rows: Row[];
}

export interface FileGroup {
  key: GroupKey;
  sheetGroups: SheetGroup[];
}

export interface OutputFile {
  filename: string;
  data: ArrayBuffer;
  warnings: XtlWarning[];
}

export interface PreviewSheet {
  name: string;
  rowCount: number;
}

export interface PreviewFile {
  filename: string;
  sheets: PreviewSheet[];
}

// ADR-0012 (preview surfacing): a snapshot of one source's shape for
// the host UI to display.
export interface PreviewSource {
  name: string;
  sheet: string;
  table: string;
  description?: string;
  rowCount: number;
  headers: string[];
}

export interface PreviewResult {
  files: PreviewFile[];
  inputs: InputSpec[];
  sources: PreviewSource[];
  warnings: XtlWarning[];
}
