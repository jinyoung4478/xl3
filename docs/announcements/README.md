# Announcement drafts

Drafts for external posts (Show HN, r/dataengineering, etc.). They live
here so they can be reviewed and iterated in PRs before being posted to
the actual platform.

These are **drafts**, not records of posted material. Edit freely. The
maintainer posts the final form manually.

## Files

- `show-hn-0.4.0.md` — Hacker News "Show HN" draft, framed for the
  HN audience (developers, technically curious operators).
- `reddit-dataengineering-0.4.0.md` — r/dataengineering / r/programming
  draft, framed for the practitioner audience.

## Posting checklist

Before posting any of these:

1. Re-read the linked README and CHANGELOG to make sure the claims still
   hold (especially the conformance fixture count and the version number).
2. Update the version and date in the draft if it has aged.
3. Make sure the homepage (`https://xl3.io`) and the npm install snippet
   point at the latest version.
4. Avoid claims this repo can't back up. Specifically:
   - Don't claim "production-ready" — the README says alpha.
   - Don't claim more than the corpus covers. Check the live count with
     `ls conformance/fixtures/ | wc -l` (160 as of 0.11.0) rather than
     quoting a number from an older draft.
5. Post during a low-traffic window (HN: weekday morning Pacific is
   conventional). Be ready to answer questions in-thread.
