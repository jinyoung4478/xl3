import React, { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import BrowserOnly from '@docusaurus/BrowserOnly';
import clsx from 'clsx';
import styles from '@site/src/pages/try.module.css';

const SAMPLE_RAW_URL = '/playground-samples/sample-raw-ko.xlsx';
const SAMPLE_TEMPLATE_URL = '/playground-samples/sample-template-ko.xlsx';

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
    inputs: Array<{ name: string; type: string; required?: boolean; default?: unknown; label?: string }>;
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
  if (!response.ok) throw new Error(`샘플 파일을 불러오지 못했습니다: ${exampleUrl}`);
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

function ConverterKo() {
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [inputDecls, setInputDecls] = useState<Awaited<ReturnType<Xl3Module['readTemplateInputs']>>>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ message: string; tone: 'muted' | 'error' | 'success'; code?: string }>({
    message: '샘플 파일이 올라가 있습니다. 그대로 눌러 변환하거나, 파일을 바꿔서 시작하세요.',
    tone: 'muted',
  });
  const [busy, setBusy] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<{
    sources: Array<{ name: string; rowCount: number; headers: string[] }>;
    files: Array<{ filename: string; sheets: Array<{ name: string; rowCount: number }> }>;
    warnings: Array<{ message: string }>;
  } | null>(null);
  const inputDeclsLoadedFor = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refreshDecls() {
      if (inputDeclsLoadedFor.current === templateFile) return;
      try {
        const buf = await fileOrUrlBuffer(templateFile, SAMPLE_TEMPLATE_URL);
        const xl3 = await loadXl3();
        const decls = await xl3.readTemplateInputs(buf);
        if (cancelled) return;
        setInputDecls(decls);
        const seed: Record<string, string> = {};
        for (const d of decls) if (d.default != null) seed[d.name] = String(d.default);
        setInputValues((prev) => ({ ...seed, ...prev }));
        inputDeclsLoadedFor.current = templateFile;
      } catch {}
    }
    refreshDecls();
    return () => { cancelled = true; };
  }, [templateFile]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus({ message: '엑셀 파일을 변환하고 있습니다…', tone: 'muted' });
    setPreviewInfo(null);
    try {
      const templateBuf = await fileOrUrlBuffer(templateFile, SAMPLE_TEMPLATE_URL);
      const dataBuf = await fileOrUrlBuffer(rawFile, SAMPLE_RAW_URL);
      const xl3 = await loadXl3();
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
        setStatus({ message: '변환은 끝났지만 결과 파일이 만들어지지 않았습니다.', tone: 'error' });
        return;
      }
      if (outputs.length === 1) {
        downloadBlob(outputBlob(outputs[0]), outputs[0].filename);
        setStatus({ message: `${outputs[0].filename} 다운로드를 완료했습니다.`, tone: 'success' });
      } else {
        const zip = await xl3.packageZip(outputs);
        downloadBlob(zip, 'xl3-outputs.zip');
        setStatus({ message: `결과 파일 ${outputs.length}개를 xl3-outputs.zip으로 묶어 다운로드했습니다.`, tone: 'success' });
      }
    } catch (err) {
      const xl3 = await loadXl3().catch(() => undefined);
      if (xl3 && xl3.isXtlError(err)) {
        setStatus({
          message: `변환 실패: ${err.message}`,
          tone: 'error',
          code: err.code,
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ message: `변환 실패: ${message}`, tone: 'error' });
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
        aria-label="브라우저 엑셀 변환기"
        aria-busy={busy}
      >
        <p className={styles.kicker}>브라우저 변환기</p>
        <h2 className={styles.heading}>원본 데이터와 템플릿을 올리면 완성된 엑셀 파일을 바로 받습니다.</h2>
        <p className={styles.hint}>
          원본 파일에서 읽을 표를 지정하려면 템플릿의 숨김 <code>__config__</code>{' '}
          시트에 <code>source_table</code> 값을 넣으세요(예: <code>1</code> 또는{' '}
          <code>A1:D</code>).
        </p>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>원본 엑셀 파일</span>
            <a href={SAMPLE_RAW_URL} download>샘플 다운로드</a>
          </span>
          <span className={styles.fieldHint}>기본 샘플이 들어 있습니다. 필요할 때만 바꾸면 됩니다.</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setRawFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>템플릿 엑셀 파일</span>
            <a href={SAMPLE_TEMPLATE_URL} download>샘플 다운로드</a>
          </span>
          <span className={styles.fieldHint}><code>__config__.source_table = 1</code>이 미리 설정돼 있습니다.</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {inputDecls.length > 0 && (
          <fieldset className={styles.inputsBlock}>
            <legend>템플릿 입력값</legend>
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
          {busy ? '변환 중…' : '실행하고 다운로드'}
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
        aria-label="변환 미리보기"
        aria-live="polite"
        aria-atomic="true"
      >
        <h3>미리보기</h3>
        {!previewInfo && (
          <p className={styles.previewEmpty}>변환을 실행하면 원본 행 수와 결과 파일 이름, 경고가 여기에 표시됩니다.</p>
        )}
        {previewInfo && (
          <>
            <section>
              <h4>인식된 원본</h4>
              {previewInfo.sources.length === 0 && <p>없음.</p>}
              <ul>
                {previewInfo.sources.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>{' '}
                    <span className={styles.muted}>· {s.rowCount}행 · {s.headers.length}열</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4>결과 파일</h4>
              {previewInfo.files.length === 0 && <p>없음.</p>}
              <ul>
                {previewInfo.files.map((f) => (
                  <li key={f.filename}>
                    <strong>{f.filename}</strong>
                    <ul>
                      {f.sheets.map((sh) => (
                        <li key={sh.name}>{sh.name} <span className={styles.muted}>· {sh.rowCount}행</span></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
            {previewInfo.warnings.length > 0 && (
              <section>
                <h4>경고</h4>
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

export default function ConverterPageKo() {
  return (
    <Layout
      title="xl3 변환기 — 브라우저에서 바로 엑셀 변환"
      description="원본과 템플릿 엑셀 파일을 올리면 xl3가 브라우저에서 convert()를 실행해 완성된 파일을 내려줍니다. xl3.io의 인터랙티브 데모입니다."
    >
      <main className={styles.pageMain}>
        <div className="container">
          <div className={styles.intro}>
            <p className={styles.kicker}>직접 써보기</p>
            <h1 className={styles.title}>여기서 직접 변환해 보고, 같은 변환을 앱에 연결하세요.</h1>
            <p className={styles.lead}>
              샘플 파일이 이미 올라가 있어서 버튼만 누르면 바로 변환됩니다. 원하는
              파일로 바꿔서 돌려봐도 됩니다. 변환은 전부 브라우저 안에서 이뤄지고,
              파일은 서버로 올라가지 않습니다.
            </p>
            <p className={styles.crosslinks}>
              <Link to="/">홈</Link>
              {' · '}
              <Link to="/guides/getting-started">레시피 01</Link>
              {' · '}
              <Link to="/spec/">명세 (영문)</Link>
              {' · '}
              <Link to="/porters-guide">포팅 가이드 (영문)</Link>
            </p>
          </div>
          <BrowserOnly fallback={<div className={styles.previewEmpty}>변환기를 불러오는 중…</div>}>
            {() => <ConverterKo />}
          </BrowserOnly>
        </div>
      </main>
    </Layout>
  );
}
