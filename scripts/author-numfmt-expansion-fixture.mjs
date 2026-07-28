#!/usr/bin/env node
// Authoring script for fixture 170 (G24 data-loss group, numFmt-drop path).
//
// Run: node scripts/author-numfmt-expansion-fixture.mjs
//
// Expected values are hand-derived literals, never convert() output —
// AUTHORING.md forbids capturing impl output as expected.xlsx. Its Stage 2
// caveat explicitly permits ExcelJS as *scaffolding* ("the package writer
// is generic — it is not the XTL implementation"), which is all it is here.
//
// Spec basis: spec/evaluation.md "Styles and Workbook Structure" — MUST
// preserve number/date format and cell style verbatim, and (clarified for
// #96) every @repeat-expanded row inherits them, not only the first.
//
// Why this is not a duplicate of 025: that fixture has ONE data row, so
// template row -> output row is 1:1 and it cannot observe expansion. A
// regression that formatted the first expanded row and left the rest bare
// passes 025. Two columns with different formats also catch column A's
// format leaking into column B.

import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'conformance', 'fixtures',
  '170-data-loss-numfmt-preserved-across-expansion');

const MONEY = '#,##0.00';
const DATE = 'yyyy-mm-dd';
const SHEET = 'Report';

const ROWS = [
  [1234.5, new Date(Date.UTC(2026, 0, 31))],
  [0.5, new Date(Date.UTC(2026, 5, 1))],
  [1000000, new Date(Date.UTC(2026, 11, 25))],
];

function config(wb) {
  const sh = wb.addWorksheet('__config__');
  [
    ['name', 'data-loss-numfmt-preserved-across-expansion'],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'output.xlsx'],
  ].forEach(([k, v], i) => {
    sh.getCell(`A${i + 1}`).value = k;
    sh.getCell(`B${i + 1}`).value = v;
  });
}

await mkdir(DIR, { recursive: true });

// template — one body row carrying both formats
const tpl = new ExcelJS.Workbook();
config(tpl);
{
  const s = tpl.addWorksheet(SHEET);
  s.getCell('A1').value = 'Amount';
  s.getCell('B1').value = 'Due';
  s.getCell('A2').value = '{{ [Amount] }}';
  s.getCell('A2').numFmt = MONEY;
  s.getCell('B2').value = '{{ [Due] }}';
  s.getCell('B2').numFmt = DATE;
}
await writeFile(join(DIR, 'template.xlsx'), Buffer.from(await tpl.xlsx.writeBuffer()));

// data — three rows, so the single template row must expand to three
const data = new ExcelJS.Workbook();
{
  const s = data.addWorksheet('Data');
  s.getCell('A1').value = 'Amount';
  s.getCell('B1').value = 'Due';
  ROWS.forEach(([amt, due], i) => {
    s.getCell(`A${i + 2}`).value = amt;
    s.getCell(`B${i + 2}`).value = due;
  });
}
await writeFile(join(DIR, 'data.xlsx'), Buffer.from(await data.xlsx.writeBuffer()));

// expected — hand-derived: each of the three rows carries its column's
// format. Rows 3 and 4 are the point; 025 already covers row 2 alone.
const exp = new ExcelJS.Workbook();
{
  const s = exp.addWorksheet(SHEET);
  s.getCell('A1').value = 'Amount';
  s.getCell('B1').value = 'Due';
  ROWS.forEach(([amt, due], i) => {
    const r = i + 2;
    s.getCell(`A${r}`).value = amt;
    s.getCell(`A${r}`).numFmt = MONEY;
    s.getCell(`B${r}`).value = due;
    s.getCell(`B${r}`).numFmt = DATE;
  });
}
await writeFile(join(DIR, 'expected.xlsx'), Buffer.from(await exp.xlsx.writeBuffer()));

await writeFile(join(DIR, 'meta.yaml'), [
  'description: "Every @repeat-expanded row inherits its template cell\'s number format, not only the first row."',
  'spec_section: evaluation.md "Styles and Workbook Structure"; ADR-0036; ADR-0006',
  'spec_version: "0.1"',
  'tags: [data-loss, numfmt, stage2, style]',
  'comparison_stage: 2',
  'verified_by: [spec-derivation, manual-script]',
  '',
].join('\n'));

console.log('wrote 170-data-loss-numfmt-preserved-across-expansion');
