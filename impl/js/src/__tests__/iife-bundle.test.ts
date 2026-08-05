import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// dist/ is built inside this package (impl/js); the conformance/
// fixtures live at the repo root, four levels up from
// impl/js/src/__tests__/.
const PKG_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));

// Smoke test for the IIFE bundle produced by `npm run build:bundle`.
//
// Loads `dist/xl3.bundle.iife.min.js` from disk, executes it in a Node
// `vm` context populated with the browser-ish globals it needs, and
// verifies:
//   1. the IIFE assigned `xl3` to the context (the `globalName`),
//   2. all EXPECTED_RUNTIME_EXPORTS appear on `ctx.xl3`,
//   3. `ctx.xl3.convert(...)` produces a real .xlsx Uint8Array against
//      the 001-bracket-substitution fixture,
//   4. the minified bundle stays under 1.5 MB (regression guard for
//      surprise dep bloat — the bundle landed at ~1.04 MB in 0.4.1).
//
// The test is skipped (not failed) if the bundle isn't present so
// devs running `npm test` without first building aren't blocked. CI
// runs `npm run build:bundle` before `npm test`, so it executes
// there.

const BUNDLE_PATH = resolve(PKG_ROOT, 'dist/xl3.bundle.iife.min.js');
const BUNDLE_SIZE_LIMIT_BYTES = 1.5 * 1024 * 1024;

// Same list as api-surface.test.ts. Kept duplicated rather than
// imported to keep this test independent (it could run against a
// bundle built from a different commit).
const EXPECTED_RUNTIME_EXPORTS = [
  'convert',
  'preview',
  'convertJson',
  'previewJson',
  'readTemplateInputs',
  'analyze',
  'analyzeModel',
  'packageZip',
  'readConfigSheet',
  'writeConfigSheet',
  'readInputsSheet',
  'batchMatch',
  'toTemplateModel',
  'xtlError',
  'isXtlError',
  'VERSION',
  'getEngineInfo',
] as const;

function loadBundleContext(): { ctx: vm.Context; xl3: Record<string, unknown> } {
  const code = readFileSync(BUNDLE_PATH, 'utf8');

  // Minimal browser-shaped global surface ExcelJS + JSZip + xl3 touch
  // when they run in IIFE mode. `globalThis` is wired up by `vm` once
  // we hand the context to `runInContext`.
  const sandbox: Record<string, unknown> = {
    // timers
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    queueMicrotask,
    // encoding / binary
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    DataView,
    Buffer,
    // misc browser-y
    URL,
    URLSearchParams,
    console,
    crypto: globalThis.crypto,
    performance: globalThis.performance,
    Blob: globalThis.Blob,
    process, // ExcelJS occasionally feature-detects via process.browser
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'xl3.bundle.iife.min.js' });

  const xl3 = (ctx as { xl3?: Record<string, unknown> }).xl3;
  if (!xl3) {
    throw new Error('IIFE bundle did not assign `xl3` to the vm context');
  }
  return { ctx, xl3 };
}

const bundleExists = existsSync(BUNDLE_PATH);
const describeIfBuilt = bundleExists ? describe : describe.skip;

describeIfBuilt('IIFE bundle smoke', () => {
  it('stays under the 1.5 MB size budget', () => {
    const { size } = statSync(BUNDLE_PATH);
    expect(size).toBeLessThan(BUNDLE_SIZE_LIMIT_BYTES);
  });

  it('exposes every expected runtime export on the global', () => {
    const { xl3 } = loadBundleContext();
    const actual = Object.keys(xl3).sort();
    const expected = [...EXPECTED_RUNTIME_EXPORTS].sort();
    // Bundles may legitimately surface a few extras (e.g. esbuild
    // helpers if treeshake misses), so assert the expected set is a
    // subset rather than equal. The api-surface test owns the strict
    // equality contract on the ESM build.
    for (const name of expected) {
      expect(actual, `missing export ${name}`).toContain(name);
    }
  });

  it('runs convert() against the 001-bracket-substitution fixture', async () => {
    const { xl3 } = loadBundleContext();
    const convert = xl3.convert as (
      template: ArrayBuffer,
      source: ArrayBuffer,
    ) => Promise<Array<{ filename: string; data: Uint8Array }>>;

    const fixtureDir = resolve(
      REPO_ROOT,
      'conformance/fixtures/001-bracket-substitution',
    );
    const templateBuf = readFileSync(resolve(fixtureDir, 'template.xlsx'));
    const dataBuf = readFileSync(resolve(fixtureDir, 'data.xlsx'));

    // Node Buffer's .buffer can have offsets — copy into a fresh
    // ArrayBuffer so the bundled ExcelJS sees a clean slice.
    const toAb = (b: Buffer): ArrayBuffer => {
      const ab = new ArrayBuffer(b.byteLength);
      new Uint8Array(ab).set(b);
      return ab;
    };

    const outputs = await convert(toAb(templateBuf), toAb(dataBuf));
    expect(Array.isArray(outputs)).toBe(true);
    expect(outputs.length).toBeGreaterThan(0);
    const first = outputs[0]!;
    expect(first.data).toBeInstanceOf(Uint8Array);
    expect(first.data.byteLength).toBeGreaterThan(0);
    // .xlsx files begin with the PK\x03\x04 ZIP local-file header.
    expect(first.data[0]).toBe(0x50);
    expect(first.data[1]).toBe(0x4b);
  });
});
