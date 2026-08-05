import { describe, expect, it } from 'vitest';
import * as api from '../index.js';

// 1.0 readiness: pin the public surface exported from `xl3` so a
// silent removal or rename fails CI. Adding a new export at the
// same time as updating this list is the expected workflow.
//
// Type-only re-exports (interfaces, type aliases) don't appear at
// runtime, so this test asserts the runtime export shape only. Type
// re-exports are checked indirectly through `npm run typecheck` —
// dependents that import them by name will fail to compile if a
// type export disappears.
//
// ROADMAP gate G22: the runtime exports listed below are 1.0-stable.
// `ParsedTemplate` and the directive / data-block types in
// `src/types.ts` are exported but tagged `@experimental` — they
// remain importable for tooling without entering the 1.0 freeze.
// See `spec/STABILITY.md` "Stable type re-exports" vs "Experimental
// type re-exports" for the formal split.
const EXPECTED_RUNTIME_EXPORTS = [
  // Conversion entry points
  'convert',
  'preview',
  // JSON source entry points (ADR-0075)
  'convertJson',
  'previewJson',
  'readTemplateInputs',
  'analyze',
  'analyzeModel',
  'packageZip',
  // Lower-level helpers
  'readConfigSheet',
  'writeConfigSheet',
  'readInputsSheet',
  'batchMatch',
  'toTemplateModel',
  // Error helpers (ADR-0015)
  'xtlError',
  'isXtlError',
  // Runtime metadata (xl3#103)
  'VERSION',
  'getEngineInfo',
] as const;

describe('public API surface', () => {
  it('pins the runtime exports of `xl3`', () => {
    const actual = Object.keys(api).sort();
    const expected = [...EXPECTED_RUNTIME_EXPORTS].sort();
    expect(actual).toEqual(expected);
  });

  it('VERSION is a non-empty string, not a function (xl3#103)', () => {
    // The one non-function export on the surface — a host that prints it
    // must not get `[object Function]`.
    expect(typeof api.VERSION).toBe('string');
    expect(api.VERSION.length).toBeGreaterThan(0);
  });

  it('every documented runtime export resolves to a callable / value', () => {
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect((api as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('convert, preview, readTemplateInputs are async functions', () => {
    expect(typeof api.convert).toBe('function');
    expect(typeof api.preview).toBe('function');
    expect(typeof api.readTemplateInputs).toBe('function');
    // Async functions: their constructor name is "AsyncFunction".
    expect(api.convert.constructor.name).toBe('AsyncFunction');
    expect(api.preview.constructor.name).toBe('AsyncFunction');
    expect(api.readTemplateInputs.constructor.name).toBe('AsyncFunction');
  });

  it('xtlError returns an Error with a code', () => {
    const err = api.xtlError('xl3/filename/empty', 'm');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('xl3/filename/empty');
  });
});
