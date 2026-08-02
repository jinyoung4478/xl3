---
sidebar_label: '06 · 실행 시점 입력값'
pagination_label: '06 · 실행 시점 입력값'
---

# 06 · 런타임 입력값

## 시나리오

템플릿은 일반적으로 만들어두되, 실행할 때마다 특정 월이나 특정 지역을 지정하고 싶습니다. 운영자가 템플릿을 직접 고치게 만들지 않고, 변환 시점에 값을 넘겨받는 방식입니다.

## `__inputs__`에 선언

| name | type | required | default | label | options |
|---|---|---|---|---|---|
| `month` | `text` | `true` | | `대상 월 (YYYY-MM)` | |
| `region` | `select` | `false` | `전체` | `지역 filter` | `전체\|서울\|부산\|대구` |

타입은 `text`, `number`, `date`, `select` 중 하나입니다.

## 템플릿 셀, 파일명, 그룹 키에서 사용

```text
Cell:           {{ "리포트 — " & __inputs__[month] }}
Filename:       output_file_pattern = {{ __inputs__[month] }}-renewals.xlsx
Filter:         {{ @filter [지역] = __inputs__[region] OR __inputs__[region] = "전체" }}
```

마지막 줄은 사실 그대로는 동작하지 않습니다 — XTL에는 `OR` 키워드가 없습니다. 정공법은 시트 템플릿을 두 개 두고 상위 로직으로 분기시키는 것입니다. 일단 `__inputs__`의 가장 단순한 쓰임새는 셀, 파일명, 또는 고정 비교에 리터럴 값을 꽂아 넣는 것입니다.

```text
{{ @filter [지역] = __inputs__[region] }}

```

…그리고 호스트 측에서는 운영자가 특정 지역을 골랐을 때만 `convert()`를 호출하도록 합니다.

## 호스트에서 값 전달

```ts
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '서울' },
});
```

`inputs.month`가 누락됐는데 `month`가 required로 표시되어 있다면, xl3는 변환 시점에 `xl3/inputs/missing-required`를 던집니다. `region`을 넘기지 않으면 `default` 값인 `전체`로 대체됩니다.

## 변환 없이 입력값 정의만 읽기

```ts
import { readTemplateInputs } from '@xl3-lang/xl3';

const inputs = await readTemplateInputs(templateBuffer);
// → [{ name: 'month', type: 'text', required: true, ... }, ...]
```

운영자가 데이터 파일을 올리기 전에, 호스트 UI에서 입력 폼을 미리 렌더링할 때 씁니다.

## 계산된 default와 label (ADR-0050)

`default`, `label`, `description`, `options` 컬럼은 입력값을 읽는 시점에
평가되는 XTL 템플릿입니다. `__config__`에서 값을 가져오거나 순수 스칼라
함수를 호출해 동적으로 구성할 수 있습니다:

| name | type | default | label |
|---|---|---|---|
| `title_prefix` | `text` | `{{ __config__[지역] }} 거래명세서` | `제목 접두어` |
| `report_date` | `text` | `{{ TEXT(TODAY(), "YYYY-MM-DD") }}` | `리포트 일자` |
| `report_label` | `text` | `{{ UPPER(__config__[지역]) }}-{{ __config__[period] }}` | `리포트 라벨` |

`readTemplateInputs()`를 호출하는 호스트 UI는 평가된 후의 문자열(예:
`"서울 거래명세서"`, 현재 UTC 날짜)을 보게 됩니다. 사용자에게 더 이상 원시
`{{ ... }}` 플레이스홀더가 노출되지 않습니다.

**입력값 평가 시점에 사용 가능한 바인딩:**

- `__config__[key]` — `__config__` 시트에서 먼저 선언된 값.
- 순수 스칼라 함수: `TODAY`, `DATE`, `IF`, `IFEMPTY`, `IFS`, `IFERROR`,
  `UPPER`, `LOWER`, `TRIM`, `TEXT`, `YEAR`, `MONTH`, `DAY`, `EOMONTH`,
  `EDATE`, `DATEDIF`, `ROUND`, `ABS`.

**사용 불가 — 입력값 평가 시점에 에러:**

- `[Column]` / `Source[Column]` — 소스 행 컨텍스트가 아직 없음.
  에러 코드: `xl3/inputs/forward-reference`.
- `__inputs__[name]` — 입력 행끼리는 독립 선언이며 의존 그래프가 아님. 같은
  에러 코드.
- `ROW()`, `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`, `XLOOKUP` — 렌더 상태나
  아직 로드되지 않은 소스 데이터를 읽음. 에러 코드:
  `xl3/inputs/runtime-only-fn`.

> **마이그레이션 메모.** 0.6 이전 버전에서는 `__inputs__` 셀의 `{{ ... }}`가
> 리터럴 텍스트로 처리되었습니다. 기존 템플릿이 `{{ ... }}` 닫힌 블록을
> 리터럴 글자로 의도하고 작성했다면 이제 그 문자열이 표현식으로 평가됩니다.
> 대부분의 작성자는 영향을 받지 않습니다 — 이전 동작이 실제로는 혼란만 주는
> 케이스였습니다.

## 참고

- `select`의 옵션은 `__inputs__` 행 안에서 파이프(`|`)로 구분합니다(예: `서울|부산|대구`). 옵션에 없는 값이 들어오면 `xl3/inputs/select-option`가 발생합니다. 파이프 분리는 셀 템플릿 평가 **후** 동작하므로 `options: {{ __config__[regions] }}` 같은 표현식도 `__config__[regions]`가 `서울|부산|대구` 리터럴 문자열이면 정상 동작합니다.
- date 입력값은 `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm:ss` 형식으로 파싱됩니다.
- number 입력값은 JS 숫자 리터럴을 받습니다. 끝의 공백은 허용됩니다.
- 스펙 참조: [`spec/evaluation.md`](https://xl3.io/spec/evaluation)의 "Inputs"; ADR-0010, ADR-0011, ADR-0050.
