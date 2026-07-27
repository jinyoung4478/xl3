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

## `verify-fixtures.mjs`

Runs the reference implementation on each static-output fixture's inputs and compares the result to the hand-authored `expected.xlsx` using cell-value equality. Error and dynamic fixtures are skipped because their assertions are runner responsibilities. This is the local "step 4" check from [`../AUTHORING.md`](../AUTHORING.md): if the impl disagrees with expected, do **not** change expected — investigate.

This is **not** the conformance runner. The conformance runner is the protocol described in [`../runner-protocol.md`](../runner-protocol.md), which uses canonical OOXML comparison and is implementation-specific.

```bash
npm run build              # produces dist/, required by the verifier
node conformance/scripts/verify-fixtures.mjs
rm -rf dist                # dist is a build artifact, not committed
```
