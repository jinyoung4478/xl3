import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { xtlError } from './error-codes.js';
import type { XtlWarning } from './types.js';

/**
 * Fixed timestamp written into every output zip entry.
 *
 * ExcelJS appends entries to its zip without a `date`, so the zip layer
 * fills in `new Date()` per entry. That made two renders of identical
 * inputs differ in raw bytes whenever they straddled a DOS-timestamp
 * tick — the workbook content was identical, but "same inputs, same
 * bytes" was not literally true.
 *
 * Deliberately **not** `SOURCE_DATE_EPOCH`, which
 * `scripts/deterministic-xlsx.mjs` honors for build-time asset
 * generation. That convention is right for a build; it is wrong here.
 * A library that read the environment would produce different bytes on
 * a host that happens to set the variable — the opposite of
 * STABILITY.md's promise that output does not depend on the host.
 *
 * 1980-01-01 is the earliest date the DOS timestamp field can encode:
 * the conventional "no meaningful timestamp" marker in reproducible
 * builds, and unmistakably not a real modification time.
 *
 * Document timestamps (`docProps/core.xml`) are left alone. They come
 * from the template and are preserved workbook properties (ADR-0032,
 * fixture 120-workbook-properties-preserved); rewriting them would
 * trade one determinism problem for a preservation bug.
 */
export const ZIP_ENTRY_DATE = new Date('1980-01-01T00:00:00Z');

/**
 * Rewrite every zip entry's mod-time to a fixed value. JSZip carries
 * already-compressed entries through rather than recompressing them, so
 * this is a header rewrite: measured at 2-7 ms from 10k to 500k cells,
 * against ~12.5 s for a 2M-cell render.
 */
async function pinZipEntryDates(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buf);
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry) entry.date = ZIP_ENTRY_DATE;
  }
  // `uint8array`, not `arraybuffer`, to keep the runtime shape callers
  // already had. ExcelJS returns a Buffer under Node and a Uint8Array in
  // the browser — both `instanceof Uint8Array`, both indexable — and
  // `OutputFile.data` has always been that value cast to `ArrayBuffer`.
  // Returning a real ArrayBuffer here broke the IIFE bundle smoke test,
  // which indexes `data[0]` to check the PK header. Changing the declared
  // type instead would be a public-surface break (G6).
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  }) as unknown as Promise<ArrayBuffer>;
}

export interface WorkbookDocument {
  removeAuxiliarySheets(): void;
  getWorksheet(name: string): ExcelJS.Worksheet | undefined;
  hasWorksheet(name: string): boolean;
  removeWorksheet(name: string): void;
  cloneWorksheet(sourceName: string, targetName: string): ExcelJS.Worksheet | undefined;
  spliceRowsPreservingMerges(
    sheet: ExcelJS.Worksheet,
    start: number,
    deleteCount: number,
    rows?: unknown[][],
  ): void;
  writeBuffer(): Promise<ArrayBuffer>;
}

export class ExcelJsWorkbookDocument implements WorkbookDocument {
  private workbook: ExcelJS.Workbook;

  private constructor(workbook: ExcelJS.Workbook) {
    this.workbook = workbook;
  }

  static async fromTemplate(templateWorkbook: ExcelJS.Workbook): Promise<ExcelJsWorkbookDocument> {
    const buf = await templateWorkbook.xlsx.writeBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);
    return new ExcelJsWorkbookDocument(workbook);
  }

  removeAuxiliarySheets() {
    // ADR-0011: reserved sheets are dunder-wrapped (`__config__`,
    // `__inputs__`, `__sources__`, `__lists__`). Pre-ADR-0011 templates
    // also used a leading-underscore convention, but those names are no
    // longer spec-legal — author-created `__name__` and `_name` sheets
    // are rejected at parse time, so anything matching here is one of
    // the four reserved dunders that should not appear in output.
    for (const ws of [...this.workbook.worksheets]) {
      if (/^__[a-z]+__$/.test(ws.name)) {
        this.workbook.removeWorksheet(ws.id);
      }
    }
  }

  getWorksheet(name: string) {
    return this.workbook.getWorksheet(name);
  }

  hasWorksheet(name: string) {
    return Boolean(this.workbook.getWorksheet(name));
  }

  removeWorksheet(name: string) {
    const sheet = this.workbook.getWorksheet(name);
    if (sheet) this.workbook.removeWorksheet(sheet.id);
  }

  cloneWorksheet(sourceName: string, targetName: string) {
    const srcSheet = this.workbook.getWorksheet(sourceName);
    if (!srcSheet) return undefined;

    // Forward sheet-level properties (defaultRowHeight, defaultColWidth, …)
    // and views so empty rows render at the same default height as the
    // template instead of Excel's hardcoded 15.
    const newSheet = this.workbook.addWorksheet(targetName, {
      properties: srcSheet.properties ? { ...srcSheet.properties } : undefined,
      pageSetup: srcSheet.pageSetup ? { ...srcSheet.pageSetup } : undefined,
      views: srcSheet.views ? srcSheet.views.map((v) => ({ ...v })) : undefined,
    });
    copyWorksheet(srcSheet, newSheet);
    return newSheet;
  }

  spliceRowsPreservingMerges(
    sheet: ExcelJS.Worksheet,
    start: number,
    deleteCount: number,
    rows: unknown[][] = [],
  ) {
    const rowDelta = rows.length - deleteCount;
    const preserveFromRow = deleteCount > 0 ? start + deleteCount : start;
    const saved = saveMergesFromRow(sheet, preserveFromRow);
    for (const merge of saved) {
      try { sheet.unMergeCells(merge.top, merge.left, merge.bottom, merge.right); } catch { /* ok */ }
    }

    // ADR-0040: outline-level is preservation matrix entry "P". ExcelJS
    // spliceRows rebuilds row metadata on shifted rows, so capture
    // outline-levels for rows >= preserveFromRow before splicing and
    // restore them on the post-shift row numbers.
    const savedOutlineLevels = saveOutlineLevelsFromRow(sheet, preserveFromRow);

    spliceRowsChunked(sheet, start, deleteCount, rows);

    for (const merge of saved) {
      try {
        sheet.mergeCells(
          merge.top + rowDelta,
          merge.left,
          merge.bottom + rowDelta,
          merge.right,
        );
      } catch { /* overlap guard */ }
    }

    for (const [rowNum, level] of savedOutlineLevels) {
      const target = sheet.getRow(rowNum + rowDelta);
      target.outlineLevel = level;
    }
  }

  async writeBuffer(): Promise<ArrayBuffer> {
    const buf = await this.workbook.xlsx.writeBuffer() as ArrayBuffer;
    return pinZipEntryDates(buf);
  }
}

// `fn(...arr)` is subject to the engine's argument-count limit (V8 caps
// around 64k); large data blocks (80k+ source rows) used to overflow the
// call stack inside ExcelJS `spliceRows`. Insert in bounded chunks instead
// of one giant spread. Chunks are appended in ascending order, so each
// insertion only shifts the (small) tail below the block once per chunk.
const SPLICE_CHUNK = 2_000;

function spliceRowsChunked(
  sheet: ExcelJS.Worksheet,
  start: number,
  deleteCount: number,
  rows: unknown[][],
) {
  if (rows.length <= SPLICE_CHUNK) {
    sheet.spliceRows(start, deleteCount, ...rows);
    return;
  }
  sheet.spliceRows(start, deleteCount, ...rows.slice(0, SPLICE_CHUNK));
  for (let i = SPLICE_CHUNK; i < rows.length; i += SPLICE_CHUNK) {
    // ExcelJS insertRows spreads internally too — keep chunks bounded.
    sheet.insertRows(start + i, rows.slice(i, i + SPLICE_CHUNK));
  }
}

interface MergeRect { top: number; left: number; bottom: number; right: number }

function saveOutlineLevelsFromRow(
  sheet: ExcelJS.Worksheet,
  fromRow: number,
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  const lastRow = sheet.actualRowCount;
  for (let r = fromRow; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    if (row.outlineLevel && row.outlineLevel > 0) {
      result.push([r, row.outlineLevel]);
    }
  }
  return result;
}

function saveMergesFromRow(sheet: ExcelJS.Worksheet, fromRow: number): MergeRect[] {
  const result: MergeRect[] = [];
  const merges = sheet.model.merges ?? [];
  for (const merge of merges) {
    const decoded = decodeMerge(merge as string);
    if (decoded && decoded.top >= fromRow) result.push(decoded);
  }
  return result;
}

function decodeMerge(ref: string): MergeRect | null {
  const parts = ref.split(':');
  if (parts.length !== 2) return null;
  const topLeft = decodeCell(parts[0]!);
  const bottomRight = decodeCell(parts[1]!);
  if (!topLeft || !bottomRight) return null;
  return {
    top: topLeft.row,
    left: topLeft.col,
    bottom: bottomRight.row,
    right: bottomRight.col,
  };
}

function decodeCell(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let col = 0;
  for (const ch of match[1]!) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: Number(match[2]), col };
}

// ADR-0002: Output filename sanitization.
//
// The rules are spec-normative (see spec/evaluation.md "Output Filenames" and
// spec/decisions/0002-filename-sanitization.md). Steps 1-3 transform the
// filename; steps 4-5 are error conditions.
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export interface SanitizedFilename {
  filename: string;
  changed: boolean;
  warnings: XtlWarning[];
}

export function sanitizeFilename(rendered: string): SanitizedFilename {
  // 1. Replace forbidden characters with `_`.
  let s = rendered.replace(FORBIDDEN_FILENAME_CHARS, '_');

  // 2. Trim leading/trailing whitespace and trailing dots.
  s = s.replace(/^\s+/, '').replace(/[\s.]+$/, '');

  // Split into basename + extension. A leading "." with no other dot means
  // the basename is empty (e.g., ".xlsx" — invalid output filename).
  const splitFilename = (input: string): { base: string; ext: string } => {
    const lastDot = input.lastIndexOf('.');
    if (lastDot > 0) return { base: input.slice(0, lastDot), ext: input.slice(lastDot) };
    if (lastDot === 0) return { base: '', ext: input };
    return { base: input, ext: '' };
  };

  // 3. Reserved name guard on the basename.
  const { base, ext } = splitFilename(s);
  if (RESERVED_DEVICE_NAMES.has(base.toUpperCase())) {
    s = base + '_' + ext;
  }

  // 4. Empty filename or empty basename → error.
  const finalParts = splitFilename(s);
  if (s === '' || finalParts.base === '') {
    throw xtlError(
      'xl3/filename/empty',
      `Output filename "${rendered}" sanitized to an empty string and is invalid.`,
    );
  }

  // 5. Length cap (UTF-8 bytes).
  const byteLen = new TextEncoder().encode(s).length;
  if (byteLen > 255) {
    throw xtlError(
      'xl3/filename/too-long',
      `Output filename "${s}" is ${byteLen} bytes; exceeds the 255-byte limit.`,
    );
  }

  const warnings: XtlWarning[] = s !== rendered
    ? [{
        code: 'xl3w/filename/sanitized',
        message: `Output filename "${rendered}" sanitized to "${s}"`,
        location: s,
      }]
    : [];
  return { filename: s, changed: s !== rendered, warnings };
}

export function sanitizeSheetName(name: string): string {
  // Excel forbids ` : \ / ? * [ ] ` in sheet names. Map brackets to parens so
  // labels like "[SNF]SOOP_xxx" render as "(SNF)SOOP_xxx" instead of being
  // mangled into "_SNF_SOOP_xxx".
  let s = name
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/[:\\/?*]/g, '_');
  if ([...s].length > 31) s = [...s].slice(0, 31).join('');
  return s || 'Sheet';
}

function copyWorksheet(src: ExcelJS.Worksheet, dst: ExcelJS.Worksheet) {
  src.columns.forEach((col, i) => {
    if (col.width) {
      const dstCol = dst.getColumn(i + 1);
      dstCol.width = col.width;
    }
  });

  src.eachRow({ includeEmpty: true }, (srcRow, rowNumber) => {
    const dstRow = dst.getRow(rowNumber);
    // Only copy explicit heights — leave undefined rows alone so Excel falls
    // back to the worksheet's defaultRowHeight (which we forwarded above).
    if (srcRow.height !== undefined) dstRow.height = srcRow.height;
    // ADR-0040: outline level preservation (P) — copy verbatim per row.
    if (srcRow.outlineLevel !== undefined && srcRow.outlineLevel > 0) {
      dstRow.outlineLevel = srcRow.outlineLevel;
    }

    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = srcCell.value;
      if (srcCell.style) dstCell.style = { ...srcCell.style };
    });

    dstRow.commit();
  });

  src.model.merges?.forEach((merge) => {
    dst.mergeCells(merge);
  });

  // Copy images. Both sheets share the same workbook,
  // so we reuse the existing imageId in the workbook's media collection.
  const images = src.getImages?.() ?? [];
  for (const img of images) {
    const imageId = Number(img.imageId);
    if (Number.isNaN(imageId)) continue;
    dst.addImage(imageId, img.range);
  }
}
