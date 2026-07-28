// ADR-0015: stable error codes for xl3-thrown errors. Hosts use these
// for localization and programmatic dispatch. The English `Error.message`
// remains the conformance-corpus contract.

export type XtlErrorCode =
  // Config
  | 'xl3/config/source-table-removed'
  | 'xl3/config/invalid-source-table'
  // Inputs (ADR-0010)
  | 'xl3/inputs/missing-required'
  | 'xl3/inputs/parse-number'
  | 'xl3/inputs/parse-date'
  | 'xl3/inputs/select-option'
  | 'xl3/inputs/duplicate-name'
  | 'xl3/inputs/invalid-name'
  | 'xl3/inputs/invalid-type'
  | 'xl3/inputs/conflict-config'
  | 'xl3/inputs/missing-header'
  | 'xl3/inputs/missing-options'
  // ADR-0050: __inputs__ XTL evaluation
  | 'xl3/inputs/forward-reference'
  | 'xl3/inputs/runtime-only-fn'
  // Sources (ADR-0012)
  | 'xl3/source/undeclared'
  | 'xl3/source/sheet-missing'
  | 'xl3/source/duplicate-name'
  | 'xl3/source/invalid-name'
  | 'xl3/source/missing-header'
  | 'xl3/source/missing-required'
  | 'xl3/source/row-cross-block'
  | 'xl3/source/unknown-column'
  | 'xl3/source/reserved-column-name'
  | 'xl3/sources/not-a-dictionary'
  // Source JSON wire format (ADR-0075)
  | 'xl3/source-json/invalid'
  // Reserved sheets (ADR-0011)
  | 'xl3/sheet/reserved-name'
  | 'xl3/sheet/duplicate-list-name'
  // Join (ADR-0014)
  | 'xl3/join/undeclared-source'
  | 'xl3/join/bad-on-clause'
  // Directive (ADR-0027)
  | 'xl3/directive/invalid-syntax'
  // Group + subtotal (ADR-0038, ADR-0058, ADR-0074)
  | 'xl3/group/missing-key'
  | 'xl3/subtotal/outside-group'
  | 'xl3/subtotal/bad-aggregate'
  | 'xl3/subtotal/mixed-row'
  | 'xl3/subtotal/explicit-block-unsupported'
  // Lists
  | 'xl3/lists/missing-reference'
  // Lists (ADR-0057)
  | 'xl3/lists/invalid-use'
  // Parser (ADR-0021)
  | 'xl3/parser/empty-block'
  // Parser (ADR-0051)
  | 'xl3/parser/unbalanced-literal'
  // Evaluation (ADR-0023, ADR-0024, ADR-0019 amendment, ADR-0039)
  | 'xl3/eval/operand-coercion'
  | 'xl3/eval/arity-mismatch'
  | 'xl3/eval/unsupported-syntax'
  | 'xl3/eval/type-mismatch'
  | 'xl3/eval/no-match'
  // Evaluation (ADR-0059)
  | 'xl3/eval/bad-aggregate-arg'
  // Expression (ADR-0054)
  | 'xl3/expression/unknown-name'
  // Expression — block scoping (ADR-0066)
  | 'xl3/expression/bracket-outside-block'
  // Block geometry (ADR-0067, ADR-0068)
  | 'xl3/block/overlap'
  | 'xl3/block/empty-table'
  // Directive scoping (ADR-0069)
  | 'xl3/directive/orphan'
  // Cell evaluation
  | 'xl3/cell/numfmt-coercion'
  | 'xl3/cell/row-outside-repeat'
  | 'xl3/cell/formula-no-cache'
  // XLOOKUP (ADR-0013)
  | 'xl3/xlookup/no-match'
  | 'xl3/xlookup/source-mismatch'
  | 'xl3/xlookup/bare-bracket'
  // Filename sanitization (ADR-0002)
  | 'xl3/filename/empty'
  | 'xl3/filename/too-long'
  // Output filename collision (ADR-0031)
  | 'xl3/filename/collision'
  // Host-requested cancellation (ROADMAP gate G21, spec/evaluation.md
  // "AbortSignal"). Raised when the `signal` passed to convert() or
  // preview() aborts; no partial output is emitted.
  | 'xl3/abort/cancelled';

export interface XtlError extends Error {
  code: XtlErrorCode;
}

/**
 * Construct an Error with a stable `code` (ADR-0015). Hosts dispatch
 * on `error.code` for localization and programmatic handling; the
 * English `error.message` remains the conformance-corpus contract.
 *
 * @stable Frozen at 1.0 per `spec/STABILITY.md` "Public API surface".
 *
 * @example
 * ```ts
 * throw xtlError('xl3/filename/empty', 'Output filename resolved to empty');
 * ```
 */
export function xtlError(code: XtlErrorCode, message: string): XtlError {
  const err = new Error(message) as XtlError;
  err.code = code;
  return err;
}

/**
 * Type guard for XtlError. Returns `true` only for Error instances
 * whose `code` starts with `xl3/`. Plain Errors, host-supplied error
 * shapes, and non-Error values all return `false`.
 *
 * @stable Frozen at 1.0.
 *
 * @example
 * ```ts
 * try {
 *   await convert(templateBuffer, sourceBuffer);
 * } catch (e) {
 *   // dispatch on the stable code, not the English message
 *   if (isXtlError(e)) console.error(e.code); // e.g. 'xl3/filename/collision'
 * }
 * ```
 */
export function isXtlError(e: unknown): e is XtlError {
  return e instanceof Error && typeof (e as XtlError).code === 'string'
    && (e as XtlError).code.startsWith('xl3/');
}
