---
sidebar_label: '07 · 다중 소스와 @join'
pagination_label: '07 · 다중 소스와 @join'
---

# 07 · 다중 원본 + `@join`

## 시나리오

갱신 데이터에는 `거래처코드`만 있고, 고객의 정식 이름은 별도의 `거래처` 테이블에 있습니다. 갱신 행에 고객의 `Name`과 `등급`를 조인해 붙이고 싶은 상황입니다.

## `__sources__`에 원본 선언

| name | sheet | table | description |
|---|---|---|---|
| `갱신현황` | `갱신현황` | `1` | 갱신 단위 행 |
| `거래처` | `거래처` | `1` | 고객 1행 |

`__config__`의 `source_sheet`는 여전히 암묵적인 기본 원본 역할을 합니다. 이 기본 원본은 접두어 없이 `[Column]`으로 참조하고, 명명된 원본은 `SourceName[Column]` 형태로 씁니다.

## `@source`로 블록의 활성 원본 바꾸기

```text
{{ @source 갱신현황 }}
{{ [거래처코드] }}   ← bare bracket resolves against 갱신현황
{{ [amount] }}
```

데이터 블록은 기본적으로 `source_sheet`에 설정된 원본을 순회합니다. `@source <Name>`를 쓰면 해당 블록에 한해 순회 대상을 `<Name>`으로 바꿉니다.

## `@join`으로 주 원본과 다른 원본의 행 짝짓기

```text
{{ @source 갱신현황 }}
{{ @join 거래처 on 갱신현황[거래처코드] = 거래처[id] }}
{{ [거래처코드] }}             ← 갱신현황 row
{{ 거래처[name] }}            ← joined customer row
{{ 거래처[등급] }}
{{ [amount] }}
```

`@join`은 **이너 조인, 첫 매치만** 입니다.

- 갱신현황의 각 행에 대해, `id = 거래처코드` 인 거래처 행 중 **첫 번째**를 찾습니다.
- 매치가 없으면 그 갱신현황 행은 결과에서 빠집니다.
- 여러 행이 매치되더라도 첫 매치 하나만 사용합니다.

`on` 절은 두 원본 이름을 모두 명시해야 합니다. ADR-0029에 따라 자기 조인(`@join S on S[a] = S[b]`, 여기서 `S`가 활성 원본인 경우)은 `xl3/join/bad-on-clause`가 발생합니다.

## 조인 없이 다른 원본의 값만 끌어오기: `XLOOKUP`

모든 갱신현황 행을 거래처 행과 짝지어야 하는 게 아니라면, `XLOOKUP`이 더 가볍습니다.

```text
{{ XLOOKUP([거래처코드], 거래처[id], 거래처[name]) }}
```

[Recipe 08](/guides/xlookup)을 참고하세요.

## 원본 간 집계

명명된 원본에 대한 집계는 조인이나 필터가 적용된 블록이 아니라 **원본 전체**를 대상으로 합니다.

```text
{{ COUNT(거래처[id]) }}      ← total customers, ignores filters
{{ SUM(갱신현황[금액]) }}      ← total renewals, ignores filters
```

[Recipe 03](/guides/aggregates)을 참고하세요.

## 참고

- 데이터 블록당 `@source`와 `@join`은 각각 하나씩만 허용됩니다. 중복은 ADR-0029에 따라 `xl3/directive/invalid-syntax`를 발생시킵니다.
- 다중 조인(`@join`의 체인)은 ADR-0014에 따라 일단 보류되어 있습니다.
- 함수 이름 매칭은 대소문자를 구분하지 않습니다 — `if`, `If`, `IF` 모두 같습니다.
- 스펙 참조: [`spec/evaluation.md`](https://xl3.io/spec/evaluation)의 "External Data Sources"; ADR-0012, ADR-0014.
