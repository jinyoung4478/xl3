#!/usr/bin/env node
// ROADMAP gate G8 — the published performance matrix.
//
// Run: `npm run bench:matrix`
//
// Separate from `bench.mjs` on purpose. That script is the fast
// regression signal (three fixed scenarios, seconds). This one sweeps
// 1k/10k/100k rows × 5/10/20 columns and is expected to take minutes,
// so it is opt-in rather than part of the default bench.
//
// Each matrix cell runs in a **child process**:
//
//   - `process.resourceUsage().maxRSS` is a process-lifetime peak, so it
//     is only meaningful per cell if the cell owns the process.
//   - A cell that exhausts the heap takes the process down with it. In a
//     single process the first OOM would end the sweep; isolated, an OOM
//     is just a recorded result — and for the largest cells that result
//     *is* the finding G21 needs.
//
// Phase split is derived from the public API rather than by exporting
// internals:
//
//   parse   = analyze(template)                  template parse only
//   eval    = preview(template, source) - parse  source read + group + eval
//   write   = convert(template, source) - preview  render + serialize
//
// `preview()` does everything `convert()` does except render and
// serialize the output workbooks, so the subtraction isolates the write
// phase. It is an approximation — the phases are not independently
// instrumented — and BENCH.md says so.

import ExcelJS from 'exceljs';
import { performance } from 'node:perf_hooks';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROW_TIERS = [1_000, 10_000, 100_000];
const COL_TIERS = [5, 10, 20];
const RUNS = 3;
const SELF = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------- fixtures

function addConfig(wb, rows) {
  const sh = wb.addWorksheet('__config__');
  sh.getCell('A1').value = 'key';
  sh.getCell('B1').value = 'value';
  rows.forEach(([k, v], i) => {
    sh.getCell(`A${i + 2}`).value = k;
    sh.getCell(`B${i + 2}`).value = v;
  });
}

const colName = (i) => `C${i}`;

/**
 * Template with `cols` output columns. Every third column carries a
 * computed expression so the eval phase is not just cell copying —
 * a matrix of pure passthroughs would understate real workloads.
 */
async function buildTemplate(cols) {
  const tpl = new ExcelJS.Workbook();
  addConfig(tpl, [
    ['name', `matrix-${cols}c`],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'out.xlsx'],
  ]);
  const ts = tpl.addWorksheet('Out');
  for (let c = 0; c < cols; c++) {
    const cell = ts.getRow(1).getCell(c + 1);
    cell.value = colName(c);
    const body = ts.getRow(2).getCell(c + 1);
    if (c % 3 === 1) {
      body.value = `{{ ROUND([${colName(c)}] * 1.1, 2) }}`;
    } else if (c % 3 === 2) {
      body.value = `{{ IF([${colName(c)}] > 500, "high", "low") }}`;
    } else {
      body.value = `{{ [${colName(c)}] }}`;
    }
  }
  return tpl.xlsx.writeBuffer();
}

async function buildSource(rows, cols) {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('Data');
  sh.addRow(Array.from({ length: cols }, (_, c) => colName(c)));
  // addRow with an array is markedly cheaper than per-cell getCell()
  // at 100k × 20; the fixture build would otherwise dominate the run.
  for (let r = 0; r < rows; r++) {
    sh.addRow(Array.from({ length: cols }, (_, c) => ((r * 7 + c * 13) % 1000)));
  }
  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------- one cell

async function runCell(rows, cols) {
  const { analyze, preview, convert } = await import('@xl3-lang/xl3');

  const buildStart = performance.now();
  const tpl = await buildTemplate(cols);
  const data = await buildSource(rows, cols);
  const buildMs = performance.now() - buildStart;

  const median = (samples) => {
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  };

  const time = async (fn) => {
    const samples = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      await fn();
      samples.push(performance.now() - t0);
    }
    return median(samples);
  };

  const parseMs = await time(() => analyze(tpl));
  const previewMs = await time(() => preview(tpl, data));
  const heapBefore = process.memoryUsage().heapUsed;
  const convertMs = await time(async () => {
    const out = await convert(tpl, data);
    if (out.length === 0) throw new Error('no output');
  });
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    rows,
    cols,
    buildMs,
    parseMs,
    evalMs: Math.max(0, previewMs - parseMs),
    writeMs: Math.max(0, convertMs - previewMs),
    totalMs: convertMs,
    heapDeltaBytes: heapAfter - heapBefore,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
  };
}

// ------------------------------------------------------------------ child

const cellArg = process.argv.indexOf('--cell');
if (cellArg !== -1) {
  const [rows, cols] = process.argv[cellArg + 1].split(',').map(Number);
  try {
    const result = await runCell(rows, cols);
    process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
    process.exit(0);
  } catch (e) {
    process.stdout.write(
      `\n__RESULT__${JSON.stringify({ rows, cols, failed: String(e?.message ?? e) })}\n`,
    );
    process.exit(1);
  }
}

// ----------------------------------------------------------------- parent

function runChild(rows, cols, heapMb) {
  return new Promise((resolve) => {
    const child = fork(SELF, ['--cell', `${rows},${cols}`], {
      execArgv: [`--max-old-space-size=${heapMb}`],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', () => {});
    child.on('exit', (code, signal) => {
      const m = out.match(/__RESULT__(.+)/);
      if (m) {
        try {
          return resolve(JSON.parse(m[1]));
        } catch {
          /* fall through */
        }
      }
      resolve({
        rows,
        cols,
        failed:
          signal === 'SIGABRT' || code === 134
            ? `heap exhausted at --max-old-space-size=${heapMb}`
            : `child exited ${code}${signal ? ` (${signal})` : ''}`,
      });
    });
  });
}

const HEAP_MB = Number(process.env.BENCH_HEAP_MB ?? 4096);
const maxRows = Number(process.env.BENCH_MAX_ROWS ?? Infinity);

const fmtMs = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n.toFixed(0)} ms`);
const fmtMb = (b) => `${(b / 1024 / 1024).toFixed(0)} MB`;

console.log(`xl3 bench matrix — median of ${RUNS} runs per cell`);
console.log(`heap cap ${HEAP_MB} MB, one child process per cell`);
console.log('='.repeat(78));
console.log(
  ['rows', 'cols', 'parse', 'eval', 'write', 'total', 'peak RSS'].map((h, i) =>
    i < 2 ? h.padStart(7) : h.padStart(11),
  ).join(''),
);
console.log('-'.repeat(78));

const results = [];
for (const rows of ROW_TIERS) {
  if (rows > maxRows) continue;
  for (const cols of COL_TIERS) {
    const r = await runChild(rows, cols, HEAP_MB);
    results.push(r);
    if (r.failed) {
      console.log(
        `${String(rows).padStart(7)}${String(cols).padStart(7)}` +
          `   ${r.failed}`,
      );
    } else {
      console.log(
        String(rows).padStart(7) +
          String(cols).padStart(7) +
          fmtMs(r.parseMs).padStart(11) +
          fmtMs(r.evalMs).padStart(11) +
          fmtMs(r.writeMs).padStart(11) +
          fmtMs(r.totalMs).padStart(11) +
          fmtMb(r.maxRssBytes).padStart(11),
      );
    }
  }
}

console.log('='.repeat(78));
const ok = results.filter((r) => !r.failed);
if (ok.length) {
  const worst = ok.reduce((a, b) => (b.maxRssBytes > a.maxRssBytes ? b : a));
  console.log(
    `memory ceiling observed: ${fmtMb(worst.maxRssBytes)} peak RSS ` +
      `at ${worst.rows} rows × ${worst.cols} cols`,
  );
}
const failed = results.filter((r) => r.failed);
if (failed.length) {
  console.log(`cells that did not complete: ${failed.map((f) => `${f.rows}×${f.cols}`).join(', ')}`);
}
console.log('\nJSON:');
console.log(JSON.stringify(results, null, 2));
