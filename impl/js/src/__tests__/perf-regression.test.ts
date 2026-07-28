import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { performance } from 'node:perf_hooks';
import { convert } from '../index.js';

// ROADMAP gate G9 — performance regression guard.
//
// These assert a *ratio*, never a wall-clock budget. An absolute bound
// ("under 300 ms") encodes the machine it was written on and breaks on a
// slow CI runner while saying nothing about the code. A ratio asks the
// only question that survives a hardware change: did the cost per unit
// of work stay flat?
//
// Observed on the reference machine at the sizes below: row scaling
// 6.2x, join scaling 6.9x for 10x the rows. Both sublinear, because the
// fixed cost (template parse, workbook setup, the ~130 MB floor from the
// G8 matrix) amortizes at the larger size.
//
// The bound is 20x — roughly 3x headroom over what was measured, while a
// quadratic regression would land near 100x. That gap is the whole
// design: loose enough to survive a noisy shared runner, tight enough
// that a ~3x degradation in per-unit cost still trips it. Re-measure
// before moving it; the numbers above are what the headroom is based on.
//
// Deliberately NOT in conformance/fixtures/: that corpus is the
// cross-implementation contract, and a Python port being slower than a
// JS one is not an XTL conformance failure. It is also bound by an
// AUTHORING.md hard rule that fixtures stay tiny. Data here is generated
// at run time, so nothing large is committed either.

const SMALL_ROWS = 1_000;
const LARGE_ROWS = 10_000;
const SCALE = LARGE_ROWS / SMALL_ROWS;
const MAX_RATIO = 20;

function addConfig(wb: ExcelJS.Workbook, rows: [string, string][]): void {
  const sh = wb.addWorksheet('__config__');
  sh.getCell('A1').value = 'key';
  sh.getCell('B1').value = 'value';
  rows.forEach(([k, v], i) => {
    sh.getCell(`A${i + 2}`).value = k;
    sh.getCell(`B${i + 2}`).value = v;
  });
}

function addSources(wb: ExcelJS.Workbook, defs: { name: string; sheet: string }[]): void {
  const sh = wb.addWorksheet('__sources__');
  sh.getCell('A1').value = 'name';
  sh.getCell('B1').value = 'sheet';
  sh.getCell('C1').value = 'table';
  defs.forEach((d, i) => {
    sh.getCell(`A${i + 2}`).value = d.name;
    sh.getCell(`B${i + 2}`).value = d.sheet;
    sh.getCell(`C${i + 2}`).value = '1';
  });
}

/** Flat per-row substitution + arithmetic: the row-iteration hot path. */
async function buildRowScaling(rows: number) {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', 'perf-rows'],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'out.xlsx'],
  ]);
  const ts = tpl.addWorksheet('Out');
  ts.getRow(1).values = ['Account', 'Amount', 'Tier'];
  ts.getCell('A2').value = '{{ [Account] }}';
  ts.getCell('B2').value = '{{ ROUND([Amount] * 1.1, 2) }}';
  ts.getCell('C2').value = '{{ IF([Amount] > 500, "high", "low") }}';

  const data = new ExcelJS.Workbook();
  const ds = data.addWorksheet('Data');
  ds.addRow(['Account', 'Amount']);
  for (let i = 0; i < rows; i++) ds.addRow([`A${i}`, (i * 7) % 1000]);

  return { tpl: await tpl.xlsx.writeBuffer(), data: await data.xlsx.writeBuffer() };
}

/**
 * `@join` across two sources. The guard that matters most: ADR-0014's
 * cached lookup index is what keeps this linear. If it regresses to a
 * scan per row the cost becomes rows x joined-rows, and this ratio is
 * what notices.
 */
async function buildJoinScaling(rows: number) {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', 'perf-join'],
    ['source_sheet', 'Renewals'],
    ['source_table', '1'],
    ['output_file_pattern', 'out.xlsx'],
  ]);
  addSources(tpl, [
    { name: 'Renewals', sheet: 'Renewals' },
    { name: 'Customers', sheet: 'Customers' },
  ]);
  const ts = tpl.addWorksheet('Out');
  ts.getRow(1).values = ['Account', 'Region', 'Amount'];
  ts.getCell('A2').value = '{{ @source Renewals }}';
  ts.getCell('A3').value =
    '{{ @join Customers on Customers[Account] = Renewals[Account] }}';
  ts.getCell('A4').value = '{{ Renewals[Account] }}';
  ts.getCell('B4').value = '{{ Customers[Region] }}';
  ts.getCell('C4').value = '{{ Renewals[Amount] }}';

  const data = new ExcelJS.Workbook();
  // The joined side scales with the primary so the pair stays a genuine
  // 10x more work. Holding it fixed would let a quadratic hide.
  const cust = data.addWorksheet('Customers');
  cust.addRow(['Account', 'Region']);
  for (let i = 0; i < rows; i++) cust.addRow([`A${i}`, i % 2 === 0 ? 'Seoul' : 'Busan']);
  const ren = data.addWorksheet('Renewals');
  ren.addRow(['Account', 'Amount']);
  for (let i = 0; i < rows; i++) ren.addRow([`A${i}`, i]);

  return { tpl: await tpl.xlsx.writeBuffer(), data: await data.xlsx.writeBuffer() };
}

/**
 * Fastest of three runs after a discarded warmup.
 *
 * Minimum, not median: noise on a shared runner only ever *adds* time,
 * so the fastest sample is the closest estimate of the real cost and the
 * most stable thing to build a ratio from.
 */
async function fastestOf3(run: () => Promise<unknown>): Promise<number> {
  await run(); // warmup — let the JIT settle before measuring
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await run();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

async function ratioFor(
  build: (rows: number) => Promise<{ tpl: ArrayBuffer; data: ArrayBuffer }>,
): Promise<{ ratio: number; smallMs: number; largeMs: number }> {
  // Fixtures are built outside the timed section — generation cost
  // scales too and would otherwise be folded into the measurement.
  const small = await build(SMALL_ROWS);
  const large = await build(LARGE_ROWS);

  const smallMs = await fastestOf3(async () => {
    const out = await convert(small.tpl, small.data);
    if (out.length === 0) throw new Error('no output');
  });
  const largeMs = await fastestOf3(async () => {
    const out = await convert(large.tpl, large.data);
    if (out.length === 0) throw new Error('no output');
  });

  return { ratio: largeMs / smallMs, smallMs, largeMs };
}

describe('G9 performance regression guards', () => {
  it(`row scaling stays under ${MAX_RATIO}x for ${SCALE}x the rows`, async () => {
    const { ratio, smallMs, largeMs } = await ratioFor(buildRowScaling);
    expect(
      ratio,
      `row scaling: ${SMALL_ROWS} rows ${smallMs.toFixed(0)}ms -> ` +
        `${LARGE_ROWS} rows ${largeMs.toFixed(0)}ms = ${ratio.toFixed(1)}x ` +
        `for ${SCALE}x the work (expected ~${SCALE}x, quadratic would be ~${SCALE ** 2}x)`,
    ).toBeLessThan(MAX_RATIO);
  }, 120_000);

  it(`@join scaling stays under ${MAX_RATIO}x for ${SCALE}x the rows`, async () => {
    const { ratio, smallMs, largeMs } = await ratioFor(buildJoinScaling);
    expect(
      ratio,
      `join scaling: ${SMALL_ROWS} rows ${smallMs.toFixed(0)}ms -> ` +
        `${LARGE_ROWS} rows ${largeMs.toFixed(0)}ms = ${ratio.toFixed(1)}x ` +
        `for ${SCALE}x the work. A regression in ADR-0014's lookup index ` +
        `shows up here as a ratio near ${SCALE ** 2}x`,
    ).toBeLessThan(MAX_RATIO);
  }, 120_000);
});
