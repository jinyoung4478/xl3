---
sidebar_label: '19 · JXLS에서 xl3로'
pagination_label: '19 · JXLS에서 xl3로'
---

# 19 · JXLS에서 xl3로 — 자바스크립트 대안

## 시나리오

팀이 JVM에서 [JXLS](https://jxls.sourceforge.net/)로 Excel 보고서를
렌더링하고 있고, 이제 같은 걸 Node.js나 브라우저에서 해야 하는 상황 —
또는 "JXLS for JavaScript"를 검색했는데 `node-java`를 감싼 8년 된
래퍼뿐이었던 상황입니다. xl3가 유지되고 있는 답입니다. 스프레드시트
자체가 템플릿인 Excel-to-Excel 템플릿 엔진입니다.

기능이 우연히 겹친 게 아닙니다. xl3의 명세는 JXLS가 약 10년간 겪은
엣지 케이스를 항목 단위로 흡수했습니다 — 병합된 데이터 행 셀, 이름 있는
범위, 인쇄 영역, 윤곽 수준, 여러 줄 텍스트 모두 전용 ADR과 적합성
픽스처를 가지고 있습니다. 운영 원칙은
([ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship))
**JXLS의 경험은 빌려오고, 문법은 빌려오지 않는다**입니다.

## 모델 차이를 표 하나로

| | JXLS | xl3 |
|---|---|---|
| 지시자가 사는 곳 | 셀 **메모** (`jx:each(items="rows" lastCell="D4")`) — 그리드에서 보이지 않음 | 셀 **값** (`{{ @filter [Status] = "Open" }}`) — 보이고, 리뷰 가능하고, diff 가능 |
| 표현식 언어 | JEXL (`${employee.payment * 1.1}`) — 새로 배워야 하는 두 번째 언어 | Excel 문법 (`{{ [Payment] * 1.1 }}`, `IF`, `XLOOKUP`, `SUM`) — 템플릿 작성자가 이미 아는 것 |
| 데이터가 오는 곳 | 코드에서 바인딩한 자바 객체 (`context.putVar("employees", list)`) | 두 번째 `.xlsx` — `render(template, data)`가 순수 함수입니다. 같은 입력, 같은 바이트 |
| 블록 경계 | 명시적 `lastCell="D4"` 좌표 | `{{ ... }}` 마커로부터 추론 (원하면 명시적 `{{ @block A:D }}`) |
| 탈출구 | 커스텀 자바 커맨드 — 튜링 완전하고 이식 불가 | 설계상 없음 — 템플릿은 어떤 구현체든 렌더링할 수 있는 인계 산출물로 남습니다 ([ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)) |

결과적으로 JXLS 템플릿은 셀 메모와 자바 바인딩을 편집할 수 있는 사람,
즉 개발자가 소유합니다. xl3 템플릿은 스프레드시트를 편집할 수 있는
사람이 소유합니다.

## 지시자 대응표

| JXLS | xl3 대응 | 비고 |
|---|---|---|
| `jx:each(items="rows" var="r" lastCell=…)` | **데이터 블록** — `{{ [Column] }}` 마커가 들어 있는 템플릿 행 | 루프 선언이 아예 없습니다. 블록이 소스 행 하나당 출력 행 하나로 확장됩니다. [시작하기](/guides/getting-started) 참고 |
| `${r.name}` | `{{ [Name] }}` | 소스 행의 열 참조 |
| `${r.amount * 1.1}` | `{{ [Amount] * 1.1 }}` | JEXL이 아니라 Excel 연산자 |
| 셀에 붙은 `jx:if(condition=…)` | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` | [조건부 셀](/guides/conditional-cells) |
| 행을 걸러내는 데 쓴 `jx:if` | `{{ @filter [Status] = "Open" }}` | `@filter` 여러 개는 AND로 결합됩니다 |
| `orderBy`가 붙은 `jx:each` | `{{ @sort [Total] desc }}` | |
| `groupBy`가 붙은 `jx:each` | `{{ @group [Region] }}` + `{{ @subtotal SUM([Renewal]) }}` | 소계 행을 사이사이 끼워 넣고 N단 중첩까지 — [그룹과 소계](/guides/group-and-subtotal) |
| `jx:each(direction="RIGHT")` | `{{ @repeat right 3 }}` | |
| 여러 컬렉션 | 블록마다 `{{ @source Renewals }}`, 그리고 `{{ @join Customers on Customers[Account] = Renewals[Account] }}` | [멀티 소스 + @join](/guides/multi-source-join) |
| `jx:multisheet` | 패턴을 **시트 이름**에 넣습니다: `Region-{{ [Region] }}` | [그룹별 시트](/guides/sheet-per-group). 그룹별 *파일*은 `output_file_pattern`으로 — [그룹별 파일](/guides/file-per-group) |
| `jx:link` | `{{ HYPERLINK(url, label) }}` | [ADR-0039](https://xl3.io/spec/decisions/hyperlink-function) |
| `jx:params(formulas=…)` | 선언할 것이 없습니다. 템플릿의 native Excel 수식은 그대로 보존됩니다 | [ADR-0046](https://xl3.io/spec/decisions/cell-formula-preservation) |
| 확장된 블록에 대한 SUM | `{{ SUM([Renewal]) }}` 집계, 또는 평범한 Excel `=SUM(...)` 수식 | [집계](/guides/aggregates) |

## 의도적으로 넘어오지 않는 것

xl3는 JXLS 기능 세 가지를 근거를 기록하고 거절했습니다. 그래서 경계가
빈틈이 아니라 결정으로 남아 있습니다.

- **`jx:image` (데이터 기반 이미지 삽입)** — 거절,
  [ADR-0037](https://xl3.io/spec/decisions/rejected-dynamic-image-insertion).
  *템플릿에 배치된* 이미지는 렌더링을 통과해 살아남습니다. 데이터로부터
  이미지를 삽입하는 것은 브라우저에서 안전하고 결정론적인 파이프라인에
  맞지 않습니다.
- **`jx:updateCell` (런타임 셀 변경)** — 거절,
  [ADR-0042](https://xl3.io/spec/decisions/rejected-runtime-cell-mutation).
  `{{ ... }}` 치환이 이미 그 용도를 커버하며, 평가 순서를 관측 가능하게
  만들지 않습니다.
- **커스텀 커맨드 (호스트 언어 탈출구)** — 거절,
  [ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship).
  당신의 자바/JS 헬퍼를 요구하는 템플릿은 다른 팀이나 다른 구현체에
  넘길 수 없습니다.

JXLS 템플릿이 커스텀 커맨드에 의존하고 있다면, 그 로직은 템플릿이 아니라
**데이터 파일**로 옮겨갑니다 — 데이터를 만들어내는 쪽에서 해당 열을 미리
계산하면 됩니다.

## 렌더 호출 비교

JXLS (자바):

```java
List<Employee> employees = loadEmployees();
Context context = new Context();
context.putVar("employees", employees);
JxlsHelper.getInstance().processTemplate(templateStream, outStream, context);
```

xl3 (Node.js 또는 브라우저):

```js
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: [{ filename: 'renewal-report.xlsx', buffer }, ...]
```

바인딩할 컨텍스트 객체가 없습니다. 렌더에 필요한 모든 것이 두 워크북
안에 있습니다. 그래서 출력이 재현 가능하고, 호스트 프로그램 없이도
템플릿을 테스트할 수 있습니다.

## 이관 체크리스트

1. **데이터를 코드 밖으로 옮깁니다.** `putVar`로 넣던 것을 시트로
   내보내세요(컬렉션 하나당 표 하나). 보통 이것이 유일한 실질 작업입니다.
2. **메모를 지우고 셀에 씁니다.** 각 `jx:each` 영역은 `{{ [Column] }}`
   마커로 된 한 줄 데이터 블록이 됩니다. `lastCell` 경계는 사라집니다.
3. **JEXL을 Excel 표현식으로 다시 씁니다.** `${...}`의 산술과 조건은
   `IF`/연산자와 함께 `{{ ... }}`로 1:1 대응됩니다.
4. **그룹핑을 선언적으로 재구성합니다.** `groupBy`/`orderBy`는 블록 안의
   `@group`/`@sort`/`@subtotal` 셀이 됩니다.
5. **돌려보고 diff를 뜹니다.** `convert()`는 결정론적이므로, 골든 파일
   테스트(`같은 입력 → 같은 바이트`)가 눈으로 확인하는 작업을 대체합니다.

설치 없이 브라우저에서 템플릿 하나로 이관을 시험해보세요 —
[xl3.io/try](https://xl3.io/try).

같이 보기: [ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)
(최종 JXLS 경계), [`spec/language.md`](https://xl3.io/spec/language)
"Directives".
