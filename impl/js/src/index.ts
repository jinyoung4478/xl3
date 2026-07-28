import JSZip from 'jszip';
import { parseTemplate, populateColumnRefs } from './parser.js';
import { readAllSources, columnSet } from './reader.js';
import type { SourceData } from './reader.js';
import { readJsonSources } from './json-source.js';
import { groupRows } from './grouper.js';
import { Renderer } from './renderer.js';
import { applyDirectives } from './data-transform.js';
import { toTemplateModel } from './template-model.js';
import { resolveInputs } from './inputs.js';
import type {
  OutputFile,
  PreviewResult,
  ParsedTemplate,
  TemplateModel,
  ConvertOptions,
  InputSpec,
  XtlWarning,
  Xl3SourceJsonInput,
} from './types.js';

export type {
  TemplateMeta,
  TemplateModel,
  ParsedTemplate,
  OutputFile,
  PreviewResult,
  PreviewSource,
  PreviewFile,
  PreviewSheet,
  SheetTemplate,
  TemplateVariable,
  DataBlock,
  Directive,
  FilterDirective,
  FilterOp,
  SortDirective,
  TopDirective,
  RepeatDirective,
  SourceDirective,
  JoinDirective,
  ConvertOptions,
  InputSpec,
  InputType,
  SourceSpec,
  XtlWarning,
  XtlWarningCode,
  Xl3SourceJsonValue,
  Xl3SourceJsonSource,
  Xl3SourceJson,
  Xl3SourceJsonInput,
} from './types.js';
export { readConfigSheet, writeConfigSheet, readInputsSheet } from './parser.js';
export type { ConfigResult } from './parser.js';
export { batchMatch } from './matcher.js';
export type { MatchResult } from './matcher.js';
export { toTemplateModel } from './template-model.js';
export { xtlError, isXtlError } from './error-codes.js';
export type { XtlError, XtlErrorCode } from './error-codes.js';
import { xtlError } from './error-codes.js';
import { throwIfAborted } from './abort.js';
import {
  tryLoadWasmEngine,
  wasmConvert,
  wasmPreview,
  wasmReadTemplateInputs,
} from './wasm-bridge.js';
import { extractManifest } from './manifest.js';

interface PreparedConversion {
  parsed: ParsedTemplate;
  source: SourceData;
  sources: Record<string, SourceData>;
  columns: Set<string>;
  grouped: ReturnType<typeof groupRows>;
  renderer: Renderer;
  // ADR-0075: how the sources were ingested, so preview can surface
  // JSON sources without .xlsx-only sheet/table coordinates.
  sourceKind: 'xlsx' | 'json';
}

function prepareConversionFromSources(
  parsed: ParsedTemplate,
  sources: Record<string, SourceData>,
  sourceKind: 'xlsx' | 'json' = 'xlsx',
): PreparedConversion {
  const defaultSource = sources['default']!;
  const columns = columnSet(defaultSource.headers);
  populateColumnRefs(parsed);

  const grouped = groupRows(defaultSource.rows, parsed.fileGroupKeys, parsed.sheetTemplates);
  const renderer = new Renderer(parsed, columns, sources);

  return { parsed, source: defaultSource, sources, columns, grouped, renderer, sourceKind };
}

/** Shared first stage: parse template + read source + resolve columns + group. */
async function prepareConversion(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
) {
  // G21: an already-aborted signal fails before any parsing work.
  throwIfAborted(options?.signal);
  const parsed = await parseTemplate(templateBuffer);
  throwIfAborted(options?.signal);
  applyResolvedInputs(parsed, options);
  // ADR-0012: read default + all named sources upfront.
  const sources = await readAllSources(
    sourceBuffer,
    parsed.meta.source_sheet,
    { sourceTable: parsed.meta.source_table },
    parsed.sources,
  );
  throwIfAborted(options?.signal);

  return prepareConversionFromSources(parsed, sources);
}

// ADR-0010 / ADR-0011: resolve runtime inputs and stash them on the
// parsed template. The renderer exposes them under the `__inputs__`
// namespace in ctx so cells reference them via `{{ __inputs__[name] }}`.
function applyResolvedInputs(parsed: ParsedTemplate, options?: ConvertOptions): void {
  if (parsed.inputs.length === 0 && !options?.inputs) {
    parsed.resolvedInputs = {};
    return;
  }
  parsed.resolvedInputs = resolveInputs(parsed.inputs, options?.inputs);
}

async function renderPreparedConversion(
  prepared: PreparedConversion,
  signal?: AbortSignal,
): Promise<OutputFile[]> {
  const files: OutputFile[] = [];
  // ADR-0031: detect filename collisions across file groups before
  // rendering any of them. Two distinct group keys that sanitize to
  // the same filename would otherwise silently overwrite each other
  // in host code (host writes the array to disk or zip, second file
  // clobbers first). Preview-fail-fast catches this at convert-time.
  const seenFilenames = new Set<string>();
  for (const fg of prepared.grouped.fileGroups) {
    const filename = prepared.renderer.previewFilename(fg);
    if (seenFilenames.has(filename)) {
      throw xtlError(
        'xl3/filename/collision',
        `Output filename "${filename}" is produced by multiple file groups (their group key values collapse to the same sanitized filename). Make group keys distinct upstream — different cell values that share only forbidden characters (e.g., "Seoul/Korea" and "Seoul:Korea") both sanitize to "Seoul_Korea".`,
      );
    }
    seenFilenames.add(filename);
  }
  for (const fg of prepared.grouped.fileGroups) {
    // G21: cancel between file groups. `files` is local and only
    // returned below, so an abort here emits nothing — the spec's
    // "no partial output" guarantee is structural, not best-effort.
    throwIfAborted(signal);
    const outFile = await prepared.renderer.renderFile(fg);
    files.push(outFile);
  }

  return files;
}

function buildPreviewWarnings(parsed: TemplateModel, columns: Set<string>): XtlWarning[] {
  const warnings: XtlWarning[] = [...parsed.warnings];
  for (const v of parsed.variables) {
    for (const col of v.columns) {
      if (!columns.has(col)) {
        warnings.push({
          code: 'xl3w/parser/missing-column',
          message: `Source column "${col}" is missing`,
          location: v.location,
        });
      }
    }
  }
  return warnings;
}

function buildPreviewFromPrepared(prepared: PreparedConversion): PreviewResult {
  const { parsed, sources, columns, grouped, renderer, sourceKind } = prepared;
  const warnings = buildPreviewWarnings(parsed, columns);
  const inputs = parsed.inputs;

  // ADR-0012/0014 surface: every source the engine has loaded — the
  // implicit `default` plus any declared in `__sources__` — with its
  // row count and headers. Hosts use this to show operators what data
  // is available.
  const previewSources = Object.entries(sources).map(([name, data]) => {
    // ADR-0075: JSON sources have no .xlsx sheet/table coordinates;
    // surface sentinels so hosts still see the name, rows, and headers.
    if (sourceKind === 'json') {
      if (name === 'default') {
        return {
          name,
          sheet: name,
          table: '(json-source)',
          rowCount: data.rows.length,
          headers: data.headers,
        };
      }
      const spec = parsed.sources.find((s) => s.name === name);
      return {
        name,
        sheet: name,
        table: '(json-source)',
        description: spec?.description,
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }
    if (name === 'default') {
      return {
        name,
        sheet: parsed.meta.source_sheet || data.sheetName,
        table: parsed.meta.source_table ?? '1',
        rowCount: data.rows.length,
        headers: data.headers,
      };
    }
    const spec = parsed.sources.find((s) => s.name === name);
    return {
      name,
      sheet: spec?.sheet ?? data.sheetName,
      table: spec?.table ?? '1',
      description: spec?.description,
      rowCount: data.rows.length,
      headers: data.headers,
    };
  });

  const files = grouped.fileGroups.map((fg) => {
    const sheets: { name: string; rowCount: number }[] = [];

    for (const st of parsed.sheetTemplates) {
      if (st.groupKeys.length === 0) {
        const sg = fg.sheetGroups.find((g) => Object.keys(g.key.values).length === 0);
        if (!sg) continue;
        const dataDirectives = st.directives.filter((d) => d.kind !== 'repeat');
        const filteredRows = dataDirectives.length
          ? applyDirectives(sg.rows, dataDirectives, parsed.listSheets)
          : sg.rows;
        sheets.push({ name: st.originalName, rowCount: filteredRows.length });
      } else {
        const matchingGroups = fg.sheetGroups.filter((g) => {
          if (Object.keys(g.key.values).length === 0) return false;
          return st.groupKeys.every((k) => k in g.key.values);
        });
        for (const sg of matchingGroups) {
          const sheetName = renderer.previewSheetName([st], sg.key);
          const dataDirectives = st.directives.filter((d) => d.kind !== 'repeat');
          const filteredRows = dataDirectives.length
            ? applyDirectives(sg.rows, dataDirectives, parsed.listSheets)
            : sg.rows;
          sheets.push({ name: sheetName, rowCount: filteredRows.length });
        }
      }
    }

    warnings.push(...renderer.previewFilenameWarnings(fg));
    return { filename: renderer.previewFilename(fg), sheets };
  });

  return { files, inputs, sources: previewSources, warnings };
}

/**
 * Run full conversion: template + source → output files.
 *
 * Reads the XTL template workbook, applies its directives over the
 * source workbook, and returns one OutputFile per emitted file group.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 *   Signature changes are 2.0-only.
 *
 * @example
 * ```ts
 * const outputs = await convert(templateBuffer, sourceBuffer, {
 *   inputs: { month: '2026-05' },
 * });
 * ```
 *
 * @example
 * ```ts
 * // Enforce a wall-clock budget. On abort the call rejects with
 * // `xl3/abort/cancelled` and emits no partial output.
 * const ctrl = new AbortController();
 * const timer = setTimeout(() => ctrl.abort(), 30_000);
 * try {
 *   const outputs = await convert(templateBuffer, sourceBuffer, {
 *     signal: ctrl.signal,
 *   });
 * } finally {
 *   clearTimeout(timer);
 * }
 * ```
 */
export async function convert(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<OutputFile[]> {
  // Phase 2 Task 2.4 — wasm acceleration path. Engine selection:
  //   'auto' (default): try wasm, fall back to JS on any error
  //   'wasm': require wasm
  //   'js': force JS path
  const engineMode = options?.engine ?? 'auto';
  // G21: the wasm render is a single uninterruptible call, so the signal
  // is honoured on either side of it rather than during.
  throwIfAborted(options?.signal);
  if (engineMode !== 'js') {
    const engine = await tryLoadWasmEngine();
    if (engine) {
      try {
        // Phase 2 Task 2.2 — extract the style manifest *here* (the
        // JS shell already owns exceljs) and hand it to the wasm
        // renderer. parseTemplate is cheap; for the convert hot path
        // we accept paying it twice (once here, once inside the JS
        // fallback) rather than reorganising the call sites.
        const parsed = await parseTemplate(templateBuffer);
        const manifest = extractManifest(parsed.workbook);
        // wasmConvert is synchronous, so a throw from it still lands in
        // the catch below and 'auto' still falls back to the JS path.
        const out = wasmConvert(
          engine,
          templateBuffer,
          sourceBuffer,
          options?.inputs,
          manifest,
        );
        throwIfAborted(options?.signal);
        return out;
      } catch (e) {
        if (engineMode === 'wasm') throw e;
        // 'auto' — silently fall through to the JS path. The wasm
        // engine throws on features outside its support matrix
        // (manifest preservation, exotic OOXML constructs).
      }
    } else if (engineMode === 'wasm') {
      throw new Error(
        'engine: "wasm" requested but the optional `xl3-wasm` dependency could not be loaded',
      );
    }
  }
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return renderPreparedConversion(prepared, options?.signal);
}

/**
 * Preview what conversion will produce without generating full files.
 *
 * Returns the planned filenames, sheet names, row counts, declared
 * inputs, and warnings the host should surface to the operator.
 * Cheaper than `convert()` because it does not serialize output
 * workbooks.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const result = await preview(templateBuffer, sourceBuffer, {
 *   inputs: { month: '2026-05' },
 * });
 * console.log(result.files, result.warnings);
 * ```
 */
export async function preview(
  templateBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  options?: ConvertOptions,
): Promise<PreviewResult> {
  // preview() only deviates from the JS path when the caller pins
  // engine: 'wasm'. The JS path produces the canonical warnings the
  // type contract promises (`xl3w/parser/missing-column` etc.) which
  // the wasm bridge cannot reconstruct from its abbreviated surface.
  throwIfAborted(options?.signal);
  if (options?.engine === 'wasm') {
    const engine = await tryLoadWasmEngine();
    if (!engine) {
      throw new Error(
        'engine: "wasm" requested but the optional `xl3-wasm` dependency could not be loaded',
      );
    }
    const partial = wasmPreview(engine, templateBuffer, sourceBuffer);
    const inputs = wasmReadTemplateInputs(engine, templateBuffer);
    throwIfAborted(options?.signal);
    return { ...partial, inputs, warnings: [] };
  }
  const prepared = await prepareConversion(templateBuffer, sourceBuffer, options);
  return buildPreviewFromPrepared(prepared);
}

// ADR-0075: JSON source path. Everything below the source-read seam is
// shared with the .xlsx path — only ingestion differs — so `convertJson`
// renders byte-identical output to `convert` with the equivalent
// `data.xlsx`.
async function prepareConversionFromJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ConvertOptions,
): Promise<PreparedConversion> {
  throwIfAborted(options?.signal);
  const parsed = await parseTemplate(templateBuffer);
  throwIfAborted(options?.signal);
  applyResolvedInputs(parsed, options);
  const sources = readJsonSources(sourceJson, parsed.sources);
  throwIfAborted(options?.signal);
  return prepareConversionFromSources(parsed, sources, 'json');
}

function assertNoWasmForJson(options?: ConvertOptions): void {
  if (options?.engine === 'wasm') {
    throw new Error(
      'engine: "wasm" is not supported for JSON source input (xl3-source-json/0.1 runs the JS engine only)',
    );
  }
}

/**
 * Run full conversion from a JSON source (ADR-0075) instead of a
 * `data.xlsx`. Accepts the `xl3-source-json/0.1` wire format as a JSON
 * string, raw bytes (`ArrayBuffer`/`Uint8Array`), or an already-parsed
 * object. Renders the same workbook `convert()` produces from the
 * equivalent `data.xlsx`.
 *
 * @stable Added in XTL 1.x (ADR-0075); additive to the frozen `convert`.
 *
 * @example
 * ```ts
 * const outputs = await convertJson(templateBuffer, {
 *   version: 'xl3-source-json/0.1',
 *   sources: {
 *     default: { headers: ['Customer', 'Amount'], rows: [['Acme', 100]] },
 *   },
 * });
 * ```
 */
export async function convertJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ConvertOptions,
): Promise<OutputFile[]> {
  assertNoWasmForJson(options);
  const prepared = await prepareConversionFromJson(templateBuffer, sourceJson, options);
  return renderPreparedConversion(prepared, options?.signal);
}

/**
 * Preview what `convertJson` will produce without generating full files
 * (ADR-0075). JSON sources surface with sentinel coordinates
 * (`sheet` = source name, `table` = `"(json-source)"`) since they have
 * no workbook location.
 *
 * @stable Added in XTL 1.x (ADR-0075); additive to the frozen `preview`.
 *
 * @example
 * ```ts
 * const result = await previewJson(templateBuffer, {
 *   version: 'xl3-source-json/0.1',
 *   sources: {
 *     default: { headers: ['Customer', 'Amount'], rows: [['Acme', 100]] },
 *   },
 * });
 * console.log(result.files, result.warnings);
 * ```
 */
export async function previewJson(
  templateBuffer: ArrayBuffer,
  sourceJson: Xl3SourceJsonInput,
  options?: ConvertOptions,
): Promise<PreviewResult> {
  assertNoWasmForJson(options);
  const prepared = await prepareConversionFromJson(templateBuffer, sourceJson, options);
  return buildPreviewFromPrepared(prepared);
}

/**
 * Inspect a template's runtime input declarations without running a
 * conversion. Hosts use this to render an input form before the host
 * has a source workbook to convert.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const inputs = await readTemplateInputs(templateBuffer);
 * for (const input of inputs) {
 *   console.log(input.name, input.type, input.required);
 * }
 * ```
 */
export async function readTemplateInputs(
  templateBuffer: ArrayBuffer,
  options?: { engine?: 'auto' | 'wasm' | 'js' },
): Promise<InputSpec[]> {
  const engineMode = options?.engine ?? 'auto';
  if (engineMode !== 'js') {
    const engine = await tryLoadWasmEngine();
    if (engine) {
      try {
        return wasmReadTemplateInputs(engine, templateBuffer);
      } catch (e) {
        if (engineMode === 'wasm') throw e;
        // auto: fall through
      }
    } else if (engineMode === 'wasm') {
      throw new Error(
        'engine: "wasm" requested but the optional `xl3-wasm` dependency could not be loaded',
      );
    }
  }
  const parsed = await parseTemplate(templateBuffer);
  return parsed.inputs;
}

/**
 * Analyze a template file and return its full parsed model
 * (including the underlying ExcelJS workbook). Useful for tooling
 * that needs to inspect template internals.
 *
 * @stable The entry point itself is frozen at 1.0 (per
 *   `spec/STABILITY.md` "Public API surface"). The **return type**
 *   `ParsedTemplate` is `@experimental`: it exposes internal model
 *   shapes (`Directive`, `DataBlock`, `SheetTemplate`) and the live
 *   `ExcelJS.Workbook`, which MAY change between minor versions.
 *   For a stable serializable view, prefer
 *   {@link analyzeModel} (which returns `TemplateModel`).
 *
 * @example
 * ```ts
 * const parsed = await analyze(templateBuffer);
 * console.log(parsed.meta.name, parsed.sheetTemplates.length);
 * ```
 */
export async function analyze(
  templateBuffer: ArrayBuffer,
): Promise<ParsedTemplate> {
  return parseTemplate(templateBuffer);
}

/**
 * Analyze a template file and return a serializable, workbook-free
 * template model. Suitable for cross-process / cross-language
 * inspection.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const model = await analyzeModel(templateBuffer);
 * const json = JSON.stringify(model, null, 2);
 * ```
 */
export async function analyzeModel(
  templateBuffer: ArrayBuffer,
): Promise<TemplateModel> {
  const parsed = await parseTemplate(templateBuffer);
  return toTemplateModel(parsed);
}

/**
 * Package multiple output files into a single ZIP Blob. Convenience
 * wrapper for hosts that want to download an entire batch in one
 * request.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * const outputs = await convert(templateBuffer, sourceBuffer);
 * const zip = await packageZip(outputs);
 * // hand `zip` to the browser as a download
 * ```
 */
export async function packageZip(files: OutputFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.filename, f.data);
  }
  return zip.generateAsync({ type: 'blob' });
}
