// Authoring-time verifier (NOT the conformance runner).
//
// For each static-output fixture, runs the reference impl on (template.xlsx,
// data.xlsx) and compares the resulting output against expected.xlsx using
// cell-value equality (not byte-equality; canonical OOXML comparison is the
// runner's job). Error and dynamic fixtures are skipped because their pass/fail
// contracts belong to the conformance runner.
//
// Per AUTHORING.md step 4: if the impl disagrees with the hand-authored
// expected, do NOT change the expected. Investigate.

import ExcelJS from 'exceljs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// impl/js/dist, not dist: the reference impl moved into the npm
// workspace at impl/js in #79 (2026-07-19). This import kept the old
// root path and the script has not run since — it is wired into neither
// CI nor package.json, so nothing surfaced the breakage.
//
// STILL BROKEN after this fix, left as-is because it is a separate
// concern from the fixture set: the script does not read `inputs` from
// meta.yaml and does not isolate per-fixture failures, so it dies
// uncaught on the first fixture declaring a required input (065-066
// onward). `impl/js/src/__tests__/conformance-runner.test.ts` handles
// both and is the checker CI actually runs; this script is a
// convenience duplicate that has rotted.
import { convert } from '../../impl/js/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

const entries = await readdir(FIXTURES, { withFileTypes: true });
const cases = entries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

function cellValToComparable(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map((r) => r.text).join('');
  }
  if (typeof v === 'object' && 'result' in v) return v.result ?? null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function loadCells(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets = {};
  for (const ws of wb.worksheets) {
    if (ws.name === '_config') continue;
    if (ws.name.startsWith('_')) continue;
    const cells = {};
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        cells[`${ws.name}!${r},${c}`] = cellValToComparable(cell.value);
      });
    });
    sheets[ws.name] = cells;
  }
  return sheets;
}

async function loadExpected(dir) {
  // expected.xlsx (single-output) or expected/*.xlsx (multi-output).
  try {
    const buf = await readFile(join(dir, 'expected.xlsx'));
    return [{ filename: 'expected.xlsx', buf }];
  } catch {}
  const expDir = join(dir, 'expected');
  try {
    const st = await stat(expDir);
    if (!st.isDirectory()) throw new Error('expected/ is not a directory');
  } catch {
    return null;
  }
  const files = await readdir(expDir);
  const xlsxs = files.filter((f) => f.endsWith('.xlsx')).sort();
  return await Promise.all(xlsxs.map(async (f) => ({
    filename: f,
    buf: await readFile(join(expDir, f)),
  })));
}

async function isStaticOutputFixture(dir) {
  const meta = await readFile(join(dir, 'meta.yaml'), 'utf8');
  return !/^\s*expected_error\s*:/m.test(meta) && !/^\s*expected_dynamic\s*:/m.test(meta);
}

let pass = 0, fail = 0, skip = 0;
for (const name of cases) {
  const dir = join(FIXTURES, name);
  if (!(await isStaticOutputFixture(dir))) {
    console.log(`SKIP  ${name}  (non-static fixture)`);
    skip++;
    continue;
  }

  const tmpl = await readFile(join(dir, 'template.xlsx'));
  const data = await readFile(join(dir, 'data.xlsx'));
  const expectedFiles = await loadExpected(dir);
  if (!expectedFiles) {
    console.error(`${name}: no expected.xlsx or expected/ dir`);
    fail++;
    continue;
  }

  const out = await convert(tmpl.buffer, data.buffer);

  // Single-file fixture (expected.xlsx) ignores filename, compares content only.
  // Multi-file fixture (expected/) checks both filenames and content.
  const isMultiFile = expectedFiles[0]?.filename !== 'expected.xlsx';

  const diffs = [];

  if (isMultiFile) {
    const actualByName = Object.fromEntries(out.map((f) => [f.filename, f.data]));
    const expectedByName = Object.fromEntries(expectedFiles.map((f) => [f.filename, f.buf]));
    const allFilenames = new Set([...Object.keys(actualByName), ...Object.keys(expectedByName)]);
    for (const fn of allFilenames) {
      if (!actualByName[fn]) { diffs.push(`missing output file: ${fn}`); continue; }
      if (!expectedByName[fn]) { diffs.push(`unexpected output file: ${fn}`); continue; }
      const aCells = await loadCells(actualByName[fn]);
      const eCells = await loadCells(expectedByName[fn]);
      diffCellMaps(aCells, eCells, diffs, fn);
    }
  } else {
    if (out.length !== 1) {
      console.error(`${name}: expected single output, got ${out.length}`);
      fail++;
      continue;
    }
    const aCells = await loadCells(out[0].data);
    const eCells = await loadCells(expectedFiles[0].buf);
    diffCellMaps(aCells, eCells, diffs);
  }

  if (diffs.length === 0) {
    console.log(`PASS  ${name}`);
    pass++;
  } else {
    console.log(`FAIL  ${name}`);
    for (const d of diffs) console.log('       ' + d);
    fail++;
  }
}

function diffCellMaps(actualCells, expectedCells, diffs, fnPrefix) {
  const allKeys = new Set([
    ...Object.keys(actualCells),
    ...Object.keys(expectedCells),
  ]);
  for (const sheet of allKeys) {
    const a = actualCells[sheet] ?? {};
    const e = expectedCells[sheet] ?? {};
    const cellKeys = new Set([...Object.keys(a), ...Object.keys(e)]);
    for (const k of cellKeys) {
      if (a[k] !== e[k]) {
        const where = fnPrefix ? `[${fnPrefix}] ${k}` : k;
        diffs.push(`${where}: actual=${JSON.stringify(a[k])}, expected=${JSON.stringify(e[k])}`);
      }
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail === 0 ? 0 : 1);
