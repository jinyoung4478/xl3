import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { ExcelJsWorkbookDocument, sanitizeFilename, ZIP_ENTRY_DATE } from '../excel-document.js';

async function documentWithMergedSheet(mergeRef: string) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('R');
  sheet.getCell('A1').value = 'Header';
  sheet.getCell('A2').value = 'Data';
  sheet.getCell('A3').value = 'Footer';
  sheet.mergeCells(mergeRef);
  const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);
  const rendered = doc.getWorksheet('R');
  if (!rendered) throw new Error('missing test worksheet');
  return { doc, sheet: rendered };
}

function merges(sheet: ExcelJS.Worksheet): string[] {
  return [...(sheet.model.merges ?? [])].sort();
}

describe('ExcelJsWorkbookDocument.spliceRowsPreservingMerges', () => {
  it('shifts merges below inserted rows', async () => {
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');

    doc.spliceRowsPreservingMerges(sheet, 3, 0, [[]]);

    expect(merges(sheet)).toEqual(['A4:B4']);
  });

  it('shifts merges below deleted rows', async () => {
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');

    doc.spliceRowsPreservingMerges(sheet, 2, 1);

    expect(merges(sheet)).toEqual(['A2:B2']);
  });

  it('inserts blocks past the engine spread limit without overflowing', async () => {
    // Regression: 80k+ row blocks used to crash with "Maximum call stack
    // size exceeded" — `spliceRows(start, del, ...rows)` spreads the whole
    // block as call arguments. Now inserted in bounded chunks.
    const { doc, sheet } = await documentWithMergedSheet('A3:B3');
    const count = 150_000;

    doc.spliceRowsPreservingMerges(sheet, 3, 0, Array(count).fill([]));

    expect(sheet.rowCount).toBeGreaterThanOrEqual(count + 3);
    expect(merges(sheet)).toEqual([`A${3 + count}:B${3 + count}`]);
  });
});

describe('sanitizeFilename', () => {
  it('returns a warning when sanitization changes the rendered name', () => {
    expect(sanitizeFilename('Acme:North.xlsx')).toEqual({
      filename: 'Acme_North.xlsx',
      changed: true,
      warnings: [{
        code: 'xl3w/filename/sanitized',
        message: 'Output filename "Acme:North.xlsx" sanitized to "Acme_North.xlsx"',
        location: 'Acme_North.xlsx',
      }],
    });
  });
});

describe('output determinism', () => {
  // Two renders of identical inputs used to differ in raw bytes: ExcelJS
  // appends zip entries without a date, so the zip layer stamped
  // `new Date()` per entry and the output moved whenever a render crossed
  // a DOS-timestamp tick. `writeBuffer` pins every entry instead.
  //
  // Asserted on the entry dates rather than by rendering twice and
  // comparing: two renders inside one test finish in the same millisecond,
  // so a byte comparison would pass even with the pin removed. This
  // assertion fails the moment it is.
  it('stamps every zip entry with the fixed date, not the clock', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('R').getCell('A1').value = 'x';
    const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);

    const zip = await JSZip.loadAsync(await doc.writeBuffer());
    const names = Object.keys(zip.files);
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      expect(zip.files[name]!.date.getTime(), `entry ${name}`).toBe(ZIP_ENTRY_DATE.getTime());
    }
  });

  it('renders the same bytes for the same input', async () => {
    async function render(): Promise<ArrayBuffer> {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('R').getCell('A1').value = 'x';
      const doc = await ExcelJsWorkbookDocument.fromTemplate(wb);
      return doc.writeBuffer();
    }

    expect(new Uint8Array(await render())).toEqual(new Uint8Array(await render()));
  });
});
