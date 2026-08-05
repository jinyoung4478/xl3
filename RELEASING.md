# Releasing xl3

The reference impl publishes to npm; the spec lives in this repo.
This file documents the cut procedure for both.

The JS/TS reference implementation lives in `impl/js/` (published as
`@xl3-lang/xl3`). The repo root is an npm workspace: run `npm ci` at
the root, and publish with `npm publish -w @xl3-lang/xl3` (or from
inside `impl/js/`).

## Versioning model

The npm package version (`impl/js/package.json`) and the XTL spec version
(`spec/STABILITY.md`) move on **independent timelines** but follow
related rules:

| Bump | Trigger |
|---|---|
| `xl3` patch (`1.0.x`) | impl bug fix; no API change; no spec change |
| `xl3` minor (`1.x.0`) | new export; spec opt-in addition (e.g., new function added in XTL 1.x) |
| `xl3` major (`2.0.0`) | spec breaking change OR impl API breaking change |
| XTL minor (e.g., 1.0 → 1.1) | additive spec change (new function, new directive option) |
| XTL major (e.g., 1.0 → 2.0) | breaking spec change (changes existing semantics) |

A spec minor bump usually drives an `xl3` minor bump but not always;
a pure impl refactor can ship as `xl3` patch with no spec change.

## Pre-release sequence (for any 1.x.0)

1. Land all targeted PRs on `main`.
2. Verify locally:

   ```bash
   npm run typecheck
   npm test -- --run
   npm run build
   npm run conformance
   npm run conformance:tz
   npm run examples:build
   npm run examples:run
   npm run bench
   ```

   All MUST be green. The bench numbers go in
   `scripts/BENCH.md` if they shifted significantly.

3. Confirm `CHANGELOG.md` `[Unreleased]` is comprehensive.
4. Bump `impl/js/package.json` version to the rc form
   (e.g., `1.0.0-rc.1`). Do NOT publish a `1.0.0` directly without
   an rc cycle for any major / new-spec-minor release.

   Then sync the runtime constant, which is generated from the
   manifest and committed (xl3#103):

   ```bash
   npm run sync:version   # rewrites impl/js/src/pkg-version.ts
   ```

   Commit the result with the bump. Forgetting this ships a `VERSION`
   export that disagrees with the package — `pkg-version.test.ts` fails
   loudly rather than letting it out, so a red test here means this step
   was skipped, not that the test is wrong.
5. Move `[Unreleased]` to `[1.0.0-rc.1] - YYYY-MM-DD` and re-create
   an empty `[Unreleased]` section.
6. Tag and push:

   ```bash
   git tag -a v1.0.0-rc.1 -m "xl3 1.0.0-rc.1"
   git push origin main --tags
   ```

7. Publish:

   ```bash
   npm publish -w @xl3-lang/xl3 --tag rc
   ```

   The `rc` dist-tag means hosts opting in
   (`npm install @xl3-lang/xl3@rc`) get the candidate; default
   `npm install @xl3-lang/xl3` keeps the prior stable.

8. Create the GitHub Release **immediately after `npm publish`**.
   `npm publish` is the easy-to-forget half-step: the package goes
   live but external installers have no release notes / changelog
   anchor until this runs.

   ```bash
   # Extract the just-cut version block into a notes file.
   awk '/^## \[1\.0\.0-rc\.1\]/{p=1; next} /^## \[/{p=0} p' CHANGELOG.md \
     > /tmp/release-notes.md

   gh release create v1.0.0-rc.1 \
     --title "xl3 1.0.0-rc.1 — <one-line summary matching CHANGELOG intro>" \
     --notes-file /tmp/release-notes.md \
     --prerelease
   ```

   Drop `--prerelease` for non-rc cuts. The title should mirror the
   form prior releases used (open `gh release list --limit 3` to see
   the established phrasing).

9. **Post-publish verification** — confirm all four artifacts moved
   together. Any one missing means the release is half-published:

   | Artifact | Check |
   |---|---|
   | npm `latest` (or `rc`) | `npm view @xl3-lang/xl3 version` matches the cut |
   | Remote git tag | `git ls-remote --tags origin \| grep v1.0.0-rc.1` returns a row |
   | GitHub Release | `gh release view v1.0.0-rc.1` resolves; appears in `gh release list` |
   | CHANGELOG | `[Unreleased]` is empty; the cut version has its own dated section |
   | Version refs in docs | `git grep -n '@xl3-lang/xl3@[0-9]'` returns only versions that exist on npm, and the four READMEs' status line names the cut |

   If any row fails, fix that row before announcing the release.

   The last row exists because the 0.10.0 scope rename
   (`@jinyoung4478/xl3` → `@xl3-lang/xl3`) rewrote version-pinned
   references too, leaving the README CDN snippet pointing at
   `@xl3-lang/xl3@0.8.0` — a version that only ever existed under the
   old scope, so the tag 404'd. Pinned references are only valid for
   versions published under the current name.

## Final 1.0.0 cut

After a minimum 21-day rc soak with no critical issues (ROADMAP G23;
extended from 7 days per review feedback):

1. Bump version to `1.0.0`.
2. Move `[1.0.0-rc.1]` → `[1.0.0] - YYYY-MM-DD` in CHANGELOG (with
   any rc-only fixes folded in).
3. Tag, push, publish:

   ```bash
   git tag -a v1.0.0 -m "xl3 1.0.0 — XTL 0.1 final"
   git push origin main --tags
   npm publish -w @xl3-lang/xl3
   ```

   No `--tag rc` this time; this becomes the new `latest`.

4. Update IMPLEMENTATIONS.md row for the TS reference impl to show
   `1.0.0`.
5. Create the GitHub Release **immediately after `npm publish`**
   (same step that's been silently skipped in past cuts — see
   v0.7.0 retrospective). Same shape as the rc step:

   ```bash
   awk '/^## \[1\.0\.0\]/{p=1; next} /^## \[/{p=0} p' CHANGELOG.md \
     > /tmp/release-notes.md

   gh release create v1.0.0 \
     --title "xl3 1.0.0 — XTL 0.1 final" \
     --notes-file /tmp/release-notes.md
   ```

   No `--prerelease` flag; this is the `Latest` release on GitHub.

6. Run the same **Post-publish verification** table from the rc
   sequence (npm version / remote tag / GitHub Release /
   CHANGELOG). All four MUST be green before announcing.

## XTL spec version cut

A spec version cut is independent of the npm release. When the XTL
spec moves from 0.1 → 1.0:

1. Update `spec/STABILITY.md` "Current state" to read 1.0.
2. Tag the conformance corpus snapshot:

   ```bash
   git tag -a xtl-1.0 -m "XTL 1.0 conformance corpus baseline"
   git push origin --tags
   ```

   This tag pins the corpus state that any 1.0-claiming
   implementation must pass.

3. Update fixture `meta.yaml` `spec_version` fields if any moved
   from 0.1 to 1.0 (a future operation; no fixtures move at the
   actual 0.1 → 1.0 cut since 1.0 IS the 0.1 surface frozen).

The XTL 1.0 cut and the `xl3` 1.0.0 cut SHOULD happen in the same
commit so external porters see a clear baseline.

## Things that MUST happen

- `npm publish` and `gh release create` ship as a **paired action**.
  The git tag, the npm version, the GitHub Release, and the dated
  CHANGELOG section all reference the same commit. If you find any
  one of them missing for a published version, treat it as an
  incomplete release and finish the others before moving on. (See
  v0.7.0 retrospective — published to npm but no GitHub Release for
  ~24 hours, leaving no notes anchor for installers.)
- Every cut runs the post-publish verification table.

## Things that MUST NOT happen

- A breaking API change in a patch or minor.
- Publishing to npm with a dirty working tree.
- Skipping the rc cycle for a major release.
- Removing a stable export without a 2.0 bump.
- Changing an `xl3/...` error code's logical meaning. Adding a new
  code is fine; renaming or repurposing is breaking.
- Changing an English `Error.message` in a way that breaks an
  existing `expected_error` substring assertion. Update the fixture
  and the message together, or don't touch the message.

## Rollback

If a release ships a critical bug:

1. Publish the fix as the next patch (`1.0.0` → `1.0.1`).
2. If the fix can't ship within an hour:

   ```bash
   npm dist-tag rm @xl3-lang/xl3 latest      # un-recommend the bad version
   npm dist-tag add @xl3-lang/xl3@<previous> latest
   ```

   Hosts that pinned to `@xl3-lang/xl3` keep the old version
   until they bump.

3. Never `npm unpublish` — npm policy disallows unpublishing
   versions used as dependencies after a brief grace window.
