---
sidebar_label: '12 · 빈 값 심화'
pagination_label: '12 · 빈 값 심화'
---

# 12 · 빈 값 자세히 보기

## XTL에서 "빈 값" 이란

ADR-0007 기준:

- **빈 값**: missing/null/undefined, 또는 Unicode 공백만으로 이뤄진 문자열.
- **빈 값이 아님**: 숫자 `0`, Boolean `false`, 공백이 아닌 모든 문자열, 모든 Date.

문자열 `"0"`과 `"false"`는 빈 값이 아닙니다. 이런 값을 걸러내려면 명시적으로 비교하세요: `[금액] != "0"`.

## `IFEMPTY` — 누락된 값의 대체값

```text
{{ IFEMPTY([담당자], "미지정") }}
{{ IFEMPTY([비고], "—") }}
{{ IFEMPTY([지역], __config__[기본지역]) }}
```

`IFEMPTY(value, fallback)`은 `value`가 빈 값일 때만 `fallback`을 반환합니다. `0`이나 `false`에는 발동하지 않습니다.

## 빈 값과 0의 차이 — 자주 나오는 버그

```text
{{ IFEMPTY([금액], "미입력") }}        → 금액이 0 인 행은 "0" (숫자) 그대로
{{ IF([금액] = 0, "미입력", [금액]) }} → 금액이 0 인 행은 "미입력"
```

"누락"과 "0" 둘 다 `미입력`로 표시하고 싶다면:

```text
{{ IF(IFEMPTY([금액], 0) = 0, "미입력", [금액]) }}
```

## 빈 그룹 키 → `(blank)`

ADR-0026에 따르면, 그룹 키 값이 빈 행은 다음 결과를 만듭니다.

- `output_file_pattern`에서 사용되면 `(blank).xlsx`라는 이름의 파일.
- 시트 템플릿 이름에서 사용되면 `(blank)`라는 이름의 시트.

Excel의 피벗 테이블 관례와 동일합니다. 차라리 시끄럽게 에러를 내고 싶다면 원본 단계에서 미리 걸러내세요.

```text
{{ @filter [지역] != "" }}        ← 지역 이 빈 행은 제거
```

## 집계 함수에서의 빈 값

`SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`는 빈 값을 건너뜁니다.

```text
data:    [10, 20, "", 30]
SUM:     60     (에러 아님)
COUNT:   3      (4 아님)
AVERAGE: 20     (15 아님)
```

빈 값이 아닌 항목이 0 개일 때 `AVERAGE`는 빈 값을 반환합니다 (에러 아님). 이를 명시적으로 잡으려면 `IFEMPTY`로 감쌉니다.

```text
{{ IFEMPTY(AVERAGE([금액]), "데이터 없음") }}
```

## `IF` 조건에서의 빈 값

Truthiness (ADR-0008 기준):

- 빈 값 → falsy.
- 숫자 `0` → falsy.
- Boolean `false` → falsy.
- 문자열 `"0"`, `"false"` → **truthy** (빈 값이 아닌 문자열).
- 모든 Date → truthy.

```text
{{ IF([지역], [지역], "미상") }}      → 지역 이 "" 이면 "", 아니면 지역
{{ IF([금액], [금액], "데이터 없음") }}      → 금액 가 0 이거나 비어 있으면 "데이터 없음"
```

## 단일 표현식 셀에서의 빈 값

ADR-0026 기준: `{{ expr }}`만 들어 있는 셀이 빈 값으로 평가되면 빈 셀이 됩니다 (에러 아님). 셀 자체는 OOXML에 존재하고, 값만 비어 있습니다. xl3로 다시 읽으면 ADR-0007에 따라 빈 값으로 읽힙니다.

리터럴이 섞여 있는 셀, 예를 들어 `{{ [금액] }} 원`의 결과는 `" 원"` 입니다 (빈 숫자가 빈 문자열로 직렬화되고 그 뒤에 공백이 붙은 형태).

## 스펙 참고

- [`spec/evaluation.md`](https://xl3.io/spec/evaluation) "Empty Values".
- ADR-0007 (빈 값 정의), ADR-0008 (truthiness), ADR-0026 (생명주기).
- IF/IFEMPTY 기본기는 [Cookbook 02](/guides/conditional-cells) 참고.
