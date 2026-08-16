import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Six surfaces state the corpus size and the ADR count as prose: the
// homepage Standard section, the JSON-LD featureList in the site config,
// `site/llms-full.txt`, and the four READMEs. Nothing generates any of
// them, and they drifted — the homepage still said 75 ADRs / 160 fixtures
// while the corpus was at 77 / 169, and an external reviewer quoted the
// stale pair back at the project as fact. This test turns a stale claim
// into a red test instead of a marketing bug.
//
// A *reworded* claim fails too, on purpose. If a regex stops matching,
// that number is no longer being checked at all, and silently passing is
// worse than a failure that names the file and the sentence. When a
// sentence legitimately changes, update its pattern here.
//
// Not covered on purpose: ROADMAP.md, CHANGELOG.md, and the conformance
// reports. Those record what was true at a past moment — a gate note
// saying "DONE (160 fixtures)" is history, not a claim about today.
//
// The same split applies to the *version* claims checked at the bottom of
// this file. "shipped in 0.12.0" and the `### 0.12.0` release sections are
// history and stay put; "The current version is 0.12.0" is a claim about
// today and goes stale the moment a release lands. Two of those survived
// the 0.13.0 cut — the release updated the four READMEs and the CDN pins
// but not these, and RELEASING's post-publish check greps for
// `@xl3-lang/xl3@N` pins, which is a shape neither of them has.

// This test file lives at impl/js/src/__tests__/; the repo root
// (spec/, conformance/, README.md, …) is four levels up.
const REPO_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));

/**
 * Decisions in `spec/decisions/`, excluding reserved numbering
 * placeholders. ADR-0018 is `Status: reserved` — it holds a gap in the
 * sequence and records no decision, so counting it would overstate the
 * design record by one.
 */
function countAdrs(): number {
  const dir = join(REPO_ROOT, 'spec', 'decisions');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .filter((name) => {
      const body = readFileSync(join(dir, name), 'utf8');
      return !/^- \*\*Status:\*\*\s*reserved\s*$/m.test(body);
    }).length;
}

/** Fixture directories under `conformance/fixtures/`. */
function countFixtures(): number {
  return readdirSync(join(REPO_ROOT, 'conformance', 'fixtures'), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length;
}

type Kind = 'adr' | 'fixtures';

interface Claim {
  /** Repo-relative path. */
  readonly file: string;
  /** What the sentence is, for the test name. */
  readonly what: string;
  /** Must match exactly once; capture groups map to `kinds` in order. */
  readonly re: RegExp;
  readonly kinds: readonly Kind[];
}

const CLAIMS: readonly Claim[] = [
  {
    file: 'website/src/pages/index.tsx',
    what: 'homepage Standard section — ADR count',
    re: /<strong>(\d+) ADRs<\/strong>/,
    kinds: ['adr'],
  },
  {
    file: 'website/src/pages/index.tsx',
    what: 'homepage Standard section — fixture count',
    re: /<strong>(\d+) conformance fixtures<\/strong>/,
    kinds: ['fixtures'],
  },
  {
    file: 'website/docusaurus.config.ts',
    what: 'JSON-LD featureList',
    re: /(\d+) Architecture Decision Records and (\d+) conformance fixtures/,
    kinds: ['adr', 'fixtures'],
  },
  {
    file: 'site/llms-full.txt',
    what: 'llms-full.txt Spec line',
    re: /Spec: (\d+) ADRs, (\d+) conformance fixtures/,
    kinds: ['adr', 'fixtures'],
  },
  {
    file: 'README.md',
    what: 'en README — "the N-fixture conformance corpus"',
    re: /the (\d+)-fixture conformance corpus/,
    kinds: ['fixtures'],
  },
  {
    file: 'README.md',
    what: 'en README — Conformance corpus bullet',
    re: /(\d+) fixtures, all green, across (\d+) ADRs/,
    kinds: ['fixtures', 'adr'],
  },
  {
    file: 'README.ko.md',
    what: 'ko README — fixture 코퍼스',
    re: /(\d+) 개 conformance fixture 코퍼스/,
    kinds: ['fixtures'],
  },
  {
    file: 'README.ko.md',
    what: 'ko README — 적합성 픽스처 항목',
    re: /ADR (\d+)개 위에 픽스처 (\d+)개/,
    kinds: ['adr', 'fixtures'],
  },
  {
    file: 'README.ja.md',
    what: 'ja README — fixture コーパス',
    re: /(\d+) 件の conformance fixture コーパス/,
    kinds: ['fixtures'],
  },
  {
    file: 'README.ja.md',
    what: 'ja README — Conformance コーパス項目',
    re: /(\d+) 件の fixture、すべて green、(\d+) 件の/,
    kinds: ['fixtures', 'adr'],
  },
  {
    file: 'README.zh-CN.md',
    what: 'zh-CN README — fixture 语料库',
    re: /(\d+) 条 fixture 组成的 conformance 语料库/,
    kinds: ['fixtures'],
  },
  {
    file: 'README.zh-CN.md',
    what: 'zh-CN README — Conformance 语料库条目',
    re: /(\d+) 个 ADR 下共 (\d+) 条 fixture/,
    kinds: ['adr', 'fixtures'],
  },
];

describe('published ADR and fixture counts', () => {
  const expected: Record<Kind, number> = {
    adr: countAdrs(),
    fixtures: countFixtures(),
  };

  it('counts the design record and the corpus off disk', () => {
    // A sanity floor, not the assertion that matters: if either counter
    // returns 0 the claim checks below would all "pass" against nothing.
    expect(expected.adr).toBeGreaterThan(50);
    expect(expected.fixtures).toBeGreaterThan(140); // ROADMAP G1 floor
  });

  it.each(CLAIMS)('$file — $what', ({ file, re, kinds }) => {
    const body = readFileSync(join(REPO_ROOT, file), 'utf8');
    const match = re.exec(body);

    expect(
      match,
      `No match for ${re} in ${file}. The sentence was probably reworded — ` +
        `update the pattern in published-counts.test.ts so the count stays checked.`,
    ).not.toBeNull();

    kinds.forEach((kind, i) => {
      const claimed = Number(match![i + 1]);
      expect(
        claimed,
        `${file} claims ${claimed} ${kind}, but the repo has ${expected[kind]}.`,
      ).toBe(expected[kind]);
    });
  });
});

/**
 * Prose that names the currently published npm version. Unlike the
 * `@xl3-lang/xl3@0.13.0` pins RELEASING already greps for, these are
 * sentences, so nothing catches them drifting except this test.
 */
const VERSION_CLAIMS: readonly Claim[] = [
  {
    file: 'ROADMAP.md',
    what: 'intro — "The current version is X"',
    re: /The current version is \*\*(\d+\.\d+\.\d+)\*\* \(npm\)/,
    kinds: [],
  },
  {
    file: 'site/llms-full.txt',
    what: 'llms-full.txt Version line (served to AI crawlers)',
    re: /^Version: (\d+\.\d+\.\d+) \(pre-1\.0\)/m,
    kinds: [],
  },
];

describe('published version claims', () => {
  const packaged = (
    JSON.parse(
      readFileSync(join(REPO_ROOT, 'impl', 'js', 'package.json'), 'utf8'),
    ) as { version: string }
  ).version;

  it.each(VERSION_CLAIMS)('$file — $what', ({ file, re }) => {
    const body = readFileSync(join(REPO_ROOT, file), 'utf8');
    const match = re.exec(body);

    expect(
      match,
      `No match for ${re} in ${file}. The sentence was probably reworded — ` +
        `update the pattern here so the version stays checked.`,
    ).not.toBeNull();

    expect(
      match![1],
      `${file} says the current version is ${match![1]}, but impl/js/package.json ` +
        `is at ${packaged}. Bump the prose with the release, or drop the claim.`,
    ).toBe(packaged);
  });
});
