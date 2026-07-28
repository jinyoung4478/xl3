#!/usr/bin/env node
// Authoring script for the G24 `data-loss` fixture group.
//
// Run: `node scripts/author-data-loss-fixtures.mjs`
//
// READ THIS BEFORE CHANGING ANY `expected` BELOW.
//
// conformance/AUTHORING.md forbids the "JS impl as ground truth" pattern:
// expected outputs are authored from the spec, never captured from the
// reference implementation. Every `expected` array in this file is a
// literal derived by hand from the quoted spec sentence above it. This
// script is only a *writer* — it turns those literals into .xlsx. It
// never calls convert().
//
// So: if the reference impl disagrees with a fixture, the fixture is not
// wrong by default. Per AUTHORING.md step 4, open an issue — either the
// spec is wrong, the impl is wrong, or the hand derivation is wrong.
//
// Disclosure for `verified_by`: the impl was run *before* these were
// authored, as probes to find which data-loss paths were already covered
// by the existing corpus. That is the reverse of AUTHORING.md's order.
// The expected values here were then re-derived from the spec text
// quoted per fixture, but honesty requires recording that the author had
// seen impl output first. Hence `verified_by: [spec-derivation,
// manual-script]` rather than a claim of blind authoring.

import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'conformance', 'fixtures');

const SHEET = 'Report';

/**
 * Each fixture: a template cell holding one expression, a source column,
 * and the hand-derived expected output cells.
 *
 * `cells` entries are [address, value, numFmt?].
 */
const FIXTURES_SPEC = [
  {
    dir: '162-data-loss-number-type-preserved',
    description:
      'A Number source value in a single-expression cell with no template format renders as a Number, not text.',
    // spec/evaluation.md "Cell Evaluation": "Single-expression cells
    // preserve the evaluated value type where possible."
    // spec/evaluation.md "Source Value Model": Excel "Number" -> XTL Number.
    // Therefore 1234.5 in, numeric 1234.5 out. Stage 1 is type-aware, so a
    // regression that emitted "1234.5" as text fails here.
    spec_section: 'evaluation.md "Cell Evaluation" (type preservation); evaluation.md "Source Value Model"',
    tags: ['data-loss', 'value-model', 'coercion'],
    header: 'Amount',
    template: [['A2', '{{ [Amount] }}']],
    data: [[1234.5], [678], [0.125]],
    expected: [
      ['A2', 1234.5],
      ['A3', 678],
      ['A4', 0.125],
    ],
  },
  {
    dir: '163-data-loss-zero-is-not-empty',
    description:
      'The Number 0 is not empty and renders as numeric 0, not as a blank cell.',
    // spec/evaluation.md "Empty Values": "Numbers, including `0`, are
    // never empty." Combined with type preservation, 0 must appear as the
    // number 0. Silent loss here would be a blank cell, which reads as
    // "no data" to an operator rather than "zero".
    spec_section: 'evaluation.md "Empty Values" (0 is never empty); evaluation.md "Cell Evaluation"',
    tags: ['data-loss', 'empty', 'value-model'],
    header: 'Balance',
    template: [['A2', '{{ [Balance] }}']],
    data: [[0], [-0.5], [7]],
    expected: [
      ['A2', 0],
      ['A3', -0.5],
      ['A4', 7],
    ],
  },
  {
    dir: '164-data-loss-leading-zero-string-stays-string',
    description:
      'A String source value that looks numeric keeps its String kind — a zero-padded identifier is not converted to a Number.',
    // spec/evaluation.md "Source Value Model": Excel "String / inline /
    // shared string" -> XTL String, and single-expression cells preserve
    // the value type. Nothing in the spec licenses parsing a String into
    // a Number when the template cell carries no numeric format — the
    // coercion rule is format-driven and this cell has no format.
    // "0001" must stay the four-character string. This is the classic
    // spreadsheet data loss: an account code silently becoming 1.
    spec_section: 'evaluation.md "Source Value Model" (String kind); evaluation.md "Cell Evaluation"',
    tags: ['data-loss', 'value-model'],
    header: 'AccountCode',
    template: [['A2', '{{ [AccountCode] }}']],
    data: [['0001'], ['00700'], ['1.50']],
    expected: [
      ['A2', '0001'],
      ['A3', '00700'],
      ['A4', '1.50'],
    ],
  },
  {
    dir: '165-data-loss-boolean-type-preserved',
    description:
      'A Boolean source value renders as a Boolean, and FALSE is not empty.',
    // spec/evaluation.md "Source Value Model": Excel "Boolean" -> XTL
    // Boolean. "Empty Values": "Booleans, including `false`, are never
    // empty." Stage 1 compares booleans as booleans and states that
    // "TRUE" (text) is NOT equal to TRUE (boolean), so a stringifying
    // regression fails here.
    spec_section: 'evaluation.md "Source Value Model" (Boolean kind); evaluation.md "Empty Values"',
    tags: ['data-loss', 'value-model', 'empty'],
    header: 'Active',
    template: [['A2', '{{ [Active] }}']],
    data: [[true], [false]],
    expected: [
      ['A2', true],
      ['A3', false],
    ],
  },
  {
    dir: '166-data-loss-percent-flows-as-underlying-number',
    description:
      'A percentage-formatted source cell flows as its underlying Number value, not as a formatted string.',
    // spec/evaluation.md "Source Value Model", verbatim: "A
    // percentage-formatted Excel cell flows as its underlying Number
    // value (50% -> `0.5`)." So a source cell displaying 50% yields the
    // number 0.5. Emitting "50%" as text would be the loss.
    spec_section: 'evaluation.md "Source Value Model" (percentage-formatted cells)',
    tags: ['data-loss', 'value-model', 'numfmt'],
    header: 'Rate',
    template: [['A2', '{{ [Rate] }}']],
    data: [[0.5, '0%'], [0.075, '0.0%']],
    expected: [
      ['A2', 0.5],
      ['A3', 0.075],
    ],
  },
  {
    dir: '167-data-loss-date-serial-nondate-format-is-number',
    description:
      'A date serial stored with a non-date number format flows as a Number, not silently promoted to a Date.',
    // spec/evaluation.md "Source Value Model", Excel-to-XTL table:
    // "Number (incl. dates stored as serials with non-date format) ->
    // Number". The kind is decided by the cell's format, not by whether
    // the number happens to fall in a plausible date range. Guessing
    // "45000 looks like a date" would corrupt a quantity into a date.
    spec_section: 'evaluation.md "Source Value Model" (serials with non-date format)',
    tags: ['data-loss', 'value-model', 'date'],
    header: 'Quantity',
    template: [['A2', '{{ [Quantity] }}']],
    data: [[45000], [1]],
    expected: [
      ['A2', 45000],
      ['A3', 1],
    ],
  },
  {
    dir: '168-data-loss-date-time-component-round-trip',
    description:
      'A Date source value carrying a time component round-trips to the same instant, not truncated to midnight.',
    // spec/evaluation.md "Source Value Model": "Date — A calendar
    // instant; may or may not carry a time component." A round trip that
    // dropped the time would change the instant. Stage 1 compares date
    // cells "on the date-time instant ... not on the host library's
    // rendering of it", so truncation to midnight fails here.
    // Instants are chosen in UTC; the corpus runs under TZ=UTC,
    // America/New_York and Asia/Seoul via `npm run conformance:tz`, so a
    // timezone-dependent shift fails in at least one of them.
    spec_section: 'evaluation.md "Source Value Model" (Date kind); ADR-0001 (UTC anchoring)',
    tags: ['data-loss', 'date', 'value-model'],
    header: 'Occurred',
    template: [['A2', '{{ [Occurred] }}', 'yyyy-mm-dd hh:mm:ss']],
    data: [
      [new Date(Date.UTC(2026, 4, 15, 13, 45, 30))],
      [new Date(Date.UTC(2026, 4, 15, 0, 0, 0))],
    ],
    expected: [
      ['A2', new Date(Date.UTC(2026, 4, 15, 13, 45, 30))],
      ['A3', new Date(Date.UTC(2026, 4, 15, 0, 0, 0))],
    ],
  },
  {
    dir: '169-data-loss-formula-cached-result-kind',
    description:
      "A source formula cell flows as its cached result's kind — a numeric result becomes a Number, not the formula text.",
    // spec/evaluation.md "Source Value Model": "Formula with cached
    // result -> The result's kind". Fixture 014 pins that the cached
    // result is used rather than recalculated; this one pins the *kind*,
    // which is the data-loss axis — emitting "=2*3" or "6" as text would
    // both be wrong.
    spec_section: 'evaluation.md "Source Value Model" (formula with cached result)',
    tags: ['data-loss', 'value-model', 'formula'],
    header: 'Total',
    template: [['A2', '{{ [Total] }}']],
    data: [[{ formula: '2*3', result: 6 }], [{ formula: '1/4', result: 0.25 }]],
    expected: [
      ['A2', 6],
      ['A3', 0.25],
    ],
  },
];

function writeConfig(wb, name) {
  const sh = wb.addWorksheet('__config__');
  const rows = [
    ['name', name],
    ['source_sheet', 'Data'],
    ['source_table', '1'],
    ['output_file_pattern', 'output.xlsx'],
  ];
  rows.forEach(([k, v], i) => {
    sh.getCell(`A${i + 1}`).value = k;
    sh.getCell(`B${i + 1}`).value = v;
  });
}

function put(sh, [ref, value, numFmt]) {
  sh.getCell(ref).value = value;
  if (numFmt) sh.getCell(ref).numFmt = numFmt;
}

async function build(spec) {
  const dir = join(FIXTURES, spec.dir);
  await mkdir(dir, { recursive: true });

  // template.xlsx — header row plus the single-expression body row.
  const tpl = new ExcelJS.Workbook();
  writeConfig(tpl, spec.dir.replace(/^\d+-/, ''));
  const ts = tpl.addWorksheet(SHEET);
  ts.getCell('A1').value = spec.header;
  spec.template.forEach((c) => put(ts, c));
  await writeFile(join(dir, 'template.xlsx'), Buffer.from(await tpl.xlsx.writeBuffer()));

  // data.xlsx — one source column.
  const data = new ExcelJS.Workbook();
  const ds = data.addWorksheet('Data');
  ds.getCell('A1').value = spec.header;
  spec.data.forEach(([value, numFmt], i) => {
    const cell = ds.getCell(`A${i + 2}`);
    cell.value = value;
    if (numFmt) cell.numFmt = numFmt;
  });
  await writeFile(join(dir, 'data.xlsx'), Buffer.from(await data.xlsx.writeBuffer()));

  // expected.xlsx — hand-derived literals only. Not impl output.
  const exp = new ExcelJS.Workbook();
  const es = exp.addWorksheet(SHEET);
  es.getCell('A1').value = spec.header;
  spec.expected.forEach((c) => put(es, c));
  await writeFile(join(dir, 'expected.xlsx'), Buffer.from(await exp.xlsx.writeBuffer()));

  const meta = [
    `description: ${JSON.stringify(spec.description)}`,
    `spec_section: ${JSON.stringify(spec.spec_section)}`,
    'spec_version: "0.1"',
    `tags: [${spec.tags.join(', ')}]`,
    'verified_by: [spec-derivation, manual-script]',
    '',
  ].join('\n');
  await writeFile(join(dir, 'meta.yaml'), meta);

  console.log(`  wrote ${spec.dir}`);
}

console.log(`authoring ${FIXTURES_SPEC.length} data-loss fixtures`);
for (const spec of FIXTURES_SPEC) await build(spec);
console.log('done — now run `npm run conformance` and treat any failure as a finding, not a fixture bug');
