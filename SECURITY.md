# Security policy

> **Status:** draft (ROADMAP gate G20). This document states the
> threat model, the stance on each attack class, and the disclosure
> process. Hard-limit values are tracked separately in
> [`spec/evaluation.md`](./spec/evaluation.md) under "Implementation
> limits" (ROADMAP gate G21).

## Threat model in one paragraph

xl3 is a **template engine, not a sandbox**. The reference impl
processes XLSX bytes the host hands it and produces XLSX bytes
back. The host owns: (1) deciding whose templates to trust, (2)
deciding whose data files to convert, (3) limiting memory and CPU
budgets per conversion, (4) sandboxing the surrounding process if
it accepts uploads from arbitrary internet users. xl3 owns: (a) not
executing macros, (b) not making network calls, (c) not writing to
the filesystem outside the buffers the host provides, (d) emitting
parse errors instead of crashing on adversarial input *up to* the
documented limits.

## What xl3 does **NOT** do

These are spec-normative, not impl quirks:

1. **Macros never execute.** XLSM inputs are accepted as XLSX-with-
   macros-stripped (ADR-0048 axis 5). VBA, XLM, and any
   macro-equivalent code is dropped at parse time; a warning is
   emitted. No host or template can opt back in within 1.x.
2. **No network I/O.** xl3 has zero network dependencies at
   runtime. Hyperlinks emitted via `HYPERLINK()` (ADR-0039) are
   metadata only — they are written into the output workbook and
   surface in Excel's UI, but xl3 never resolves or fetches them.
3. **No filesystem access** beyond the buffers / arrays the caller
   passes to `convert()`, `preview()`, `analyze()`,
   `readTemplateInputs()`, `packageZip()`. The reference impl reads
   nothing from `process.env`, the host filesystem, or any
   credentials store.
4. **No formula execution.** Excel formula text in template cells
   is preserved verbatim per ADR-0046; xl3 does not evaluate it.
   Re-evaluation happens at Excel-open time, in Excel, under the
   end user's security context — not in the conversion process.
5. **No untrusted code import.** xl3's `__sources__` model
   (ADR-0012) reads named tables from the data workbook only.
   There is no escape hatch for SQL, REST, JEXL plugins, or any
   JXLS-style host-extension SPI (ADR-0048 axis 3).

## Attack-class stance

| Attack class | Stance | Mitigation |
|---|---|---|
| **Zip bomb / inflated XLSX** | Defer to host — xl3 cannot size-cap an arbitrary OOXML before parsing | Host SHOULD apply a payload-size limit at the upload boundary (e.g., `5 MB` for typical operational templates). xl3 will surface an OOM via the host's process, not silently |
| **Large workbook (rows × cols × sheets)** | Documented hard limits (G21) | See "Implementation limits" in `spec/evaluation.md`. Limits are not security boundaries — they are correctness boundaries beyond which xl3 explicitly emits an error |
| **Adversarial formula text** | Preserved verbatim, **never executed by xl3** | Risk transfers to Excel-open time; the document opener's Excel handles formula evaluation under its own security context |
| **External link references** (workbook-to-workbook, web queries, etc.) | Preserved verbatim if present in input; xl3 never follows them | Excel/LibreOffice prompt the user on open; xl3 emits no network traffic |
| **Untrusted `__inputs__` defaults** (post-ADR-0050) | Evaluated against a *constrained* context — only `__config__` + pure scalar functions; no source data, no system access | A malicious template cannot use `__inputs__` evaluation to exfiltrate data; the env has no I/O |
| **DoS via pathological data** (many groups, deep formulas) | Host SHOULD pass an `AbortSignal` as `options.signal`, or wrap `convert()` in `Promise.race` against a timeout | xl3 ships no timeout itself — a single conversion is single-threaded; the host process is the right place to enforce wall-clock |
| **Path traversal in output filenames** | Mitigated — ADR-0002 sanitization strips forbidden chars and reserved device names | Hosts that write outputs to disk MAY still apply additional whitelists |
| **CSV / formula injection** in *output* cells | Out of scope for xl3; the output is XLSX, not CSV | If a downstream consumer exports xl3 output to CSV, that consumer is responsible for CSV-injection mitigation |
| **Supply chain (npm)** | `@xl3-lang/xl3` publishes with `npm publish --access=public --otp`. Maintainer 2FA via security key required at publish time | Per maintainer; reflected in `RELEASING.md` |

## Hosts that accept user-supplied templates

If your host accepts both `template.xlsx` AND `data.xlsx` from end
users (e.g., a public converter SaaS), the per-request budget
SHOULD include:

1. **Total upload size cap** before parse.
2. **Wall-clock timeout** around the `convert()` call (Promise.race
   pattern, or `options.signal` with an `AbortSignal`).
3. **Memory cap** on the worker process (`--max-old-space-size`
   under Node; Worker `memoryLimit` in Cloudflare Workers; etc.).
4. **Process isolation** — run conversion in a worker or subprocess
   without filesystem / network credentials for the surrounding
   service.

xl3 itself does not implement any of these — they are the host's
responsibility because the budget is application-specific.

## Reporting a vulnerability

Please **do not** open public GitHub issues for security findings.

Email the maintainer at **jykim@snack24h.com** with:

- A reproducer (minimal `template.xlsx` + `data.xlsx` + the API
  call). xl3 is single-maintainer in 2026; a clean reproducer is
  what determines triage speed.
- The xl3 version (e.g., `0.6.0`) and the runtime (Node version /
  browser).
- The expected vs observed behavior.

Acknowledgement target: 5 business days. If the issue is confirmed
as a vulnerability, a fix lands as a patch release; the CHANGELOG
records the CVE-equivalent identifier and credits the reporter
(unless they request anonymity).

## Versions covered

The maintainer accepts security reports for:

- The **current minor** of `@xl3-lang/xl3` on npm.
- The **previous minor** for ≥ 90 days after a new minor cuts.

Older versions are not patched. Users are expected to track the
current minor during pre-1.0 (per `STABILITY.md` "Pre-1.0 policy").

## Hardening checklist for host integrators

If you are embedding xl3 in production, run through this once:

- [ ] Upload size cap on template + data files at the boundary
- [ ] Wall-clock timeout on the `convert()` call
- [ ] Memory cap on the conversion worker / process
- [ ] No filesystem credentials reachable from the conversion
      process
- [ ] No outbound network credentials reachable from the
      conversion process
- [ ] Output filenames sanitized before writing to disk (xl3 does
      ADR-0002 sanitization, but disk writes deserve a second pass
      if your host has path-traversal concerns)
- [ ] Logging captures `xl3/...` error codes (ADR-0015) for
      observability without including full template / data buffers
      in logs

If any of these are missing, the threat surface is your host's,
not xl3's.

## References

- ADR-0002 — output filename sanitization
- ADR-0015 — error code catalog (host observability)
- ADR-0048 — JXLS boundary (axis 3 / 5 explain why escape hatches
  and external I/O are out of scope by design)
- ADR-0050 — `__inputs__` XTL evaluation (the constrained eval
  context)
- ROADMAP gate G20 (this doc) and G21 (hard limits)
- `spec/evaluation.md` — "Implementation limits" section (G21,
  expanded in 0.7-0.8)
