import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { canonicalizeXlsx, comparable, formatTextReport, parseMeta } from '../conformance-runner.js';

describe('parseMeta', () => {
  it('reads required scalar fields', () => {
    const text = `
description: A short description
spec_section: language.md "Source Columns"
spec_version: "0.1"
tags: [substitution, basic]
verified_by: [manual-script]
`;
    expect(parseMeta(text)).toEqual({
      description: 'A short description',
      spec_section: 'language.md "Source Columns"',
      spec_version: '0.1',
      tags: ['substitution', 'basic'],
      verified_by: ['manual-script'],
      expected_warnings: [],
      dynamic_cells: [],
      comparison_stage: 1,
      inputs: [],
    });
  });

  it('parses inputs as a list of name/value entries', () => {
    const text = `
description: x
inputs:
  - name: month
    value: "2026-05"
  - name: region
    value: Seoul
`;
    expect(parseMeta(text).inputs).toEqual([
      { name: 'month', value: '2026-05' },
      { name: 'region', value: 'Seoul' },
    ]);
  });

  it('strips matching outer quotes from values', () => {
    expect(parseMeta(`description: "quoted desc"\nspec_version: '0.2'`)).toMatchObject({
      description: 'quoted desc',
      spec_version: '0.2',
    });
  });

  it('parses skip_reason when present', () => {
    const meta = parseMeta(`description: x\nskip_reason: needs canonicalization runner`);
    expect(meta.skip_reason).toBe('needs canonicalization runner');
  });

  it('parses expected_error when present', () => {
    const meta = parseMeta(`description: x\nexpected_error: "Source sheet"`);
    expect(meta.expected_error).toBe('Source sheet');
  });

  it('parses expected_dynamic and dynamic cell assertions', () => {
    const meta = parseMeta(`
description: today
expected_dynamic: utc_today
dynamic_cells:
  - sheet: R
    cell: A2
    format: YYYY-MM-DD
`);
    expect(meta.expected_dynamic).toBe('utc_today');
    expect(meta.dynamic_cells).toEqual([
      { sheet: 'R', cell: 'A2', format: 'YYYY-MM-DD' },
    ]);
  });

  it('parses comparison_stage with default 1', () => {
    expect(parseMeta(`description: x`).comparison_stage).toBe(1);
    expect(parseMeta(`description: x\ncomparison_stage: 2`).comparison_stage).toBe(2);
  });

  it('parses inline string lists with trimmed items', () => {
    const meta = parseMeta(`tags: [a , b,c , d]`);
    expect(meta.tags).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns empty arrays for empty inline lists', () => {
    expect(parseMeta(`tags: []`).tags).toEqual([]);
  });

  it('ignores blank lines and comments', () => {
    const text = `
# leading comment
description: desc  # inline comment
tags: [a, b]

`;
    expect(parseMeta(text)).toMatchObject({
      description: 'desc',
      tags: ['a', 'b'],
    });
  });

  it('ignores unknown keys without throwing', () => {
    expect(() => parseMeta(`unknown_key: 123\ndescription: ok`)).not.toThrow();
  });
});

describe('canonicalizeXlsx', () => {
  it('normalizes generated sheet part names and default page setup noise', async () => {
    const first = await workbookZip({
      sheetId: 1,
      sheetPart: 'sheet1.xml',
      pageSetupAttrs: '',
    });
    const second = await workbookZip({
      sheetId: 7,
      sheetPart: 'sheet9.xml',
      pageSetupAttrs: ' copies="1" firstPageNumber="1" useFirstPageNumber="1"',
    });

    expect(await canonicalizeXlsx(first)).toEqual(await canonicalizeXlsx(second));
  });

  it('treats `<x></x>` and `<x/>` as equivalent', async () => {
    const a = await singleXmlZip('part.xml', '<root><x/></root>');
    const b = await singleXmlZip('part.xml', '<root><x></x></root>');
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('treats `<x attrs></x>` and `<x attrs/>` as equivalent', async () => {
    const a = await singleXmlZip('part.xml', '<root><x a="1" b="2"/></root>');
    const b = await singleXmlZip('part.xml', '<root><x b="2" a="1"></x></root>');
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('treats reordered attributes as equivalent', async () => {
    const a = await singleXmlZip('part.xml', '<root><x a="1" b="2"/></root>');
    const b = await singleXmlZip('part.xml', '<root><x b="2" a="1"/></root>');
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('normalizes single-quoted attribute values to double-quoted', async () => {
    const a = await singleXmlZip('part.xml', `<root><x a="1"/></root>`);
    const b = await singleXmlZip('part.xml', `<root><x a='1'/></root>`);
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('ignores XML declarations and prolog whitespace', async () => {
    const a = await singleXmlZip('part.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<root><x a="1"/></root>`);
    const b = await singleXmlZip('part.xml', `<root><x a="1"/></root>`);
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('parses tag delimiters without splitting on `>` inside quoted attributes', async () => {
    const a = await singleXmlZip('part.xml', `<root><x a="1 &gt; 0" b="2"/></root>`);
    const b = await singleXmlZip('part.xml', `<root><x b='2' a='1 &gt; 0'></x></root>`);
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('drops insignificant whitespace inside closing tags', async () => {
    const a = await singleXmlZip('part.xml', '<root><x>1</x></root>');
    const b = await singleXmlZip('part.xml', '<root><x>1</x   ></root>');
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
  });

  it('preserves real text differences', async () => {
    const a = await singleXmlZip('part.xml', '<root><x>1</x></root>');
    const b = await singleXmlZip('part.xml', '<root><x>2</x></root>');
    expect(await canonicalizeXlsx(a)).not.toEqual(await canonicalizeXlsx(b));
  });

  it('preserves whitespace-only content (does not collapse `<x> </x>`)', async () => {
    const a = await singleXmlZip('part.xml', '<root><x> </x></root>');
    const b = await singleXmlZip('part.xml', '<root><x/></root>');
    expect(await canonicalizeXlsx(a)).not.toEqual(await canonicalizeXlsx(b));
  });

  it('preserves real attribute value differences', async () => {
    const a = await singleXmlZip('part.xml', '<root><x a="1"/></root>');
    const b = await singleXmlZip('part.xml', '<root><x a="2"/></root>');
    expect(await canonicalizeXlsx(a)).not.toEqual(await canonicalizeXlsx(b));
  });

  it('strips volatile calcId regardless of writer quote style', async () => {
    const dq = await singleXmlZip('part.xml', '<root><calcPr calcId="123" iterate="1"/></root>');
    const sq = await singleXmlZip('part.xml', `<root><calcPr calcId='999' iterate='1'/></root>`);
    expect(await canonicalizeXlsx(dq)).toEqual(await canonicalizeXlsx(sq));
  });

  it('strips volatile sheetId regardless of writer quote style', async () => {
    const dq = await singleXmlZip('part.xml', '<root><sheet name="R" sheetId="1"/></root>');
    const sq = await singleXmlZip('part.xml', `<root><sheet name='R' sheetId='42'/></root>`);
    expect(await canonicalizeXlsx(dq)).toEqual(await canonicalizeXlsx(sq));
  });

  it('strips default page setup attributes regardless of writer quote style', async () => {
    const dq = await singleXmlZip('part.xml', '<root><pageSetup fitToWidth="1" copies="1" firstPageNumber="1" useFirstPageNumber="1"/></root>');
    const sq = await singleXmlZip('part.xml', `<root><pageSetup fitToWidth='1' copies='1' firstPageNumber='1' useFirstPageNumber='1'/></root>`);
    expect(await canonicalizeXlsx(dq)).toEqual(await canonicalizeXlsx(sq));
  });

  it('strips volatile core properties without touching stable core metadata', async () => {
    const a = await singleXmlZip(
      'docProps/core.xml',
      '<cp:coreProperties><dc:title>Report</dc:title><dc:creator>A</dc:creator><cp:lastModifiedBy>A</cp:lastModifiedBy></cp:coreProperties>',
    );
    const b = await singleXmlZip(
      'docProps/core.xml',
      '<cp:coreProperties><dc:title>Report</dc:title><dc:creator>B</dc:creator><cp:lastModifiedBy>B</cp:lastModifiedBy></cp:coreProperties>',
    );
    const c = await singleXmlZip(
      'docProps/core.xml',
      '<cp:coreProperties><dc:title>Invoice</dc:title><dc:creator>B</dc:creator><cp:lastModifiedBy>B</cp:lastModifiedBy></cp:coreProperties>',
    );
    expect(await canonicalizeXlsx(a)).toEqual(await canonicalizeXlsx(b));
    expect(await canonicalizeXlsx(a)).not.toEqual(await canonicalizeXlsx(c));
  });
});

async function singleXmlZip(name: string, content: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(name, content);
  const data = await zip.generateAsync({ type: 'uint8array' });
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function workbookZip(opts: {
  sheetId: number;
  sheetPart: string;
  pageSetupAttrs: string;
}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/${opts.sheetPart}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="R" sheetId="${opts.sheetId}" r:id="rId1"/></sheets>
  <calcPr calcId="123"/>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${opts.sheetPart}"/>
</Relationships>`);
  zip.file(`xl/worksheets/${opts.sheetPart}`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData>
  <pageSetup fitToWidth="1"${opts.pageSetupAttrs}/>
</worksheet>`);
  const data = await zip.generateAsync({ type: 'uint8array' });
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

describe('formatTextReport', () => {
  it('shows the run stage and fixture comparison stage', () => {
    const text = formatTextReport({
      implementation: 'xl3-js',
      version: '0.1.0-alpha.0',
      spec_version: '0.1',
      comparison_stage: 2,
      results: [
        {
          fixture: '024-stage2-merge-preservation',
          status: 'pass',
          duration_ms: 1,
          comparison_stage: 2,
        },
      ],
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        errored: 0,
        skipped: 0,
      },
    });

    expect(text).toContain('XTL 0.1 — Stage 2');
    expect(text).toContain('024-stage2-merge-preservation [stage 2]');
  });
});

// #92 — Stage 1 comparison must be kind-aware. runner-protocol.md:
// "A text cell never equals a number, boolean, or date cell, even when
// their display forms coincide" and "a runner that stringifies both sides
// before comparing MUST NOT claim Stage 1 conformance."
//
// Every canonical form used to collapse to a bare string, so a text cell
// holding that same string compared equal to the real thing. These pin
// each impostor apart. Regression guard for the data-loss group (162-169),
// four of which depend on it.
describe('comparable — cell kinds cannot impersonate each other (#92)', () => {
  const iso = '2026-05-15T13:45:30.000Z';

  it('a date cell does not equal a text cell holding its ISO form', () => {
    expect(comparable(new Date(iso))).not.toBe(comparable(iso));
  });

  it('a formula cell does not equal a text cell holding its formula text', () => {
    expect(comparable({ formula: 'SUM(A1)', result: 1 })).not.toBe(comparable('=SUM(A1)'));
  });

  it('an error cell does not equal a text cell holding the error code', () => {
    // The reachable case: ADR-0025 has the engine substitute the literal
    // "#DIV/0!" into mixed-text cells, so this pair really does occur.
    expect(comparable({ error: '#DIV/0!' })).not.toBe(comparable('#DIV/0!'));
  });

  it('a hyperlink cell does not equal a text cell holding its canonical form', () => {
    const cell = { text: 'xl3', hyperlink: 'https://xl3.io' };
    expect(comparable(cell)).not.toBe(comparable('HYPERLINK("https://xl3.io","xl3")'));
  });

  it('a shared-formula cell does not equal a text cell holding its canonical form', () => {
    expect(comparable({ sharedFormula: 'E2', result: 3 })).not.toBe(comparable('=shared:E2'));
  });

  it('keeps numbers and booleans native so 1 never equals "1"', () => {
    expect(comparable(1)).toBe(1);
    expect(comparable(1)).not.toBe(comparable('1'));
    expect(comparable(true)).toBe(true);
    expect(comparable(true)).not.toBe(comparable('TRUE'));
    // protocol: "Numeric equality is value-based: 1 equals 1.0"
    expect(comparable(1)).toBe(comparable(1.0));
  });

  it('still matches like kinds to like', () => {
    expect(comparable(new Date(iso))).toBe(comparable(new Date(iso)));
    expect(comparable('abc')).toBe(comparable('abc'));
    expect(comparable({ formula: 'A1+1', result: 2 })).toBe(
      comparable({ formula: 'A1+1', result: 99 }),
    ); // ADR-0046: formula text is the contract, cached result is not
  });

  it('treats rich text as equal to plain text of the same content', () => {
    // Intended, not a collision: the protocol compares rich-text cells
    // "by their concatenated text".
    expect(comparable({ richText: [{ text: 'ab' }, { text: 'c' }] })).toBe(comparable('abc'));
  });
});
