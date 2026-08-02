---
sidebar_label: '14 · 값 사전으로 쓰는 __config__'
pagination_label: '14 · 값 사전으로 쓰는 __config__'
---

# 14 · 값 사전으로서의 `__config__`

## 시나리오

여러 셀이 부서명, 날짜 기준값, 갱신 컷오프 같은 상수를 함께 참조합니다. 모든 셀에 리터럴을 박아넣는 건 깨지기 쉽습니다. 값 하나만 바꿔도 템플릿 전체를 뒤져야 하니까요. `__config__`는 작성자가 어떤 셀에서든 읽어 쓸 수 있는 값 사전 역할도 같이 합니다.

## 동작 방식

ADR-0011 기준으로 `__config__`는 예약된 설정 시트입니다. `key`와 `value`, 두 컬럼으로 구성됩니다. 일부 키는 스펙에서 정의됩니다 (`name`, `description`, `source_sheet`, `source_table`, `output_file_pattern`, `match_pattern`). 그 외의 키는 작성자가 자유롭게 정의할 수 있고 다음과 같이 접근합니다:

```text
{{ __config__[key_name] }}
```

## 예시

`__config__`:

| 키 | 값 |
|---|---|
| `source_sheet` | `원본` |
| `source_table` | `1` |
| `output_file_pattern` | `리포트.xlsx` |
| `priority_threshold` | `10000` |
| `기본지역` | `서울` |
| `report_owner` | `Mina` |

템플릿 셀:

```text
{{ "Prepared by " & __config__[report_owner] }}
{{ IF([갱신액] > __config__[priority_threshold], "우선", "일반") }}
{{ IFEMPTY([지역], __config__[기본지역]) }}
```

`priority_threshold`를 10000에서 5000으로 바꾸면 모든 셀이 한 번에 업데이트됩니다. 작성자는 리포트 곳곳에 흩어진 표현식 20개가 아니라 `__config__`의 셀 하나만 고치면 됩니다.

## 타입 인식

`__config__`에 저장된 값은 작성된 셀 타입을 그대로 가져갑니다:

- 숫자 셀은 숫자로 (`10000`은 숫자로 비교됩니다).
- 문자열 셀은 문자열로.
- 날짜 셀은 Date로.
- 불리언은 Boolean으로.

```text
__config__[priority_threshold] > 5000     ← 숫자 비교
__config__[start_date] = TODAY()           ← 날짜 비교
```

특정 타입을 강제하고 싶다면 Excel 셀 타입을 그에 맞게 지정하세요. 템플릿 안에서 명시적으로 변환하려면 `TEXT()` (숫자 → 문자열) 또는 산술 연산 (`__config__[x] + 0`으로 숫자 문자열 → 숫자 강제 변환)을 쓰면 됩니다.

## 재사용 불가한 예약 키

ADR-0011에 따라, 다음 `__config__` 키들은 스펙에서 정의되고 엔진이 직접 읽습니다. 커스텀 의미로 덮어쓰면 안 됩니다:

- `name`
- `description`
- `source_sheet`
- `source_table`
- `output_file_pattern`
- `match_pattern`

커스텀 키는 `^__[a-z]+__$` 패턴 (예: `__foo__`처럼 dunder로 감싼 이름)과 일치하면 안 됩니다 (ADR-0027 예약). 앞에 단일 `_`가 붙는 건 괜찮습니다. 그 외에는 어떤 식별자든 쓸 수 있습니다.

## 그냥 원본 데이터에 넣지 않는 이유는?

워크플로 안에서 "공유 상수"를 다루는 두 가지 선택지가 있습니다:

1. **`__config__`의 작성자 정의 키** — 값이 템플릿 안에 자리잡습니다. 값을 바꾸려면 템플릿을 다시 버전업해야 합니다. 운영자가 건드리면 안 되는 조직 단위 상수에 적합합니다.
2. **`default`가 있는 `__inputs__` 선언** — 값은 템플릿 안에 있지만 호스트가 실행마다 override 할 수 있습니다. 운영자가 매번 조정할 수 있는 실행 단위 파라미터 (대상 월, 기준값 등)에 적합합니다.

"이 템플릿은 이 상수들로 하드코딩되어 있고, 바꾸려면 템플릿을 수정해야 한다"면 `__config__`를 쓰세요. "이 템플릿은 파라미터를 받고, 호스트가 실행마다 정해서 넘긴다"면 `__inputs__`를 쓰세요.

## 스펙 포인터

- ADR-0011 — 예약 시트 명명 규칙.
- [`spec/evaluation.md`](https://xl3.io/spec/evaluation) "Template Configuration".
- 실행 단위 대안인 `__inputs__`는 [Cookbook 06](/guides/runtime-inputs) 참고.
