import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import clsx from 'clsx';
import { CodeCard } from '@site/src/components/CodeCard';
import { ExcelPreview, ExcelPreviewFrame } from '@site/src/components/ExcelPreview';
import type { Workbook } from '@site/src/components/ExcelPreview';
import styles from './index.module.css';

// Trailing blank rows so every sheet has breathing room below the data
// and the fixed-height viewer scrolls like a real Excel worksheet.
const blankRows = (count: number): string[][] =>
  Array.from({ length: count }, () => []);

// One preview per walkthrough step. Clicking a step (01–03) swaps the
// Excel view on the right to the artifact for that stage: raw data →
// template → result. The template step carries two sheets (Report +
// __config__) you can toggle inside the preview window.
//
// Built inside a hook so the caption strings (title / note / subtitle) are
// localized via translate() at render time; filenames, sheet names, and
// formulas stay literal across locales.
function useStepPreviews(): Workbook[] {
  return [
  // 01 — Raw data the application supplies
  {
    kind: 'data.xlsx',
    title: translate({
      id: 'homepage.preview.raw.title',
      message: 'Start with the raw data.',
      description: 'Excel preview caption — raw data step',
    }),
    note: translate({
      id: 'homepage.preview.raw.note',
      message:
        'The application hands xl3 a data table — an .xlsx sheet or a language-neutral JSON source — plus any per-run inputs. Nothing about layout lives in code.',
      description: 'Excel preview note — raw data step',
    }),
    workbookTitle: 'data.xlsx',
    workbookSubtitle: translate({
      id: 'homepage.preview.raw.subtitle',
      message: 'raw operator data',
      description: 'Excel preview window subtitle — raw data step',
    }),
    formula: 'Acme Logistics',
    sheetName: 'Sheet1',
    rows: [
      ['Account', 'Region', 'Renewal', 'Owner'],
      ['Acme Logistics', 'Seoul', '18400', 'Mina'],
      ['Beta Works', 'Busan', '7200', 'Joon'],
      ...blankRows(5),
    ],
    classes: [
      ['header', 'header', 'header', 'header'],
      ['selected', '', 'currency', ''],
      ['', '', 'currency', ''],
    ],
  },
  // 02 — Template: the executable workbook (two switchable sheets)
  {
    kind: 'template.xlsx',
    title: translate({
      id: 'homepage.preview.template.title',
      message: 'The template is the executable workbook.',
      description: 'Excel preview caption — template step',
    }),
    note: translate({
      id: 'homepage.preview.template.note',
      message:
        'The visible layout carries XTL {{ … }} cells; the hidden __config__ sheet declares the rules. Click the sheet tabs to switch between them.',
      description: 'Excel preview note — template step',
    }),
    workbookTitle: 'template.xlsx',
    workbookSubtitle: translate({
      id: 'homepage.preview.template.subtitle',
      message: 'executable Excel template',
      description: 'Excel preview window subtitle — template step',
    }),
    sheets: [
      {
        name: '__config__',
        formula: 'source_table = 1',
        rows: [
          ['key', 'value', 'notes'],
          ['source_sheet', 'Sheet1', 'worksheet to read'],
          ['source_table', '1', 'column names and data rows'],
          ...blankRows(5),
        ],
        classes: [
          ['header', 'header', 'header'],
          ['', '', ''],
          ['', 'selected', ''],
        ],
      },
      {
        name: 'Report',
        formula: '{{ IF([Renewal] > 10000, "Priority", "Standard") }}',
        rows: [
          ['Customer Renewal Report', '', '', '', ''],
          ['Account', 'Region', 'Renewal', 'Owner', 'Tier'],
          [
            '{{ [Account] }}',
            '{{ [Region] }}',
            '{{ [Renewal] }}',
            '{{ [Owner] }}',
            '{{ IF([Renewal] > 10000, "Priority", "Standard") }}',
          ],
          ...blankRows(5),
        ],
        classes: [
          ['header', 'header', 'header', 'header', 'header'],
          ['header', 'header', 'header', 'header', 'header'],
          ['template', 'template', 'template', 'template', 'selected template'],
        ],
        merges: [{ row: 0, col: 0, span: 5 }],
      },
    ],
  },
  // 03 — Result: the rendered output workbook
  {
    kind: 'result.xlsx',
    title: translate({
      id: 'homepage.preview.result.title',
      message: 'Same inputs, same workbook — every run.',
      description: 'Excel preview caption — result step',
    }),
    note: translate({
      id: 'homepage.preview.result.note',
      message:
        "The template's number formats, fills, borders, and merged headers are preserved verbatim; only the values change.",
      description: 'Excel preview note — result step',
    }),
    workbookTitle: 'result.xlsx',
    workbookSubtitle: translate({
      id: 'homepage.preview.result.subtitle',
      message: 'rendered workbook, formatting preserved',
      description: 'Excel preview window subtitle — result step',
    }),
    formula: 'Priority',
    sheetName: 'Report',
    rows: [
      ['Customer Renewal Report', '', '', '', ''],
      ['Account', 'Region', 'Renewal', 'Owner', 'Tier'],
      ['Acme Logistics', 'Seoul', '18,400', 'Mina', 'Priority'],
      ['Beta Works', 'Busan', '7,200', 'Joon', 'Standard'],
      ...blankRows(4),
    ],
    classes: [
      ['header', 'header', 'header', 'header', 'header'],
      ['header', 'header', 'header', 'header', 'header'],
      ['', '', 'currency', '', 'status'],
      ['', '', 'currency', '', 'status'],
    ],
    merges: [{ row: 0, col: 0, span: 5 }],
  },
  ];
}

function Hero() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className={clsx('container', styles.heroLayout)}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            <Translate id="homepage.hero.kicker" description="Hero section eyebrow / kicker line">
              Excel template engine for recurring business documents
            </Translate>
          </p>
          <h1 className={styles.heroTitle}>
            <Translate
              id="homepage.hero.title"
              description="Hero section H1"
              values={{
                lineBreak: <br />,
                // The accent dot is the headline's sentence-final mark, so it
                // has to be the mark that locale actually uses — a Latin "."
                // after 作る or 写代码 reads as a typo. ja/zh override it with
                // 。; everything else inherits the Latin period.
                dot: (
                  <span className={styles.blueDot}>
                    {translate({
                      id: 'homepage.hero.title.fullStop',
                      message: '.',
                      description:
                        "Sentence-final mark rendered as the hero H1's accent dot. Override per locale (ja/zh use 。).",
                    })}
                  </span>
                ),
              }}
            >
              {'Generate Excel reports{lineBreak}from templates — not code{dot}'}
            </Translate>
          </h1>
          <p className={styles.heroLead}>
            <Translate
              id="homepage.hero.lead"
              description="Hero section lead paragraph"
            >
              Edit the transformation logic inside the Excel file — no developer ticket. Supply the data and xl3 executes it: styles preserved, same result every time.
            </Translate>
          </p>
          <div className={styles.heroLinks}>
            <Link className="button button--primary button--lg" to="/try">
              <Translate id="homepage.hero.cta.try" description="Hero primary CTA button">
                Try the converter
              </Translate>
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://github.com/xl3-lang/xl3"
            >
              GitHub
            </Link>
            <Link
              className="button button--secondary button--lg"
              href="https://www.npmjs.com/package/@xl3-lang/xl3"
            >
              npm
            </Link>
          </div>
        </div>
        <aside
          className={styles.flowPanel}
          aria-label={translate({
            id: 'homepage.hero.flowPanel.ariaLabel',
            message: 'xl3 workflow',
            description: 'Aria label for the workflow diagram aside',
          })}
        >
          {/* Brand line. Moved out of the H1 (2026-08-02) so the headline can
              carry the concrete promise; kept in the hero, untranslated in
              every locale, because it is brand copy rather than a claim. */}
          <div className={styles.visualHeader}>
            <span>Runtime system</span>
            <strong>Execute Excel. Deterministically.</strong>
          </div>
          <div className={styles.visualLogoCard}>
            <img src="/img/xl3-logo-dark.png" alt="XL3" />
          </div>
          <div className={styles.flowRole}>
            <span>
              <Translate id="homepage.hero.flow.role.developer" description="Workflow diagram — actor label">
                Developer
              </Translate>
            </span>
            <strong>
              <Translate id="homepage.hero.flow.role.developerRole" description="What the developer does in the workflow">
                owns data and deployment
              </Translate>
            </strong>
          </div>
          <div
            className={styles.flowStack}
            aria-label={translate({
              id: 'homepage.hero.flowStack.ariaLabel',
              message: 'Operator file flow',
              description: 'Aria label for the file-flow stack inside the workflow diagram',
            })}
          >
            <div className={styles.flowFile}>
              <span>raw.xlsx</span>
              <small>
                <Translate id="homepage.hero.flow.raw.label" description="Workflow diagram — what raw.xlsx is">
                  operator data
                </Translate>
              </small>
            </div>
            <div className={styles.flowPlus}>+</div>
            <div className={styles.flowFile}>
              <span>template.xlsx</span>
              <small>
                <Translate id="homepage.hero.flow.template.label" description="Workflow diagram — what template.xlsx is">
                  executable rules
                </Translate>
              </small>
            </div>
            <div className={styles.flowArrow}>↓</div>
            <div className={styles.flowResult}>
              <span>
                <Translate id="homepage.hero.flow.result.label" description="Workflow diagram — output label">
                  finished workbook
                </Translate>
              </span>
              <small>
                <Translate id="homepage.hero.flow.result.sublabel" description="Workflow diagram — output sublabel">
                  for the operator
                </Translate>
              </small>
            </div>
          </div>
        </aside>
        <div className={styles.heroPillars} aria-label="XL3 brand attributes">
          <div className={styles.pillar}>
            <span className={styles.pillarIcon} aria-hidden="true">↯</span>
            <strong>Fast</strong>
          </div>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon} aria-hidden="true">◇</span>
            <strong>Deterministic</strong>
          </div>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon} aria-hidden="true">▣</span>
            <strong>Portable</strong>
          </div>
          <div className={styles.pillar}>
            <span className={styles.pillarIcon} aria-hidden="true">&lt;/&gt;</span>
            <strong>Spec-first</strong>
          </div>
        </div>
      </div>
    </header>
  );
}

function useWalkthroughSteps() {
  return [
    {
      index: '01',
      title: translate({
        id: 'homepage.walkthrough.step01.title',
        message: 'Start with the raw data',
        description: 'Walkthrough step 01 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step01.body',
        message:
          'The application hands xl3 a data table — an .xlsx sheet or a JSON source — plus any per-run inputs. Nothing about layout lives in code.',
        description: 'Walkthrough step 01 body',
      }),
    },
    {
      index: '02',
      title: translate({
        id: 'homepage.walkthrough.step02.title',
        message: 'Declare the transform in the workbook',
        description: 'Walkthrough step 02 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step02.body',
        message:
          'The template carries the visible layout with XTL {{ … }} cells and a hidden __config__ sheet that says what to repeat, filter, group, and render. Switch sheets in the preview to see both.',
        description: 'Walkthrough step 02 body',
      }),
    },
    {
      index: '03',
      title: translate({
        id: 'homepage.walkthrough.step03.title',
        message: 'Get the same workbook, every run',
        description: 'Walkthrough step 03 title',
      }),
      body: translate({
        id: 'homepage.walkthrough.step03.body',
        message:
          'Any conforming engine renders the template as a pure function: same inputs, same output — formats, merges, and borders preserved verbatim.',
        description: 'Walkthrough step 03 body',
      }),
    },
  ] as const;
}

function Walkthrough() {
  const steps = useWalkthroughSteps();
  const stepPreviews = useStepPreviews();
  const [active, setActive] = React.useState(0);
  const preview = stepPreviews[active];
  return (
    <section id="walkthrough" className={styles.walkthrough}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.walkthrough.kicker" description="Walkthrough section kicker">
              How it works
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.walkthrough.title" description="Walkthrough section H2">
              Excel is the template. xl3 executes it.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.walkthrough.lead" description="Walkthrough section lead paragraph">
              The business user edits layout in Excel; the application supplies data and inputs; xl3 executes the workbook deterministically. Click through the three stages to follow one report from raw data to finished output.
            </Translate>
          </p>
        </div>
        <div className={styles.walkthroughLayout}>
          <div
            className={styles.stepsGrid}
            role="tablist"
            aria-label={translate({
              id: 'homepage.walkthrough.steps.ariaLabel',
              message: 'Workflow steps',
              description: 'Aria label for the clickable walkthrough step list',
            })}
          >
            {steps.map((s, i) => (
              <button
                key={s.index}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={clsx(styles.stepCard, i === active && styles.stepCardActive)}
                onClick={() => setActive(i)}
              >
                <span className={styles.stepIndex}>{s.index}</span>
                <div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepBody}>{s.body}</p>
                </div>
              </button>
            ))}
          </div>
          <div className={styles.previewColumn}>
            <ExcelPreviewFrame
              kind={preview.kind}
              title={preview.title}
              note={preview.note}
            >
              {/* key on active step so the sheet-tab state resets when the step changes */}
              <ExcelPreview key={active} workbook={preview} />
            </ExcelPreviewFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

function Handoff() {
  return (
    <section id="standard" className={styles.handoff}>
      <div className="container">
        <div className={styles.narrativeGrid}>
          <div>
            <p className={styles.kicker}>
              <Translate id="homepage.handoff.kicker" description="Handoff section kicker">
                Why Excel is the template
              </Translate>
            </p>
            <h2 className={styles.sectionTitle}>
              <Translate id="homepage.handoff.title" description="Handoff section H2">
                Stop encoding report layout in one-off scripts.
              </Translate>
            </h2>
          </div>
          <div className={styles.prose}>
            <p>
              <Translate id="homepage.handoff.body.p1" description="Handoff body paragraph 1">
                ExcelJS, SheetJS, openpyxl, and Apache POI are the DOM APIs of spreadsheets: powerful, but verbose. When report layout, styles, merged cells, and loops live in code, every design change — a new column, a moved subtotal, a reformatted header — becomes a deployment.
              </Translate>
            </p>
            <p>
              <Translate id="homepage.handoff.body.p2" description="Handoff body paragraph 2">
                xl3 moves the recurring contract back into Excel. The workbook is already the view; XTL makes it executable, while the application only supplies data and runs the engine. A template is an ordinary .xlsx — no macros, no vendor cloud — so you can diff it, review it in a pull request, and hand it to someone who has never heard of xl3.
              </Translate>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function useResponsibilityCards() {
  return [
    {
      title: translate({
        id: 'homepage.responsibility.card01.title',
        message: 'Developer',
        description: 'Responsibility section card 01 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card01.body',
        message:
          'Owns the runtime: engine behavior, validation, integration, deployment, and reliability.',
        description: 'Responsibility section card 01 body',
      }),
      tag: 'runtime',
    },
    {
      title: translate({
        id: 'homepage.responsibility.card02.title',
        message: 'Operator',
        description: 'Responsibility section card 02 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card02.body',
        message:
          'Owns the template: layout, columns, repeat rules, output format, and document-specific logic — edited directly in Excel.',
        description: 'Responsibility section card 02 body',
      }),
      tag: 'template.xlsx',
    },
    {
      title: translate({
        id: 'homepage.responsibility.card03.title',
        message: 'Business',
        description: 'Responsibility section card 03 title',
      }),
      body: translate({
        id: 'homepage.responsibility.card03.body',
        message:
          'Uses the finished workbook without waiting for every recurring document change to become a release.',
        description: 'Responsibility section card 03 body',
      }),
      tag: 'result.xlsx',
    },
  ] as const;
}

function Responsibility() {
  const cards = useResponsibilityCards();
  return (
    <section className={styles.responsibility}>
      <div className="container">
        <div className={styles.narrativeGrid}>
          <div>
            <p className={styles.kicker}>
              <Translate id="homepage.responsibility.kicker" description="Responsibility section kicker">
                Responsibility-driven automation
              </Translate>
            </p>
            <h2 className={styles.sectionTitle}>
              <Translate id="homepage.responsibility.title" description="Responsibility section H2">
                Move document changes out of the deploy queue.
              </Translate>
            </h2>
          </div>
          <div className={styles.prose}>
            <p>
              <Translate id="homepage.responsibility.body.p1" description="Responsibility section body paragraph 1">
                Most Excel automation tools make developers faster. xl3 aims at a different outcome: letting operators take over the document changes that used to require a developer. When every business partner needs its own format, having one engineer implement each one — and re-edit it on every change — is the bottleneck.
              </Translate>
            </p>
            <p>
              <Translate id="homepage.responsibility.body.p2" description="Responsibility section body paragraph 2">
                xl3 was shaped by an internal service where, over months of operation, non-developers maintained templates and conversion rules directly in Excel while developers focused almost entirely on the runtime. The important reduction was not just lines of code — it was the amount of work that had to be done by developers at all.
              </Translate>
            </p>
          </div>
        </div>
        <div className={styles.stageGrid}>
          {cards.map((c) => (
            <article key={c.tag} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          <Translate id="homepage.responsibility.fact" description="Responsibility section closing fact">
            xl3 is not trying to replace developers. Developers own the runtime; operators own the templates; document automation becomes an organizational capability instead of a developer-only task.
          </Translate>
        </p>
      </div>
    </section>
  );
}

function useStandardCards() {
  return [
    {
      title: translate({
        id: 'homepage.standard.card01.title',
        message: 'The spec (xl3 + XTL)',
        description: 'Standard card 01 title',
      }),
      body: translate({
        id: 'homepage.standard.card01.body',
        message:
          'The normative definition: the xl3 workbook format and XTL, its small embedded expression language. A function lives in XTL only when its value must be known before the workbook is written (ADR-0043).',
        description: 'Standard card 01 body',
      }),
      tag: 'spec/',
    },
    {
      title: translate({
        id: 'homepage.standard.card02.title',
        message: 'The conformance suite',
        description: 'Standard card 02 title',
      }),
      body: translate({
        id: 'homepage.standard.card02.body',
        message:
          'Language-neutral fixtures that every implementation runs to prove it conforms. The corpus — not any single implementation — is the contract a port must match.',
        description: 'Standard card 02 body',
      }),
      tag: 'conformance/',
    },
    {
      title: translate({
        id: 'homepage.standard.card03.title',
        message: 'The reference implementation',
        description: 'Standard card 03 title',
      }),
      body: translate({
        id: 'homepage.standard.card03.body',
        message:
          '@xl3-lang/xl3 (TypeScript) runs in browsers and Node. It is useful, but not normative — Rust/WASM and Python ports are in progress.',
        description: 'Standard card 03 body',
      }),
      tag: '@xl3-lang/xl3',
    },
  ] as const;
}

function Standard() {
  const cards = useStandardCards();
  return (
    <section id="conformance" className={styles.reliability}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.standard.kicker" description="Standard section kicker">
              An open standard, not a library
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.standard.title" description="Standard section H2">
              A spec, a conformance suite, and a reference implementation.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.standard.lead" description="Standard section lead paragraph">
              xl3 is defined as an open, implementation-independent standard in three parts. The XTL surface stays small on purpose, so templates remain readable by humans and easy for AI systems to draft.
            </Translate>
          </p>
        </div>
        <div className={styles.stageGrid}>
          {cards.map((c) => (
            <article key={c.tag} className={styles.stageCard}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <code>{c.tag}</code>
            </article>
          ))}
        </div>
        <p className={styles.conformanceFact}>
          <Translate
            id="homepage.standard.fact"
            description="Standard section conformance stats sentence; {adrCount} and {fixtureCount} are pre-bolded counts, {npmLink} and {portersGuideLink} are inline links"
            values={{
              // Hand-maintained counts — they went stale once (75/160 while the
              // corpus was at 77/169) and an external reviewer quoted the stale
              // pair back at us. Live values: `ls spec/decisions/*.md | wc -l`
              // minus ADR-0018 (a reserved gap placeholder, not a decision),
              // and the corpus size in conformance/DASHBOARD.md. Refresh both
              // on every release cut.
              adrCount: <strong>77 ADRs</strong>,
              fixtureCount: <strong>169 conformance fixtures</strong>,
              npmLink: (
                <a href="https://www.npmjs.com/package/@xl3-lang/xl3">@xl3-lang/xl3</a>
              ),
              portersGuideLink: (
                <Link to="/porters-guide">
                  <Translate
                    id="homepage.standard.fact.portersGuideLabel"
                    description="Link label inside the conformance fact sentence"
                  >
                    Porter's Guide
                  </Translate>
                </Link>
              ),
            }}
          >
            {
              'XTL 0.1 ships with {adrCount} and {fixtureCount}, all green at Stage 2. The TypeScript reference implementation is published at {npmLink} — the {portersGuideLink} documents the contract so a second-language port can match it.'
            }
          </Translate>
        </p>
      </div>
    </section>
  );
}

function useComparisons() {
  return [
    {
      tool: 'xl3',
      bestAt: translate({
        id: 'homepage.comparison.xl3.bestAt',
        message: 'Declarative Excel template execution. The workbook already exists; xl3 runs it with data.',
        description: 'Comparison row xl3 — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.xl3.tradeoff',
        message: 'Alpha; one maintainer; the XTL surface is intentionally small and still evolving until 1.0.',
        description: 'Comparison row xl3 — tradeoff',
      }),
    },
    {
      tool: 'Workbook APIs (ExcelJS, SheetJS, openpyxl, POI)',
      bestAt: translate({
        id: 'homepage.comparison.sdk.bestAt',
        message: 'Low-level or full-featured workbook generation from application code.',
        description: 'Comparison row spreadsheet SDKs — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.sdk.tradeoff',
        message: 'Layout, styles, merges, loops, and business rules become code. Non-developers cannot safely edit the template.',
        description: 'Comparison row spreadsheet SDKs — tradeoff',
      }),
    },
    {
      tool: 'Python / VBA scripts',
      bestAt: translate({
        id: 'homepage.comparison.scripts.bestAt',
        message: 'Fast one-off automation close to existing spreadsheets.',
        description: 'Comparison row Python/VBA — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.scripts.tradeoff',
        message: "Rules live in code or one maintainer's memory; layout changes still need code changes.",
        description: 'Comparison row Python/VBA — tradeoff',
      }),
    },
    {
      tool: 'Power Query / Office Scripts',
      bestAt: translate({
        id: 'homepage.comparison.powerQuery.bestAt',
        message: 'Microsoft 365 workflows and data shaping inside the Excel ecosystem.',
        description: 'Comparison row Power Query — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.powerQuery.tradeoff',
        message:
          'Tenant-bound; the workflow rules do not travel with the workbook.',
        description: 'Comparison row Power Query — tradeoff',
      }),
    },
    {
      tool: 'Template engines (JXLS, xltpl, jsreport xlsx)',
      bestAt: translate({
        id: 'homepage.comparison.templateEngines.bestAt',
        message: 'Server-side report generation from spreadsheet-like templates.',
        description: 'Comparison row template engines — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.templateEngines.tradeoff',
        message: 'Useful prior art, but often tied to one runtime and not positioned as a small, portable Excel rule format.',
        description: 'Comparison row template engines — tradeoff',
      }),
    },
    {
      tool: 'Doc-gen SaaS (Plumsail, Conga, Formstack)',
      bestAt: translate({
        id: 'homepage.comparison.docgen.bestAt',
        message: 'Managed document workflows, integrations, approvals, and delivery.',
        description: 'Comparison row doc-gen SaaS — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.docgen.tradeoff',
        message: 'Rules live in a vendor service, not in a portable workbook template you can review and run yourself.',
        description: 'Comparison row doc-gen SaaS — tradeoff',
      }),
    },
    {
      tool: 'Direct LLM → xlsx',
      bestAt: translate({
        id: 'homepage.comparison.llmDirect.bestAt',
        message: 'Quick exploratory drafting, one-off charts.',
        description: 'Comparison row direct LLM xlsx — best at',
      }),
      tradeoff: translate({
        id: 'homepage.comparison.llmDirect.tradeoff',
        message: 'Not a deterministic transformation contract for recurring operations; styles and totals drift between runs.',
        description: 'Comparison row direct LLM xlsx — tradeoff',
      }),
    },
  ] as const;
}

function Comparison() {
  const rows = useComparisons();
  return (
    <section id="compare" className={styles.comparison}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.comparison.kicker" description="Comparison section kicker">
              How it compares
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.comparison.title" description="Comparison section H2">
              The same problem, different shapes.
            </Translate>
          </h2>
        </div>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>
                  <Translate id="homepage.comparison.col.approach" description="Comparison table column header — tool/approach name">
                    Approach
                  </Translate>
                </th>
                <th>
                  <Translate id="homepage.comparison.col.bestAt" description="Comparison table column header — best at">
                    Best at
                  </Translate>
                </th>
                <th>
                  <Translate id="homepage.comparison.col.tradeoff" description="Comparison table column header — tradeoff">
                    Tradeoff
                  </Translate>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.tool}>
                  <td><strong>{c.tool}</strong></td>
                  <td>{c.bestAt}</td>
                  <td>{c.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DeveloperApi() {
  return (
    <section id="api" className={styles.api}>
      <div className="container">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>
            <Translate id="homepage.api.kicker" description="Developer API section kicker">
              Developer API
            </Translate>
          </p>
          <h2 className={styles.sectionTitle}>
            <Translate id="homepage.api.title" description="Developer API section H2">
              Wire the same workflow into your product.
            </Translate>
          </h2>
          <p>
            <Translate id="homepage.api.lead" description="Developer API section lead paragraph">
              Install the reference implementation and run a template with a buffer of data. The operator experience can stay file-based while your app owns deployment and validation — and convertJson() takes a language-neutral JSON source when the host has no .xlsx to hand over.
            </Translate>
          </p>
        </div>
        <div className={styles.codePair}>
          <CodeCard
            name="terminal"
            lines={[
              [
                { kind: 'prompt', text: '$' },
                { kind: 'fn', text: 'npm' },
                { kind: 'plain', text: ' ' },
                { kind: 'kw', text: 'install' },
                { kind: 'plain', text: ' ' },
                { kind: 'var', text: '@xl3-lang/xl3' },
              ],
            ]}
          />
          <CodeCard
            name="example.ts"
            lines={[
              [
                { kind: 'kw', text: 'import' },
                { kind: 'plain', text: ' { ' },
                { kind: 'var', text: 'convert' },
                { kind: 'plain', text: ' } ' },
                { kind: 'kw', text: 'from' },
                { kind: 'plain', text: ' ' },
                { kind: 'string', text: "'@xl3-lang/xl3'" },
                { kind: 'plain', text: ';' },
              ],
              [{ kind: 'plain', text: '' }],
              [
                { kind: 'kw', text: 'const' },
                { kind: 'plain', text: ' ' },
                { kind: 'const', text: 'outputs' },
                { kind: 'plain', text: ' = ' },
                { kind: 'kw', text: 'await' },
                { kind: 'plain', text: ' ' },
                { kind: 'fn', text: 'convert' },
                { kind: 'plain', text: '(' },
                { kind: 'var', text: 'templateBuffer' },
                { kind: 'plain', text: ', ' },
                { kind: 'var', text: 'dataBuffer' },
                { kind: 'plain', text: ');' },
              ],
              [{ kind: 'comment', text: '// OutputFile[] → formatted .xlsx workbook(s)' }],
            ]}
          />
        </div>
        <p className={styles.apiCta}>
          <Link to="/guides/getting-started">
            <Translate id="homepage.api.cta.cookbook" description="Bottom CTA link — cookbook 01">
              Cookbook 01 — Getting started in 5 minutes
            </Translate>
          </Link>
          {' · '}
          <Link to="/spec/">
            <Translate id="homepage.api.cta.spec" description="Bottom CTA link — spec">
              Read the spec
            </Translate>
          </Link>
          {' · '}
          <Link to="/porters-guide">
            <Translate id="homepage.api.cta.porters" description="Bottom CTA link — Porter's Guide">
              Porter's Guide
            </Translate>
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title={translate({
        id: 'homepage.layout.title',
        // Leads with the job the visitor searched for, not with xl3's identity
        // as a standard — "open standard" is a trust signal, not the reason
        // anyone arrives. Docusaurus appends "| xl3", so no brand prefix here.
        message: 'Generate Production Excel Reports From Templates',
        description: 'HTML <title> for the landing page',
      })}
      description={translate({
        id: 'homepage.layout.description',
        message:
          'xl3 executes an ordinary .xlsx as a template: edit the transformation logic in the Excel file, supply data, and get the same formatted workbook every time.',
        description: 'HTML <meta description> for the landing page',
      })}
    >
      <Hero />
      <main>
        {/* Responsibility sits ahead of Handoff on purpose: the split it
            describes — operators own templates, developers own the runtime —
            is the value, and Handoff is the argument for why Excel is the
            place to put it. Value before rationale. */}
        <Walkthrough />
        <Responsibility />
        <Handoff />
        <Standard />
        <Comparison />
        <DeveloperApi />
      </main>
    </Layout>
  );
}
