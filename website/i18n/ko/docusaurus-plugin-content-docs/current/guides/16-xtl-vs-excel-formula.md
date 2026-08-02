---
sidebar_label: '16 · XTL 함수와 Excel 수식 비교'
pagination_label: '16 · XTL 함수와 Excel 수식 비교'
---

# 16 · XTL 함수 vs Excel 수식

## 자주 부딪히는 함정 — 여기서부터 시작

이 페이지를 열어본 이유는 보통 무언가가 예상대로 동작하지 않아서일 가능성이
높습니다. 가장 흔한 경우들:

### "셀에 `₩1,234,567`을 표시하고 싶은데 `TEXT([금액], "₩#,##0")`이 안 돼요"

XTL의 `TEXT()`가 지원하는 포맷 토큰은 일부러 작게 잡혀 있고, 통화 토큰은
포함되지 않습니다. 정답은 셀의 **숫자 표시 형식(numFmt)**:

| 단계 | 위치 |
|---|---|
| 1. 템플릿 셀의 셀 서식을 `"₩"#,##0`으로 설정 | Excel의 셀 서식 → 사용자 지정 |
| 2. 같은 셀에 `{{ [금액] }}` (순수 숫자만)을 입력 | XTL 치환 |

렌더링된 셀에는 숫자가 들어있고, Excel이 이를 `₩1,234,567`로 표시합니다.
값이 여전히 숫자이기 때문에 정렬, 필터링, 다른 수식 참조가 모두 정상 동작합니다.

같은 패턴이 `(1,234)` 형식의 음수 회계 표기(`#,##0;(#,##0)`), 백분율
(`0.00%`), 날짜(`yyyy-mm-dd`) 등에도 그대로 적용됩니다.

### "`=B2*2`로 행마다 계산하고 싶은데 모든 행이 같은 결과를 보여줘요"

xl3는 `@repeat`로 행을 확장할 때 수식 텍스트를 **글자 그대로 보존**합니다 —
`B2`를 `B3`, `B4`로 자동으로 바꾸지 **않습니다** (계약은 ADR-0046 참조).

대신 XTL 표현식을 쓰세요:

```text
{{ [금액] * 2 }}
```

이건 렌더 시점에 각 행마다 평가되어 계산된 숫자가 셀에 들어갑니다. 같은 결과지만
행 참조 혼동이 없습니다.

### "하단에 합계를 두고 싶은데 `=SUM(B2:B5)`가 행이 늘어나도 범위가 안 늘어요"

원인은 같습니다 — xl3는 범위 참조도 다시 쓰지 않습니다. 두 가지 선택지:

- **전체 열 참조**를 footer에 두기: `=SUM(B:B)` (또는 `@filter`로 위쪽에서
  데이터 행만 남기기).
- **XTL 집계 함수**: footer 셀에 `{{ SUM([금액]) }}`를 두기. 렌더 시점에
  계산되어 숫자로 들어갑니다.

### "행마다 클릭 가능한 링크를 넣고 싶어요"

XTL의 `HYPERLINK()` 함수를 쓰세요 (URL/label 모두 컬럼 참조 가능):

```text
{{ HYPERLINK([URL], [표시명]) }}
```

정적 URL이면 셀에 `=HYPERLINK("https://...", "label")` 수식을 직접 넣어도
됩니다 (xl3가 보존합니다).

### "`IF(...)`로 5개 분기 만들었더니 중첩이 너무 깊어 못 읽겠어요"

`IFS(c1, v1, c2, v2, ...)`가 XTL의 다중 분기 조건 함수입니다. 마지막은
`TRUE, default`로 닫아주세요:

```text
{{ IFS([R] > 10000, "VIP", [R] > 1000, "일반", TRUE, "Lite") }}
```

### "`SUMPRODUCT`처럼 `SUM(수량 * 단가)`를 쓰고 싶어요"

XTL 집계는 인자 안에 행별 산술식을 받지 않습니다. `{{ SUM([수량] * [단가]) }}`, `{{ SUM([A] + [B]) }}`, `{{ AVERAGE([매출] - [원가]) }}` 같은 형태는 파싱 시점에 `xl3/eval/bad-aggregate-arg`로 거부됩니다 (ADR-0059). 인자는 컬럼 참조 한 개여야 합니다: `[Column]` 또는 `Source[Column]`.

세 가지 해결책 (선호 순):

1. **원본에 헬퍼 컬럼 추가** — 원본에 `금액` 컬럼(계산식 또는 미리 곱해진 값)을 만들고 `{{ SUM([금액]) }}` 사용. "A × B의 합계" 표준 XTL 패턴.
2. **푸터 셀에 네이티브 Excel `SUMPRODUCT`** — xl3는 셀 수식을 그대로 보존합니다 (ADR-0046). 푸터 셀에 `=SUMPRODUCT(E2:E10000, F2:F10000)`을 직접 작성. 렌더 시점의 실제 행 수를 모르므로 `E2:E10000`처럼 오버슈트 범위를 씁니다. 두 가지 푸터 함정(자기 컬럼 참조; 행 오버슈트 이중 합산)을 피해야 함 — [LLM 작성 가이드 § Footer pitfalls](https://github.com/xl3-lang/xl3/blob/main/docs/llm-template-authoring.md#footer-pitfall-1--self-column-sum-raises-순환-참조-circular-reference) 참고.
3. **행 단위 XTL 셀 + 렌더 출력의 헬퍼 컬럼** — `{{ [수량] * [단가] }}`를 행 단위 셀에 둡니다(집계가 아니므로 정상 동작). 그 값까지 footer로 합치려면 결국 1번 또는 2번으로 돌아갑니다.

왜 이 제약이 있는가: XTL 0.x는 함수 표면을 작고 예측 가능하게 유지합니다. 행별 계산 후 집계(Excel 배열 수식 동작)는 의도적으로 deferred — ADR-0059 § "Why not allow `SUM([a] + [b])`".

### "`SUMIF` / `COUNTIF` / `AVERAGEIF` 찾고 있어요"

함수를 찾지 말고 데이터 블록 패턴을 쓰세요. "상태가 VIP인 행의 amount 합계":

```text
{{ @filter [상태] = "VIP" }}
{{ @repeat down }}
... 데이터 행 템플릿 ...
{{ SUM([금액]) }}
```

필터된 합계 **와** 필터 안 된 전체 행을 함께 보여줘야 한다면 셀에
`=SUMIF(B:B, "VIP", C:C)`를 직접 넣으세요 — xl3가 수식을 보존하고 Excel이
열 때 계산합니다.

### "`ISBLANK(x)`를 쓰고 싶어요"

0.5.x부터 지원합니다 (ADR-0047). ADR-0007 기준으로 비어있을 때 `true`를
반환합니다 — 공백만 있는 문자열도 빈 값으로 봅니다.

```text
{{ IF(ISBLANK([비고]), "(없음)", [비고]) }}
```

같은 결과를 fallback 형태로도 쓸 수 있습니다: `IFEMPTY([비고], "(없음)")`.
같은 술어를 검사합니다.

---

## 일반 규칙

> **파일이 만들어지기 *전*에 값이 정해져야 하는 경우에만 XTL `{{ ... }}`을
> 쓰세요. 그 외에는 수식을 셀에 직접 넣고 Excel이 열 때 계산하도록 두세요.**

경계는 렌더 시점:

- **렌더 전 — XTL만 가능:** `@filter`, `@sort`, `@top`, `@group`,
  `@subtotal`, 소스 데이터 집계 (`SUM`, `COUNT`, …), 교차 소스 `XLOOKUP`,
  `output_file_pattern`, `__sheet_name_pattern__`, `__inputs__` 기본값. Excel은
  이 영역에 손을 댈 수 없습니다 — 계산할 셀 자체가 존재하지 않습니다.
- **렌더 후 — Excel로 충분:** 셀 표시 서식, 렌더된 값에 대한 셀 단위 산술,
  출력 값의 문자열 변환, 타입 검사, 출력 셀에서 날짜 컴포넌트 추출.

이 원칙은 normative — ADR-0043 — 이며 XTL 함수 면적을 작게 유지하는 핵심
장치입니다. XTL 표에 없는 모든 Excel 함수는 **의도적으로** Excel 수식 경로로
빠지도록 설계되어 있습니다.

---

## 대조표

| 목적 | XTL 방식 | Excel 수식 방식 | 선택 |
|---|---|---|---|
| 숫자를 `1,234,567.00`으로 표시 | `{{ TEXT([A], "#,##0.00") }}` (문자열) | 셀 `numFmt = "#,##0.00"`, 값 `{{ [A] }}` (숫자) | 시각용은 **Excel 수식**, 문자열이 필요하면 XTL |
| `₩1,234,567` 표시 | (XTL 미지원) | 셀 `numFmt = "₩"#,##0` | **Excel 수식** |
| 음수를 괄호로 표시 | (미지원) | 셀 `numFmt = #,##0;(#,##0)` | **Excel 수식** |
| 행별 곱셈 (`*2`) | `{{ [A] * 2 }}` | `=B2*2` ❌ 행마다 다시 쓰이지 않음 | **XTL** |
| 행 확장 위에 합계 footer | `{{ SUM([A]) }}` | `=SUM(B:B)` 전체 열 가능 | 둘 다 가능 |
| A × B의 합계 (SUMPRODUCT) | 원본에 헬퍼 컬럼 + `{{ SUM([금액]) }}` | 푸터 셀에 `=SUMPRODUCT(E2:E10000, F2:F10000)` | **Excel 수식** 또는 헬퍼 컬럼 — `SUM([A]*[B])`는 `xl3/eval/bad-aggregate-arg` 발생 |
| 정적 하이퍼링크 | (필요 없음) | `=HYPERLINK("...", "label")` | **Excel 수식** |
| 행별 동적 하이퍼링크 | `{{ HYPERLINK([URL], [표시명]) }}` | quoting 지옥으로 비현실적 | **XTL** |
| "이번 달" 행만 필터 | `{{ @filter MONTH([일자]) = MONTH(TODAY()) }}` | (Excel은 렌더 전 필터 불가) | **XTL 전용** |
| 파일명 "지난 달" | `{{ TEXT(EDATE(TODAY(), -1), "YYYY-MM") }}.xlsx` | (파일명에 수식 경로 없음) | **XTL 전용** |
| 다중 분기 등급 라벨 | `{{ IFS([R]>10000, "VIP", [R]>1000, "Std", TRUE, "Lite") }}` | `=IFS(B2>10000, "VIP", ...)` | 둘 다; filter/group이 이 값에 의존하면 XTL |
| 조건부 집계 | `@filter` + `SUM` 블록 | `=SUMIF(B:B, "VIP", C:C)` | 블록 합계는 XTL, 교차형은 Excel 수식 |
| `MOD` / `INT` / `SQRT` / `POWER` | (XTL 미지원) | 셀 수식 | **Excel 수식** |
| 빈 값 검사 | `ISBLANK([X])` 또는 `IFEMPTY([X], "fallback")` | `=ISBLANK(B2)` | 둘 다; ISBLANK가 Excel idiom과 일치 |
| 기타 `IS*` 타입 검사 | (미지원) | `=ISNUMBER(B2)` 등 | **Excel 수식** |

---

## 빠른 결정 트리

```
값이 다음에 영향을 주는가:
  • 어느 행을 렌더할지?            → @filter / @sort       (XTL)
  • 어떻게 그룹을 묶을지?          → @group / @subtotal    (XTL)
  • 출력 파일명?                   → {{ ... }}             (XTL)
  • 시트 이름?                     → {{ ... }}             (XTL)
  • __inputs__ 기본값?             → {{ ... }}             (XTL)
  • 행별 계산된 표시값?            → {{ ... }}             (XTL)
  • 셀이 *어떻게 보이는지*?        → 셀 numFmt             (Excel 측)
  • 행별 수식?                     → {{ ... }} 표현식      (XTL)
  • 전체 열 / 정적 계산?           → =FORMULA 셀에 직접    (Excel 측)
```

---

## 왜 이 규칙이 존재하나

XTL 함수 면적은 의도적으로 작게 유지됩니다 (ADR-0043). 포터가 구현할 카탈로그를
명확하게 하려는 것입니다. 셀 출력 전용으로 함수를 추가하는 건 Excel이 이미 하는 일을
중복하고 스펙을 부풀립니다.

트레이드오프: xl3 출력 파일은 작성자가 셀 수식을 쓰면 완전한 self-contained
가 아닙니다 — 열 때 Excel 재계산에 의존합니다. 대부분의 운영 리포트에서는 이게
오히려 자연스러운 워크플로입니다.

XTL에 없는 함수가 필요하다고 느낄 때:

1. **그 값이 directive (`@filter`, `@sort`, `@top`, `@group`, `@subtotal`)
   안에서 쓰이거나 `output_file_pattern` / `__sheet_name_pattern__`에 쓰이는가?**
   → XTL이어야 합니다. XTL이 필요한 걸 제공하지 않으면 "Function re-proposal"
   템플릿으로 이슈를 등록해주세요 (GitHub issues).
2. **그 외** → Excel 수식을 셀에 직접 넣으세요. xl3가 보존하고 Excel이 열 때
   계산합니다.

## 참고

- [ADR-0043 — Excel-native preference principle](https://xl3.io/spec/decisions/excel-native-preference)
- [ADR-0044 — Function batch accepted](https://xl3.io/spec/decisions/function-batch-accepted)
- [ADR-0045 — Function batch rejected](https://xl3.io/spec/decisions/function-batch-rejected)
- [ADR-0046 — Cell formula preservation contract](https://xl3.io/spec/decisions/cell-formula-preservation)
- [ADR-0047 — ISBLANK as IFEMPTY alias](https://xl3.io/spec/decisions/isblank-as-ifempty-alias)
- [Cookbook 10 — 스타일과 브랜딩](/guides/styling-and-branding) — `numFmt`이 정답일 때
- [Cookbook 11 — TEXT() 포맷팅](/guides/text-formatting) — `TEXT()`가 정답일 때
- [Cookbook 12 — 빈 값 다루기](/guides/empty-values) — IFEMPTY / ISBLANK 동반자
