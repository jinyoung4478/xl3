// XTL conformance runner — Stage 1.
//
// Iterates fixtures under a directory, runs the reference impl on each,
// and compares output to expected via cell-value equality. This is *not*
// the canonical OOXML comparison runner-protocol.md ultimately requires
// (that's Stage 2, defined by ADR-0006). It is the minimum that
// makes the corpus actionable for both this impl and other-language
// ports targeting cell-equivalent conformance.

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { convert } from './index.js';
import { versionsEqual } from './version.js';

export type ComparisonStage = 1 | 2;

export interface DynamicCellAssertion {
  sheet: string;
  cell: string;
  format: string;
}

export interface FixtureInputAssignment {
  name: string;
  value: string;
}

export interface FixtureMeta {
  description: string;
  spec_section: string;
  spec_version: string;
  tags: string[];
  verified_by: string[];
  expected_warnings: string[];
  expected_error?: string;
  expected_error_code?: string;
  expected_dynamic?: string;
  dynamic_cells: DynamicCellAssertion[];
  comparison_stage: ComparisonStage;
  skip_reason?: string;
  inputs: FixtureInputAssignment[];
}

export type FixtureStatus = 'pass' | 'fail' | 'skip' | 'error';

export interface FixtureResult {
  fixture: string;
  status: FixtureStatus;
  duration_ms: number;
  comparison_stage?: ComparisonStage;
  diff?: string;
  error?: string;
  skip_reason?: string;
}

export interface ConformanceReport {
  implementation: string;
  version: string;
  spec_version: string;
  comparison_stage: ComparisonStage;
  results: FixtureResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
  };
}

export interface RunOptions {
  fixtureDir: string;
  /** Restrict to fixtures whose `tags` include this string. */
  filter?: string;
  /**
   * Restrict to fixtures whose declared `spec_version` matches this
   * value exactly (after MAJOR.MINOR.PATCH normalization, so "0.1"
   * matches "0.1.0"). Range matching (>=, ^) is deferred to post-1.0;
   * see `conformance/runner-protocol.md`.
   */
  specVersion?: string;
  /** Compare static output fixtures using Stage 1 cell values or Stage 2 OOXML. */
  comparisonStage?: ComparisonStage;
  /**
   * Which render engine to drive `convert()` with. Mirrors
   * `ConvertOptions.engine`:
   * - `'auto'` (default) — try wasm, fall back to JS
   * - `'wasm'` — require xl3-wasm; surfaces engine-availability
   *   failures as fixture errors. Used by Phase 3 Task 3.2 to
   *   prove the accelerated path is bit-equivalent on stage-1.
   * - `'js'` — force the original ExcelJS path.
   */
  engine?: 'auto' | 'wasm' | 'js';
}

export async function runConformance(opts: RunOptions): Promise<ConformanceReport> {
  const entries = await readdir(opts.fixtureDir, { withFileTypes: true });
  const fixtures = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const results: FixtureResult[] = [];
  const runnerStart = new Date();
  const comparisonStage = opts.comparisonStage ?? 1;
  for (const name of fixtures) {
    const dir = join(opts.fixtureDir, name);
    results.push(await runOne(name, dir, { ...opts, comparisonStage }, runnerStart));
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errored: results.filter((r) => r.status === 'error').length,
    skipped: results.filter((r) => r.status === 'skip').length,
  };

  return {
    implementation: 'xl3-js',
    version: pkgVersion(),
    spec_version: opts.specVersion ?? '0.1',
    comparison_stage: comparisonStage,
    results,
    summary,
  };
}

async function runOne(
  name: string,
  dir: string,
  opts: RunOptions & { comparisonStage: ComparisonStage },
  runnerStart: Date,
): Promise<FixtureResult> {
  const start = Date.now();
  let meta: FixtureMeta;
  try {
    meta = await loadMeta(dir);
  } catch (e) {
    return {
      fixture: name,
      status: 'error',
      duration_ms: Date.now() - start,
      error: `meta.yaml: ${(e as Error).message}`,
    };
  }

  if (meta.skip_reason) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: meta.skip_reason,
    };
  }

  if (opts.filter && !meta.tags.includes(opts.filter)) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: `filtered out by tag "${opts.filter}"`,
    };
  }

  if (opts.specVersion && !versionsEqual(meta.spec_version, opts.specVersion)) {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: `spec_version ${meta.spec_version} != requested ${opts.specVersion}`,
    };
  }

  try {
    const tmpl = await readFile(join(dir, 'template.xlsx'));
    const data = await readFile(join(dir, 'data.xlsx'));
    if (meta.expected_error && meta.expected_dynamic) {
      return {
        fixture: name,
        status: 'error',
        duration_ms: Date.now() - start,
        error: 'meta.yaml: expected_error and expected_dynamic are mutually exclusive',
      };
    }
    if (meta.expected_error) {
      return await runExpectedErrorFixture(
        name, start, tmpl, data,
        meta.expected_error,
        meta.expected_error_code,
        meta.inputs,
        opts.engine,
      );
    }
    if (meta.expected_dynamic) {
      return await runDynamicFixture(name, start, tmpl, data, meta, runnerStart, opts.engine);
    }
    if (meta.comparison_stage > opts.comparisonStage) {
      return {
        fixture: name,
        status: 'skip',
        duration_ms: Date.now() - start,
        skip_reason: `requires comparison_stage ${meta.comparison_stage}; runner is stage ${opts.comparisonStage}`,
      };
    }

    const expected = await loadExpected(dir);
    if (!expected) {
      return {
        fixture: name,
        status: 'error',
        duration_ms: Date.now() - start,
        error: 'no expected.xlsx or expected/ directory',
      };
    }

    const out = await convert(toArrayBuffer(tmpl), toArrayBuffer(data), {
      inputs: inputsAsRecord(meta.inputs),
      engine: opts.engine,
    });
    // Conformance corpus matches against the warning's English
    // `message` for portability; see XtlWarning shape in types.ts.
    const actualWarnings = out.flatMap((f) => (f.warnings ?? []).map((w) => w.message));
    const warningDiff = diffWarnings(actualWarnings, meta.expected_warnings);
    if (warningDiff) {
      return {
        fixture: name,
        status: 'fail',
        duration_ms: Date.now() - start,
        comparison_stage: meta.comparison_stage,
        diff: warningDiff,
      };
    }
    const diffs = await diffOutput(out, expected, meta.comparison_stage);

    if (diffs.length === 0) {
      return {
        fixture: name,
        status: 'pass',
        duration_ms: Date.now() - start,
        comparison_stage: meta.comparison_stage,
      };
    }
    return {
      fixture: name,
      status: 'fail',
      duration_ms: Date.now() - start,
      comparison_stage: meta.comparison_stage,
      diff: diffs.join('\n'),
    };
  } catch (e) {
    return {
      fixture: name,
      status: 'error',
      duration_ms: Date.now() - start,
      error: (e as Error).message,
    };
  }
}

function diffWarnings(actual: string[], expected: string[]): string | null {
  if (expected.length === 0 && actual.length === 0) return null;
  if (expected.length === 0 && actual.length > 0) {
    return `unexpected warnings: ${JSON.stringify(actual)}`;
  }
  if (expected.length > 0 && actual.length === 0) {
    return `expected warnings containing ${JSON.stringify(expected)}, got none`;
  }
  if (actual.length !== expected.length) {
    return `warning count differs: actual=${actual.length}, expected=${expected.length}; actual=${JSON.stringify(actual)}; expected=${JSON.stringify(expected)}`;
  }

  for (let i = 0; i < expected.length; i++) {
    if (!actual[i]!.includes(expected[i]!)) {
      return `warning ${i + 1} differs: actual=${JSON.stringify(actual[i])}, expected=${JSON.stringify(expected[i])}`;
    }
  }
  return null;
}

async function runDynamicFixture(
  name: string,
  start: number,
  tmpl: Buffer,
  data: Buffer,
  meta: FixtureMeta,
  runnerStart: Date,
  engine: 'auto' | 'wasm' | 'js' | undefined,
): Promise<FixtureResult> {
  if (meta.expected_dynamic !== 'utc_today') {
    return {
      fixture: name,
      status: 'skip',
      duration_ms: Date.now() - start,
      skip_reason: `unsupported expected_dynamic kind "${meta.expected_dynamic}"`,
    };
  }
  if (meta.dynamic_cells.length === 0) {
    return {
      fixture: name,
      status: 'error',
      duration_ms: Date.now() - start,
      error: 'meta.yaml: expected_dynamic requires at least one dynamic_cells entry',
    };
  }

  const expectedExample = formatUtcToday(runnerStart, meta.dynamic_cells[0]!.format);
  try {
    const out = await convert(toArrayBuffer(tmpl), toArrayBuffer(data), {
      inputs: inputsAsRecord(meta.inputs),
      engine,
    });
    if (out.length !== 1) {
      return {
        fixture: name,
        status: 'fail',
        duration_ms: Date.now() - start,
        diff: `expected single output file for dynamic fixture, got ${out.length}`,
      };
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out[0]!.data);
    const diffs: string[] = [];
    for (const assertion of meta.dynamic_cells) {
      const sheet = wb.getWorksheet(assertion.sheet);
      if (!sheet) {
        diffs.push(`missing sheet: ${assertion.sheet}`);
        continue;
      }
      const actual = comparable(sheet.getCell(assertion.cell).value);
      const cellExpected = comparable(formatUtcToday(runnerStart, assertion.format));
      if (actual !== cellExpected) {
        diffs.push(`${assertion.sheet}@${assertion.cell}: actual=${JSON.stringify(actual)}, expected=${JSON.stringify(cellExpected)}`);
      }
    }

    if (diffs.length === 0) {
      return { fixture: name, status: 'pass', duration_ms: Date.now() - start };
    }
    return {
      fixture: name,
      status: 'fail',
      duration_ms: Date.now() - start,
      diff: diffs.join('\n'),
    };
  } catch (e) {
    return {
      fixture: name,
      status: 'fail',
      duration_ms: Date.now() - start,
      diff: `expected dynamic output ${expectedExample}, got error ${(e as Error).message}`,
    };
  }
}

async function runExpectedErrorFixture(
  name: string,
  start: number,
  tmpl: Buffer,
  data: Buffer,
  expectedError: string,
  expectedCode: string | undefined,
  inputs: FixtureInputAssignment[],
  engine: 'auto' | 'wasm' | 'js' | undefined,
): Promise<FixtureResult> {
  try {
    await convert(toArrayBuffer(tmpl), toArrayBuffer(data), {
      inputs: inputsAsRecord(inputs),
      engine,
    });
    return {
      fixture: name,
      status: 'fail',
      duration_ms: Date.now() - start,
      diff: `expected error containing ${JSON.stringify(expectedError)}, but conversion succeeded`,
    };
  } catch (e) {
    const actual = (e as Error).message;
    const actualCode = (e as { code?: string }).code;
    if (!actual.includes(expectedError)) {
      return {
        fixture: name,
        status: 'fail',
        duration_ms: Date.now() - start,
        diff: `expected error containing ${JSON.stringify(expectedError)}, got ${JSON.stringify(actual)}`,
      };
    }
    // ADR-0015: when expected_error_code is declared, the thrown error
    // MUST carry a matching `.code`.
    if (expectedCode && actualCode !== expectedCode) {
      return {
        fixture: name,
        status: 'fail',
        duration_ms: Date.now() - start,
        diff: `expected error code ${JSON.stringify(expectedCode)}, got ${JSON.stringify(actualCode ?? '(none)')}`,
      };
    }
    return { fixture: name, status: 'pass', duration_ms: Date.now() - start };
  }
}

interface ExpectedFile {
  filename: string;
  buf: Buffer;
}

async function loadExpected(dir: string): Promise<ExpectedFile[] | null> {
  // Single-output: expected.xlsx
  try {
    const buf = await readFile(join(dir, 'expected.xlsx'));
    return [{ filename: 'expected.xlsx', buf }];
  } catch { /* fallthrough */ }

  // Multi-output: expected/ directory
  const expDir = join(dir, 'expected');
  let isDir = false;
  try {
    isDir = (await stat(expDir)).isDirectory();
  } catch { /* not present */ }
  if (!isDir) return null;

  const files = (await readdir(expDir))
    .filter((f) => f.endsWith('.xlsx'))
    .sort();
  return Promise.all(files.map(async (f) => ({
    filename: f,
    buf: await readFile(join(expDir, f)),
  })));
}

async function diffOutput(
  out: { filename: string; data: ArrayBuffer }[],
  expected: ExpectedFile[],
  comparisonStage: ComparisonStage,
): Promise<string[]> {
  const diffs: string[] = [];
  const isMultiFile = !(expected.length === 1 && expected[0]!.filename === 'expected.xlsx');

  if (isMultiFile) {
    const actualByName = new Map(out.map((f) => [f.filename, f.data] as const));
    const expectedByName = new Map(expected.map((f) => [f.filename, f.buf] as const));
    const allFilenames = new Set([
      ...actualByName.keys(),
      ...expectedByName.keys(),
    ]);
    for (const fn of allFilenames) {
      const a = actualByName.get(fn);
      const e = expectedByName.get(fn);
      if (!a) { diffs.push(`missing output file: ${fn}`); continue; }
      if (!e) { diffs.push(`unexpected output file: ${fn}`); continue; }
      if (comparisonStage === 2) {
        await diffCanonicalWorkbooks(a, toArrayBuffer(e), diffs, fn);
      } else {
        const aCells = await loadCells(a);
        const eCells = await loadCells(toArrayBuffer(e));
        diffCellMaps(aCells, eCells, diffs, fn);
      }
    }
  } else {
    if (out.length !== 1) {
      diffs.push(`expected single output file, got ${out.length}`);
      return diffs;
    }
    if (comparisonStage === 2) {
      await diffCanonicalWorkbooks(out[0]!.data, toArrayBuffer(expected[0]!.buf), diffs);
    } else {
      const aCells = await loadCells(out[0]!.data);
      const eCells = await loadCells(toArrayBuffer(expected[0]!.buf));
      diffCellMaps(aCells, eCells, diffs);
    }
  }

  return diffs;
}

async function diffCanonicalWorkbooks(
  actual: ArrayBuffer,
  expected: ArrayBuffer,
  diffs: string[],
  fnPrefix?: string,
) {
  const a = await canonicalizeXlsx(actual);
  const e = await canonicalizeXlsx(expected);
  const parts = new Set([...a.keys(), ...e.keys()]);
  for (const part of [...parts].sort()) {
    const av = a.get(part);
    const ev = e.get(part);
    const where = fnPrefix ? `[${fnPrefix}] ${part}` : part;
    if (av === undefined) { diffs.push(`missing package part: ${where}`); continue; }
    if (ev === undefined) { diffs.push(`unexpected package part: ${where}`); continue; }
    if (av !== ev) diffs.push(`${where}: canonical content differs (${diffSummary(part, av, ev)})`);
  }
}

export async function canonicalizeXlsx(buf: ArrayBuffer): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(buf);
  const out = new Map<string, string>();
  const names = Object.keys(zip.files)
    .filter((name) => !zip.files[name]!.dir)
    .sort();
  const sheetPartNames = await buildSheetPartNames(zip);

  for (const name of names) {
    const file = zip.files[name]!;
    const canonicalName = sheetPartNames.get(name) ?? name;
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      const xml = await file.async('string');
      out.set(canonicalName, canonicalizeXml(name, xml, sheetPartNames));
    } else {
      const data = await file.async('uint8array');
      out.set(canonicalName, Buffer.from(data).toString('base64'));
    }
  }
  return out;
}

async function buildSheetPartNames(zip: JSZip): Promise<Map<string, string>> {
  const workbook = zip.file('xl/workbook.xml');
  const rels = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return new Map();

  const workbookXml = await workbook.async('string');
  const relsXml = await rels.async('string');
  const relTargets = new Map<string, string>();
  for (const rel of tokenizeXml(relsXml)) {
    if (rel.kind !== 'start' || rel.name !== 'Relationship') continue;
    const attrs = xmlAttrsToMap(rel.attrs);
    const id = attrs.get('Id');
    const target = attrs.get('Target');
    if (!id || !target) continue;
    const normalizedTarget = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\.\//, '')}`;
    relTargets.set(id, normalizedTarget.replace(/\/\.\//g, '/'));
  }

  const out = new Map<string, string>();
  for (const sheet of tokenizeXml(workbookXml)) {
    if (sheet.kind !== 'start' || sheet.name !== 'sheet') continue;
    const attrs = xmlAttrsToMap(sheet.attrs);
    const sheetName = attrs.get('name');
    const relId = attrs.get('r:id');
    if (!sheetName || !relId) continue;
    const part = relTargets.get(relId);
    if (part) out.set(part, `xl/worksheets/by-name/${sanitizePartName(sheetName)}.xml`);
  }
  return out;
}

function xmlAttrsToMap(attrs: XmlAttr[]): Map<string, string> {
  return new Map(attrs.map((attr) => [attr.name, attr.value]));
}

function sanitizePartName(name: string): string {
  return encodeURIComponent(name).replace(/%/g, '_');
}

function canonicalizeXml(partName: string, xml: string, sheetPartNames: Map<string, string>): string {
  const normalized = xml
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();

  return serializeXmlTokens(
    filterVolatileCoreProps(
      tokenizeXml(normalizeSheetPartReferences(normalized, sheetPartNames)),
      partName,
    ),
  );
}

function normalizeSheetPartReferences(xml: string, sheetPartNames: Map<string, string>): string {
  let out = xml;
  for (const [originalPart, canonicalPart] of sheetPartNames) {
    out = replaceAllLiteral(out, `/${originalPart}`, `/${canonicalPart}`);
    if (originalPart.startsWith('xl/') && canonicalPart.startsWith('xl/')) {
      out = replaceAllLiteral(out, originalPart.slice(3), canonicalPart.slice(3));
    }
  }
  return out;
}

function replaceAllLiteral(input: string, search: string, replacement: string): string {
  return input.split(search).join(replacement);
}

type XmlToken =
  | { kind: 'start'; name: string; attrs: XmlAttr[]; selfClosing: boolean }
  | { kind: 'end'; name: string }
  | { kind: 'text'; value: string };

interface XmlAttr {
  name: string;
  value: string;
}

function tokenizeXml(xml: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      if (i < xml.length) tokens.push({ kind: 'text', value: xml.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ kind: 'text', value: xml.slice(i, lt) });

    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      i = end < 0 ? xml.length : end + 2;
      if (tokens.length === 0) {
        while (i < xml.length && /\s/.test(xml[i]!)) i++;
      }
      continue;
    }
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      i = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      const textEnd = end < 0 ? xml.length : end;
      tokens.push({ kind: 'text', value: xml.slice(lt + 9, textEnd) });
      i = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('</', lt)) {
      const gt = xml.indexOf('>', lt + 2);
      if (gt < 0) {
        tokens.push({ kind: 'text', value: xml.slice(lt) });
        break;
      }
      tokens.push({ kind: 'end', name: xml.slice(lt + 2, gt).trim() });
      i = gt + 1;
      continue;
    }

    const gt = findTagEnd(xml, lt + 1);
    if (gt < 0) {
      tokens.push({ kind: 'text', value: xml.slice(lt) });
      break;
    }
    tokens.push(parseStartTag(xml.slice(lt + 1, gt)));
    i = gt + 1;
  }
  return tokens.filter((token) => token.kind !== 'text' || token.value.length > 0);
}

function findTagEnd(xml: string, start: number): number {
  let quote: string | null = null;
  for (let i = start; i < xml.length; i++) {
    const ch = xml[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function parseStartTag(raw: string): XmlToken {
  const trimmed = raw.trim();
  const selfClosing = trimmed.endsWith('/');
  const body = selfClosing ? trimmed.slice(0, -1).trimEnd() : trimmed;
  const nameEnd = findNameEnd(body);
  const name = body.slice(0, nameEnd);
  return {
    kind: 'start',
    name,
    attrs: parseXmlAttrs(body.slice(nameEnd)),
    selfClosing,
  };
}

function findNameEnd(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i]!)) return i;
  }
  return s.length;
}

function parseXmlAttrs(input: string): XmlAttr[] {
  const attrs: XmlAttr[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (i >= input.length) break;

    const nameStart = i;
    while (i < input.length && !/[\s=]/.test(input[i]!)) i++;
    const name = input.slice(nameStart, i);
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (input[i] !== '=') break;
    i++;
    while (i < input.length && /\s/.test(input[i]!)) i++;

    const quote = input[i];
    if (quote !== '"' && quote !== "'") break;
    i++;
    const valueStart = i;
    while (i < input.length && input[i] !== quote) i++;
    attrs.push({ name, value: input.slice(valueStart, i) });
    if (i < input.length) i++;
  }
  return attrs;
}

function filterVolatileCoreProps(tokens: XmlToken[], partName: string): XmlToken[] {
  if (partName !== 'docProps/core.xml') return tokens;

  const volatile = new Set(['dc:creator', 'cp:lastModifiedBy', 'dcterms:created', 'dcterms:modified']);
  const out: XmlToken[] = [];
  let skipName: string | null = null;
  let skipDepth = 0;

  for (const token of tokens) {
    if (skipName) {
      if (token.kind === 'start' && token.name === skipName && !token.selfClosing) skipDepth++;
      if (token.kind === 'end' && token.name === skipName) {
        if (skipDepth === 0) skipName = null;
        else skipDepth--;
      }
      continue;
    }
    if (token.kind === 'start' && volatile.has(token.name)) {
      if (!token.selfClosing) skipName = token.name;
      continue;
    }
    out.push(token);
  }
  return out;
}

function serializeXmlTokens(tokens: XmlToken[]): string {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'text') {
      out.push(token.value);
      continue;
    }
    if (token.kind === 'end') {
      out.push(`</${token.name}>`);
      continue;
    }

    const attrs = canonicalAttrs(token.attrs);
    const attrText = attrs.length
      ? ` ${attrs.map((attr) => `${attr.name}="${escapeAttrValue(attr.value)}"`).join(' ')}`
      : '';
    const next = tokens[i + 1];
    if (token.selfClosing || (next?.kind === 'end' && next.name === token.name)) {
      out.push(`<${token.name}${attrText}/>`);
      if (!token.selfClosing) i++;
    } else {
      out.push(`<${token.name}${attrText}>`);
    }
  }
  return out.join('');
}

function canonicalAttrs(attrs: XmlAttr[]): XmlAttr[] {
  return attrs
    .filter((attr) => !isVolatileAttr(attr))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isVolatileAttr(attr: XmlAttr): boolean {
  if (attr.name === 'calcId') return true;
  if (attr.name === 'sheetId') return true;
  return (
    (attr.name === 'copies' || attr.name === 'firstPageNumber' || attr.name === 'useFirstPageNumber') &&
    attr.value === '1'
  );
}

function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function firstDiffSummary(actual: string, expected: string): string {
  const max = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < max && actual[i] === expected[i]) i++;
  if (i === actual.length && i === expected.length) return 'same length but unequal';
  return `first difference at char ${i}: actual ${JSON.stringify(snippetAt(actual, i))}, expected ${JSON.stringify(snippetAt(expected, i))}`;
}

function diffSummary(part: string, actual: string, expected: string): string {
  const mergeHint = firstRegexValueDiff(actual, expected, /<mergeCell\b[^>]*\bref=("[^"]*"|'[^']*')/g);
  if (mergeHint) return `mergeCell ref differs: ${mergeHint}`;

  const numFmtHint = firstRegexValueDiff(actual, expected, /<numFmt\b[^>]*\bformatCode=("[^"]*"|'[^']*')/g);
  if (numFmtHint) return `numFmt differs: ${numFmtHint}`;

  const styleHint = part.endsWith('styles.xml')
    ? firstRegexValueDiff(actual, expected, /<xf\b[^>]*\bnumFmtId=("[^"]*"|'[^']*')/g)
    : null;
  if (styleHint) return `style xf numFmtId differs: ${styleHint}`;

  const xmlHint = part.endsWith('.xml') || part.endsWith('.rels')
    ? xmlTokenDiffSummary(actual, expected)
    : null;
  if (xmlHint) return xmlHint;

  return firstDiffSummary(actual, expected);
}

interface AnnotatedXmlToken {
  token: XmlToken;
  path: string;
}

function xmlTokenDiffSummary(actual: string, expected: string): string | null {
  const actualTokens = annotateXmlTokens(tokenizeXml(actual));
  const expectedTokens = annotateXmlTokens(tokenizeXml(expected));
  const max = Math.max(actualTokens.length, expectedTokens.length);

  for (let i = 0; i < max; i++) {
    const a = actualTokens[i];
    const e = expectedTokens[i];
    if (!a) return `${e!.path}: missing ${xmlTokenLabel(e!.token)}`;
    if (!e) return `${a.path}: unexpected ${xmlTokenLabel(a.token)}`;
    if (xmlTokenKey(a.token) === xmlTokenKey(e.token)) continue;
    return describeXmlTokenDiff(a, e);
  }
  return null;
}

function annotateXmlTokens(tokens: XmlToken[]): AnnotatedXmlToken[] {
  const out: AnnotatedXmlToken[] = [];
  const stack: string[] = [];
  const siblingCounts = new Map<string, number>();

  for (const token of tokens) {
    if (token.kind === 'start') {
      const parentPath = stack.at(-1) ?? '';
      const countKey = `${parentPath}/${token.name}`;
      const count = (siblingCounts.get(countKey) ?? 0) + 1;
      siblingCounts.set(countKey, count);
      const path = `${parentPath}/${token.name}[${count}]`;
      out.push({ token, path });
      if (!token.selfClosing) stack.push(path);
    } else if (token.kind === 'end') {
      const path = stack.pop() ?? `/${token.name}`;
      out.push({ token, path });
    } else {
      const path = `${stack.at(-1) ?? ''}/text()`;
      out.push({ token, path });
    }
  }
  return out;
}

function describeXmlTokenDiff(actual: AnnotatedXmlToken, expected: AnnotatedXmlToken): string {
  const a = actual.token;
  const e = expected.token;
  if (a.kind === 'start' && e.kind === 'start' && a.name === e.name) {
    const attrHint = firstAttrDiff(a.attrs, e.attrs);
    if (attrHint) return `${actual.path}: ${attrHint}`;
  }
  if (a.kind === 'text' && e.kind === 'text') {
    return `${actual.path}: text differs: actual ${JSON.stringify(snippetAt(a.value, firstDiffIndex(a.value, e.value)))}, expected ${JSON.stringify(snippetAt(e.value, firstDiffIndex(a.value, e.value)))}`;
  }
  return `${actual.path}: actual ${xmlTokenLabel(a)}, expected ${xmlTokenLabel(e)} at ${expected.path}`;
}

function firstAttrDiff(actual: XmlAttr[], expected: XmlAttr[]): string | null {
  const a = new Map(actual.map((attr) => [attr.name, attr.value]));
  const e = new Map(expected.map((attr) => [attr.name, attr.value]));
  const names = [...new Set([...a.keys(), ...e.keys()])].sort();
  for (const name of names) {
    if (!a.has(name)) return `missing attribute ${name}=${JSON.stringify(e.get(name))}`;
    if (!e.has(name)) return `unexpected attribute ${name}=${JSON.stringify(a.get(name))}`;
    if (a.get(name) !== e.get(name)) {
      return `attribute ${name} differs: actual ${JSON.stringify(a.get(name))}, expected ${JSON.stringify(e.get(name))}`;
    }
  }
  return null;
}

function xmlTokenKey(token: XmlToken): string {
  if (token.kind === 'start') {
    return `start:${token.name}:${token.selfClosing}:${canonicalAttrs(token.attrs)
      .map((attr) => `${attr.name}=${attr.value}`)
      .join('\u0000')}`;
  }
  if (token.kind === 'end') return `end:${token.name}`;
  return `text:${token.value}`;
}

function xmlTokenLabel(token: XmlToken): string {
  if (token.kind === 'start') return token.selfClosing ? `<${token.name}/>` : `<${token.name}>`;
  if (token.kind === 'end') return `</${token.name}>`;
  return `text ${JSON.stringify(snippetAt(token.value, 0))}`;
}

function firstDiffIndex(actual: string, expected: string): number {
  const max = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < max && actual[i] === expected[i]) i++;
  return i;
}

function firstRegexValueDiff(actual: string, expected: string, re: RegExp): string | null {
  const actualValues = [...actual.matchAll(re)].map((m) => m[1]);
  const expectedValues = [...expected.matchAll(re)].map((m) => m[1]);
  const max = Math.max(actualValues.length, expectedValues.length);
  for (let i = 0; i < max; i++) {
    if (actualValues[i] !== expectedValues[i]) {
      return `actual ${JSON.stringify(actualValues[i] ?? null)}, expected ${JSON.stringify(expectedValues[i] ?? null)}`;
    }
  }
  return null;
}

function snippetAt(s: string, index: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(s.length, index + 60);
  return s.slice(start, end);
}

type CellMap = Record<string, Record<string, unknown>>;

async function loadCells(buf: ArrayBuffer): Promise<CellMap> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets: CellMap = {};
  for (const ws of wb.worksheets) {
    if (ws.name === '_config') continue;
    if (ws.name.startsWith('_')) continue;
    const cells: Record<string, unknown> = {};
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        cells[`${r},${c}`] = comparable(cell.value);
      });
    });
    sheets[ws.name] = cells;
  }
  return sheets;
}

/**
 * Canonical, **kind-tagged** form of a cell value for Stage 1 comparison.
 *
 * Every string-valued form carries a `kind:` prefix, including plain
 * text. Without that, each canonicalization collapsed into a bare string
 * that a genuine text cell could impersonate (#92): a `Date` became its
 * ISO string and compared equal to a text cell holding that same ISO
 * text, and the same held for formula, error, hyperlink and
 * shared-formula cells. runner-protocol.md prohibits exactly this —
 * "a text cell never equals a number, boolean, or date cell, even when
 * their display forms coincide", and "a runner that stringifies both
 * sides before comparing MUST NOT claim Stage 1 conformance".
 *
 * Numbers and booleans stay native. They cannot collide with a tagged
 * string under `diffCellMaps`'s strict `!==`, and leaving them alone
 * keeps `1` equal to `1.0` as the protocol requires.
 *
 * Rich text deliberately tags as `text:` — the protocol says rich-text
 * cells compare "by their concatenated text", so equality with a plain
 * text cell of the same content is intended, not a collision.
 */
export function comparable(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return `date:${v.toISOString()}`;
    if ('richText' in v) {
      return `text:${(v as { richText: { text: string }[] }).richText
        .map((r) => r.text).join('')}`;
    }
    // ADR-0025: an Excel error cell ({ error: '#DIV/0!' } etc.) is
    // surfaced by its error code so output-side fixtures can pin the
    // exact error. ADR-0017 separately governs error cells in input
    // sources (they read as empty in eval, so they never reach output
    // unchanged unless the engine intentionally produces them).
    if ('error' in v) return `error:${String((v as { error: unknown }).error ?? '')}`;
    // ADR-0039: hyperlink cells ({ text, hyperlink }) compare by a
    // stable concatenation so two structurally-equal hyperlinks pass
    // the `!==` check in diffCellMaps.
    if ('hyperlink' in v && 'text' in v) {
      const h = v as { text: unknown; hyperlink: unknown };
      return `hyperlink:HYPERLINK("${String(h.hyperlink ?? '')}","${String(h.text ?? '')}")`;
    }
    // ADR-0046: formula cells compare by formula text. Cached `result`
    // is timing-dependent (template-cached vs runtime-computed) and is
    // NOT part of the preservation contract — only the formula text.
    if ('formula' in v) {
      return `formula:=${String((v as { formula: unknown }).formula ?? '')}`;
    }
    // ADR-0066: an OOXML shared-formula slave (`{ sharedFormula: 'E2' }`)
    // identifies its owner by address. We compare by a stable string so
    // two structurally-equal slaves (which JavaScript would treat as
    // distinct object refs) match in the runner's `!==` check.
    if ('sharedFormula' in v) {
      return `sharedFormula:=shared:${String((v as { sharedFormula: unknown }).sharedFormula ?? '')}`;
    }
    if ('result' in v) return comparable((v as { result: ExcelJS.CellValue }).result ?? null);
  }
  if (typeof v === 'string') return `text:${v}`;
  return v;
}

function formatUtcToday(d: Date, fmt: string): string {
  const y = d.getUTCFullYear();
  const M = d.getUTCMonth() + 1;
  const D = d.getUTCDate();
  const H = d.getUTCHours();
  const m = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  return fmt
    .replace('YYYY', String(y))
    .replace('YY', String(y).slice(-2))
    .replace('MM', String(M).padStart(2, '0'))
    .replace('DD', String(D).padStart(2, '0'))
    .replace('dd', String(D).padStart(2, '0'))
    .replace('HH', String(H).padStart(2, '0'))
    .replace('hh', String(H).padStart(2, '0'))
    .replace('mm', String(m).padStart(2, '0'))
    .replace('ss', String(s).padStart(2, '0'));
}

function diffCellMaps(actual: CellMap, expected: CellMap, diffs: string[], fnPrefix?: string) {
  const sheets = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const sheet of sheets) {
    const a = actual[sheet] ?? {};
    const e = expected[sheet] ?? {};
    const cells = new Set([...Object.keys(a), ...Object.keys(e)]);
    for (const k of cells) {
      if (a[k] !== e[k]) {
        const where = fnPrefix ? `[${fnPrefix}] ${sheet}@${k}` : `${sheet}@${k}`;
        diffs.push(`${where}: actual=${JSON.stringify(a[k])}, expected=${JSON.stringify(e[k])}`);
      }
    }
  }
}

async function loadMeta(dir: string): Promise<FixtureMeta> {
  const txt = await readFile(join(dir, 'meta.yaml'), 'utf8');
  return parseMeta(txt);
}

/**
 * Minimal YAML reader for the keys meta.yaml uses: scalar strings, scalar
 * numbers (treated as strings), and inline arrays `[a, b, c]`. Pulled from
 * the runner-protocol.md required/optional fields list. We deliberately
 * avoid a full YAML dependency for a six-key file.
 */
export function parseMeta(text: string): FixtureMeta {
  const meta: FixtureMeta = {
    description: '',
    spec_section: '',
    spec_version: '',
    tags: [],
    verified_by: [],
    expected_warnings: [],
    dynamic_cells: [],
    comparison_stage: 1,
    inputs: [],
  };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (!line.trim() || line.startsWith('---')) continue;

    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (key === 'tags' || key === 'verified_by' || key === 'expected_warnings') {
      meta[key] = parseInlineList(value);
    } else if (
      key === 'description' || key === 'spec_section' ||
      key === 'spec_version' || key === 'skip_reason' ||
      key === 'expected_error' || key === 'expected_error_code' ||
      key === 'expected_dynamic'
    ) {
      meta[key] = stripQuotes(value);
    } else if (key === 'comparison_stage') {
      meta.comparison_stage = parseComparisonStage(value);
    } else if (key === 'dynamic_cells') {
      meta.dynamic_cells = parseDynamicCells(lines.slice(i + 1));
    } else if (key === 'inputs') {
      meta.inputs = parseInputs(lines.slice(i + 1));
    }
  }
  return meta;
}

function parseInputs(lines: string[]): FixtureInputAssignment[] {
  const inputs: FixtureInputAssignment[] = [];
  let current: Partial<FixtureInputAssignment> | null = null;

  const flush = () => {
    if (current?.name !== undefined && current.value !== undefined) {
      inputs.push({ name: current.name, value: current.value });
    }
  };

  for (const raw of lines) {
    if (!raw.startsWith(' ') && raw.trim()) break;
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      flush();
      current = {};
      const rest = trimmed.slice(2).trim();
      if (rest) assignInputField(current, rest);
    } else if (current) {
      assignInputField(current, trimmed);
    }
  }
  flush();
  return inputs;
}

function assignInputField(input: Partial<FixtureInputAssignment>, line: string) {
  const idx = line.indexOf(':');
  if (idx < 0) return;
  const key = line.slice(0, idx).trim();
  const value = stripQuotes(line.slice(idx + 1).trim());
  if (key === 'name' || key === 'value') {
    input[key] = value;
  }
}

function inputsAsRecord(items: FixtureInputAssignment[]): Record<string, unknown> | undefined {
  if (items.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const it of items) out[it.name] = it.value;
  return out;
}

function parseComparisonStage(v: string): ComparisonStage {
  const n = Number(stripQuotes(v));
  return n === 2 ? 2 : 1;
}

function parseDynamicCells(lines: string[]): DynamicCellAssertion[] {
  const cells: DynamicCellAssertion[] = [];
  let current: Partial<DynamicCellAssertion> | null = null;

  const flush = () => {
    if (current?.sheet && current.cell && current.format) {
      cells.push({
        sheet: current.sheet,
        cell: current.cell,
        format: current.format,
      });
    }
  };

  for (const raw of lines) {
    if (!raw.startsWith(' ') && raw.trim()) break;
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      flush();
      current = {};
      const rest = trimmed.slice(2).trim();
      if (rest) assignDynamicCellField(current, rest);
    } else if (current) {
      assignDynamicCellField(current, trimmed);
    }
  }
  flush();
  return cells;
}

function assignDynamicCellField(cell: Partial<DynamicCellAssertion>, line: string) {
  const idx = line.indexOf(':');
  if (idx < 0) return;
  const key = line.slice(0, idx).trim();
  const value = stripQuotes(line.slice(idx + 1).trim());
  if (key === 'sheet' || key === 'cell' || key === 'format') {
    cell[key] = value;
  }
}

function parseInlineList(v: string): string[] {
  if (!v.startsWith('[') || !v.endsWith(']')) return [];
  const inner = v.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function pkgVersion(): string {
  // Hardcoded floor; bin can override by reading package.json if needed.
  return '0.1.0-alpha.0';
}

export function formatTextReport(report: ConformanceReport): string {
  const lines: string[] = [];
  lines.push(`${report.implementation} ${report.version} — XTL ${report.spec_version} — Stage ${report.comparison_stage}`);
  for (const r of report.results) {
    const status = r.status.toUpperCase().padEnd(5);
    const stage = r.comparison_stage ? ` [stage ${r.comparison_stage}]` : '';
    let line = `  ${status} ${r.fixture}${stage}  (${r.duration_ms}ms)`;
    if (r.skip_reason) line += `  — ${r.skip_reason}`;
    if (r.error) line += `  — error: ${r.error}`;
    lines.push(line);
    if (r.diff) {
      for (const d of r.diff.split('\n')) lines.push(`         ${d}`);
    }
  }
  const s = report.summary;
  lines.push('');
  lines.push(
    `${s.passed}/${s.total} passed` +
    (s.failed ? ` · ${s.failed} failed` : '') +
    (s.errored ? ` · ${s.errored} errored` : '') +
    (s.skipped ? ` · ${s.skipped} skipped` : ''),
  );
  return lines.join('\n');
}
