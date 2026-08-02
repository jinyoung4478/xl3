---
sidebar_label: '15 · 디렉티브 조합하기'
pagination_label: '15 · 디렉티브 조합하기'
---

# 15 · 디렉티브 조합하기 (`@filter`, `@sort`, `@top`, `@source`, `@join`)

## 디렉티브가 무엇이고 무엇이 아닌가

디렉티브 (`@filter`, `@sort`, `@top`, `@source`, `@join`)는 **데이터 블록** 안에 자리잡고, 블록이 순회할 행 집합을 다듬습니다. 소스 셀의 작성 순서와 상관없이 정해진 순서대로 평가됩니다:

1. **`@source <Name>`** — 블록이 어느 소스를 순회할지 정합니다.
2. **`@join <Source> on ...`** — 주 소스의 행을 다른 소스의 행과 짝지웁니다.
3. **`@filter <condition>`** — 조건이 truthy 인 행만 남깁니다.
4. **`@sort <column> [asc|desc]`** — 행을 정렬합니다.
5. **`@top <N>`** — 필터링과 정렬이 끝난 뒤 앞에서 N 개만 남깁니다.

작성 팁: 디렉티브를 실행 순서대로 적어 두세요. 스펙이 강제하는 건 아니지만, 템플릿이 훨씬 읽기 좋아집니다.

## 디렉티브 조합

자주 쓰이는 모양: 서울의 고액 갱신 상위 5건.

```text
{{ @filter [지역] = "서울" }}
{{ @filter [금액] > 1000 }}
{{ @sort [금액] desc }}
{{ @top 5 }}
{{ [계정] }} | {{ [금액] }}
```

평가 순서:
1. `지역=서울`로 필터.
2. 금액>1000으로 필터 (AND로 결합).
3. 살아남은 행을 금액 내림차순으로 정렬.
4. 앞에서 5건.

## 여러 `@filter`는 AND로 결합됩니다

ADR-0029에 따라, 한 블록 안의 여러 `@filter`는 서로 AND로 묶입니다. `OR` 키워드는 없습니다. OR을 표현하려면 다음 중 하나를 쓰세요:

- `IN`으로 하나의 필터로 합치기:
  `{{ @filter [지역] in __lists__[활성지역] }}`
- 두 개의 데이터 블록으로 쪼개기 (각각을 자기 영역에 두고, 양쪽이 렌더링되면서 자연스럽게 행 집합이 union 되게 합니다).
- 위쪽 단계에서 미리 처리하기.

## `@source` + `@join` 조합

```text
{{ @source 갱신현황 }}
{{ @join 거래처 on 갱신현황[거래처코드] = 거래처[id] }}
{{ @filter 거래처[등급] = "A" }}
{{ @sort 갱신현황[금액] desc }}
{{ @top 10 }}
{{ 갱신현황[거래처코드] }}
{{ 거래처[name] }}
{{ 갱신현황[금액] }}
```

단계:
1. 갱신현황 순회 (`@source`가 지정).
2. id로 거래처 와 inner join. 매칭 안 된 행은 빠집니다.
3. 거래처 의 tier가 "A" 인 행만 남기기.
4. 갱신현황.amount 내림차순 정렬.
5. 상위 10건.

`@filter`는 어느 쪽 소스의 컬럼이든 참조할 수 있습니다. 컬럼 해석은 대괄호만 쓰는 경우엔 활성 블록의 소스를 쓰고, join 쪽은 명시적으로 `Source[Column]` 형식을 씁니다.

## 금지된 조합

ADR-0029 기준:

- **데이터 블록당 `@source`는 최대 하나**. 중복되면 `xl3/directive/invalid-syntax`가 발생합니다.
- **데이터 블록당 `@join`도 최대 하나**. 멀티 조인은 지원 범위가 아닙니다.
- **self-join 금지**. 활성 소스가 `S` 일 때 `@join S on S[a] = S[b]`를 쓰면 `xl3/join/bad-on-clause`가 발생합니다.

## `@sort` 다음의 `@top`

```text
{{ @sort [금액] desc }}
{{ @top 10 }}
```

정렬 없는 Top-N은 의미가 없습니다. `@sort` 없이 `@top`을 쓰면 소스에 적힌 순서대로 앞 N 개를 잘라옵니다 — 가끔은 유용할 수 있지만, 작성자가 의도한 결과인 경우는 거의 없습니다.

## 필터 후 행이 비는 경우

`@filter`가 모든 행을 떨어뜨리면, 데이터 블록은 0행으로 expand 됩니다. 템플릿 행의 스타일과 포맷은 결과에 남지만 데이터 행 자체는 생성되지 않습니다. 블록 아래의 footer 행은 그대로 보입니다.

## 스펙 포인터

- ADR-0029 — 디렉티브 조합 + 소스 엣지 시맨틱.
- [`spec/language.md`](https://xl3.io/spec/language) "Filter", "Sort", "Top", "Source", "Join".
- `@filter in __lists__[…]`는 [Cookbook 05](/guides/sheet-per-group) 참고.
- `@source` + `@join` 기본은 [Cookbook 07](/guides/multi-source-join) 참고.
- `@sort` + `@top` 기본은 [Cookbook 09](/guides/sort-and-top) 참고.
