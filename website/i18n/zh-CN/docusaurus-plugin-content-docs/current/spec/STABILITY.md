---
slug: /spec/stability
---

# XTL 稳定性政策

## 当前状态

XTL 当前版本为 **0.1**。参考实现以 `@xl3-lang/xl3` 的形式把 XTL 0.1 发布到 npm；它的包版本与规范版本走各自独立的时间线（见 [RELEASING.md](https://github.com/xl3-lang/xl3/blob/main/RELEASING.md)），因此这里不做固定。1.0 的切版被有意延后，直到外部验证累积到一定程度——至少包含一个能通过一致性语料的第二语言移植，以及一个生产采用者。在此之前，跨 0.x minor 版本的破坏性变更是可能的，并且应当（**SHOULD**）在受影响的 ADR 中记录。

1.0 将要冻结的契约已经起草完成（见下方"通往 1.0 的路径"）；延后只是关于承诺所需的外部信号水平，而不是因为规范尚不完整。

## 在 0.x 期间

- 规范的破坏性变更会在受影响的 ADR 中记录，并在下一个 minor 发布之前反映到一致性语料中。
- 参考实现（npm 上的 `xl3`）对其自身 API 遵循 SemVer；规范破坏会触发规范 minor 版本递增。
- 实现应声明它们针对的规范版本（例如 `XTL 0.2 partial`、`XTL 0.3 full`）。

## 在 1.0

- 规范冻结，仅允许向后兼容的演进。
- 规范破坏性变更需要 XTL 2.0，并配套公开讨论与迁移指南。
- 参考实现严格遵循 SemVer。

## 通往 1.0 的路径

1.0 切版关闭 XTL 的首个可移植性契约。其意图是：在任意宿主时区、区域或字节序下，任何一致的实现都对冻结的 fixture 语料生成相同的输出（Stage 1）以及相同的规范 OOXML（Stage 2）。

### 公开 API 表面（xl3 参考实现）

TypeScript 参考实现在 1.0 时冻结以下 13 个运行时导出。新增导出向后兼容；移除或重命名其中任何一个属于 2.0 才允许的变更。

**转换入口**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**底层辅助函数**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook, configVars?) → InputSpec[]`（可选参数
  `configVars` 在 0.6.0 中按 ADR-0050 加入；单参数调用仍然有效）
- `batchMatch(...)`——文件模式匹配辅助函数
- `toTemplateModel(parsed) → TemplateModel`

**错误辅助函数（ADR-0015）**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**稳定类型重导出**——在 1.0 冻结：
`TemplateMeta`、`TemplateModel`、`OutputFile`、`PreviewResult`、
`PreviewSource`、`PreviewFile`、`PreviewSheet`、`ConvertOptions`、
`InputSpec`、`InputType`、`SourceSpec`、`XtlError`、`XtlErrorCode`、
`XtlWarning`、`XtlWarningCode`。

**实验性类型重导出**（ROADMAP G22）——为工具链导出，但其形态可能（**MAY**）在 minor 版本之间变化：
`ParsedTemplate`、`SheetTemplate`、`TemplateVariable`、`DataBlock`、
`Directive`、`FilterDirective`、`FilterOp`、`SortDirective`、
`TopDirective`、`RepeatDirective`、`SourceDirective`、
`JoinDirective`。

每个实验性类型都带有 `@experimental` JSDoc 标签。持有这些对象之一的宿主应当（**SHOULD**）基于 `kind` 进行派发（对于指令而言），或将其形态视为不透明；并且如果它们依赖某个具体的字段集，应当（**SHOULD**）锁定到特定的 xl3 minor 版本。对大多数工具需求而言，可序列化、变更更慢的替代方案是 `TemplateModel`（由 `analyzeModel` 返回）。

`src/__tests__/api-surface.test.ts` 中的快照测试锁定了运行时列表，并在静默变更时使 CI 失败。新增导出需要主动更新快照**并**在 CHANGELOG 中留下记录。

### 1.0 冻结的内容

以下 ADR 所覆盖的表面区域是 1.0 契约的一部分。破坏性变更需要 XTL 2.0 切版。

- ADR-0001——`TODAY()` UTC 语义
- ADR-0002——输出文件名清理
- ADR-0003——由 numFmt 驱动的强制转换
- ADR-0005——动态一致性断言协议
- ADR-0006——Stage 2 规范 OOXML 比较（规则 1-8 + 列出空白项的修订）
- ADR-0007——空值谓词
- ADR-0008——真值判定规则
- ADR-0009 + ADR-0017——比较算法与源值模型（作为一份契约共同阅读）
- ADR-0010 + ADR-0011——运行时输入与保留工作表命名
- ADR-0012——多源数据模型
- ADR-0013——XLOOKUP 跨源查找
- ADR-0014——`@join` 块级配对（单一内连接、确定性首匹配）
- ADR-0015——结构化错误报告（`xl3/...` 错误码 + 英文一致性消息）
- ADR-0016——顺序与排序稳定性
- ADR-0033——合并单元格源表头
- ADR-0035——数据行合并单元格广播
- ADR-0036——模板特性保留矩阵
- ADR-0038——`@group` + `@subtotal` 指令（交错小计行输出）
- ADR-0039——`HYPERLINK` 单元格输出
- ADR-0040——保留矩阵修订（已发货大纲级别；CF/DV 范围 PE 待 0.6.1）
- ADR-0041——多行单元格文本契约
- ADR-0044——函数批次（UPPER、LOWER、TRIM、IFERROR、IFS、DATE）
- ADR-0046——单元格公式保留（OOXML 元素契约）
- ADR-0047——`ISBLANK` 作为 `IFEMPTY` 别名
- ADR-0050——`__inputs__` 的 `default`/`label`/`description`/`options` 作为 XTL 模板
- ADR-0051——`{{ ... }}` 块定界边界 + 不平衡字面量检测
- ADR-0052——单表达式 vs. 混合文本单元格分类（先 trim 再做锚定匹配；相邻块始终为混合文本）
- ADR-0053——Excel 错误哨兵在混合文本中的传播
- ADR-0054——单元格 / 文件 / 工作表模式中的裸名（缩写解析 + `xl3/expression/unknown-name`）
- ADR-0055——`@top` / `@repeat right` 的正整数语法
- ADR-0056——`__config__[system-key]` 读取策略
- ADR-0057——`__lists__[name]` 在 `@filter in/!in` 之外被拒绝
- ADR-0058——`@subtotal` 行组合（同行层级绑定）
- ADR-0059——聚合参数形态（仅列引用）
- ADR-0060——`XLOOKUP` 值 / 回退参数规则（惰性回退）
- ADR-0061——源名 vs. 函数名的词法消歧（保留 ADR-0024 扩展透传）
- ADR-0062——`__inputs__` 的 `default = ""` 语义
- ADR-0063——`__inputs__` 的 `options` 竖线分隔规则
- ADR-0064——字符串→数字的强制转换范围（接受科学计数法；拒绝十六进制 / 二进制 / 八进制）
- ADR-0065——`@source default` 显式形态 + 源名大小写敏感
- ADR-0021（分组顺序修订）——在不匹配的 `@sort` 下，分组顺序为实现自定义
- ADR-0041（表头修订）——表头单元格换行符规范化

ADR-0043 与 ADR-0048 是**过程规范性的**——它们约束未来的 ADR 作者，而非运行时契约。ADR-0034 与 ADR-0049 是信息性的。ADR-0004 是信息性的（参考实现耦合审计）。ADR-0037、ADR-0042、ADR-0045 已被拒绝（拒绝本身即契约）。

### 1.0 不包括的内容

以下内容被有意延后。加入这些不会破坏向后兼容性，也不需要新的规范主版本。

- 单个块中的多个 `@join` 指令、`@join … left` 语义、多行 join 匹配（ADR-0014 显式范围外清单）。
- XLOOKUP 通配符、近似与反向搜索模式（ADR-0013 显式范围外清单）。
- 区域感知的字符串排序。排序使用 Unicode 代码点序；需要区域排序规则的宿主应在上游预排序。
- 日期/日期时间算术函数（无 `EOMONTH`、`EDATE`、`DATEDIF` 等）。
- 跨写入器对 ADR-0006 修订中空白项的规范化（默认属性等价、颜色十六进制大小写、命名空间前缀绑定）。
- 在 ADR-0010 / ADR-0012 的宿主 API 表面之外，输入、源或输出的规范性线格式。

### 一致性基线

1.0 一致性语料是被标注为 `spec_version: "0.1"` 的 fixture 与 1.0 切版前新增 fixture 的并集。语料必须通过：

1. Stage 1 单元格值比较。
2. 声明 `comparison_stage: 2` 的 fixture 的 Stage 2 规范 OOXML 比较。
3. 在至少三种时区（`UTC`、`America/New_York`、`Asia/Seoul`）下的 Stage 1——参考仓库的 CI 工作流运行此矩阵；移植应当（**SHOULD**）照此办理。

声称达到 1.0 的实现必须（**MUST**）报告其针对该语料的一致性运行结果，并且必须不（**MUST NOT**）跳过 fixture，除非这些 fixture 被声明的比较阶段高于其运行器所支持的阶段。

## 核心 vs. 扩展

规范作出如下区分：

- **核心**——一致性所要求的语言特性。在 [`README.md`](/spec) 中总结，并在 [`language.md`](/spec/language) 与 [`evaluation.md`](/spec/evaluation) 中定义。这里的破坏性变更是规范版本事件。
- **扩展**——实现特定或领域特定的增补。可在各实现间变化。在实现自身的 README 中记录，而非在规范中。

实现可以（**MAY**）添加扩展，但必须不（**MUST NOT**）静默更改核心语义。

例如，实现可以支持 XTL 0.1 核心表以外的额外 `TEXT()` 格式。此类格式属于扩展：可移植的模板不应依赖它们，一致性 fixture 也不要求对它们生成相同输出。

## 一致性语料的版本化

一致性语料的版本与规范版本同步。在规范 0.3 中加入的 fixture 会相应打标；实现声明它们通过哪些 fixture，进而声明它们一致于哪个规范版本。

## 弃用政策（1.0 之后）

当某个特性将在未来某个主版本中被移除：

1. 该特性在规范中被标记为**弃用**，至少在被移除前保留一个 minor 版本。
2. 使用该弃用特性的一致性 fixture 获得 `deprecated` 标签。
3. 鼓励实现在使用弃用特性时发出警告。
4. 移除发生在下一个主版本（例如 1.3 弃用 → 2.0 移除）。
