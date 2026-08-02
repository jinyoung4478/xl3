---
sidebar_label: '18 · 그룹과 소계'
pagination_label: '18 · 그룹과 소계'
---

# 18 · 그룹 + 소계 행

## 시나리오

거래명세서 / 정산서 / 발주서에서 라인 아이템을 고객별 또는 월별 섹션으로
나누고, 각 섹션 끝에 소계 행 + (선택) 마지막에 총계 행을 두는 패턴:

```
한솔    위젯-A    10,000
한솔    위젯-B     5,000
        소계       15,000
베타    위젯-A    20,000
        소계       20,000
        총계       35,000
```

XTL 0.6는 이 패턴을 하나의 데이터 블록 안에서 만들어줍니다 — 소스에서 미리
집계하거나, 출력 후 후처리할 필요가 없습니다 (ADR-0038).

## 두 가지 요소

### `@group [Key1], [Key2], …`

`@group`은 활성 행 집합을 N-level 중첩 그룹으로 분할합니다. 행을 다시 정렬하지는
**않습니다** — 그룹 순서는 `@filter` / `@sort`가 적용된 *후*의 등장 순서를
따릅니다. 그룹 순서를 안정시키고 싶으면 같은 키로 `@sort`를 함께 거세요.

```text
{{ @sort [거래처] }}
{{ @group [거래처] }}
```

### `@subtotal <aggregate>`

셀에 `{{ @subtotal SUM([금액]) }}` 표현식이 들어있는 행은 **소계 행**입니다.
이 행은 소스 행마다 반복되지 **않고**, 렌더링 시점에 각 그룹 경계마다 한 번씩
바인딩된 레벨로 emit 됩니다. 지원 집계: `SUM`, `COUNT`, `AVERAGE`, `MIN`, `MAX`.

소스 순서에서 **첫번째** `@subtotal` 행이 가장 **안쪽** 그룹 키에 바인딩됩니다.
아래쪽에 추가한 `@subtotal` 행이 점점 바깥 레벨로 바인딩됩니다 — 맨 아래 행이
가장 바깥 키에 바인딩.

## 단일 레벨 그룹

```text
{{ @sort [거래처] }}
{{ @group [거래처] }}
{{ [거래처] }} | {{ [품목] }} | {{ [금액] }}
"소계"           |              | {{ @subtotal SUM([금액]) }}
```

소스 3행 (한솔/위젯/100, 베타/볼트/50, 한솔/기어/200)으로 렌더링:

```
한솔    위젯   100
한솔    기어     200
        소계     300
베타    볼트      50
        소계      50
```

## 2-level 중첩 + 총계

```text
{{ @sort [지역] }}
{{ @sort [거래처] }}
{{ @group [지역], [거래처] }}
{{ [지역] }} | {{ [거래처] }} | {{ [금액] }}
"고객 소계"    |                  | {{ @subtotal SUM([금액]) }}
"지역 소계"    |                  | {{ @subtotal SUM([금액]) }}
```

위쪽 `@subtotal` (고객 소계)가 안쪽 키 (`[거래처]`)에 바인딩되고, 아래
`@subtotal` (지역 소계)가 `[지역]`에 바인딩됩니다. 둘 다 경계마다 emit 되지만,
공통 경계에서는 안쪽이 먼저 fire 됩니다.

**"가장 바깥 @subtotal로 만드는 총계" 패턴:** `@group [거래처]` 한 줄 + 두
`@subtotal` 행을 두면, 바깥 행은 데이터 블록 끝에 단 한 번 fire 됩니다 — 가장
바깥 그룹의 경계가 곧 데이터의 끝이기 때문입니다.

## 다른 directive 와의 조합

| Directive | 동작 |
|---|---|
| `@filter` | 그룹화 **전**에 적용. 필터링된 행은 어느 그룹에도 속하지 않음. 모든 행이 필터링된 그룹은 출력에 등장하지 않음. |
| `@sort` | 그룹화 전에 적용. 그룹 순서를 고정하려면 `@group`과 같은 키로 같은 순서로 `@sort`를 거세요. |
| `@source` | 각 `@source` 블록은 독립적인 그룹화 scope를 갖습니다. |
| `@join` | 조인된 행의 컬럼도 primary 컬럼과 동일하게 그룹화에 참여 가능. |
| `@top` | 그룹화 **후** 행 레벨에 적용. `@top` cut을 통과한 그룹의 데이터 행이 있는 경우에만 소계가 emit. |
| `@repeat right` | `@group`과 호환 안 됨 (`xl3/directive/invalid-syntax`). |

## 엣지 케이스

- **단일 그룹 degenerate** — `@group [Key]` 이고 모든 행이 같은 `[Key]` 값을
  가지면, 소계는 그 그룹 경계에서 한 번 emit 됩니다. 데이터셋이 우연히 단일
  바깥 그룹 값을 가질 때 총계 패턴과 일치합니다.
- **빈 그룹** — ADR-0007 기준으로 모든 데이터 행이 empty 인 그룹은 skip 됩니다
  (데이터 행도, `@subtotal`도 emit 되지 않음).
- **집계 인자** — `@subtotal` 안에는 컬럼 참조만 허용됩니다. 복합 표현식
  (`SUM([A]) - SUM([B])`, `IF(...)`)은 `xl3/subtotal/bad-aggregate`를 던지며
  추후 ADR로 연기됩니다.
- **`@subtotal` 행의 리터럴 텍스트 셀** — 가능. "소계:" 같은 라벨 셀이 집계 셀
  옆에 들어가며, 매 emit 때마다 함께 렌더됩니다. 단, 리터럴 셀은 현재 행 컬럼을
  참조하면 안 됩니다 — 그룹 경계에는 "현재 행"이 없습니다.

## 에러 코드

- `xl3/group/missing-key` — `@group`에 키가 없음.
- `xl3/subtotal/outside-group` — `@group`이 없는 블록에서 `@subtotal` 셀이
  등장했거나, `@group` 키 수보다 `@subtotal` 행이 더 많음.
- `xl3/subtotal/bad-aggregate` — `@subtotal` 본문이 `SUM`, `COUNT`, `AVERAGE`,
  `MIN`, `MAX` 중 하나가 아니거나, 인자가 허용된 컬럼 참조 형식이 아님.

## 참고

- [ADR-0038 — `@group`과 `@subtotal` directive](https://xl3.io/spec/decisions/group-and-subtotal)
- [`spec/language.md` § "Group + Subtotal"](https://xl3.io/spec/language)
- [Cookbook 03 — 집계 함수](/guides/aggregates) — 그룹화 없이 블록 레벨에서 쓰는
  `SUM` / `COUNT` / `AVERAGE`
- [Cookbook 15 — Directive 조합](/guides/directive-composition) — 전체 directive
  순서 규칙
