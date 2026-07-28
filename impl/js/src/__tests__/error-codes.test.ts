import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { xtlError, isXtlError, type XtlErrorCode } from '../error-codes.js';

// ADR-0015: error.code is a stable contract — hosts dispatch on it
// for localization and programmatic handling. The snapshot below
// pins the full catalog so a rename, removal, or reuse with
// different semantics fails CI. New codes are append-only; adding
// one to this list at the same time as defining it in
// error-codes.ts is the expected workflow.
//
// G3 1.0 GATE — catalog must remain unchanged for 30 days before
// G3 ticks. Clock reset 2026-05-23 by 0.8.0's 4 new codes; earliest
// tick 2026-06-22. During 0.8.x, only critical-bug-fix codes may be
// added — any addition or rename pushes the 0.9-rc target. See
// ROADMAP.md "0.8.x — Sociological gates (in flight)".
const EXPECTED_CODES: XtlErrorCode[] = [
  'xl3/cell/formula-no-cache',
  'xl3/eval/arity-mismatch',
  'xl3/eval/operand-coercion',
  'xl3/eval/unsupported-syntax',
  'xl3/eval/type-mismatch',
  'xl3/eval/no-match',
  'xl3/cell/numfmt-coercion',
  'xl3/cell/row-outside-repeat',
  'xl3/config/invalid-source-table',
  'xl3/config/source-table-removed',
  'xl3/filename/collision',
  'xl3/abort/cancelled',
  'xl3/filename/empty',
  'xl3/filename/too-long',
  'xl3/inputs/conflict-config',
  'xl3/inputs/duplicate-name',
  'xl3/inputs/invalid-name',
  'xl3/inputs/invalid-type',
  'xl3/inputs/missing-header',
  'xl3/inputs/missing-options',
  'xl3/inputs/missing-required',
  'xl3/inputs/parse-date',
  'xl3/inputs/parse-number',
  'xl3/inputs/select-option',
  'xl3/inputs/forward-reference',
  'xl3/inputs/runtime-only-fn',
  'xl3/directive/invalid-syntax',
  'xl3/group/missing-key',
  'xl3/subtotal/outside-group',
  'xl3/subtotal/bad-aggregate',
  'xl3/subtotal/mixed-row',
  'xl3/subtotal/explicit-block-unsupported',
  'xl3/join/bad-on-clause',
  'xl3/join/undeclared-source',
  'xl3/lists/missing-reference',
  'xl3/parser/empty-block',
  'xl3/sheet/duplicate-list-name',
  'xl3/sheet/reserved-name',
  'xl3/source/duplicate-name',
  'xl3/source/invalid-name',
  'xl3/source/missing-header',
  'xl3/source/missing-required',
  'xl3/source/row-cross-block',
  'xl3/source/sheet-missing',
  'xl3/source/undeclared',
  'xl3/source/reserved-column-name',
  'xl3/source/unknown-column',
  'xl3/sources/not-a-dictionary',
  'xl3/source-json/invalid',
  'xl3/xlookup/bare-bracket',
  'xl3/xlookup/no-match',
  'xl3/xlookup/source-mismatch',
  // 0.7.0 batch (ADR-0051, ADR-0057, ADR-0059, ADR-0054)
  'xl3/parser/unbalanced-literal',
  'xl3/lists/invalid-use',
  'xl3/eval/bad-aggregate-arg',
  'xl3/expression/unknown-name',
  'xl3/expression/bracket-outside-block',
  'xl3/block/overlap',
  'xl3/block/empty-table',
  'xl3/directive/orphan',
];

describe('error code catalog (ADR-0015)', () => {
  it('pins the full set of xtl error codes', () => {
    const source = readErrorCodesSource();
    const declared = extractDeclaredCodes(source).sort();
    const expected = [...EXPECTED_CODES].sort();
    expect(declared).toEqual(expected);
  });

  it('every catalog code is actually thrown somewhere in src/', () => {
    const root = srcRoot();
    const allFiles = collectTsFiles(root).filter(
      (f) => !f.endsWith('error-codes.ts') && !f.includes('__tests__'),
    );
    const haystack = allFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

    const orphans = EXPECTED_CODES.filter(
      (code) => !haystack.includes(`'${code}'`) && !haystack.includes(`"${code}"`),
    );
    expect(orphans).toEqual([]);
  });
});

describe('xtlError / isXtlError', () => {
  it('attaches the code to the Error instance', () => {
    const err = xtlError('xl3/source/undeclared', 'Source "X" is not declared');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('xl3/source/undeclared');
    expect(err.message).toBe('Source "X" is not declared');
  });

  it('isXtlError detects xl3-prefixed errors', () => {
    expect(isXtlError(xtlError('xl3/filename/empty', 'm'))).toBe(true);
  });

  it('isXtlError rejects plain errors', () => {
    expect(isXtlError(new Error('plain'))).toBe(false);
  });

  it('isXtlError rejects errors with non-xl3 codes', () => {
    const fake = new Error('m') as Error & { code: string };
    fake.code = 'ENOENT';
    expect(isXtlError(fake)).toBe(false);
  });

  it('isXtlError rejects non-error values', () => {
    expect(isXtlError(undefined)).toBe(false);
    expect(isXtlError(null)).toBe(false);
    expect(isXtlError({ code: 'xl3/filename/empty' })).toBe(false);
    expect(isXtlError('xl3/filename/empty')).toBe(false);
  });
});

function readErrorCodesSource(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  return readFileSync(join(here, '..', 'error-codes.ts'), 'utf8');
}

function extractDeclaredCodes(source: string): string[] {
  // Pull every literal `'xl3/.../...'` from the union type body.
  const matches = source.match(/'xl3\/[a-z-]+\/[a-z-]+'/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

function srcRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}
