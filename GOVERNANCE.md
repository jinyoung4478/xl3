# Governance

How decisions are made for the XTL spec and the xl3 reference implementation.

This document is intentionally short. It describes the current state of the
project (single maintainer, formative phase) and the path toward
multi-stakeholder governance as adoption grows.

## Current state

xl3 is in its **formative phase**. A single maintainer is:

- The author of `impl/js/src/` (TypeScript reference implementation)
- The editor of `spec/` (XTL language definition)
- The accepter of [ADRs](./spec/decisions/) in `spec/decisions/`
- The reviewer for all PRs

This is normal for a project at this stage. The structures below describe how
decisions enter the project and what changes as more contributors join.

**XTL 1.0 ships in this shape.** That is a decision, not a gap waiting to
be filled before the release — recorded with its reasoning, and its limits,
in [ADR-0077](./spec/decisions/0077-single-maintainer-1.0.md). Short
version: the contract lives in the conformance corpus and the ADR set
rather than in one person's head, and a second implementation already
passes Stage 1 from that corpus. What it does *not* fix is equally plain —
releases stop if the maintainer stops, and nobody else can accept an ADR.
Treat xl3 as a fork-if-needed dependency rather than a managed one if that
matters to you.

## Roles

| Role | Responsibility | Who |
|---|---|---|
| **Maintainer** | Final accept/reject on ADRs and impl PRs. Cuts releases. | Currently the project author. |
| **Spec editor** | Drafts ADRs, edits `spec/language.md` and `spec/evaluation.md`. | Maintainer for now. |
| **Port author** | Implements XTL in another language; runs conformance against [`conformance/fixtures/`](./conformance/fixtures/). | Anyone. Listed in [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md). |
| **Contributor** | Files issues, sends PRs, proposes fixtures or ADRs. | Anyone. See [CONTRIBUTING.md](./CONTRIBUTING.md). |

The maintainer set grows when external contributors sustainably review and
land changes. There is no formal vote process — the maintainer commits to
broadening the maintainer set when it makes sense, and to documenting the
moment it does.

## How changes enter the project

### Impl bug / small spec clarification

- Open an issue or send a PR directly.
- Reviewed by the maintainer.
- Merged when it (a) does not change normative spec behavior or (b) is a
  trivially correct clarification.

### Normative spec change (new behavior, change to existing behavior)

Spec changes follow the **ADR process**:

1. **Discovery** — a real edge case (in usage, in fixture authoring, in a
   port) reveals that the spec is silent or ambiguous.
2. **Issue** — file a `spec` issue describing the gap, the alternatives, and
   the relevant cross-references.
3. **ADR draft** — the maintainer (or contributor) drafts an ADR in
   [`spec/decisions/`](./spec/decisions/) following the template at
   `spec/decisions/0000-template.md`. Includes Context, Considered Options,
   Decision, Consequences, References.
4. **Review** — discussion happens on the PR introducing the ADR. The bar
   for acceptance is "the rationale is sufficient that a second implementer
   would reach the same decision without reading the impl source."
5. **Acceptance** — `status: accepted` is set when:
   - At least one conformance fixture demonstrates the new behavior, AND
   - The reference impl change is included in the same PR (or a follow-up
     PR landed before release), AND
   - The maintainer signs off.
6. **Release** — the next minor version bumps the spec version if the
   change is additive, major if breaking.

The ADRs in [`spec/decisions/`](./spec/decisions/) are the project's
public record of every normative decision and the reasoning behind it.

### Conformance fixture additions

Fixtures are how XTL is _executable_. New fixtures expand the corpus:

1. Open an issue or follow the **fixture proposal** issue template.
2. Author the fixture following [`conformance/AUTHORING.md`](./conformance/AUTHORING.md).
   The cardinal rule: **expected outputs come from the spec, not from
   running the reference impl.**
3. Submit a PR.
4. Maintainer reviews. Approval is faster than for ADRs because fixtures
   constrain less — they document an existing spec rule rather than
   creating one.

## Backward-compatibility commitments

| Surface | Stability promise |
|---|---|
| Spec `XTL 1.0` (when cut) | Breaking changes require `XTL 2.0` with migration guide |
| Spec `XTL 0.x` (current) | Breaking changes allowed; bump minor; ship fixture updates with the change |
| `xl3` npm `1.x` (when cut) | Public API frozen at the snapshot in `impl/js/src/__tests__/api-surface.test.ts`. Renames or removals require a major bump |
| `xl3` npm `0.x` (current) | Public API may shift; the snapshot test catches accidental drift |
| Error codes (`xl3/<category>/<id>`) | Append-only. Renames are breaking. Removal requires a major bump |

## Disagreements

Technical disagreement is healthy. The resolution path:

1. Discuss on the issue/PR with concrete tradeoffs.
2. If consensus doesn't emerge, the maintainer makes a judgment call and
   documents it in the ADR's Consequences section.
3. A future ADR can revisit and supersede an earlier one. ADRs are not
   immutable; they record the reasoning at a point in time. When a later
   ADR supersedes an earlier one, the earlier one is marked
   `status: superseded` with a pointer.

This is intentionally a low-ceremony process. As contributor count grows,
this section will need expansion (voting, RFC periods, technical steering
committee, etc.). The maintainer commits to that expansion happening
publicly.

## How to influence the project today

The most effective ways to influence xl3:

1. **Use it in production and report what's missing.** Real adoption is
   the strongest signal for what to prioritize.
2. **Propose a fixture.** A new fixture forces the spec to be clearer than
   prose alone. Even unaccepted fixture proposals usually trigger spec
   improvements.
3. **Port to a second language and run the conformance corpus.** A second
   independent implementation finds spec gaps faster than any review.
   See [PORTERS_GUIDE.md](./PORTERS_GUIDE.md).
4. **Open an ADR draft on a deferred item.** Items deferred in
   [`spec/decisions/`](./spec/decisions/) (date arithmetic, locale
   collation, multi-join, etc.) are candidates for future ADRs — concrete
   proposals are welcome.

## How this document evolves

When the maintainer set widens, this document is rewritten to reflect the
new state — including any voting / RFC / TSC processes adopted. Until then,
this is the working description.

That trigger is unchanged by the 1.0 decision above. ADR-0077 also names
two further moments to look again: an external contributor landing an
accepted ADR (ROADMAP G14), and a second production user appearing.
