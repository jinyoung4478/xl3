import { xtlError } from './error-codes.js';

/**
 * Raise `xl3/abort/cancelled` if the host's signal has aborted.
 *
 * ROADMAP gate G21 / `spec/evaluation.md` "AbortSignal". Called at the
 * pipeline's existing await boundaries rather than inside per-row loops:
 * a conversion is CPU-bound and single-threaded, so a signal that aborts
 * mid-render is not observable until the next boundary anyway, and
 * checking per row would cost more than it buys.
 *
 * Lives outside `error-codes.ts` on purpose — that module declares the
 * catalog, and `error-codes.test.ts` asserts every catalogued code is
 * *raised* from somewhere else in `src/`.
 *
 * @internal
 */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw xtlError(
      'xl3/abort/cancelled',
      'Conversion was cancelled by the host via the AbortSignal passed in options.signal. No output was emitted.',
    );
  }
}
