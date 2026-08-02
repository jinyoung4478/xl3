import React, { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import clsx from 'clsx';
import styles from './try.module.css';

// Sample files shipped under website/static/playground-samples/. ko ships its
// own pair so the demo data reads as Korean; other locales fall back to the
// English samples. Keep this the only locale-specific bit of the page — the
// copy comes from i18n/<locale>/code.json.
const SAMPLES: Record<string, { raw: string; template: string }> = {
  default: {
    raw: '/playground-samples/sample-raw.xlsx',
    template: '/playground-samples/sample-template.xlsx',
  },
  ko: {
    raw: '/playground-samples/sample-raw-ko.xlsx',
    template: '/playground-samples/sample-template-ko.xlsx',
  },
};

type OutputFile = { filename: string; data: Uint8Array };
type Xl3Module = {
  convert(
    template: ArrayBuffer,
    data: ArrayBuffer,
    options?: { inputs?: Record<string, string | number | boolean> },
  ): Promise<OutputFile[]>;
  packageZip(files: OutputFile[]): Promise<Blob>;
  preview(
    template: ArrayBuffer,
    data: ArrayBuffer,
    options?: { inputs?: Record<string, string | number | boolean> },
  ): Promise<{
    files: Array<{ filename: string; sheets: Array<{ name: string; rowCount: number }> }>;
    inputs: Array<{ name: string; type: string; required?: boolean; default?: unknown; label?: string; description?: string }>;
    sources: Array<{ name: string; rowCount: number; headers: string[] }>;
    warnings: Array<{ message: string }>;
  }>;
  readTemplateInputs(template: ArrayBuffer): Promise<
    Array<{ name: string; type: string; required?: boolean; default?: unknown; label?: string }>
  >;
  isXtlError(e: unknown): e is Error & { code: string };
};

let xl3Promise: Promise<Xl3Module> | undefined;
function loadXl3(): Promise<Xl3Module> {
  if (!xl3Promise) {
    xl3Promise = import(/* webpackChunkName: 'xl3-engine' */ '@xl3-lang/xl3') as Promise<Xl3Module>;
  }
  return xl3Promise;
}

async function fileOrUrlBuffer(file: File | null, exampleUrl: string): Promise<ArrayBuffer> {
  if (file) return file.arrayBuffer();
  const response = await fetch(exampleUrl);
  if (!response.ok) {
    throw new Error(`Could not load example file at ${exampleUrl}`);
  }
  return response.arrayBuffer();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function outputBlob(output: OutputFile): Blob {
  return new Blob(
    [output.data],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

function Converter() {
  const { i18n } = useDocusaurusContext();
  const samples = SAMPLES[i18n.currentLocale] ?? SAMPLES.default;
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [inputDecls, setInputDecls] = useState<Xl3Module extends never ? never : Awaited<ReturnType<Xl3Module['readTemplateInputs']>>>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ message: string; tone: 'muted' | 'error' | 'success'; code?: string }>({
    message: translate({
      id: 'try.status.idle',
      message: 'Sample files are pre-loaded. Press the button to convert as-is, or replace either file first.',
      description: 'Status line shown before the user has run a conversion',
    }),
    tone: 'muted',
  });
  const [busy, setBusy] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<{
    sources: Array<{ name: string; rowCount: number; headers: string[] }>;
    files: Array<{ filename: string; sheets: Array<{ name: string; rowCount: number }> }>;
    warnings: Array<{ message: string }>;
  } | null>(null);
  const inputDeclsLoadedFor = useRef<File | null>(null);

  // Re-read declared inputs whenever a new template file is supplied.
  useEffect(() => {
    let cancelled = false;
    async function refreshDecls() {
      if (inputDeclsLoadedFor.current === templateFile) return;
      try {
        const buf = await fileOrUrlBuffer(templateFile, samples.template);
        const xl3 = await loadXl3();
        const decls = await xl3.readTemplateInputs(buf);
        if (cancelled) return;
        setInputDecls(decls);
        // Seed values from defaults.
        const seed: Record<string, string> = {};
        for (const d of decls) {
          if (d.default != null) seed[d.name] = String(d.default);
        }
        setInputValues((prev) => ({ ...seed, ...prev }));
        inputDeclsLoadedFor.current = templateFile;
      } catch {
        // Silent — template might fail to parse during file picking.
      }
    }
    refreshDecls();
    return () => { cancelled = true; };
  }, [templateFile, samples.template]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus({
      message: translate({
        id: 'try.status.running',
        message: 'Converting workbook…',
        description: 'Status line shown while the converter is running',
      }),
      tone: 'muted',
    });
    setPreviewInfo(null);
    try {
      const templateBuf = await fileOrUrlBuffer(templateFile, samples.template);
      const dataBuf = await fileOrUrlBuffer(rawFile, samples.raw);
      const xl3 = await loadXl3();

      // Preview first to populate the side panel.
      const previewResult = await xl3.preview(
        templateBuf.slice(0),
        dataBuf.slice(0),
        Object.keys(inputValues).length ? { inputs: inputValues } : undefined,
      );
      setPreviewInfo({
        sources: previewResult.sources,
        files: previewResult.files,
        warnings: previewResult.warnings,
      });

      const outputs = await xl3.convert(
        templateBuf,
        dataBuf,
        Object.keys(inputValues).length ? { inputs: inputValues } : undefined,
      );
      if (outputs.length === 0) {
        setStatus({
          message: translate({
            id: 'try.status.noOutputs',
            message: 'Conversion succeeded but produced no output files.',
            description: 'Status line when convert() returns an empty array',
          }),
          tone: 'error',
        });
        return;
      }
      if (outputs.length === 1) {
        downloadBlob(outputBlob(outputs[0]), outputs[0].filename);
        setStatus({
          message: translate(
            {
              id: 'try.status.downloadedOne',
              message: 'Downloaded {filename}.',
              description: 'Status line after a single output file is downloaded',
            },
            { filename: outputs[0].filename },
          ),
          tone: 'success',
        });
      } else {
        const zip = await xl3.packageZip(outputs);
        downloadBlob(zip, 'xl3-outputs.zip');
        setStatus({
          message: translate(
            {
              id: 'try.status.downloadedMany',
              message: 'Downloaded {count} files as xl3-outputs.zip.',
              description: 'Status line after multiple output files are bundled into a zip and downloaded',
            },
            { count: String(outputs.length) },
          ),
          tone: 'success',
        });
      }
    } catch (err) {
      const xl3 = await loadXl3().catch(() => undefined);
      if (xl3 && xl3.isXtlError(err)) {
        setStatus({
          message: translate(
            {
              id: 'try.status.failedXtl',
              message: 'Conversion failed: {detail}',
              description: 'Status line on a typed xl3/XTL failure',
            },
            { detail: err.message },
          ),
          tone: 'error',
          code: err.code,
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({
          message: translate(
            {
              id: 'try.status.failedGeneric',
              message: 'Conversion failed: {detail}',
              description: 'Status line on a generic (non-xl3) runtime failure',
            },
            { detail: message },
          ),
          tone: 'error',
        });
      }
    } finally {
      setBusy(false);
    }
  }, [rawFile, templateFile, inputValues]);

  return (
    <div className={styles.converterWrap}>
      <form
        className={styles.converterForm}
        onSubmit={onSubmit}
        aria-label={translate({
          id: 'try.form.ariaLabel',
          message: 'Browser workbook converter',
          description: 'Aria-label for the converter form region',
        })}
        aria-busy={busy}
      >
        <p className={styles.kicker}>
          <Translate id="try.form.kicker" description="Form section kicker">
            Browser converter
          </Translate>
        </p>
        <h2 className={styles.heading}>
          <Translate id="try.form.heading" description="Form section H2">
            Upload raw data and a template, then download the finished workbook.
          </Translate>
        </h2>
        <p className={styles.hint}>
          <Translate
            id="try.form.hint"
            description="Hint paragraph explaining source_table; {sourceTable}, {one}, {range}, {config} are inline code refs"
            values={{
              sourceTable: <code>source_table</code>,
              one: <code>1</code>,
              range: <code>A1:D</code>,
              config: <code>__config__</code>,
            }}
          >
            {
              "To choose the raw workbook table, add {sourceTable} such as {one} or {range} to the template workbook's hidden {config} sheet."
            }
          </Translate>
        </p>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>
              <Translate id="try.form.rawLabel" description="Raw Excel file picker label">
                Raw Excel file
              </Translate>
            </span>
            <a href={samples.raw} download>
              <Translate id="try.form.downloadSample" description="Link label to download the sample file (used twice)">
                Download sample
              </Translate>
            </a>
          </span>
          <span className={styles.fieldHint}>
            <Translate id="try.form.rawHint" description="Hint under the raw file picker">
              Default sample is attached. Replace it only if you want.
            </Translate>
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setRawFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>
              <Translate id="try.form.templateLabel" description="Template Excel file picker label">
                Template Excel file
              </Translate>
            </span>
            <a href={samples.template} download>
              <Translate id="try.form.downloadSample" description="Link label to download the sample file (used twice)">
                Download sample
              </Translate>
            </a>
          </span>
          <span className={styles.fieldHint}>
            <Translate
              id="try.form.templateHint"
              description="Hint under the template file picker; {config} is an inline code ref"
              values={{ config: <code>__config__.source_table = 1</code> }}
            >
              {'Includes {config}.'}
            </Translate>
          </span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {inputDecls.length > 0 && (
          <fieldset className={styles.inputsBlock}>
            <legend>
              <Translate id="try.form.inputs.legend" description="Legend for the dynamic inputs block">
                Template inputs
              </Translate>
            </legend>
            {inputDecls.map((d) => {
              const inputId = `xl3-input-${d.name}`;
              return (
                <label key={d.name} className={styles.inputField} htmlFor={inputId}>
                  <span>
                    {d.label || d.name}
                    {d.required ? ' *' : ''}
                  </span>
                  <input
                    id={inputId}
                    value={inputValues[d.name] ?? ''}
                    onChange={(e) => setInputValues((v) => ({ ...v, [d.name]: e.target.value }))}
                    placeholder={d.default != null ? String(d.default) : ''}
                  />
                </label>
              );
            })}
          </fieldset>
        )}

        <button
          type="submit"
          className={clsx('button button--primary button--lg', styles.submit)}
          disabled={busy}
        >
          {busy ? (
            <Translate id="try.form.submit.busy" description="Submit button label while a conversion is running">
              Converting…
            </Translate>
          ) : (
            <Translate id="try.form.submit.idle" description="Submit button label when idle">
              Run and download
            </Translate>
          )}
        </button>
        <p
          className={clsx(styles.status, styles[`status_${status.tone}`])}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {status.message}
          {status.code && (
            <>
              {' '}
              <code style={{ fontSize: '0.85em' }}>{status.code}</code>
            </>
          )}
        </p>
      </form>

      <aside
        className={styles.previewPanel}
        aria-label={translate({
          id: 'try.preview.ariaLabel',
          message: 'Conversion preview',
          description: 'Aria-label for the preview side panel',
        })}
        aria-live="polite"
        aria-atomic="true"
      >
        <h3>
          <Translate id="try.preview.heading" description="Preview panel heading">
            Preview
          </Translate>
        </h3>
        {!previewInfo && (
          <p className={styles.previewEmpty}>
            <Translate id="try.preview.empty" description="Placeholder text when no conversion has run yet">
              Run the converter to see source counts, output filenames, and any warnings.
            </Translate>
          </p>
        )}
        {previewInfo && (
          <>
            <section>
              <h4>
                <Translate id="try.preview.sources.heading" description="Preview subsection — sources">
                  Sources detected
                </Translate>
              </h4>
              {previewInfo.sources.length === 0 && (
                <p>
                  <Translate id="try.preview.none" description="Placeholder when a list is empty (used in multiple sections)">
                    None.
                  </Translate>
                </p>
              )}
              <ul>
                {previewInfo.sources.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>{' '}
                    <span className={styles.muted}>
                      ·{' '}
                      <Translate
                        id="try.preview.sourceMeta"
                        description="Source row count + column count meta; {rowCount} and {colCount} are integers"
                        values={{ rowCount: s.rowCount, colCount: s.headers.length }}
                      >
                        {'{rowCount} rows · {colCount} cols'}
                      </Translate>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4>
                <Translate id="try.preview.outputs.heading" description="Preview subsection — output files">
                  Output files
                </Translate>
              </h4>
              {previewInfo.files.length === 0 && (
                <p>
                  <Translate id="try.preview.none" description="Placeholder when a list is empty (used in multiple sections)">
                    None.
                  </Translate>
                </p>
              )}
              <ul>
                {previewInfo.files.map((f) => (
                  <li key={f.filename}>
                    <strong>{f.filename}</strong>
                    <ul>
                      {f.sheets.map((sh) => (
                        <li key={sh.name}>
                          {sh.name}{' '}
                          <span className={styles.muted}>
                            ·{' '}
                            <Translate
                              id="try.preview.sheetMeta"
                              description="Per-sheet row count meta; {rowCount} is an integer"
                              values={{ rowCount: sh.rowCount }}
                            >
                              {'{rowCount} rows'}
                            </Translate>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
            {previewInfo.warnings.length > 0 && (
              <section>
                <h4>
                  <Translate id="try.preview.warnings.heading" description="Preview subsection — warnings">
                    Warnings
                  </Translate>
                </h4>
                <ul>
                  {previewInfo.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

export default function ConverterPage() {
  return (
    <Layout
      title={translate({
        id: 'try.layout.title',
        message: 'xl3 converter — try Excel-to-Excel templates in the browser',
        description: 'HTML <title> for the converter page',
      })}
      description={translate({
        id: 'try.layout.description',
        message:
          'Upload raw + template Excel files. xl3 runs convert() in the browser and downloads the rendered workbook. The interactive demo for xl3.io.',
        description: 'HTML <meta description> for the converter page',
      })}
    >
      <main className={styles.pageMain}>
        <div className="container">
          <div className={styles.intro}>
            <p className={styles.kicker}>
              <Translate id="try.intro.kicker" description="Intro section kicker">
                Use it
              </Translate>
            </p>
            <h1 className={styles.title}>
              <Translate id="try.intro.title" description="Intro section H1">
                Try the operator flow, then wire it into your app.
              </Translate>
            </h1>
            <p className={styles.lead}>
              <Translate id="try.intro.lead" description="Intro section lead paragraph">
                Both files are pre-loaded with sample data. Press the button to convert as-is, or replace either file. Conversion runs entirely in your browser — nothing is uploaded.
              </Translate>
            </p>
            <p className={styles.crosslinks}>
              <Link to="/">
                <Translate id="try.intro.link.home" description="Crosslink — Home">
                  Home
                </Translate>
              </Link>
              {' · '}
              <Link to="/guides/getting-started">
                <Translate id="try.intro.link.cookbook" description="Crosslink — Cookbook 01">
                  Cookbook 01
                </Translate>
              </Link>
              {' · '}
              <Link to="/spec/">
                <Translate id="try.intro.link.spec" description="Crosslink — Spec">
                  Spec
                </Translate>
              </Link>
              {' · '}
              <Link to="/porters-guide">
                <Translate id="try.intro.link.porters" description="Crosslink — Porter's Guide">
                  Porter's Guide
                </Translate>
              </Link>
            </p>
          </div>
          <BrowserOnly
            fallback={
              <div className={styles.previewEmpty}>
                <Translate id="try.fallback.loading" description="BrowserOnly fallback while xl3 engine loads">
                  Loading converter…
                </Translate>
              </div>
            }
          >
            {() => <Converter />}
          </BrowserOnly>
        </div>
      </main>
    </Layout>
  );
}
