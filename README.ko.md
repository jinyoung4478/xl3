# xl3 — Excel 보고서를 코드가 아니라 템플릿으로

> 변환 로직을 Excel 파일에서 직접 고치고, 데이터를 넣으면 실행합니다.
> 서식은 그대로, 결과는 매번 같습니다. Jinja가 HTML을 템플릿으로
> 만들었듯, **xl3는 Excel 파일을 실행 가능한 템플릿으로 만듭니다** —
> 단일 라이브러리가 아니라, 구현에 독립적인 열린 표준으로.

**상태:** alpha · **XTL spec 0.1 (draft)** · 레퍼런스 구현
`@xl3-lang/xl3` 0.13.0 · 1.0 전까지 breaking change 가능

**xl3**는 평범한 `.xlsx` 파일을 결정론적·선언형 변환 템플릿으로 바꾸는
열린 표준입니다. 레이아웃·스타일·병합 셀·규칙이 *Excel 파일 안에* 들어가고,
규격을 따르는 어떤 엔진이든 주어진 데이터에 대해 이를 실행합니다 — 같은
입력이면 언제나 같은 출력. 이 저장소가 그 표준을 세 부분으로 *정의*합니다:

- **[스펙](./spec/)** — 규범적 정의. 파일이 *만들어지기 전에* 확정돼야 할
  것(필터·그룹·집계·파일명 패턴)을 위한 작은 임베디드 표현식 언어 **XTL**과
  설계 기록(ADR) 포함.
- **[적합성 스위트](./conformance/)** — 어떤 구현이든 규격 준수를
  증명하기 위해 실행하는 언어중립 픽스처.
- **레퍼런스 구현** —
  [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3)
  (TypeScript, [`impl/js/`](./impl/js/)) — 여러 [구현](./IMPLEMENTATIONS.md) 중
  하나 (Rust/WASM·Python 진행 중).

**이름은 셋, 스택은 하나:** **xl3** = 표준(이 포맷) · **XTL** = 그 임베디드
표현식 언어 · **`@xl3-lang/xl3`** = 그 TypeScript 레퍼런스 구현.

월간 보고서·견적서·거래명세서·재무 보고서처럼 반복되는 Excel 문서를
Excel에서 계속 수정할 수 있게 두면서도 실행은 결정론적이고 점검·검증
가능해야 할 때 잘 맞습니다. AI 작성에도 유리합니다. LLM은 수백 줄짜리 SDK
코드보다 작은 템플릿 계약을 더 안정적으로 생성할 수 있습니다.

[English](./README.md) · **한국어** · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 분리 구조: Excel은 템플릿이고, xl3가 실행한다

```text
  ┌──────────────────────────┐
  │   실무자 / 디자이너      │
  │   Excel에서 레이아웃 수정│
  └─────────────┬────────────┘
                │ template.xlsx
                ▼
  ┌──────────────────────────┐       ┌──────────────────────────┐
  │      개발자 애플리케이션 │       │           xl3            │
  │      데이터 + 입력 제공  ├──────►│      템플릿 실행          │
  └──────────────────────────┘       └─────────────┬────────────┘
                                                    │
                                                    ▼
                                             result.xlsx
```

ExcelJS·SheetJS·openpyxl 같은 SDK는 스프레드시트의 DOM API입니다. 강력하지만
장황합니다. 반복되는 문서에서는 Excel 파일 자체가 뷰이자 템플릿 계약이어야
합니다. xl3는 애플리케이션이 데이터를 제공하고, Excel이 레이아웃과
업무 규칙을 소유하게 만듭니다.

이 분리 구조 때문에 [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md),
169 개 conformance fixture 코퍼스, 그리고 의도적으로 작은 XTL 표면이
존재합니다.

## 간단한 예시

템플릿에는 일반 Excel 내용, `__config__`, xl3 표현식을 함께 넣을 수 있습니다.

| `__config__` key | 값 |
|---|---|
| `source_sheet` | `원본` |
| `source_table` | `1` |
| `output_file_pattern` | `거래처-갱신-리포트.xlsx` |

| 셀 | 템플릿 값 |
|---|---|
| A5 | `{{ [거래처] }}` |
| B5 | `{{ [지역] }}` |
| C5 | `{{ [갱신액] }}` |
| E5 | `{{ IF([갱신액] > 10000, "우선", "일반") }}` |

데이터 Excel 파일이 다음과 같다면:

| 거래처 | 지역 | 갱신액 | 담당자 |
|---|---|---:|---|
| 한솔물산 | 서울 | 18400 | 민아 |
| 베타웍스 | 부산 | 7200 | 준호 |

xl3는 다음 결과를 렌더링합니다:

| 거래처 | 지역 | 갱신액 | 담당자 | 등급 |
|---|---|---:|---|---|
| 한솔물산 | 서울 | 18400 | 민아 | 우선 |
| 베타웍스 | 부산 | 7200 | 준호 | 일반 |

…숫자 형식, 채우기, 테두리, 병합 헤더, 푸터 행이 모두 그대로 보존됩니다.
출력은 변환 없이 Excel · Numbers · Google Sheets에서 바로 열리는 `.xlsx`
입니다.

무엇이 보존되고 무엇이 안 되는지는 [지원 범위 문서](./docs/support-matrix.md)에
기능 단위로 정리해 두었습니다. 1.1로 미뤄둔 네 가지와 크기 한계도 함께
적혀 있습니다.

언어 초안은 [`spec/`](./spec)에, 구현 중립적인 fixture corpus와 runner
protocol은 [`conformance/`](./conformance)에 있습니다.

## 왜 Excel이 템플릿이어야 하는가

한 문장 요약: **보고서 레이아웃은 이미 Excel 안에 있습니다.** 그 레이아웃을
코드로 옮기는 순간 행 삽입, 스타일 변경, 병합 수정, 소계 규칙 변경이 모두
배포가 됩니다. xl3는 레이아웃을 Excel에 남기고, Excel 파일을 실행 가능하게
만듭니다. 애플리케이션은 데이터와 배포를 책임지고, 템플릿은 반복되는 문서
계약을 책임집니다.

구체적으로:

- **작고 점검 가능한 XTL 표면 (ADR-0043).** 어떤 함수가 XTL에
  살려면, 그 값이 파일이 만들어지기 *전에* 정해져야 합니다. 그 외의
  모든 것은 평범한 Excel 셀 수식이고, Excel이 열릴 때 직접 평가합니다.
  언어가 작을수록 사람이 검토하기 쉽고, AI가 초안을 만들기도 쉽습니다. 대조표는
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md) 참고.
- **적합성 픽스처.** ADR 77개 위에 픽스처 169개, 전부 통과.
  변환 계약을 실행 가능한 형태로 검증하는 테스트베드입니다.
- **구현 하나, 스펙 하나.** [`spec/`](./spec) 디렉토리가 이
  TypeScript 레퍼런스와는 별개로 XTL을 정의합니다. 다른 런타임으로의
  포팅도 환영 — 코퍼스가 곧 계약입니다.
- **매크로도 외부 클라우드도 없음.** 템플릿은 평범한 `.xlsx` 입니다.
  diff로 비교하고, PR로 리뷰하고, xl3를 모르는 사람에게도 그대로
  넘길 수 있습니다.

같은 특성은 **LLM이 없는 흐름에서도** 유용합니다 — 실무자와 분석가가
템플릿을 직접 읽고 편집할 수 있으니까요. 평소 쓰던 `IF`, `SUM`, 컬럼
참조 그대로의 문법입니다. AI 친화성은 같은 설계 선택의 결과입니다:
작고, 선언적이고, 검토 가능한 규칙.

## 책임 중심 문서 자동화

대부분의 Excel 자동화 도구는 개발자의 생산성을 높이는 데 집중합니다.
xl3의 목표는 다릅니다. 개발자가 하던 반복 문서 변경을 운영자가 직접
수행할 수 있게 만드는 것입니다.

기존 방식에서는 레이아웃 변경, 컬럼 추가, 반복 로직 수정, 출력 형식 변경이
모두 개발 요청과 배포가 됩니다. xl3는 책임을 이렇게 분리합니다.

```text
개발자   -> 런타임 유지보수
운영자   -> 템플릿 유지보수
비즈니스 -> 결과 사용
```

개발자는 엔진, 검증, 통합, 배포의 안정성을 책임집니다. 운영자는 Excel
템플릿과 문서별 변환 규칙을 직접 관리합니다. 비즈니스는 완성된 Excel 파일을
사용합니다.

이 모델은 이론만이 아닙니다. xl3는 실제 사내 서비스에서 수개월 동안
운영되며, 비개발자가 템플릿과 변환 규칙을 Excel 안에서 직접 유지보수할 수
있다는 것을 확인했습니다. 개발 리소스는 거의 Runtime 개선에 집중했고,
중요하게 줄어든 것은 코드의 양만이 아니라 개발자가 반드시 해야 하는 업무의
양이었습니다.

그래서 XTL은 가능한 한 Excel 문법을 유지합니다. 목표 경험은 "새 언어를
배운다"가 아니라 "평소 Excel을 조금 더 강력하게 쓴다"입니다. xl3는
개발자를 대체하려는 프로젝트가 아닙니다. 개발자는 런타임을 만들고,
운영자는 템플릿을 관리합니다. xl3는 Excel 자동화의 소유권을 개발자에서
운영 조직으로 옮기는 런타임입니다.

## 비교

| 접근 | 잘하는 영역 | 트레이드오프 |
|---|---|---|
| **xl3** | 선언형 Excel 템플릿 실행. Excel 파일은 이미 존재하고, xl3는 데이터를 넣어 실행합니다. | Alpha; 메인테이너 1명; XTL 표면은 의도적으로 작게 유지하며 1.0 전까지 다듬는 중. |
| 스프레드시트 SDK (ExcelJS / SheetJS / openpyxl / Apache POI) | 코드 기반의 저수준 또는 풀-기능 Excel 파일 생성. | 레이아웃, 스타일, 병합, 반복, 업무 규칙이 애플리케이션 코드가 됩니다. 비개발자가 안전하게 템플릿을 고치기 어렵습니다. |
| Python / VBA 스크립트 | 기존 스프레드시트에 가까운 빠른 일회성 자동화. | 규칙이 코드나 한 담당자의 기억에 남기 쉽고, 레이아웃 변경도 코드 변경이 됩니다. |
| Power Query / Office Scripts / Power Automate | Microsoft 365 안에서의 데이터 가공·워크플로 자동화. | 테넌트에 묶임 — 업무 규칙이 Excel 파일과 함께 이동하지 않습니다. |
| JXLS / xltpl / jsreport xlsx recipe | 스프레드시트형 템플릿 기반의 서버 사이드 리포트 생성. | 유용한 선행 사례지만 대개 하나의 런타임에 묶여 있고, 작고 이식 가능한 Excel 규칙 포맷으로 자리 잡지는 못했습니다. |
| Plumsail / Conga / Formstack 같은 문서 생성 SaaS | 관리형 문서 워크플로·승인·전달. | 규칙이 벤더 서비스 안에 머물고, 직접 검토하고 실행할 수 있는 이식 가능한 Excel 템플릿이 아닙니다. |
| LLM → xlsx 직접 생성 | 빠른 탐색·일회성 차트. | 반복되는 운영 업무를 위한 결정적 변환 계약으로 쓰기에는 부적합합니다. |

## 설치

```bash
npm install @xl3-lang/xl3
```

## 사용법

```ts
import { convert } from '@xl3-lang/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 템플릿의 grouping rule에 따라 하나 이상의 .xlsx 출력
```

브라우저와 Node 20.12 이상에서 동작합니다.

### `data.xlsx` 대신 JSON 소스

Excel이 아닌 호스트(Python 서비스, DB/ETL 작업)는 Excel 파일을 거치지 않고
언어 중립적인 `xl3-source-json/0.1` 와이어 포맷을 그대로 넘길 수 있습니다.
`convertJson`은 동등한 `data.xlsx`로 `convert`를 돌린 것과 정확히 같은
결과를 렌더링합니다.

```ts
import { convertJson } from '@xl3-lang/xl3';

const outputs = await convertJson(templateBuffer, {
  version: 'xl3-source-json/0.1',
  sources: {
    default: { headers: ['Customer', 'Amount'], rows: [['Acme', 100]] },
  },
});
```

`previewJson`이 preview 쪽 짝입니다. 잘못된 입력은
`xl3/source-json/invalid`를 발생시킵니다. 0.11.0에서
[ADR-0075](./spec/decisions/0075-xl3-source-json.md)로 추가됐고, wire
format은 구현 간 이식 가능하며 `.xlsx` 경로는 그대로입니다.

### 번들러 없이 `<script>`로 사용

번들러를 쓰지 않는 환경에서는 자체 포함 IIFE 번들을 그대로 가져오면
`window.xl3`로 사용할 수 있습니다.

```html
<script src="https://cdn.jsdelivr.net/npm/@xl3-lang/xl3@0.13.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

번들 크기는 약 1 MB (minified, gzip 약 300 KB). ExcelJS와 JSZip이 같이
들어가 있어 다른 의존성 없이 한 줄 include로 바로 동작합니다.

[xl3.io](https://xl3.io)에서 브라우저 흐름을 바로 시험해볼 수 있습니다.
첨부된 샘플 파일을 그대로 실행해도 되고, 원본·템플릿 Excel 파일을 내려받아
살펴봐도 되고, 원하는 파일로 교체해서 돌려봐도 됩니다.

템플릿의 숨김 `__config__` 시트에서 원본 파일의 소스 테이블 위치를 지정할
수 있습니다.

| 키 | 예시 | 의미 |
|---|---|---|
| `source_sheet` | `원본` | 원본 시트 이름, 또는 `*`로 끝나는 접두사 패턴 |
| `source_table` | `1` | 1 행을 컬럼명으로 읽고, 그 아래 행들을 데이터로 처리 |
| `source_table` | `A1:D` | A1-D1을 컬럼명으로 읽고, 그 아래 행들을 데이터로 처리 |
| `source_table` | `A1:D200` | A1-D1을 컬럼명으로 읽고, A2-D200 영역을 데이터로 처리 |

원본 파일의 N 번 행이 컬럼명인 일반적인 경우에는 `source_table = N` 한 줄이면
됩니다. 테이블이 중간 컬럼에서 시작하거나 끝 행을 제한해야 할 때만 범위
형식을 씁니다.

### 예약 시트

템플릿은 양쪽이 더블 언더스코어로 감싸진 예약 시트 네 개를 사용합니다
(ADR-0011 기준).

| 시트 | 용도 |
|---|---|
| `__config__` | 템플릿 작성자가 정의하는 설정과 값 사전. `{{ __config__[name] }}`로 참조 |
| `__inputs__` | 실행 시점에 호스트가 넘기는 입력값 (ADR-0010). `name`/`type`/`default`/`label`/`description`/`options` 컬럼으로 선언 |
| `__sources__` | 기본 `source_sheet` 외에 추가로 쓰는 이름 붙은 데이터 소스 (ADR-0012). `name`/`sheet`/`table`/`description` 컬럼으로 선언 |
| `__lists__` | `@filter [field] in __lists__[name]` 등에서 쓰는 멤버십 목록 |

작성자가 만든 시트 이름이 `^__[a-z]+__$` 패턴에 걸리면 파싱 단계에서
거절됩니다.

### 다중 소스 (Multi-source) 데이터

기본 `source_sheet` 외에도 템플릿이 `__sources__`에서 이름 붙은 소스를
선언하고 Excel 구조화 참조 (structured reference) 형식으로 가져올 수 있습니다.

```text
{{ 거래처[거래처명] }}
{{ SUM(갱신현황[금액]) }}
{{ XLOOKUP([거래처코드], 거래처[코드], 거래처[거래처명]) }}
```

`@source <Name>`은 데이터 블록의 기본 소스를 `<Name>`으로 바꿔서 단축형
`[Column]`도 `<Name>` 기준으로 해석되게 합니다. `@join`은 두 번째 소스의
행을 키 기준으로 기본 행과 짝지웁니다 (inner join, 첫 매치 사용). 전체
디렉티브 문법은 [`spec/language.md`](./spec/language.md)를 참고하세요.

## 가이드

자주 쓰는 패턴을 모은 짧은 레시피 18 개가
[`docs/guides/`](./docs/guides)에 있습니다. 시작하기, 조건문, 집계,
파일·시트 그룹화, 런타임 입력값, 조인, `XLOOKUP`, 정렬·Top-N, 브랜딩,
멀티라인 텍스트, 빈 값, 에러 처리, `__config__` 값, 디렉티브 조합, XTL
vs Excel 수식, 템플릿 작성 시 표시, `@group` / `@subtotal`까지 다룹니다.

## Spec

XTL 스펙은 언어 중립적이며 [`spec/`](./spec)에 있습니다. 이 저장소는
TypeScript 레퍼런스 구현을 함께 제공합니다. 다른 언어 포팅도 환영합니다 —
자세한 내용은 [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) 참고.

Conformance 코퍼스는 로컬에서 바로 돌려볼 수 있습니다.

```bash
npm run conformance
npm run conformance:stage2
```

## 프로젝트 구조

- `spec/` — 정규 XTL 언어 초안
- `conformance/` — 구현 중립적인 fixture 코퍼스와 runner protocol
- `impl/js/src/` — TypeScript 레퍼런스 구현

스펙이 진실의 출처입니다. Conformance fixture는 그 스펙 동작을 실행 가능한
형태로 굳혀둡니다. 레퍼런스 구현은 유용한 도구이지만 그 자체가 기준은
아닙니다.

## 라이선스

- Code (`impl/js/src/`, `conformance/`): [MIT](./LICENSE)
- XTL spec (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft와 Excel은 Microsoft Corporation의 상표입니다. xl3는 Microsoft와
관련이 없습니다. Office Open XML 형식(`.xlsx`)은 ISO/IEC 29500으로 공개되어
있습니다.
