# ADR 0077 - XTL 1.0 ships with a single maintainer

- **Status:** accepted (process gate)
- **Date:** 2026-07-28
- **Spec target:** XTL 1.0
- **Affects:** `GOVERNANCE.md` ("Current state", "Roles", "How this
  document evolves"), ROADMAP gate G16

## Context

ROADMAP gate **G16** asks for **≥ 2 people with accept/reject rights on
ADRs and impl PRs** before 1.0, with the fallback: *"explicit accept of
single-maintainer 1.0 governance shape via amendment to GOVERNANCE."*

`GOVERNANCE.md` already describes the project as single-maintainer, but
describes it as a *phase* — "xl3 is in its formative phase", "the
maintainer set grows when external contributors sustainably review and
land changes". Read as a gate, that is ambiguous in the way that matters:
someone deciding whether to depend on xl3 cannot tell whether 1.0 is
blocked on recruiting a second maintainer, or whether 1.0 ships as-is.

This ADR removes the ambiguity by taking the fallback explicitly rather
than leaving G16 open until a second maintainer happens to appear.

## Decision

**XTL 1.0 ships with one maintainer.** G16 is closed by its fallback, not
by satisfying its primary criterion.

The clause in `GOVERNANCE.md` about the maintainer set growing stays
live — this decision is about the 1.0 cut, not a statement that the
project will always have one maintainer.

## Why this is defensible here

The risk G16 guards against is real: a spec with a single accepter can
drift with that person, and a project with a bus factor of one can stop.
What makes it acceptable *for this project at 1.0* is that the contract
does not live in the maintainer's head.

**The specification is executable and independent.** The corpus is the
normative definition of behavior — see
[`conformance/DASHBOARD.md`](../../conformance/DASHBOARD.md) for the live
figures — and `conformance/AUTHORING.md` forbids capturing expected
outputs from the reference implementation precisely so the corpus does
not become "whatever the JS impl does". Every accepted behavior has an
ADR recording its reasoning.

**A second implementation already exists and passes a large part of the
corpus.** `xl3-py` passed every one of the 133 fixtures its last report
ran (2026-05-23). Stated carefully, because the first version of this ADR
overstated it as "clears Stage 1": that report is tens of fixtures behind
the current corpus, so it does **not** establish that xl3-py meets
ROADMAP G13 today — G13 was reverted to unjudgeable on 2026-07-30 for
exactly this reason.

The argument here survives the correction, because it does not depend on
the gate. 133 fixtures independently passing is evidence that the corpus
is sufficient to reimplement XTL *from*, by someone who is not the
maintainer. A spec you can build a second implementation from survives its
author in a way a single codebase does not — and that remains true whether
or not the port is currently caught up.

**Both artifacts are permissively licensed.** Code MIT, spec CC-BY-4.0.
A stalled project can be forked and continued without permission.

**The surface cannot churn quietly.** G3 and G6 freeze the error catalog
and the public API against breaking change, and additions must be logged
to `spec/STABILITY.md`. Those gates constrain the maintainer as much as
anyone.

## What this does not fix

Stated plainly, because the mitigations above do not cover it:

- **Releases stop if the maintainer stops.** Nobody else can publish to
  npm or cut a tag. A fork can continue the spec and the code; it cannot
  continue the package name.
- **Nobody else can accept an ADR.** An external contributor can author
  one (that is G14), but acceptance is still one person.
- **Review latency is one person's availability.** There is no second
  reviewer to route around an absence.

A user for whom any of those is disqualifying should treat xl3 as a
fork-if-needed dependency rather than a managed one. That is the honest
framing, and it is why this is recorded as a decision with consequences
rather than a formality.

## Revisit trigger

Named so this does not sit open-ended:

- **Any external contributor who lands changes sustainably** — the
  existing `GOVERNANCE.md` trigger, unchanged.
- **G14 closing** is the natural moment to look again: someone who has
  authored an accepted ADR has demonstrated the judgment the role needs.
- **A second production user appearing** (beyond G15's reference case)
  raises the cost of a bus factor of one enough to revisit regardless of
  contributor flow.

## Consequences

`GOVERNANCE.md` gains a short statement that 1.0 ships in this shape,
pointing here for the reasoning. ROADMAP G16 closes via its fallback with
the fallback named, so the table does not read as though the primary
criterion was met.

No spec behavior changes; no fixture is affected. This is a process
decision recorded the same way ADR-0043 and ADR-0048 record theirs.
