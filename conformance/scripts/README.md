# Authoring Scripts

These scripts are **authoring-time aids**, not the conformance runner.

## `build-fixtures.mjs`

Constructs `template.xlsx`, `data.xlsx`, and `expected.xlsx` for each fixture by writing every cell explicitly from the spec. The script never imports anything from `impl/js/src/`; `exceljs` is used only as a generic xlsx writer, the same way Excel itself would be in a manual flow. This preserves the cardinal rule from [`../AUTHORING.md`](../AUTHORING.md): expected outputs are authored from the spec, not generated from the reference implementation.

```bash
node conformance/scripts/build-fixtures.mjs
```

To rebuild only selected fixtures, pass fixture ids:

```bash
node conformance/scripts/build-fixtures.mjs 026
```

Fixture 027 uses the same authoring flow, then rewrites selected OOXML package
parts to simulate cross-writer serialization differences while preserving the
same workbook semantics.

The committed `.xlsx` files in `conformance/fixtures/<NNN>-*/` are the artifacts of this script. The script itself is checked in as an audit trail so reviewers can re-derive the binaries from the source comments and confirm no spec-versus-impl shortcut was taken.

## Verifying a fixture against the impl

`AUTHORING.md` step 4 — run the reference impl and confirm it agrees with
the hand-authored `expected.xlsx`:

```bash
npm run build
npm run conformance          # all fixtures
npm run conformance:tz       # and under UTC / America/New_York / Asia/Seoul
```

A `verify-fixtures.mjs` script used to live here for this. It was removed
2026-07-28: it duplicated the runner, had been unrunnable since the impl
moved to `impl/js` in #79, and — the reason it was deleted rather than
repaired — its comparison collapsed dates to ISO strings, so it would
have passed a fixture whose expected `Date` had been replaced by the
equivalent text. A checker that cannot see that difference gives false
assurance on exactly the fixtures that pin native value types.

