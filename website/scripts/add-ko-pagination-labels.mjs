#!/usr/bin/env node
// Adds `pagination_label` + `sidebar_label` frontmatter to each Korean
// guide page so the prev/next pagination buttons render in Korean.
// Docusaurus's pagination falls back to the source-language sidebars.ts
// label when the doc has no frontmatter override.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = join(here, '..', 'i18n/ko/docusaurus-plugin-content-docs/current/guides');

const LABELS = {
  '01-getting-started.md': '01 · 시작하기',
  '02-conditional-cells.md': '02 · 조건부 셀',
  '03-aggregates.md': '03 · 합계와 집계',
  '04-file-per-group.md': '04 · 그룹별로 파일 나누기',
  '05-sheet-per-group.md': '05 · 그룹별로 시트 나누기',
  '06-runtime-inputs.md': '06 · 실행 시점 입력값',
  '07-multi-source-join.md': '07 · 다중 소스와 @join',
  '08-xlookup.md': '08 · XLOOKUP 조회',
  '09-sort-and-top.md': '09 · 정렬과 상위 N개',
  '10-styling-and-branding.md': '10 · 서식과 브랜딩',
  '11-text-formatting.md': '11 · TEXT() 서식',
  '12-empty-values.md': '12 · 빈 값 심화',
  '13-error-handling.md': '13 · 호스트 측 오류 처리',
  '14-config-values.md': '14 · 값 사전으로 쓰는 __config__',
  '15-directive-composition.md': '15 · 디렉티브 조합하기',
  '16-xtl-vs-excel-formula.md': '16 · XTL 함수와 Excel 수식 비교',
  '17-template-authoring-display.md': '17 · 템플릿 작성용 표시값',
  '18-group-and-subtotal.md': '18 · 그룹과 소계',
};

async function main() {
  for (const [file, label] of Object.entries(LABELS)) {
    const path = join(GUIDES_DIR, file);
    let content = await readFile(path, 'utf8');
    if (content.startsWith('---\n')) {
      // already has frontmatter — leave as-is unless missing the keys
      if (content.includes('sidebar_label:')) {
        console.log(`  ${file}: frontmatter already present, skipping`);
        continue;
      }
      // Inject keys into existing frontmatter
      content = content.replace(
        /^---\n/,
        `---\nsidebar_label: '${label}'\npagination_label: '${label}'\n`,
      );
    } else {
      content = `---\nsidebar_label: '${label}'\npagination_label: '${label}'\n---\n\n${content}`;
    }
    await writeFile(path, content);
    console.log(`  ${file}: ${label}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
