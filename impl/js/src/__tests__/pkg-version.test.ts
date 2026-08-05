import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, getEngineInfo } from '../index.js';
import { _resetWasmEngineCache } from '../wasm-bridge.js';

// xl3#103: a host that reports "this conversion looks wrong" is always
// asked which xl3 produced it, and before these two exports the answer
// required the consumer to read `node_modules/@xl3-lang/xl3/package.json`
// off disk and inject it at build time.
//
// `src/pkg-version.ts` is generated from package.json and committed, so
// nothing regenerates it during a normal `npm test`. That makes drift the
// real risk: bump the package version, forget `npm run sync:version`, and
// ship a `VERSION` that lies. This test is the guard — it reads the
// manifest off disk rather than trusting the constant.

// This test file lives at impl/js/src/__tests__/; the package root
// (package.json) is two levels up.
const PKG_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function manifestVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

describe('VERSION', () => {
  it('matches package.json', () => {
    expect(
      VERSION,
      'src/pkg-version.ts is stale — run `npm run sync:version` after bumping the version.',
    ).toBe(manifestVersion());
  });

  it('is a bare MAJOR.MINOR.PATCH string, not a range or a `v` prefix', () => {
    // Consumers print this and feed it to `compareVersions`; a `^` or a
    // leading `v` would break both.
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});

describe('getEngineInfo', () => {
  it('reports the same version as the VERSION export', async () => {
    const info = await getEngineInfo();
    expect(info.version).toBe(VERSION);
  });

  it('reports the js backend when xl3-wasm is not installed', async () => {
    // `xl3-wasm` is an optional dependency and is not installed in this
    // repo, so the bridge's load attempt fails and `auto` resolves to JS.
    // Reset the module-level cache first so the answer comes from an
    // actual load attempt rather than whatever an earlier test left.
    _resetWasmEngineCache();
    const info = await getEngineInfo();
    expect(info.backend).toBe('js');
  });

  it('is stable across calls (the wasm probe is cached, not re-run per call)', async () => {
    const first = await getEngineInfo();
    const second = await getEngineInfo();
    expect(second).toEqual(first);
  });
});
