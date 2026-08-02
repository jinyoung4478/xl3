---
slug: /guides
sidebar_label: '개요'
pagination_label: '개요'
---

# XTL 가이드

자주 쓰는 리포트 워크플로를 바로 복붙해 쓸 수 있도록 모아 둔 짧은 레시피 모음입니다. 각 레시피는 시나리오, 템플릿 셀, 기대 결과로 구성된 짧은 마크다운 페이지입니다.

이 가이드들은 기존에 있는 두 자료를 보완합니다:

- **[`examples/`](https://github.com/xl3-lang/xl3/tree/main/examples/)**에는 네 개의 실행 가능한 템플릿이 있고, 조합된 형태를 end-to-end로 보여줍니다. 하나 복사해서 출발점으로 쓰세요. 한국어 예시는 `04-cafe-weekly-report`를 참고하세요.
- **[`spec/language.md`](https://xl3.io/spec/language)**는 각 함수와 디렉티브에 대한 정식 레퍼런스입니다(영문). 레시피로 커버되지 않는 케이스를 만났을 때 참고하세요.

여기 있는 레시피들은 "프로덕션 수준의 현실성"보다 "X를 보여주는 가장 작은 템플릿"을 우선합니다 — 모양은 기억나는데 문법이 가물가물할 때 빠르게 찾아보는 것이 목적입니다.

## 레시피

| # | 레시피 | 배울 내용 |
|---|---|---|
| 01 | [5분 만에 시작하기](/guides/getting-started) | 템플릿 + 데이터 → 결과. 치환과 `__config__`. |
| 02 | [조건부 셀](/guides/conditional-cells) | `IF`, `IFEMPTY`, 비교 연산자, truthiness. |
| 03 | [행 집계](/guides/aggregates) | `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX` — 블록 단위 vs 소스 전체. |
| 04 | [그룹마다 파일 하나](/guides/file-per-group) | `output_file_pattern`으로 파일을 그룹핑. |
| 05 | [그룹마다 시트 하나](/guides/sheet-per-group) | 시트 그룹핑 + 리스트 기반 필터. |
| 06 | [런타임 입력](/guides/runtime-inputs) | 실행 단위 값 (월, 지역 등)을 위한 `__inputs__`. |
| 07 | [멀티 소스 + `@join`](/guides/multi-source-join) | `__sources__`, `@source`, `@join`. |
| 08 | [`XLOOKUP`](/guides/xlookup) | 크로스 소스 조회. |
| 09 | [정렬과 상위 N개](/guides/sort-and-top) | `@sort` (stable), `@top`, 다중 키 정렬. |
| 10 | [스타일과 브랜딩](/guides/styling-and-branding) | `tabColor`, 셀 병합, `numFmt`, `TEXT()`. |
| 11 | [`TEXT()` 포맷팅](/guides/text-formatting) | 통화, 날짜, 퍼센트. `numFmt`와 `TEXT()`의 사용처 구분. |
| 12 | [빈 값 깊이 다루기](/guides/empty-values) | `IFEMPTY`, empty와 0의 함정, `(blank)`, 희소 데이터의 집계. |
| 13 | [호스트를 위한 에러 처리](/guides/error-handling) | `XtlError` 잡기, 코드 카탈로그, fail-fast를 위한 `preview()`. |
| 14 | [값 사전으로 쓰는 `__config__`](/guides/config-values) | 작성자 정의 키, 타입 인식, `__config__` vs `__inputs__`. |
| 15 | [디렉티브 조합하기](/guides/directive-composition) | 실행 순서, 여러 `@filter`의 AND 결합, 금지된 조합. |
| 16 | [XTL 함수 vs Excel 수식](/guides/xtl-vs-excel-formula) | `{{ ... }}`와 `=...` 셀 수식을 어떻게 나눠 쓸지. ADR-0043의 render-time / open-time 경계. |
| 17 | [템플릿 작성용 표시값](/guides/template-authoring-display) | 템플릿 편집 중 Excel에서 보이는 모습 (에러, 플레이스홀더), 그게 의도된 이유, 대시보드용 `IFERROR` wrap 관행. |
| 18 | [`@group`과 `@subtotal`](/guides/group-and-subtotal) | 하나의 데이터 블록 안에 그룹별 소계 행을 끼워 넣기 (ADR-0038) — 단일 레벨, 중첩, 가장 바깥 @subtotal로 만드는 총계. |

## 레시피를 읽는 법

각 레시피는 같은 구조를 따릅니다:

1. **시나리오** — 운영자가 원하는 결과를 한 문장으로.
2. **`__config__`** — 필요한 키들.
3. **템플릿 셀** — 결과를 만들기 위한 가장 작은 셀 집합.
4. **데이터** — 작은 입력 표.
5. **결과** — `convert()`가 돌려주는 것.
6. **노트** — 조심할 부분과, 더 알고 싶을 때 참고할 스펙 포인터.

## 표기 규칙

- 셀은 `[row, col]`이 아니라 Excel이 쓰는 `A1` 표기를 씁니다.
- `__config__` 값은 간결하게 `key = value` 형태로 적어 두지만, 실제 `template.xlsx` 안에서는 두 컬럼 (`A: key`, `B: value`)으로 들어갑니다.
- 원본 데이터는 레시피를 짧게 유지하기 위해 마크다운 테이블로 표시합니다. 실제 `data.xlsx`에서는 `source_sheet`와 같은 이름의 워크시트에 그 행들이 들어 있습니다.

## 레시피 실행해 보기

가이드의 레시피들은 문서 위주입니다 — 모든 레시피에 실행 가능한 `.xlsx` 쌍이 함께 제공되지는 않습니다. 직접 해 보려면:

1. Excel을 열어 새 Excel 파일을 만듭니다.
2. 레시피에 적힌 키들로 `__config__` 시트를 추가합니다.
3. `source_sheet`와 같은 이름의 데이터 시트를 추가합니다.
4. 레시피의 셀들로 템플릿 시트를 추가합니다.
5. `template.xlsx`로 저장하고, 데이터는 `data.xlsx`로 저장합니다.
6. `convert(templateBuffer, dataBuffer)`를 실행합니다 ([README](/readme#usage) 참고).

또는 더 빠르게는, [실행 가능한 예제](https://github.com/xl3-lang/xl3/tree/main/examples/) 중 하나를 복사해서 입맛에 맞게 고쳐 쓰세요.
