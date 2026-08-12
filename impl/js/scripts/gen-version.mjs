#!/usr/bin/env node
// Regenerate `src/pkg-version.ts` from `package.json`.
//
// Why a generated file instead of reading package.json at runtime:
// there are two build paths and neither can do it. `tsc -p
// tsconfig.build.json` emits the npm ESM entry and has no `define`, and
// the tsup IIFE bundle runs in a browser where `package.json` does not
// exist at all. A generated constant is the only form both paths carry.
//
// The output is **committed**, not git-ignored: `npm run typecheck` and
// `npm test` both compile `src/` on a fresh clone, so a missing file
// would break them before any build ran. Drift is caught instead by
// `src/__tests__/pkg-version.test.ts`, which fails when the constant and
// package.json disagree. Run this after a version bump (RELEASING.md).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PKG_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkgPath = resolve(PKG_ROOT, 'package.json');
const outPath = resolve(PKG_ROOT, 'src/pkg-version.ts');

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
// Shape-check before emitting. The value is interpolated into a TypeScript
// string literal below, so a version carrying a quote or a backslash would
// produce a file that does not compile — or worse, one that compiles into
// something other than a version. npm validates semver on publish, but this
// script also runs against hand-edited manifests. This guard is what makes
// the interpolation safe: do not loosen it without switching the emit to
// JSON.stringify.
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`gen-version: package.json version is not a semver string: ${JSON.stringify(version)}`);
  process.exit(1);
}

const body = `// GENERATED FILE — do not edit by hand.
//
// Written by \`scripts/gen-version.mjs\` from \`package.json\`, and
// committed so \`npm run typecheck\` / \`npm test\` work on a fresh clone.
// After bumping the package version run \`npm run sync:version\`;
// \`src/__tests__/pkg-version.test.ts\` fails if the two disagree.

/** This package's own version, as published to npm. */
export const VERSION = '${version}';
`;

const previous = (() => {
  try {
    return readFileSync(outPath, 'utf8');
  } catch {
    return null;
  }
})();

if (previous === body) {
  console.log(`gen-version: src/pkg-version.ts already at ${version}`);
} else {
  writeFileSync(outPath, body);
  console.log(`gen-version: wrote src/pkg-version.ts (${version})`);
}
