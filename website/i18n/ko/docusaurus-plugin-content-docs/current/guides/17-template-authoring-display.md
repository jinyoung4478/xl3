---
sidebar_label: '17 · 템플릿 작성용 표시값'
pagination_label: '17 · 템플릿 작성용 표시값'
---

# 17 · 템플릿 작성 시 표시 동작

## 흔한 상황

`template.xlsx`를 Excel로 열어 편집 중입니다. 다음과 같은 게 보입니다:

- `=VLOOKUP("한솔", Data!A:B, 2, FALSE)` 셀이 `#N/A`로 표시됨.
- `=Data!B2 + 100` 셀이 `#VALUE!`로 표시됨.
- 통화 형식 `₩#,##0`으로 설정된 셀에 `{{ [금액] }}`가 일반 텍스트로 보임.
- 플레이스홀더 셀을 클릭하면 데이터 유효성 검사 경고가 뜸.

**이 중 어느 것도 버그가 아닙니다.** xl3가 템플릿을 렌더하면 모두 사라집니다:

- Data 시트의 플레이스홀더가 실제 값으로 치환됩니다.
- VLOOKUP이 A열에서 "한솔"를 찾습니다.
- 셀이 이제 숫자이기 때문에 `+100`이 동작합니다.
- 통화 서식이 치환된 숫자에 적용됩니다.
- 유효성 검사 규칙은 실제 값에 적용됩니다.

이 레시피는 *왜* 템플릿 뷰가 그렇게 보이는지, 그리고 잡음이 너무 많다고 느껴질
때 어떻게 정리할 수 있는지를 설명합니다. (ADR-0049가 이 동작의 normative
contract입니다.)

## 왜 플레이스홀더가 리터럴 텍스트로 표시되는가

템플릿 셀 값이 `{{ [금액] }}` 이고 서식이 `#,##0.00` 이라면, Excel은
숫자 셀에 비숫자 문자열이 들어있는 상황을 봅니다. Excel의 동작:

- 텍스트를 있는 그대로 표시 (자동 서식 적용 안 함).
- "텍스트로 저장된 숫자" 초록 삼각형 표시 안 함 (휴리스틱이 숫자처럼 보이는
  내용을 요구하는데 `{{ ... }}`는 명백히 숫자가 아님).
- 오류로 처리하지 않음 (잘못된 수식이 아니라 그냥 문자열이라서).

편집 뷰에서는 `{{ [금액] }}`가 보이고, xl3가 렌더한 뒤에는 같은 셀에
`1,234.56` (값 × 서식 조합에 따른 결과)이 보입니다.

**이건 의도된 동작입니다.** 플레이스홀더가 눈에 보인다는 점이 템플릿을
*self-documenting* 하게 만들어줍니다 — 실행하지 않고도 어떤 셀이 동적이고
어떤 셀이 고정인지 한눈에 보입니다. 리뷰어가 파일만 열어도 contract을
읽어낼 수 있습니다.

## 왜 대시보드 수식이 에러를 보여주는가 (정리하는 법)

대시보드 시트에 다음 같은 수식이 자주 들어갑니다:

```excel
=VLOOKUP("한솔", Data!A:B, 2, FALSE)
=Data!B2 + 100
=AVERAGE(Data!B:B)
=SUMPRODUCT((Data!A:A="VIP") * Data!B:B)
```

템플릿을 열었을 때 (렌더 전)이 수식들은 Data 시트의 플레이스홀더 행을
참조합니다. 룩업은 매치를 찾지 못하고 (문자열은 리터럴 키와 일치하지 않음),
문자열 산술은 `#VALUE!`를 반환합니다. 결과적으로 대시보드는 작성 중에 빨간
셀로 가득 차게 됩니다.

### 해결: `IFERROR`로 감싸기

Excel native 정답입니다. 수식마다 한 줄, 익히는 데 몇 초.

```excel
=IFERROR(VLOOKUP("한솔", Data!A:B, 2, FALSE), "—")
=IFERROR(Data!B2 + 100, 0)
=IFERROR(AVERAGE(Data!B:B), 0)
=IFERROR(SUMPRODUCT((Data!A:A="VIP") * Data!B:B), 0)
```

렌더 전 템플릿 뷰: 깔끔 (`—`, `0`).
렌더 후 출력: 실제 값 (xl3는 수식 텍스트를 건드리지 않습니다 —
[ADR-0046](https://xl3.io/spec/decisions/cell-formula-preservation) 참조; Excel이
열 때 재계산하고 wrapper가 자연스럽게 사라집니다).

### 어떤 수식을 감싸야 하나

| 수식 | 템플릿 뷰 에러? | 감싸기? |
|---|---|---|
| `=SUM(Data!B:B)` | 아니오 — SUM은 범위 내 텍스트를 무시하고 0을 반환 | 선택 |
| `=SUMIF(Data!A:A, "VIP", Data!B:B)` | 아니오 — 매치 없으면 0 | 선택 |
| `=COUNTIF(Data!A:A, "VIP")` | 아니오 — 0 반환 | 선택 |
| `=AVERAGE(Data!B:B)` | **예** — 숫자가 없으면 `#DIV/0!` | 예 |
| `=VLOOKUP("key", Data!..., ...)` | **예** — 매치 없으면 `#N/A` | 예 |
| `=INDEX(...,MATCH("key",Data!A:A,0))` | **예** — `#N/A` | 예 |
| `=Data!B2 + N` (셀 단위 산술) | **예** — `#VALUE!` | 예 |
| `=Data!B2 & " text"` (텍스트 연결) | 아니오 — 플레이스홀더에 문자열을 연결해도 문제없음 | 아니오 |
| `=COUNTA(Data!A:A)` | 아니오 — 비어있지 않은 셀을 세므로 플레이스홀더도 카운트됨 | 아니오 |

**경험 법칙:** 플레이스홀더 행에 대해 `#N/A`, `#VALUE!`, `#DIV/0!`을 반환하는
수식만 감싸세요. 집계형 함수 (`SUM`, `COUNT*`, `SUMIF*`)는 텍스트를 견뎌서
감쌀 필요가 없습니다.

## 렌더된 출력 검증하기

템플릿 뷰에서 렌더 결과를 추측할 필요는 없습니다. 빠른 경로 세 가지:

### 1. xl3.io 플레이그라운드

`template.xlsx` + 샘플 `data.xlsx` (또는 번들된 샘플)을
[xl3.io](https://xl3.io)에 드롭하면 렌더된 엑셀 파일이 몇 초 안에 나옵니다.

### 2. 호스트의 `preview()` API

TypeScript 호스트에 xl3를 임베딩 중이라면:

```ts
import { preview } from '@xl3-lang/xl3';

const result = await preview(templateBuffer, dataBuffer);
console.log(result.sources);   // 감지된 소스 행
console.log(result.files);     // 출력 파일과 시트
console.log(result.warnings);  // 비치명적 이슈
```

`preview()`는 `convert()`와 동일한 파싱 + 초기 평가 단계를 돌리지만 엑셀 파일
바이트는 만들지 않습니다 — 전체 렌더를 돌리기 전에 호스트측 검증에 유용합니다.

### 3. 빠른 CLI 스모크 테스트

```bash
# 샘플을 새로 만들고 싶으면 예제 파일 빌드
npm run examples:build

# 하나 렌더해서 확인
node -e "
import('@xl3-lang/xl3').then(async ({ convert }) => {
  const fs = await import('node:fs/promises');
  const tpl = await fs.readFile('./template.xlsx');
  const data = await fs.readFile('./data.xlsx');
  const outs = await convert(tpl.buffer, data.buffer);
  for (const o of outs) await fs.writeFile('rendered-' + o.filename, o.data);
})
"
```

`rendered-*.xlsx`를 열어 실제 출력을 확인하세요.

## 작성 중 데이터 유효성 검사 경고

"0 ~ 100 사이의 숫자" 같은 유효성 규칙을 컬럼에 걸어두고 작성 중에 플레이스홀더
셀을 클릭하면 Excel이 유효성 경고를 띄웁니다 ("이 값이 규칙에 맞지 않음").

선택지:

- **유효성 스타일을 `Warning` 또는 `Information` 으로** 변경 (`Stop` 대신) —
  경고는 뜨지만 편집을 막진 않습니다.
- **플레이스홀더가 아닌 셀에 유효성을 걸고 데이터 행에 전파시키기.** xl3의
  보존 규칙 (ADR-0036 §8)이 확장된 행으로 규칙을 가져갑니다.
- **클릭 시점 경고를 받아들이기** — xl3가 실제 값으로 치환하는 순간 경고는
  사라지고, 렌더된 파일을 보는 운영자는 이 경고를 절대 보지 않습니다.

## xl3가 의도적으로 *하지 않는* 것

[ADR-0049](https://xl3.io/spec/decisions/template-display-vs-render-output)의
contract:

1. xl3는 템플릿 뷰를 위해 플레이스홀더를 샘플 값으로 미리 치환하지 **않습니다**.
   (시각적 플레이스홀더 신호를 잃게 됨.)
2. xl3는 셀마다 별도의 `numFmt` 두 개 ("템플릿 뷰 서식" vs "렌더 서식")를
   유지하지 **않습니다**. (추가 스펙 면적, 이득이 적음.)
3. xl3는 대시보드 수식을 자동으로 `IFERROR`로 감싸지 **않습니다**. (ADR-0046
   이 금지하는 방식으로 수식 텍스트를 변경하게 되고, 실제 작성자 실수를 조용히
   삼킬 위험이 있음.)

작성자는 템플릿 뷰를 책임지고, 엔진은 렌더 출력을 책임집니다. 둘은 설계상
서로 다릅니다.

## 참고

- [ADR-0049 — Template-display vs render-output: intentional asymmetry](https://xl3.io/spec/decisions/template-display-vs-render-output)
- [ADR-0046 — Cell formula preservation contract](https://xl3.io/spec/decisions/cell-formula-preservation)
- [Cookbook 16 — XTL 함수 vs Excel 수식](/guides/xtl-vs-excel-formula)
- [`preview()` API 문서](https://xl3.io/api/functions/preview)
