---
sidebar_label: '08 · XLOOKUP 조회'
pagination_label: '08 · XLOOKUP 조회'
---

# 08 · `XLOOKUP`

## 시나리오

다른 원본에서 키를 맞춰 컬럼 하나만 가져오고 싶을 때 씁니다. 한 방짜리 `VLOOKUP` / `INDEX(MATCH(...))` 또는 SQL의 `LEFT JOIN ... LIMIT 1`에 가까운 동작입니다.

## 기본 형태

```text
{{ XLOOKUP(lookup_value, lookup_array, return_array) }}
{{ XLOOKUP(lookup_value, lookup_array, return_array, fallback) }}
```

- `lookup_value` — 찾을 값.
- `lookup_array` — 다른 원본에서 검색할 컬럼.
- `return_array` — 다른 원본에서 반환받을 컬럼.
- `fallback` (선택) — 매치되는 행이 없을 때 반환할 값.

매치되는 첫 번째 행의 `return_array` 값을 돌려줍니다. 비교 규칙은 XTL의 표준 비교 알고리즘을 따릅니다(숫자와 숫자형 문자열은 숫자로, 일반 문자열은 코드 포인트 단위로). ADR-0013에 따라 와일드카드, 유사 매칭, 역방향 검색은 지원하지 않습니다.

## 예시

`__sources__`:

| name | sheet | table |
|---|---|---|
| `거래처` | `거래처` | `1` |

템플릿 셀:

```text
A2: {{ [거래처코드] }}
B2: {{ XLOOKUP([거래처코드], 거래처[id], 거래처[name]) }}
C2: {{ XLOOKUP([거래처코드], 거래처[id], 거래처[등급]) }}
```

기본 원본의 각 행마다, xl3가 `id`로 매치되는 거래처 행을 찾아 `name` / `tier`를 끌어옵니다.

## 매치 실패 시 동작

`lookup_value`가 `lookup_array`에 없고 fallback도 주지 않으면, xl3는 `xl3/xlookup/no-match`를 던집니다. 스펙은 데이터가 조용히 빠지는 쪽보다 시끄럽게 실패하는 쪽을 우선합니다.

에러를 피하고 싶다면 네 번째 인자로 fallback 값을 넘기세요.

```text
{{ XLOOKUP([거래처코드], 거래처[id], 거래처[name], "(unknown)") }}
```

매치되는 행이 없으면 fallback 값이 반환됩니다. 자리표시자 없이 누락을 허용하고 싶다면 상류에서 미리 필터링하거나, 매치 없는 행을 아예 떨어뜨려 버리는 `@join`을 쓰세요.

## 원본 불일치 방지

`lookup_array`와 `return_array`는 **같은 원본**의 컬럼이어야 합니다. `XLOOKUP([id], 거래처[id], 갱신현황[name])`는 `xl3/xlookup/source-mismatch`가 발생합니다 — 다른 원본을 섞으면, 매치된 행과 아무런 의미상 관계가 없는 위치의 값을 돌려주게 되기 때문입니다.

## 성능

xl3는 어떤 `(원본, 컬럼)` 쌍에 대해 XLOOKUP이 처음 실행될 때 인덱스를 만들어 두므로, 같은 컬럼에 대한 이후 룩업은 O(1) 입니다. 변환 실행의 첫 룩업이 O(N) 비용을 치르고, 같은 데이터 블록 안의 다음 룩업들은 상수 시간에 끝납니다.

## 참고

- 비교는 타입을 인지합니다 — 숫자와 숫자형 문자열은 경계를 넘어 매치되므로, `XLOOKUP("42", 거래처[id], ...)`는 `id`가 숫자 `42` 인 행을 찾아냅니다.
- 주 원본의 모든 행을 다른 원본의 행과 짝지어야 한다면 `@join`을, 다른 원본에서 셀 하나만 끌어오면 된다면 `XLOOKUP`을 쓰세요.
- 스펙 참조: [`spec/language.md`](https://xl3.io/spec/language)의 "XLOOKUP"; ADR-0013.
