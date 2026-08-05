import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { canonicalizeXlsx } from '../conformance-runner.js';

const run = promisify(execFile);

const PKG_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));

// End-to-end tests for the `xl3` bin — the path a non-JS host takes.
// They spawn the built CLI rather than importing it, because the things
// worth testing here are exactly the things an in-process import would
// bypass: argv parsing, stdin, files landing on disk, and exit codes.
//
// Skipped (not failed) when dist/ is absent, matching iife-bundle.test.ts:
// `npm test` without a prior build shouldn't block a dev. CI builds first.

const CLI = resolve(PKG_ROOT, 'dist/bin/xl3.js');
const FIXTURE = resolve(REPO_ROOT, 'conformance/fixtures/001-bracket-substitution');
const TEMPLATE = join(FIXTURE, 'template.xlsx');
const DATA_XLSX = join(FIXTURE, 'data.xlsx');

// 066 declares a required `region` input that reaches the output
// filename pattern (ADR-0010), which makes input plumbing observable.
const INPUTS_FIXTURE = resolve(REPO_ROOT, 'conformance/fixtures/066-input-text-host-supplied');
const INPUTS_TEMPLATE = join(INPUTS_FIXTURE, 'template.xlsx');
const INPUTS_DATA = join(INPUTS_FIXTURE, 'data.xlsx');

// The same two rows `data.xlsx` holds, as the wire format. Parity
// between these two spellings of one dataset is the CLI's core promise.
const EQUIVALENT_JSON = JSON.stringify({
  version: 'xl3-source-json/0.1',
  sources: { default: { headers: ['Customer'], rows: [['Acme'], ['Beta']] } },
});

const describeCli = existsSync(CLI) ? describe : describe.skip;

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'xl3-cli-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** execFile that resolves on non-zero exit instead of throwing. */
async function cli(
  args: string[],
  stdin?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const child = run('node', [CLI, ...args], { encoding: 'utf8' });
    if (stdin !== undefined) {
      child.child.stdin?.end(stdin);
    }
    const { stdout, stderr } = await child;
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describeCli('xl3 CLI', () => {
  it('renders from an .xlsx source', async () => {
    const out = tempDir();
    const { code } = await cli(['render', TEMPLATE, `--data=${DATA_XLSX}`, `--out=${out}`, '--quiet']);
    expect(code).toBe(0);
    const bytes = readFileSync(join(out, 'output.xlsx'));
    // PK zip magic — a real workbook, not an error page or empty file.
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('renders from JSON on stdin', async () => {
    const out = tempDir();
    const { code, stdout } = await cli(
      ['render', TEMPLATE, '--data=-', `--out=${out}`, '--json'],
      EQUIVALENT_JSON,
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.count).toBe(1);
    expect(report.files).toHaveLength(1);
    expect(existsSync(join(out, 'output.xlsx'))).toBe(true);
  });

  it('produces identical output from .xlsx and equivalent JSON', async () => {
    // ADR-0075's central claim, asserted through the CLI because that is
    // where a Java or Python host relies on it: moving off a temporary
    // data.xlsx must not change the workbook.
    //
    // Compared canonically, not byte-for-byte. Two runs of the *same*
    // inputs already differ in raw bytes — every zip entry header carries
    // a last-modified time, so the output shifts whenever a render
    // crosses a DOS-timestamp tick. That is why Stage 2 conformance
    // compares canonicalized parts (ADR-0006), and it is the same
    // comparison that belongs here. Asserting raw bytes makes this test
    // fail a few times in ten for a reason that has nothing to do with
    // the source format.
    const fromXlsx = tempDir();
    const fromJson = tempDir();
    await cli(['render', TEMPLATE, `--data=${DATA_XLSX}`, `--out=${fromXlsx}`, '--quiet']);
    await cli(['render', TEMPLATE, '--data=-', `--out=${fromJson}`, '--quiet'], EQUIVALENT_JSON);

    const [xlsxParts, jsonParts] = await Promise.all([
      canonicalizeXlsx(toArrayBuffer(readFileSync(join(fromXlsx, 'output.xlsx')))),
      canonicalizeXlsx(toArrayBuffer(readFileSync(join(fromJson, 'output.xlsx')))),
    ]);

    expect([...jsonParts.keys()].sort()).toEqual([...xlsxParts.keys()].sort());
    for (const [part, xml] of xlsxParts) {
      expect(jsonParts.get(part), `part ${part} differs`).toBe(xml);
    }
  });

  it('writes a zip when asked', async () => {
    const out = tempDir();
    const zip = join(out, 'bundle.zip');
    const { code } = await cli(
      ['render', TEMPLATE, `--data=${DATA_XLSX}`, `--zip=${zip}`, '--quiet'],
    );
    expect(code).toBe(0);
    expect(readFileSync(zip).subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('previews without writing anything', async () => {
    const out = tempDir();
    const { code, stdout } = await cli(['preview', TEMPLATE, `--data=${DATA_XLSX}`, `--out=${out}`]);
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.files[0].filename).toBe('output.xlsx');
    expect(result.sources[0].headers).toEqual(['Customer']);
    expect(existsSync(join(out, 'output.xlsx'))).toBe(false);
  });

  it('lists template inputs as JSON', async () => {
    const { code, stdout } = await cli(['inputs', TEMPLATE]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it('reports an xl3 error code and exits 1', async () => {
    const out = tempDir();
    const { code, stderr } = await cli(
      ['render', TEMPLATE, '--data=-', `--out=${out}`, '--json'],
      '{"version":"nope"}',
    );
    expect(code).toBe(1);
    // The stable `code` is what a host dispatches on (ADR-0015).
    expect(JSON.parse(stderr).error.code).toBe('xl3/source-json/invalid');
  });

  it('prints the package version on --version and exits 0', async () => {
    // xl3#103 made `VERSION` the single source for this; before that the
    // CLI read package.json off disk relative to dist/bin/, which the
    // library path could not do at all (no package.json in a browser).
    const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as {
      version: string;
    };
    const { code, stdout } = await cli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('exits 2 on a usage error, distinct from a conversion failure', async () => {
    const { code, stderr } = await cli(['render', TEMPLATE]);
    expect(code).toBe(2);
    expect(stderr).toContain('missing --data');
  });

  it('passes --input through to the template', async () => {
    // 066's `region` input reaches the output filename pattern, so the
    // rendered name is proof the value arrived — not just that the run
    // exited 0.
    const { code, stdout } = await cli([
      'preview', INPUTS_TEMPLATE, `--data=${INPUTS_DATA}`, '--input=region=Busan',
    ]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).files[0].filename).toBe('Busan_report.xlsx');
  });

  it('lets --input override the same key from --inputs', async () => {
    const dir = tempDir();
    const inputsFile = join(dir, 'inputs.json');
    writeFileSync(inputsFile, JSON.stringify({ region: 'Seoul' }));

    const { code, stdout } = await cli([
      'preview', INPUTS_TEMPLATE, `--data=${INPUTS_DATA}`,
      `--inputs=${inputsFile}`, '--input=region=Busan',
    ]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).files[0].filename).toBe('Busan_report.xlsx');
  });

  it('surfaces a missing required input as its error code', async () => {
    const { code, stderr } = await cli([
      'preview', INPUTS_TEMPLATE, `--data=${INPUTS_DATA}`, '--json',
    ]);
    expect(code).toBe(1);
    expect(JSON.parse(stderr).error.code).toBe('xl3/inputs/missing-required');
  });
});
