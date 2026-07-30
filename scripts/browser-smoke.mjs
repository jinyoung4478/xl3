#!/usr/bin/env node
// ROADMAP gate G10 — cross-browser smoke test.
//
// Run: `npm run browser:smoke`
// Browsers must be installed first: `npx playwright install webkit firefox`
//
// Loads the IIFE bundle in a real browser engine and runs one convert()
// per engine. The criterion is deliberately thin — bundle loads, exports
// are present, a conversion produces a real .xlsx — because the point is
// engine coverage, not re-testing semantics the conformance corpus
// already pins on Node.
//
// Why this exists when iife-bundle.test.ts already smoke-tests the
// bundle: that test runs in a Node `vm` with a hand-written sandbox of
// browser-ish globals (TextEncoder, Blob, crypto, a fake `process`, …).
// It is a useful guard, but the shim list is a guess about what browsers
// provide, and V8-in-Node is not WebKit or SpiderMonkey. A dependency
// that reaches for something only Node has would pass there and fail in
// a browser — which is the class of bug `/try` (the in-browser converter
// on xl3.io) ships to users.
//
// "Safari" here means Playwright's `webkit`, i.e. the WebKit engine that
// Safari is built on, running headless on Linux. That is the standard
// CI proxy; it is not Safari-the-application on macOS, and a
// Safari-specific UI bug would not be caught.
//
// No web server: the bundle is injected with addScriptTag({ path }) and
// the fixture bytes are passed into the page as a plain array, so this
// needs nothing but the browsers.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as playwright from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUNDLE = join(REPO, 'impl', 'js', 'dist', 'xl3.bundle.iife.min.js');
const FIXTURE = join(REPO, 'conformance', 'fixtures', '001-bracket-substitution');

// Same list the api-surface and iife-bundle tests use. Duplicated on
// purpose so a bundle built from another commit still gets checked.
const EXPECTED_EXPORTS = [
  'convert', 'preview', 'convertJson', 'previewJson', 'readTemplateInputs',
  'analyze', 'analyzeModel', 'packageZip', 'readConfigSheet',
  'writeConfigSheet', 'readInputsSheet', 'batchMatch', 'toTemplateModel',
  'xtlError', 'isXtlError',
];

const ENGINES = [
  { name: 'webkit  (Safari engine)', launcher: playwright.webkit },
  { name: 'firefox (Gecko)', launcher: playwright.firefox },
];

async function runOne({ name, launcher }, bundle, template, data) {
  const browser = await launcher.launch();
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.setContent('<!doctype html><title>xl3 smoke</title>');
    await page.addScriptTag({ content: bundle });

    const result = await page.evaluate(
      async ({ tpl, dat, expected }) => {
        const xl3 = globalThis.xl3;
        if (!xl3) return { ok: false, why: 'globalThis.xl3 is undefined after loading the bundle' };

        const missing = expected.filter((k) => typeof xl3[k] === 'undefined');
        if (missing.length) return { ok: false, why: `missing exports: ${missing.join(', ')}` };

        const toAB = (arr) => new Uint8Array(arr).buffer;
        const out = await xl3.convert(toAB(tpl), toAB(dat));
        if (!Array.isArray(out) || out.length !== 1) {
          return { ok: false, why: `expected 1 output file, got ${out && out.length}` };
        }
        const bytes = new Uint8Array(out[0].data);
        // .xlsx is a zip: first two bytes are "PK".
        const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
        return {
          ok: isZip && bytes.length > 1000,
          why: isZip ? '' : 'output does not start with the PK zip signature',
          filename: out[0].filename,
          bytes: bytes.length,
          exports: expected.length,
        };
      },
      { tpl: [...template], dat: [...data], expected: EXPECTED_EXPORTS },
    );

    if (pageErrors.length) {
      return { name, ok: false, why: `page errors: ${pageErrors.join(' | ')}` };
    }
    return { name, ...result };
  } finally {
    await browser.close();
  }
}

const [bundle, template, data] = await Promise.all([
  readFile(BUNDLE, 'utf8').catch(() => {
    throw new Error(`bundle not found at ${BUNDLE} — run \`npm run build:bundle\` first`);
  }),
  readFile(join(FIXTURE, 'template.xlsx')),
  readFile(join(FIXTURE, 'data.xlsx')),
]);

console.log('xl3 cross-browser smoke (G10)');
console.log(`bundle ${(bundle.length / 1024 / 1024).toFixed(2)} MB · fixture 001-bracket-substitution`);
console.log('-'.repeat(64));

let failed = 0;
for (const engine of ENGINES) {
  let r;
  try {
    r = await runOne(engine, bundle, template, data);
  } catch (e) {
    r = { name: engine.name, ok: false, why: String(e?.message ?? e) };
  }
  if (r.ok) {
    console.log(
      `  PASS  ${r.name.padEnd(24)} ${r.exports} exports · convert -> ` +
        `${r.filename} (${r.bytes} bytes)`,
    );
  } else {
    failed++;
    console.log(`  FAIL  ${r.name.padEnd(24)} ${r.why}`);
  }
}

console.log('-'.repeat(64));
if (failed) {
  console.error(`${failed} of ${ENGINES.length} engines failed`);
  process.exit(1);
}
console.log(`${ENGINES.length} engines passed`);
