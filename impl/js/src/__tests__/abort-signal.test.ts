import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert, convertJson, isXtlError, preview, previewJson } from '../index.js';
import { throwIfAborted } from '../abort.js';
import type { XtlError } from '../error-codes.js';
import type { Xl3SourceJson } from '../types.js';

// ROADMAP gate G21 / spec/evaluation.md "AbortSignal". Pins two promises
// the spec makes to hosts: an aborted signal surfaces the stable
// `xl3/abort/cancelled` code, and no partial output is emitted.

const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const FAN_OUT = join(REPO_ROOT, 'conformance', 'fixtures', '085-file-group-first-seen-order');

function toAB(path: string): ArrayBuffer {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

const template = () => toAB(join(FAN_OUT, 'template.xlsx'));
const data = () => toAB(join(FAN_OUT, 'data.xlsx'));

const SOURCE_JSON: Xl3SourceJson = {
  version: 'xl3-source-json/0.1',
  sources: { default: { headers: ['City', 'Amount'], rows: [['Seoul', 1]] } },
};

async function expectCancelled(run: () => Promise<unknown>): Promise<void> {
  let caught: unknown;
  await expect(run()).rejects.toThrow();
  try {
    await run();
  } catch (e) {
    caught = e;
  }
  expect(isXtlError(caught)).toBe(true);
  expect((caught as XtlError).code).toBe('xl3/abort/cancelled');
}

describe('G21 AbortSignal', () => {
  it('rejects convert() with xl3/abort/cancelled when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expectCancelled(() => convert(template(), data(), { signal: ctrl.signal }));
  });

  it('rejects preview() the same way', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expectCancelled(() => preview(template(), data(), { signal: ctrl.signal }));
  });

  it('rejects convertJson() the same way', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expectCancelled(() => convertJson(template(), SOURCE_JSON, { signal: ctrl.signal }));
  });

  it('rejects previewJson() the same way', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expectCancelled(() => previewJson(template(), SOURCE_JSON, { signal: ctrl.signal }));
  });

  it('cancels after a file group has rendered and still emits nothing', async () => {
    // The fixture fans out to three files. A real AbortController fired
    // from a timer would race the render loop, so the checkpoint is
    // driven deterministically instead.
    //
    // The flip point is calibrated rather than hard-coded: a first pass
    // counts how many times the pipeline reads `aborted` in a successful
    // run, and the second pass flips two reads before that. Since the
    // trailing reads are the per-file-group guards, that lands the abort
    // on the last group — after earlier groups have already rendered,
    // which is precisely the case where a torn result could escape.
    // Self-calibrating so that adding a checkpoint elsewhere in the
    // pipeline does not silently turn this into a prepare-phase test.
    let total = 0;
    const counting = {
      get aborted() {
        total++;
        return false;
      },
    } as unknown as AbortSignal;
    const full = await convert(template(), data(), { signal: counting });
    expect(full).toHaveLength(3);
    expect(total).toBeGreaterThanOrEqual(4);

    let reads = 0;
    const flipAfter = total - 2;
    const signal = {
      get aborted() {
        return ++reads > flipAfter;
      },
    } as unknown as AbortSignal;

    let caught: unknown;
    try {
      await convert(template(), data(), { signal });
    } catch (e) {
      caught = e;
    }

    expect(isXtlError(caught)).toBe(true);
    expect((caught as XtlError).code).toBe('xl3/abort/cancelled');
    // Stopped before the pipeline ran to completion, and the caller got a
    // rejection rather than the partially filled array — `convert`
    // accumulates locally and returns only after the loop finishes, so
    // "no partial output" is structural rather than best-effort.
    expect(reads).toBe(flipAfter + 1);
    expect(reads).toBeLessThan(total);
  });

  it('leaves conversion unaffected when no signal is passed', async () => {
    const out = await convert(template(), data());
    expect(out.map((f) => f.filename)).toEqual(['Seoul.xlsx', 'Busan.xlsx', 'Daegu.xlsx']);
  });

  it('leaves conversion unaffected when the signal never aborts', async () => {
    const ctrl = new AbortController();
    const out = await convert(template(), data(), { signal: ctrl.signal });
    expect(out).toHaveLength(3);
  });

  it('throwIfAborted is a no-op for undefined and non-aborted signals', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });

  it('throwIfAborted raises the catalogued code for an aborted signal', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    try {
      throwIfAborted(ctrl.signal);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isXtlError(e)).toBe(true);
      expect((e as XtlError).code).toBe('xl3/abort/cancelled');
    }
  });
});
