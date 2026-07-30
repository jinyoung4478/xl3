---
sidebar_label: '19 · 从 JXLS 迁移到 xl3'
pagination_label: '19 · 从 JXLS 迁移到 xl3'
---

# 19 · 从 JXLS 迁移到 xl3 —— JavaScript 方案

## 场景

你的团队在 JVM 上用 [JXLS](https://jxls.sourceforge.net/) 生成 Excel
报表，现在需要在 Node.js 或浏览器里做同样的事 —— 或者你搜索
"JXLS for JavaScript"，只找到了包装 `node-java` 的、八年前的封装库。
xl3 就是那个仍在维护的答案：一个把电子表格本身当作模板的
Excel-to-Excel 模板引擎。

这不是功能上的偶然重合。xl3 的规范逐项吸收了 JXLS 十年间踩过的边界
情况 —— 合并的数据行单元格、命名区域、打印区域、分级显示层级、多行
文本，每一项都有专门的 ADR 和一致性测试用例。其运作原则是
（[ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship)）：
**借鉴 JXLS 的经验，而不是它的语法。**

## 用一张表看清模型差异

| | JXLS | xl3 |
|---|---|---|
| 指令存放位置 | 单元格**批注**（`jx:each(items="rows" lastCell="D4")`）—— 在表格中看不见 | 单元格**值**（`{{ @filter [Status] = "Open" }}`）—— 可见、可评审、可 diff |
| 表达式语言 | JEXL（`${employee.payment * 1.1}`）—— 需要额外学习的第二种语言 | Excel 语法（`{{ [Payment] * 1.1 }}`、`IF`、`XLOOKUP`、`SUM`）—— 模板作者本来就会 |
| 数据来源 | 代码中绑定的 Java 对象（`context.putVar("employees", list)`） | 第二个 `.xlsx` —— `render(template, data)` 是纯函数：相同输入，相同字节 |
| 块边界 | 显式的 `lastCell="D4"` 坐标 | 由 `{{ ... }}` 标记推断（需要时也可显式写 `{{ @block A:D }}`） |
| 逃生通道 | 自定义 Java 命令 —— 图灵完备且不可移植 | 设计上没有 —— 模板始终是任何实现都能渲染的交付物（[ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)） |

由此带来的结果：JXLS 模板归能编辑单元格批注和 Java 绑定的人所有，也就是
开发者。xl3 模板归能编辑电子表格的人所有。

## 指令对照表

| JXLS | xl3 对应写法 | 说明 |
|---|---|---|
| `jx:each(items="rows" var="r" lastCell=…)` | **数据块** —— 含有 `{{ [Column] }}` 标记的模板行 | 完全没有循环声明；数据块按每行源数据展开成一行输出。参见[快速开始](/guides/getting-started) |
| `${r.name}` | `{{ [Name] }}` | 引用源数据行中的列 |
| `${r.amount * 1.1}` | `{{ [Amount] * 1.1 }}` | 用 Excel 运算符，而非 JEXL |
| 单元格上的 `jx:if(condition=…)` | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` | [条件单元格](/guides/conditional-cells) |
| 用来丢弃行的 `jx:if` | `{{ @filter [Status] = "Open" }}` | 多个 `@filter` 之间以 AND 组合 |
| 带 `orderBy` 的 `jx:each` | `{{ @sort [Total] desc }}` | |
| 带 `groupBy` 的 `jx:each` | `{{ @group [Region] }}` + `{{ @subtotal SUM([Renewal]) }}` | 小计行穿插在数据之间，支持 N 层嵌套 —— [分组与小计](/guides/group-and-subtotal) |
| `jx:each(direction="RIGHT")` | `{{ @repeat right 3 }}` | |
| 多个集合 | 每个块用 `{{ @source Renewals }}`，再配合 `{{ @join Customers on Customers[Account] = Renewals[Account] }}` | [多数据源 + @join](/guides/multi-source-join) |
| `jx:multisheet` | 把模式写进**工作表名**：`Region-{{ [Region] }}` | [按分组分表](/guides/sheet-per-group)；按分组分*文件*用 `output_file_pattern` —— [按分组分文件](/guides/file-per-group) |
| `jx:link` | `{{ HYPERLINK(url, label) }}` | [ADR-0039](https://xl3.io/spec/decisions/hyperlink-function) |
| `jx:params(formulas=…)` | 无需声明；模板中原生的 Excel 公式会被原样保留 | [ADR-0046](https://xl3.io/spec/decisions/cell-formula-preservation) |
| 对展开后的块求 SUM | `{{ SUM([Renewal]) }}` 聚合，或普通的 Excel `=SUM(...)` 公式 | [聚合](/guides/aggregates) |

## 有意不予保留的部分

xl3 拒绝了 JXLS 的三项功能，并记录了理由，所以这条边界是一个决定，而
不是一处缺失。

- **`jx:image`（数据驱动的图片插入）** —— 已拒绝，
  [ADR-0037](https://xl3.io/spec/decisions/rejected-dynamic-image-insertion)。
  *放在模板里*的图片能够保留下来；而从数据插入图片不符合浏览器安全、
  结果确定的流水线。
- **`jx:updateCell`（运行时修改单元格）** —— 已拒绝，
  [ADR-0042](https://xl3.io/spec/decisions/rejected-runtime-cell-mutation)。
  `{{ ... }}` 替换已经覆盖了这个用途，而且不会让求值顺序变得可观察。
- **自定义命令（宿主语言的逃生通道）** —— 已拒绝，
  [ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship)。
  一个必须依赖你的 Java/JS 辅助代码的模板，无法交给另一个团队或另一个
  实现。

如果你的 JXLS 模板依赖自定义命令，那部分逻辑应当移到**数据文件**里，而
不是模板里 —— 在生成数据的那一端把该列预先算好。

## 渲染调用对比

JXLS（Java）：

```java
List<Employee> employees = loadEmployees();
Context context = new Context();
context.putVar("employees", employees);
JxlsHelper.getInstance().processTemplate(templateStream, outStream, context);
```

xl3（Node.js 或浏览器）：

```js
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: [{ filename: 'renewal-report.xlsx', buffer }, ...]
```

没有需要绑定的 context 对象。渲染所需的一切都在这两个工作簿里 —— 这正是
输出可复现、且无需宿主程序即可测试模板的原因。

## 迁移检查清单

1. **把数据搬出代码。** 原本 `putVar` 进去的东西，导出成工作表（每个
   集合一张表）。这通常是唯一真正的工作量。
2. **删掉批注，改写单元格。** 每个 `jx:each` 区域变成一行由
   `{{ [Column] }}` 标记组成的数据块；`lastCell` 边界随之消失。
3. **把 JEXL 改写成 Excel 表达式。** `${...}` 中的算术和条件判断可以
   1:1 映射到 `{{ ... }}` 配合 `IF`／运算符。
4. **用声明式方式重建分组。** `groupBy`／`orderBy` 变成块内的
   `@group`／`@sort`／`@subtotal` 单元格。
5. **跑一遍并做 diff。** `convert()` 是确定性的，因此黄金文件测试
   （`相同输入 → 相同字节`）可以取代肉眼抽查。

无需安装，直接在浏览器里拿一个模板试试迁移 ——
[xl3.io/try](https://xl3.io/try)。

延伸阅读：[ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)
（最终的 JXLS 边界）、[`spec/language.md`](https://xl3.io/spec/language)
"Directives"。
