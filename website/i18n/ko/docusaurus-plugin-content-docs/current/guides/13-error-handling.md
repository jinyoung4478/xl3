---
sidebar_label: '13 · 호스트 측 오류 처리'
pagination_label: '13 · 호스트 측 오류 처리'
---

# 13 · 호스트를 위한 에러 처리

## 시나리오

앱에서 `convert(templateBuffer, dataBuffer)`를 호출했습니다. 그런데 템플릿에 오타가 있거나, 데이터에 필수 컬럼이 빠져 있다면? 이제 어떻게 해야 할까요?

xl3는 안정적인 `error.code` 문자열을 가진 **구조화된 에러**를 던집니다 (ADR-0015 기준). 호스트는 이 코드를 기준으로 분기하면 됩니다 — 다국어 처리, 재시도 로직, 운영자가 이해하기 쉬운 메시지를 만들기에 좋습니다.

## catch + 분기

```ts
import { convert, isXtlError } from '@xl3-lang/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // ship outputs
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('Your data file is missing required columns.', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('Two output files would have the same name. Check your data.', err.message);
      default:
        return showOperator('Conversion failed.', err.message);
    }
  }
  // Non-xl3 error: probably a system fault. Re-throw.
  throw err;
}
```

`isXtlError(value)`는 `code`가 `xl3/`로 시작하는 `Error` 인스턴스에 대해서만 `true`를 반환합니다. 평범한 `Error`나 DOMException 같은 건 매칭되지 않습니다.

## 에러 코드 카탈로그

안정적이고 append-only 입니다. 이름 변경은 ADR-0015 기준으로 breaking change로 취급합니다. 현재 카탈로그는 다음과 같습니다:

- **`xl3/cell/*`** — 셀 단위 실패 (`formula-no-cache`, `numfmt-coercion`, `row-outside-repeat`)
- **`xl3/eval/*`** — 표현식 평가 (`arity-mismatch`, `operand-coercion`, `unsupported-syntax`)
- **`xl3/config/*`** — `__config__` 관련 문제
- **`xl3/inputs/*`** — 런타임 입력 실패
- **`xl3/source/*`** — 원본 데이터 문제 (헤더 누락, 미선언 소스, 예약 컬럼명)
- **`xl3/sources/*`** — `__sources__` 시트 문제
- **`xl3/sheet/*`** — 시트 이름 관련 문제
- **`xl3/directive/*`** — 디렉티브 문법
- **`xl3/join/*`** — `@join` 절 관련 문제
- **`xl3/xlookup/*`** — `XLOOKUP` 실패
- **`xl3/filename/*`** — 결과 파일명 관련 문제
- **`xl3/parser/*`** — 파서 실패
- **`xl3/lists/*`** — `__lists__` 참조 문제
- **`xl3/expression/*`** — 표현식 수준 거부 (`bracket-outside-block`, `unknown-name`)
- **`xl3/block/*`** — 데이터 블록 레이아웃 (`overlap`, `empty-table`)
- **`xl3/group/*`** — `@group` 문제 (`missing-key`)
- **`xl3/subtotal/*`** — `@subtotal` 문제 (`outside-group`, `bad-aggregate`, `mixed-row`, `explicit-block-unsupported`)
- **`xl3/source-json/*`** — JSON 소스 입력 (`invalid`) — `convertJson` / `previewJson` 경로에서만 발생

전체 목록은 [`impl/js/src/error-codes.ts`](https://github.com/xl3-lang/xl3/blob/main/impl/js/src/error-codes.ts)에 있습니다.

## 명시적으로 다룰 만한 흔한 케이스

**필수 입력 누락** (`xl3/inputs/missing-required`):
템플릿이 어떤 입력을 `required: true`로 선언했는데 호스트가 그 값을 넘기지 않은 경우입니다. 입력 폼을 보여주거나, 운영자에게 다시 물어보고, 재시도하면 됩니다.

**파일명 충돌** (`xl3/filename/collision`):
서로 다른 그룹 키가 sanitize 과정에서 같은 파일명이 되어버린 경우입니다 (예: `서울/한국`와 `서울:한국`가 모두 `서울_한국.xlsx`로). 보통 템플릿이 아니라 운영자가 데이터를 정리해야 하는 문제입니다.

**XLOOKUP의 소스 불일치** (`xl3/xlookup/source-mismatch`):
템플릿 작성자가 `XLOOKUP(x, A[k], B[v])`처럼 `A`와 `B`가 서로 다른 소스인 식을 쓴 경우입니다. 운영자 문제가 아니라 템플릿을 고쳐야 합니다.

**XLOOKUP 매칭 실패** (`xl3/xlookup/no-match`):
조회값이 조회 컬럼에 없는 경우입니다. 운영자의 데이터가 불완전하거나, 혹은 템플릿에서 `@join`을 쓰는 편이 나을 수도 있습니다 (매칭 안 된 행은 자동으로 떨어집니다).

## 로케일

`error.message`는 영어입니다. 다국어 처리는 호스트에서 `error.code`로 분기해 자체 메시지를 제공하세요 — 엔진의 영어 문자열을 직접 번역하지는 **마세요**. 영어 텍스트는 conformance 계약의 일부이며, fixture 들이 그 문자열의 부분 일치로 검증됩니다.

## 변환 전에 preview로 검사

`preview(template, data, options)`는 `convert`와 동일한 파싱/디스패치 단계를 실행하되, Excel 파일을 렌더링하지는 않습니다. 호스트에 "Convert" 버튼 앞에 "Validate" 버튼이 있다면 `preview`를 호출하세요 — 빠르고, 같은 에러를 잡아내고, xlsx 생성 비용도 들지 않습니다.

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings: non-fatal issues
// preview.inputs: resolved input values (after defaults + coercion)
// preview.files / preview.sources: what convert() would produce
```

## 스펙 포인터

- ADR-0015 — 구조화된 에러 리포팅.
- [`spec/evaluation.md`](https://xl3.io/spec/evaluation) "Errors".
- 입력 관련 에러는 [Cookbook 06](/guides/runtime-inputs) 참고.
