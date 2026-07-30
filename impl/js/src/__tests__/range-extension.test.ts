import { describe, expect, it } from 'vitest';
import { extendSqref, parseSqref, replicatedRowsFor } from '../range-extension.js';

// ADR-0040 § "Extension rule for CF and DV `sqref` ranges", clause by clause.
// ROADMAP gate G5.
//
// The scenario throughout: a one-row @repeat block on template row 2 that
// expands to three output rows, so blockStart = blockEnd = 2 and delta = 2.

const BLOCK_START = 2;
const BLOCK_END = 2;
const DELTA = 2;

const ext = (ref: string, s = BLOCK_START, e = BLOCK_END, d = DELTA) =>
  extendSqref(ref, s, e, d);

describe('parseSqref', () => {
  it('reads a single cell as a one-row span', () => {
    expect(parseSqref('A2')).toEqual([
      { startRow: 2, endRow: 2, coversAllRows: false, raw: 'A2' },
    ]);
  });

  it('reads a range and ignores its columns', () => {
    const [r] = parseSqref('A2:C5');
    expect(r).toMatchObject({ startRow: 2, endRow: 5, coversAllRows: false });
  });

  it('normalizes a reversed range', () => {
    expect(parseSqref('A5:A2')[0]).toMatchObject({ startRow: 2, endRow: 5 });
  });

  it('treats a whole-column reference as covering all rows', () => {
    expect(parseSqref('C:C')[0]!.coversAllRows).toBe(true);
    expect(parseSqref('$A:$A')[0]!.coversAllRows).toBe(true);
  });

  it("treats Excel's max-row idiom as covering all rows", () => {
    expect(parseSqref('A2:A1048576')[0]!.coversAllRows).toBe(true);
  });

  it('splits a multi-range sqref on whitespace (rule 4)', () => {
    expect(parseSqref('A2:A5 C2:C5').map((r) => r.raw)).toEqual(['A2:A5', 'C2:C5']);
  });

  it('marks an unparseable sub-range as covering all rows so callers skip it', () => {
    // ADR-0040 § "Error catalog": an unapplied extension is a silent no-op.
    expect(parseSqref('not-a-ref')[0]!.coversAllRows).toBe(true);
  });
});

describe('extendSqref — rule 1.1, fully contained ranges extend', () => {
  it('extends a single cell into a range', () => {
    expect(ext('A2')).toMatchObject({ ref: 'A2:A4', changed: true });
  });

  it('extends a range whose span equals the block', () => {
    expect(ext('A2:A2')).toMatchObject({ ref: 'A2:A4', changed: true });
  });

  it('extends a multi-column range, leaving columns alone (rule 2)', () => {
    expect(ext('A2:C2').ref).toBe('A2:C4');
  });

  it('extends a two-row block by its own delta', () => {
    // Template rows 2-3 (a 2-row record) expanding to 6 rows: delta = 4.
    expect(ext('A2:A3', 2, 3, 4).ref).toBe('A2:A7');
  });

  it('preserves absolute markers', () => {
    expect(ext('$A$2:$A$2').ref).toBe('$A$2:$A$4');
  });

  it('extends a whole-row reference contained in the block', () => {
    expect(ext('2:2').ref).toBe('2:4');
  });
});

describe('extendSqref — rule 1.2, everything else is left as authored', () => {
  it('leaves a range entirely above the block', () => {
    expect(ext('A1:A1')).toMatchObject({ ref: 'A1:A1', changed: false });
  });

  it('leaves a range entirely below the block', () => {
    // The row it points at moves, but ADR-0036 row 1 makes non-shifting the
    // documented stance for anchors; extension is the only rewrite in scope.
    expect(ext('A4:A4')).toMatchObject({ ref: 'A4:A4', changed: false });
  });

  it('leaves a range that overlaps the block only partly, and flags it', () => {
    const r = ext('A1:A2');
    expect(r.ref).toBe('A1:A2');
    expect(r.changed).toBe(false);
    expect(r.partialOverlap).toBe(true);
  });

  it('flags an overlap that starts inside the block and runs past it', () => {
    expect(ext('A2:A9').partialOverlap).toBe(true);
  });

  it('does not flag a range that never touches the block', () => {
    expect(ext('A7:A9').partialOverlap).toBe(false);
  });
});

describe('extendSqref — rule 3, references that already cover everything', () => {
  it('leaves a whole-column reference alone', () => {
    expect(ext('C:C')).toMatchObject({ ref: 'C:C', changed: false });
  });

  it("leaves Excel's max-row idiom alone", () => {
    expect(ext('A2:A1048576')).toMatchObject({ changed: false });
  });
});

describe('extendSqref — rule 4, multi-range sqref is processed per sub-range', () => {
  it('extends the contained sub-ranges and leaves the rest', () => {
    const r = ext('A2:A2 C2:C2 E9:E9');
    expect(r.ref).toBe('A2:A4 C2:C4 E9:E9');
    expect(r.changed).toBe(true);
  });

  it('mixes a whole-column sub-range in without disturbing it', () => {
    expect(ext('A2 D:D').ref).toBe('A2:A4 D:D');
  });
});

describe('extendSqref — degenerate inputs are no-ops, never throws', () => {
  it('returns the input when delta is zero', () => {
    expect(ext('A2:A2', 2, 2, 0)).toMatchObject({ ref: 'A2:A2', changed: false });
  });

  it('returns the input when delta is negative', () => {
    expect(ext('A2:A2', 2, 2, -3).changed).toBe(false);
  });

  it('handles an empty sqref', () => {
    expect(ext('')).toMatchObject({ ref: '', changed: false });
  });

  it('leaves an unparseable sqref untouched', () => {
    expect(ext('garbage')).toMatchObject({ ref: 'garbage', changed: false });
  });
});

describe('replicatedRowsFor — ExcelJS models data validations per cell', () => {
  it('lists the rows an expansion added, for a one-row block', () => {
    expect(replicatedRowsFor(2, 2, 2, 2)).toEqual([3, 4]);
  });

  it('steps by the template row count for a multi-row record', () => {
    // Template rows 2-3, expanding to 6 output rows (3 records): delta = 4.
    // A validation on template row 2 recurs on 4 and 6; one on row 3 on 5 and 7.
    expect(replicatedRowsFor(2, 2, 3, 4)).toEqual([4, 6]);
    expect(replicatedRowsFor(3, 2, 3, 4)).toEqual([5, 7]);
  });

  it('does not replicate a validation outside the block', () => {
    expect(replicatedRowsFor(1, 2, 2, 2)).toEqual([]);
    expect(replicatedRowsFor(9, 2, 2, 2)).toEqual([]);
  });

  it('returns nothing when the block did not grow', () => {
    expect(replicatedRowsFor(2, 2, 2, 0)).toEqual([]);
  });
});
