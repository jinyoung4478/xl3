---
slug: /conformance/authoring
---

# 撰写一致性 Fixture

本目录中的语料将成为 XTL 的可执行定义。在这里编码的 fixture 会比任何单一实现存在得更久。把它们写好，比把它们写多更重要。

## "以 JS 实现为真理"的反模式

诱人的捷径是：

1. 运行 JS 参考实现
2. 把它的输出保存为 `expected.xlsx`
3. 提交并宣称这就是规范

这会让 JS 实现成为事实上的规范。当 Python 或 Go 移植与之不一致时，到底谁对？谁先跑出来谁就对。规范就变成了"JS 实现做了什么"，标准化也就名存实亡。

**一致性必须从规范出发撰写，而不是从实现出发。**

## 撰写流程

### 简单 fixture

1. 阅读 [`spec/`](../spec/) 中相关小节。
2. 在 Excel（或电子表格编辑器）中手工编写 `template.xlsx` 与 `data.xlsx`。
3. **手工**计算预期输出——打开 Excel、打开计算器、逐个单元格地推算。保存为 `expected.xlsx`。
4. 运行参考实现。若它与你手算出的预期不一致，**不要**修改预期——开一个 issue：要么规范错了，要么实现错了，要么你的手算错了。

### 复杂 fixture

当手算不切实际时（例如 200 行求和、跨工作表的分组）：

1. 按规范撰写模板和数据。
2. 通过两条独立路径计算预期（例如 Excel 公式 + 一个单独的脚本）。两者必须一致。
3. 运行参考实现；如果它与两条独立路径都一致，把实现的输出保存为预期。
4. 在 `meta.yaml` 中记录：`verified_by: [excel-formulas, manual-script]`。

### `meta.yaml` 应包含什么

```yaml
description: "Basic per-row substitution with [field] syntax"
spec_section: "Cell-level variables"
spec_version: 0.1
tags: [substitution, basic]
comparison_stage: 1
verified_by: [hand]            # or [excel-formulas, manual-script], etc.
```

`comparison_stage` 是可选字段，默认为 `1`。仅当静态输出 fixture 需要通过规范 OOXML 比较来断言样式、合并区域、图像、包结构或阶段 1 单元格值比较无法观察到的其他工作簿特性时，才使用 `2`。

`expected_error` 将 fixture 变为错误 fixture，不得与 `expected.xlsx`、`expected/` 或 `expected_dynamic` 同时使用。`expected_dynamic` 将 fixture 变为动态断言 fixture，必须包含 `dynamic_cells`；动态 fixture 同样省略静态预期输出。`comparison_stage` 仅用于静态输出 fixture。

### 阶段 2 fixture 撰写注意事项

当前大多数阶段 2 fixture（024-026）的 `template.xlsx` 与 `expected.xlsx` 都由 JS 参考实现内部所用的同一个 `exceljs` 写出端构建。它们在两侧穿过同一个库，因此可以演练规范化器关于*等价性*的主张（工作表零件改名、默认页面设置剥离、属性顺序、引号风格、空元素形态），但无法演练其*跨写出端*的主张。一个只处理 ExcelJS 怪癖的规范化器也能通过这些 fixture。

Fixture 027 通过手工改写已撰写的预期工作簿的 OOXML 序列化（保留相同的工作簿语义），增加了包级别的写出端差异覆盖。这仍不能替代由 Excel、LibreOffice 或其他独立 OOXML 写出端保存的工作簿；当撰写环境可用时，这样的 fixture 仍然是首选的后续补充。

基本规则仍然适用：通过运行 JS 实现得到的阶段 2 `expected.xlsx` 是被禁止的。ExcelJS 仅作为脚手架是可接受的，因为该包写出端是通用的——它不是 XTL 实现。添加由 Excel 本身（或另一个 OOXML 写出端）保存了 `expected.xlsx` 的阶段 2 fixture，仍是更强的后续补充；在此之前，跨写出端行为由 fixture 027 的包级改写以及 `impl/js/src/__tests__/conformance-runner.test.ts` 中的规范化器单元测试覆盖。

对错误 fixture，省略 `expected.xlsx` 与 `expected/`，并声明预期诊断信息的稳定部分：

```yaml
expected_error: "Source sheet"
```

对动态 fixture，省略 `expected.xlsx` 与 `expected/`，声明动态断言的种类，并列出预期值由运行器计算的单元格：

```yaml
expected_dynamic: utc_today
dynamic_cells:
  - sheet: Report
    cell: A2
    format: YYYY-MM-DD
```

## 硬性规则

- **预期输出是撰写出来的，不是生成出来的。** 如果无法手工校验，就必须独立校验。把 `expected.xlsx` 视为规范的一部分，而不是测试输出。
- **每个 fixture 只测试一个概念。** 在一个 fixture 中混合 repeat + filter + 聚合会让失败难以诊断。组合最小的 fixture。
- **fixture 文件应当极小。** 如果一个 fixture 需要 1000 行数据，那测试概念就是错的——生成能演练同样性质的小数据。
- **不允许 PII 或专有数据。** fixture 采用 MIT 协议且公开。只使用合成数据。
- **模板必须人类可读。** 除非显式测试，否则在 fixture 中避免仅二进制的 Excel 特性（自定义 XML、宏）。
- **错误 fixture 只断言稳定诊断。** 匹配一段简短的、用以描述契约的子串，而不是绝对路径等易变的细节。
- **动态 fixture 只断言规范定义的动态值。** 不要用它来回避为静态行为撰写预期工作簿。

## 当规范与 fixture 不一致时

规范胜出。更新 fixture。

## 当 fixture 与实现不一致时

fixture 胜出。更新实现。

## 当撰写过程中发现规范不充分的场景时

停下。开一个 issue，先更新规范。不要提交依赖规范不充分行为的 fixture——这会把规范的不充分冻结成"语料做了什么"，反过来逼迫规范在事后去匹配它。
