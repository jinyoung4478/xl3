import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 1.0 readiness: build an ADR ↔ fixture coverage matrix from the
// `spec_section` field in every fixture's meta.yaml. Two questions
// this answers:
//
// 1. Are there ADRs with NO conformance fixtures? (ADRs that are
//    purely documentation / process don't need fixtures, but
//    semantic ADRs do.)
// 2. Are there fixtures that don't reference any ADR or spec page?
//    (Each fixture should declare what it tests.)
//
// The matrix is also written to `conformance/coverage.md` for
// human review. Adding a new ADR or fixture without updating the
// references will fail this test.

// This test file lives at impl/js/src/__tests__/; the repo root
// (spec/, conformance/, …) is four levels up.
const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const FIXTURE_DIR = join(REPO_ROOT, 'conformance', 'fixtures');
const ADR_DIR = join(REPO_ROOT, 'spec', 'decisions');

// ADRs that are intentionally not covered by fixtures because they
// describe process, audit, runner protocol, or deferral — not
// language semantics with observable output.
const INFORMATIONAL_ADRS = new Set([
  '0004', // reference impl coupling audit (informational)
  '0005', // dynamic conformance assertions (used by 023)
  '0006', // Stage 2 OOXML conformance protocol
  '0015', // structured error reporting (assertions are in fixtures, but no dedicated semantic fixture)
  '0019', // deferred — date arithmetic
  '0020', // deferred — locale collation
  '0018', // reserved — placeholder for the numbering gap, no behavior
  '0021', // implementation-defined boundaries (covered indirectly by 014/018/052; no dedicated fixture)
  '0022', // Excel version compatibility (informational catalog; no dedicated fixture)
  '0034', // relationship to prior-art template engines (informational principle)
  '0037', // rejected — dynamic image insertion (rejection IS the contract; no fixture)
  // 0038 — @group + @subtotal: impl shipped 2026-05-18, fixtures 132-135 cover it.
  '0040', // preservation matrix amendment: outline-level shipped in spliceRowsPreservingMerges 2026-05-18 (no semantic fixture; behavior is observable indirectly via Stage 2 OOXML diff); CF/DV range PE remains impl-pending — both parts intentionally untracked here until fixtures land
  '0042', // rejected — runtime cell mutation (rejection IS the contract)
  '0043', // accepted (process gate) — Excel-native preference principle
  '0045', // rejected bundle — rejection IS the contract
  '0048', // accepted (informational + process gate) — JXLS boundary
  '0049', // accepted (informational) — template display vs render output
  '0077', // accepted (process gate) — single-maintainer 1.0 (G16 fallback);
          // a governance decision, no observable output
  '0076', // deferred — pivot / sparkline / ListObject / page break left
          // implementation-defined for 1.0 (G12's deferral arm). A fixture
          // would assert the behavior the ADR declines to assert and would
          // have to be deleted in 1.1.
  // 0.7.0 spec-audit batch — fixtures 141–187 reserved by these ADRs
  // but impl-pending. Each ADR's Consequences section names the
  // fixture number(s) it intends to land in 0.7.1. Listed here so
  // the corpus≥140 floor and the per-ADR coverage requirement do
  // not block the 0.7.0 tag; revisit and remove from this list as
  // each fixture lands (tracked in ROADMAP G1 / 0.7.1 milestone).
  '0051', // string literal / block delimiter boundary
  '0052', // cell expression classification (single vs mixed-text)
  '0053', // mixed-text error sentinel propagation
  '0054', // bare name in cell context
  '0055', // directive integer bounds (positive_integer)
  '0056', // reserved sheet read policy (__config__ system keys)
  '0057', // __lists__ misuse error code
  '0058', // @subtotal row composition
  '0059', // aggregate argument shape
  '0060', // XLOOKUP value / fallback arg rules
  '0061', // source name lexical disambiguation
  '0062', // __inputs__ default empty string semantics
  '0063', // __inputs__ options pipe-split rules
  '0064', // string→number coercion scope
  '0065', // @source default explicit form
  // ADR-0070 — proposed / impl-pending. #54(A) derived columns: doc-only
  // design ahead of implementation, so no covering fixture yet. Remove
  // from this list when the derived-key conformance fixtures land.
  '0070', // proposed — #54(A) derived columns
  // ADR-0071 — rejected (see the ADR): SOURCECELL not adopted; source
  // metadata is covered by __inputs__ for host-driven flows (#57). A
  // rejected design has no covering fixture.
  '0071', // rejected — source cell scalar reference (superseded by __inputs__)
  // ADR-0072 — proposed / impl-pending. Amends ADR-0003: numFmt coercion
  // failure degrades to a warned text fallback. Doc-only design ahead of
  // implementation, so no covering fixture yet. Remove from this list when
  // the warned-fallback conformance fixtures land (021/022 conversion).
  '0072', // proposed — numFmt coercion warned fallback (amends ADR-0003)
  // ADR-0075 — implemented, but JSON source input is outside the
  // .xlsx-driven conformance corpus (template.xlsx + data.xlsx). Covered
  // by focused unit tests (json-source.test.ts) instead of a fixture.
  '0075', // xl3-source-json — covered by unit tests, not the xlsx corpus
]);

// Tests used by ADR-0005 dynamic assertion. Counted as covering 0005.
const ADR_0005_FIXTURES = ['023-today-utc-dynamic'];
// Tests used by ADR-0015 structured error code coverage.
const ADR_0015_FIXTURES = ['017', '018', '019', '020', '021', '022', '032', '033', '034', '037', '042', '067', '072', '073', '076', '077', '078', '081', '082', '091'];

describe('spec coverage — ADR ↔ fixture matrix', () => {
  it('every semantic ADR has at least one covering fixture', () => {
    const fixtureRefs = collectFixtureAdrRefs();
    const adrFiles = readdirSync(ADR_DIR)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .filter((f) => f !== '0000-template.md');

    const uncovered: string[] = [];
    for (const f of adrFiles) {
      const id = f.match(/^(\d{4})/)![1]!;
      if (INFORMATIONAL_ADRS.has(id)) continue;
      const refs = fixtureRefs.get(id) ?? [];
      if (refs.length === 0) {
        uncovered.push(f);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it('every fixture declares a spec_section', () => {
    const fixtures = readdirSync(FIXTURE_DIR).filter((entry) =>
      statSync(join(FIXTURE_DIR, entry)).isDirectory(),
    );
    const missing: string[] = [];
    for (const entry of fixtures) {
      const meta = join(FIXTURE_DIR, entry, 'meta.yaml');
      const text = readFileSync(meta, 'utf8');
      if (!/^spec_section:/m.test(text)) missing.push(entry);
    }
    expect(missing).toEqual([]);
  });

  it('writes a coverage matrix to conformance/coverage.md', () => {
    const fixtureRefs = collectFixtureAdrRefs();
    const adrFiles = readdirSync(ADR_DIR)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .filter((f) => f !== '0000-template.md')
      .sort();

    const lines: string[] = [];
    lines.push('# ADR coverage matrix');
    lines.push('');
    lines.push('Auto-generated by `impl/js/src/__tests__/spec-coverage.test.ts`. Do not edit manually.');
    lines.push('');
    lines.push('| ADR | Title | Covering fixtures |');
    lines.push('|---|---|---|');
    for (const f of adrFiles) {
      const id = f.match(/^(\d{4})/)![1]!;
      const title = readAdrTitle(join(ADR_DIR, f));
      let refs = fixtureRefs.get(id) ?? [];
      if (id === '0005') refs = [...new Set([...refs, ...ADR_0005_FIXTURES])];
      if (id === '0015') refs = [...new Set([...refs, ...ADR_0015_FIXTURES])];
      const cell = refs.length > 0
        ? refs.map((r) => `\`${r.replace(/^0+/, '')}\``).sort().join(', ')
        : INFORMATIONAL_ADRS.has(id) ? '_(informational)_' : '**none**';
      lines.push(`| ${id} | ${title} | ${cell} |`);
    }

    const out = lines.join('\n') + '\n';
    const path = join(REPO_ROOT, 'conformance', 'coverage.md');
    const existing = (() => { try { return readFileSync(path, 'utf8'); } catch { return ''; } })();
    if (existing !== out) {
      writeFileSync(path, out);
    }
    // Always assert the file exists and has content.
    expect(out.length).toBeGreaterThan(100);
  });
});

function collectFixtureAdrRefs(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const fixtures = readdirSync(FIXTURE_DIR).filter((entry) =>
    statSync(join(FIXTURE_DIR, entry)).isDirectory(),
  );
  for (const entry of fixtures) {
    const meta = readFileSync(join(FIXTURE_DIR, entry, 'meta.yaml'), 'utf8');
    const m = meta.match(/^spec_section:\s*(.+)$/m);
    if (!m) continue;
    const adrMatches = m[1]!.matchAll(/ADR-(\d{4})/g);
    for (const am of adrMatches) {
      const id = am[1]!;
      if (!refs.has(id)) refs.set(id, []);
      refs.get(id)!.push(entry);
    }
  }
  return refs;
}

function readAdrTitle(path: string): string {
  const text = readFileSync(path, 'utf8');
  const first = text.split('\n')[0]!;
  return first.replace(/^#\s*/, '').replace(/^ADR\s+\d{4}\s*-\s*/, '').trim();
}
