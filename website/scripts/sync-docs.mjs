#!/usr/bin/env node
// Sync the repo's markdown trees into `website/docs/` so Docusaurus can
// serve them. This is a build-time copy, not a runtime mirror — runs
// before `docusaurus build` / `docusaurus start`.
//
// Sources kept canonical at the repo root (guides in docs/guides,
// spec in spec/, conformance docs in conformance/, top-level reference
// docs at the root). Docusaurus only sees `website/docs/`.

import { cp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEBSITE = join(HERE, '..');
const REPO = join(WEBSITE, '..');
const TARGET = join(WEBSITE, 'docs');
const COPY_OPTIONS = { recursive: true, dereference: true };

const COPIES = [
  // [src absolute, dest relative to TARGET]
  ['docs/guides', 'guides'],
  ['docs/migration-0.x-to-1.0.md', 'migration-0.x-to-1.0.md'],
  ['docs/api', 'api'],
  ['spec', 'spec'],
  ['conformance', 'conformance'],
  ['PORTERS_GUIDE.md', 'PORTERS_GUIDE.md'],
  ['IMPLEMENTATIONS.md', 'IMPLEMENTATIONS.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.md'],
  ['GOVERNANCE.md', 'GOVERNANCE.md'],
  ['ROADMAP.md', 'ROADMAP.md'],
  ['RELEASING.md', 'RELEASING.md'],
  ['README.md', 'README.md'],
];

// Files in the conformance/ tree we don't want to surface.
const CONFORMANCE_EXCLUDE = new Set(['fixtures', 'scripts', 'reports']);

async function main() {
  await rm(TARGET, { recursive: true, force: true });
  await mkdir(TARGET, { recursive: true });

  for (const [src, dest] of COPIES) {
    const absSrc = join(REPO, src);
    const absDest = join(TARGET, dest);
    if (!existsSync(absSrc)) {
      console.warn(`skip missing: ${src}`);
      continue;
    }
    if (src === 'conformance') {
      await mkdir(absDest, { recursive: true });
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(absSrc, { withFileTypes: true });
      for (const e of entries) {
        if (CONFORMANCE_EXCLUDE.has(e.name)) continue;
        if (e.isDirectory()) {
          await cp(join(absSrc, e.name), join(absDest, e.name), COPY_OPTIONS);
        } else if (e.name.endsWith('.md')) {
          await cp(join(absSrc, e.name), join(absDest, e.name));
        }
      }
      continue;
    }
    await cp(absSrc, absDest, COPY_OPTIONS);
  }

  // The spec/ tree has a `decisions/` subfolder with 32 ADRs. They use
  // literal `{{ }}` in examples which is fine for Docusaurus `.md` (no
  // MDX), but `decisions/0018-reserved.md` is just a placeholder. We
  // keep them all for completeness — Docusaurus auto-pages them.

  // Guides README → index (prefer index.md, drop README.md to avoid
  // two docs claiming the same route).
  await preferIndexOverReadme(join(TARGET, 'guides'));

  // Spec already ships an index.md; drop README.md to avoid a route
  // collision with `/spec/`.
  await preferIndexOverReadme(join(TARGET, 'spec'));

  // TypeDoc emits an `api/README.md` overview; rename to index.md so
  // `/api` resolves.
  await preferIndexOverReadme(join(TARGET, 'api'));

  // Strip the "Function: " / "Interface: " / "Type Alias: " prefix from
  // typedoc's H1. The kind is already conveyed by the sidebar category
  // and the URL segment (/api/functions/...), so repeating it on every
  // page title and sidebar entry is redundant.
  await stripApiKindPrefixes(join(TARGET, 'api'));

  // Conformance has README.md (overview) + DASHBOARD.md (live status).
  // Promote README → index so the /conformance URL serves the overview;
  // DASHBOARD stays as a sibling at /conformance/dashboard (via slug).
  await preferIndexOverReadme(join(TARGET, 'conformance'));

  // Inject `slug` frontmatter so user-facing URLs are all lowercase /
  // kebab-case, even though the canonical repo files keep the GitHub
  // UPPERCASE.md convention (README, CONTRIBUTING, GOVERNANCE, etc.
  // get auto-linking in GitHub's UI by exact filename). Synced files
  // keep their original names so repo-style relative links
  // (`[GOVERNANCE.md](./GOVERNANCE.md)`) still resolve.
  await injectSlugs(TARGET, LOWERCASE_SLUGS);

  // SEO titles/descriptions for landing docs. Injected here (not in
  // the canonical files) so GitHub renders stay clean. Frontmatter
  // `title` only affects <title>/og:title — sidebars.ts pins labels
  // explicitly, and the markdown H1 stays as-is.
  await injectSeoMeta(TARGET, SEO_META);

  // Canonical repo paths use relative links that target GitHub's file
  // layout (`../../spec/language.md` from a cookbook recipe). Once the
  // file is copied into `website/docs/`, the depth changes and most
  // relative paths drift. Fix the common patterns up front so the
  // build doesn't warn on every recipe.
  await rewriteRelativePaths(TARGET);

  // Rewrite repo-tree-only links. The canonical markdown files at the
  // repo root reference paths that exist on GitHub but not in the
  // synced docs/ tree (examples/, LICENSE, conformance/fixtures, …).
  // Without this rewrite they 404 on xl3.io.
  await rewriteDeadLinks([
    join(TARGET, 'PORTERS_GUIDE.md'),
    join(TARGET, 'IMPLEMENTATIONS.md'),
    join(TARGET, 'CONTRIBUTING.md'),
    join(TARGET, 'GOVERNANCE.md'),
    join(TARGET, 'ROADMAP.md'),
    join(TARGET, 'README.md'),
    join(TARGET, 'guides', 'index.md'),
    join(TARGET, 'spec', 'evaluation.md'),
    join(TARGET, 'spec', 'language.md'),
    join(TARGET, 'spec', 'index.md'),
    join(TARGET, 'spec', 'STABILITY.md'),
    join(TARGET, 'conformance', 'index.md'),
    join(TARGET, 'conformance', 'DASHBOARD.md'),
    join(TARGET, 'conformance', 'AUTHORING.md'),
    join(TARGET, 'conformance', 'runner-protocol.md'),
    join(TARGET, 'conformance', 'coverage.md'),
    // ADRs link spec siblings via `../language.md` etc.; when an
    // untranslated ADR renders as the English fallback under a locale
    // prefix, raw relative `.md` hrefs leak and 404.
    ...(await readdirMd(join(TARGET, 'spec', 'decisions'))),
    join(TARGET, 'spec', 'glossary.md'),
  ]);

  // The synced tree is gitignored, so Docusaurus's git-based lastUpdate
  // lookup can't see it. Stamp each file with the canonical source's
  // last commit date via `last_update` frontmatter (read before git by
  // the docs plugin), so the sitemap gets a real <lastmod> per page.
  await stampLastUpdate(TARGET);

  console.log('synced markdown into', TARGET);
}

const GH_BLOB = 'https://github.com/xl3-lang/xl3/blob/main';
const GH_TREE = 'https://github.com/xl3-lang/xl3/tree/main';

// Paths that 404 on the site (excluded from the synced docs/ tree or
// never copied). Each entry maps a relative link target to an absolute
// GitHub URL or an absolute site path. Tree = repo directory, blob =
// repo file, site = page on the deployed site.
const DEAD_LINK_PREFIXES = [
  { prefix: 'conformance/fixtures/', kind: 'tree' },
  { prefix: 'conformance/reports/', kind: 'tree' },
  { prefix: 'examples/', kind: 'tree' },
  { prefix: 'impl/', kind: 'tree' },
  // Cookbook recipes have site routes (/guides/<name>); the rest of
  // docs/ (llm-template-authoring, internal/) is repo-only.
  { prefix: 'docs/guides/', kind: 'site-md', target: '/guides/' },
  { prefix: 'docs/', kind: 'blob' },
];

const DEAD_LINK_EXACT = {
  'spec/decisions/': { kind: 'tree' },
  'spec/decisions': { kind: 'tree', target: 'spec/decisions/' },
  'examples': { kind: 'tree', target: 'examples/' },
  'examples/': { kind: 'tree' },
  'LICENSE': { kind: 'blob' },
  'spec/LICENSE': { kind: 'blob' },
  // Repo files that are intentionally not synced into the site.
  'CHANGELOG.md': { kind: 'blob' },
  'SECURITY.md': { kind: 'blob' },
  // scripts/ is repo-only. spec/evaluation.md cites BENCH.md as the
  // source of the measured resource limits (G8/G21), so the reference
  // has to resolve somewhere — GitHub, since it is a maintenance
  // artifact with its own update workflow rather than user docs.
  'scripts/BENCH.md': { kind: 'blob' },
  // Synced targets with a live route. Plain relative `.md` links
  // resolve fine on the default locale, but when an untranslated doc
  // is rendered as the English fallback under /<locale>/, Docusaurus
  // leaves the raw `.md` href in place and it 404s. Absolute site
  // paths render correctly from every locale.
  'spec/language.md': { kind: 'site', target: '/spec/language' },
  'spec/evaluation.md': { kind: 'site', target: '/spec/evaluation' },
  'spec/glossary.md': { kind: 'site', target: '/spec/glossary' },
  'spec/STABILITY.md': { kind: 'site', target: '/spec/stability' },
  'spec/README.md': { kind: 'site', target: '/spec' },
  'spec/index.md': { kind: 'site', target: '/spec' },
  'conformance/README.md': { kind: 'site', target: '/conformance' },
  'conformance/DASHBOARD.md': { kind: 'site', target: '/conformance/dashboard' },
  'conformance/AUTHORING.md': { kind: 'site', target: '/conformance/authoring' },
  'conformance/coverage.md': { kind: 'site', target: '/conformance/coverage' },
  'conformance/runner-protocol.md': { kind: 'site', target: '/conformance/runner-protocol' },
  'GOVERNANCE.md': { kind: 'site', target: '/governance' },
  'IMPLEMENTATIONS.md': { kind: 'site', target: '/implementations' },
  'ROADMAP.md': { kind: 'site', target: '/roadmap' },
  'PORTERS_GUIDE.md': { kind: 'site', target: '/porters-guide' },
  'CONTRIBUTING.md': { kind: 'site', target: '/contributing' },
  'RELEASING.md': { kind: 'site', target: '/releasing' },
  // Conformance pages cross-link siblings bare (`./runner-protocol.md`).
  'runner-protocol.md': { kind: 'site', target: '/conformance/runner-protocol' },
  'DASHBOARD.md': { kind: 'site', target: '/conformance/dashboard' },
  'AUTHORING.md': { kind: 'site', target: '/conformance/authoring' },
  'coverage.md': { kind: 'site', target: '/conformance/coverage' },
  // Spec pages and ADRs cross-link spec siblings (`./language.md`,
  // `../evaluation.md` from decisions/).
  'language.md': { kind: 'site', target: '/spec/language' },
  'evaluation.md': { kind: 'site', target: '/spec/evaluation' },
  'glossary.md': { kind: 'site', target: '/spec/glossary' },
  'STABILITY.md': { kind: 'site', target: '/spec/stability' },
  // Repo-level dirs/files that have a live site equivalent.
  'docs/guides/': { kind: 'site', target: '/guides/' },
  'docs/guides': { kind: 'site', target: '/guides' },
};

async function readdirMd(dir) {
  if (!existsSync(dir)) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(dir, e.name));
}

async function rewriteDeadLinks(files) {
  // Match `]([./|../[…]]path)` — any number of leading `..` segments.
  const linkRe = /\]\(((?:\.\.?\/)+)([^)#]+)(#[^)]*)?\)/g;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const body = await readFile(file, 'utf8');
    const rewritten = body.replace(linkRe, (match, _prefix, target, frag = '') => {
      const exact = DEAD_LINK_EXACT[target];
      if (exact) {
        if (exact.kind === 'site') return `](${exact.target}${frag})`;
        const base = exact.kind === 'tree' ? GH_TREE : GH_BLOB;
        return `](${base}/${exact.target ?? target}${frag})`;
      }
      for (const { prefix, kind, target: siteBase } of DEAD_LINK_PREFIXES) {
        if (target.startsWith(prefix)) {
          // site-md: repo path with a live site route — strip the
          // prefix, the .md extension and the NN- number prefix that
          // Docusaurus's numberPrefixParser drops from routes
          // (docs/guides/03-aggregates.md → /guides/aggregates).
          if (kind === 'site-md') {
            const page = target
              .slice(prefix.length)
              .replace(/\.md$/, '')
              .replace(/^\d+-/, '');
            return `](${siteBase}${page}${frag})`;
          }
          const base = kind === 'tree' ? GH_TREE : GH_BLOB;
          return `](${base}/${target}${frag})`;
        }
      }
      return match;
    });
    if (rewritten !== body) {
      await writeFile(file, rewritten);
    }
  }
}

const API_PREFIX_DIRS = ['functions', 'interfaces', 'type-aliases'];
const API_PREFIX_RE = /^# (?:Function|Interface|Type Alias):\s+/;

async function stripApiKindPrefixes(apiDir) {
  const { readdir } = await import('node:fs/promises');
  for (const sub of API_PREFIX_DIRS) {
    const dir = join(apiDir, sub);
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      const file = join(dir, e.name);
      const body = await readFile(file, 'utf8');
      const rewritten = body.replace(API_PREFIX_RE, '# ');
      if (rewritten !== body) await writeFile(file, rewritten);
    }
  }
}

async function rewriteRelativePaths(target) {
  const { readdir } = await import('node:fs/promises');

  // Guides: canonical is `docs/guides/`, synced is `website/docs/guides/`.
  // GitHub-style `../../spec/X.md` and `../../README.md` both lose one
  // segment after the sync drop.
  for (const entry of await readdir(join(target, 'guides'), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const file = join(target, 'guides', entry.name);
    let body = await readFile(file, 'utf8');
    let changed = false;
    const next = body
      .replace(/\]\(\.\.\/\.\.\/spec\/([\w./-]+)\.md(#[^)]*)?\)/g, (_, name, frag = '') => {
        changed = true;
        return `](../spec/${name}.md${frag})`;
      })
      // #67: sibling guide links (`./03-aggregates.md`) resolve fine on the
      // default locale but leak the raw `.md` path — with the NN- prefix —
      // when an UNtranslated guide renders as the English fallback under a
      // locale prefix (/ja/guides/…). Rewrite to the absolute guide route
      // (number + .md dropped, matching Docusaurus's numberPrefixParser).
      .replace(/\]\(\.\/\d{2}-([a-z0-9-]+)\.md(#[^)]*)?\)/g, (_, name, frag = '') => {
        changed = true;
        return `](/guides/${name}${frag})`;
      })
      // Single-level spec links from a guide (`../spec/language.md`) also
      // leak under locale fallback — send them to the absolute spec route.
      .replace(/\]\(\.\.\/spec\/([a-z-]+)\.md(#[^)]*)?\)/g, (_, name, frag = '') => {
        changed = true;
        return `](/spec/${name}${frag})`;
      })
      .replace(/\]\(\.\.\/\.\.\/README\.md(#[^)]*)?\)/g, (_, frag = '') => {
        changed = true;
        // /readme is the synced top-level README; preserve anchors so
        // links to specific sections (#usage etc.) keep working.
        return `](/readme${frag})`;
      })
      // `../llm-template-authoring.md` points at docs/ in the repo;
      // that file is not synced, so send it out to GitHub.
      .replace(/\]\(\.\.\/llm-template-authoring\.md(#[^)]*)?\)/g, (_, frag = '') => {
        changed = true;
        return `](${GH_BLOB}/docs/llm-template-authoring.md${frag})`;
      });
    if (changed) await writeFile(file, next);
  }

  // Spec/STABILITY links to `./README.md`; the overview lives at /spec.
  // Absolute path so locale-fallback rendering doesn't leak a raw
  // `.md` href (see DEAD_LINK_EXACT site entries).
  const stab = join(target, 'spec', 'STABILITY.md');
  if (existsSync(stab)) {
    const body = await readFile(stab, 'utf8');
    const next = body.replace(/\]\(\.\/README\.md(#[^)]*)?\)/g, '](/spec$1)');
    if (next !== body) await writeFile(stab, next);
  }

  // Conformance overview (was README.md, now index.md) links to
  // `../spec/README.md` — that file no longer exists (promoted to
  // spec/index.md by preferIndexOverReadme).
  const conf = join(target, 'conformance', 'index.md');
  if (existsSync(conf)) {
    const body = await readFile(conf, 'utf8');
    const next = body.replace(/\]\(\.\.\/spec\/README\.md(#[^)]*)?\)/g, '](../spec/index.md$1)');
    if (next !== body) await writeFile(conf, next);
  }

  // Top-level README.md → `./README.<lang>.md`: language READMEs are
  // not synced into the site (they'd collide with /readme). Send the
  // links out to GitHub instead.
  const README_LANG_RE = /\]\(\.\/README\.([a-z]{2}(?:-[A-Z]{2})?)\.md(#[^)]*)?\)/g;
  const readme = join(target, 'README.md');
  if (existsSync(readme)) {
    const body = await readFile(readme, 'utf8');
    const next = body.replace(README_LANG_RE, (_, lang, frag = '') =>
      `](${GH_BLOB}/README.${lang}.md${frag})`
    );
    if (next !== body) await writeFile(readme, next);
  }
}

// Map: synced-file path (relative to TARGET) → final user-facing URL.
// Files keep their original UPPERCASE names; only the URL slug changes.
// Index docs are also pinned so `/api`, `/guides`, `/spec`, `/conformance`
// land on the overview without a trailing slash.
const LOWERCASE_SLUGS = {
  'PORTERS_GUIDE.md': '/porters-guide',
  'IMPLEMENTATIONS.md': '/implementations',
  'CONTRIBUTING.md': '/contributing',
  'GOVERNANCE.md': '/governance',
  'ROADMAP.md': '/roadmap',
  'RELEASING.md': '/releasing',
  'README.md': '/readme',
  'spec/STABILITY.md': '/spec/stability',
  'conformance/DASHBOARD.md': '/conformance/dashboard',
  'conformance/AUTHORING.md': '/conformance/authoring',
  'api/index.md': '/api',
  'guides/index.md': '/guides',
  'spec/index.md': '/spec',
  'conformance/index.md': '/conformance',
};

// Last commit date (YYYY-MM-DD) of a repo path, or null if untracked.
function gitDate(repoRel) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', repoRel], {
      cwd: REPO,
      encoding: 'utf8',
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// Map a synced file (relative to TARGET) back to its canonical repo
// path. Returns null for generated files (api/ comes from typedoc).
function canonicalSource(rel) {
  if (rel.startsWith('api/')) return null;
  if (rel.startsWith('guides/')) return `docs/${rel}`;
  // spec/, conformance/ and top-level files keep their repo paths.
  return rel;
}

async function stampLastUpdate(target) {
  // typedoc output has no git history of its own; it derives from
  // impl/js/src/, so every api/ page shares the date of the last commit
  // touching impl/js/src/.
  const apiDate = gitDate('impl/js/src');
  const { readdir } = await import('node:fs/promises');

  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!e.name.endsWith('.md')) continue;
      const rel = relative(target, abs);
      const src = canonicalSource(rel);
      let date = src === null ? apiDate : gitDate(src);
      // index.md may have been promoted from README.md by
      // preferIndexOverReadme — retry under the original name.
      if (!date && src && src.endsWith('index.md')) {
        date = gitDate(src.replace(/index\.md$/, 'README.md'));
      }
      if (!date) continue;
      const body = await readFile(abs, 'utf8');
      const fm = `last_update:\n  date: ${date}`;
      if (body.startsWith('---\n')) {
        const end = body.indexOf('\n---\n', 4);
        if (end !== -1 && !/^last_update:/m.test(body.slice(0, end))) {
          await writeFile(abs, body.slice(0, end) + `\n${fm}` + body.slice(end));
        }
      } else {
        await writeFile(abs, `---\n${fm}\n---\n\n${body}`);
      }
    }
  }

  await walk(target);
}

// Keyword-targeted <title> / meta description per landing doc.
// "excel template language" has a near-empty SERP and /spec is the
// exact-match answer; /guides targets the how-to long tail.
const SEO_META = {
  'spec/index.md': {
    title: 'XTL — an Excel Template Language · Specification',
    description:
      'Normative specification for XTL, the Excel template language: template syntax, evaluation model, design decisions (ADRs), and conformance fixtures.',
  },
  'guides/index.md': {
    title: 'XTL Guides — Excel templating recipes for loops, joins, and grouping',
    description:
      'Hands-on recipes for the XTL Excel template language: runtime inputs, multi-source joins, group-and-subtotal, conditional cells, file-per-group output, and more.',
  },
  'guides/19-jxls-to-xl3.md': {
    title: 'JXLS Alternative for JavaScript & Node.js — Migrate JXLS Templates to xl3',
    description:
      'Migrate JXLS templates to xl3, the JavaScript Excel template engine: jx:each, jx:if, groupBy, and multisheet mapped to XTL directives, with a step-by-step checklist.',
  },
};

async function injectSeoMeta(target, map) {
  for (const [rel, meta] of Object.entries(map)) {
    const file = join(target, rel);
    if (!existsSync(file)) continue;
    const body = await readFile(file, 'utf8');
    const lines = [];
    if (meta.title) lines.push(`title: "${meta.title}"`);
    if (meta.description) lines.push(`description: "${meta.description}"`);
    const fm = lines.join('\n');
    if (body.startsWith('---\n')) {
      const end = body.indexOf('\n---\n', 4);
      if (end !== -1 && !/^title:/m.test(body.slice(0, end))) {
        await writeFile(file, body.slice(0, end) + `\n${fm}` + body.slice(end));
      }
    } else {
      await writeFile(file, `---\n${fm}\n---\n\n${body}`);
    }
  }
}

async function injectSlugs(target, map) {
  for (const [rel, slug] of Object.entries(map)) {
    const file = join(target, rel);
    if (!existsSync(file)) continue;
    const body = await readFile(file, 'utf8');
    if (body.startsWith('---\n')) {
      const end = body.indexOf('\n---\n', 4);
      if (end !== -1 && !/^slug:\s*/m.test(body.slice(0, end))) {
        await writeFile(file, body.slice(0, end) + `\nslug: ${slug}` + body.slice(end));
      }
    } else {
      await writeFile(file, `---\nslug: ${slug}\n---\n\n${body}`);
    }
  }
}

async function preferIndexOverReadme(dir) {
  const readme = join(dir, 'README.md');
  const index = join(dir, 'index.md');
  if (!existsSync(readme)) return;
  if (!existsSync(index)) {
    const body = await readFile(readme, 'utf8');
    await writeFile(index, body);
  }
  await unlink(readme);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
