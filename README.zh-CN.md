# xl3 — 声明式 Excel 转换标准

> 就像 Jinja 让 HTML 成为模板,**xl3 让 Excel 工作簿成为可执行模板** ——
> 作为一个与实现无关的开放标准,而不是单一的库。

**状态:** alpha · **XTL spec 0.1 (draft)** · 参考实现
`@xl3-lang/xl3` 0.11.0 · 1.0 之前可能存在 breaking change

**xl3** 是一个开放标准,用于把普通的 `.xlsx` 工作簿变成确定性的声明式
转换模板:布局、样式、合并单元格与规则都放在 *工作簿内部*,任何符合
规范的引擎都能针对所给数据执行它 —— 相同输入,始终得到相同输出。本仓库
以三个部分 *定义* 该标准:

- **[规范](./spec/)** — 规范性定义,包含 **XTL** 这套小巧的内嵌表达式
  语言(用于描述那些必须在工作簿写出 *之前* 就确定的内容:过滤、分组、
  聚合、文件名模式),以及设计记录 (ADR)。
- **[Conformance 套件](./conformance/)** — 任何实现都要运行、以证明其
  符合规范的语言中立 fixture。
- **参考实现** —
  [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3)
  (TypeScript,位于 [`impl/js/`](./impl/js/)) —— 多个[实现](./IMPLEMENTATIONS.md)
  之一(Rust/WASM 与 Python 进行中)。

**三个名字,一套体系:** **xl3** = 标准(这个格式) · **XTL** = 它的内嵌
表达式语言 · **`@xl3-lang/xl3`** = 它的 TypeScript 参考实现。

当月度报告、报价单、交易明细、财务工作簿等重复 Excel 文档需要继续由
Excel 编辑,同时执行过程又必须确定、可审查、可验证时,xl3 就特别合适。
它也适合 AI 生成:相比数百行工作簿 API 代码,LLM 更容易稳定地产出一个
小型模板契约。

[English](./README.md) · [한국어](./README.ko.md) · [日本語](./README.ja.md) · **简体中文** · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 分工:Excel 是模板，xl3 负责执行

```text
  ┌──────────────────────────┐
  │   业务用户 / 设计者      │
  │   在 Excel 中修改布局    │
  └─────────────┬────────────┘
                │ template.xlsx
                ▼
  ┌──────────────────────────┐       ┌──────────────────────────┐
  │      开发者应用          │       │           xl3            │
  │      提供数据 + 输入     ├──────►│        执行模板           │
  └──────────────────────────┘       └─────────────┬────────────┘
                                                    │
                                                    ▼
                                             result.xlsx
```

工作簿 API 就像电子表格世界里的 DOM API:强大，但冗长。对于重复文档，
工作簿本身应该就是 View 和模板契约。xl3 让应用负责提供数据，让 Excel
继续拥有布局和面向业务的规则。

这种分工正是 [`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)、
160 条 fixture 组成的 conformance 语料库、以及刻意保持精简的 XTL
表面所共同服务的目标。

## 一个简单的例子

模板里可以同时包含普通 Excel 内容、`__config__` 和 xl3 表达式:

| `__config__` 键 | 值 |
|---|---|
| `source_sheet` | `原始数据` |
| `source_table` | `1` |
| `output_file_pattern` | `客户-续约报告.xlsx` |

| 单元格 | 模板值 |
|---|---|
| A5 | `{{ [客户] }}` |
| B5 | `{{ [区域] }}` |
| C5 | `{{ [续约金额] }}` |
| E5 | `{{ IF([续约金额] > 10000, "优先", "普通") }}` |

给定下面这份数据工作簿:

| 客户 | 区域 | 续约金额 | 负责人 |
|---|---|---:|---|
| 北京物流 | 北京 | 18400 | 李敏 |
| 上海贝塔工程 | 上海 | 7200 | 王俊 |

xl3 渲染出的结果:

| 客户 | 区域 | 续约金额 | 负责人 | 等级 |
|---|---|---:|---|---|
| 北京物流 | 北京 | 18400 | 李敏 | 优先 |
| 上海贝塔工程 | 上海 | 7200 | 王俊 | 普通 |

……同时原样保留模板中的数字格式、填充、边框、合并表头与底部行。
输出就是一份可以直接在 Excel、Numbers 或 Google Sheets 中打开的
`.xlsx`,无需任何格式转换。

语言草案参见 [`spec/`](./spec),实现无关的 fixture 语料库与 runner
协议参见 [`conformance/`](./conformance)。

## 为什么 Excel 应该是模板

一句话总结这件事:**报表布局本来就已经在 Excel 里。** 一旦把布局搬进
代码，插入行、修改样式、调整合并单元格、改变小计规则都会变成一次部署。
xl3 把布局留在 Excel 中，并让工作簿可执行。应用负责数据与部署，模板负责
重复文档的契约。

具体来说:

- **小巧、可审计的 XTL 表面(ADR-0043)。** 一个函数只在它的值
  必须在工作簿写出 *之前* 就确定时,才会进入 XTL。其余的一切都
  按普通 Excel 单元格公式处理,由 Excel 在打开时自行求值。语言
  表面越小,人类越容易审查,AI 也越容易起草。
  并列对照参见
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md)。
- **Conformance 语料库。** 74 个 ADR 下共 160 条 fixture,全部通
  过。这是把转换契约变成可执行验证的测试床。
- **一份实现,一份规范。** [`spec/`](./spec) 目录独立于这份
  TypeScript 参考实现定义了 XTL。欢迎向其他运行时移植 —— 语料库
  就是契约。
- **没有宏,也没有厂商云。** 模板就是普通的 `.xlsx`。可以做 diff、
  在 pull request 中评审,也可以直接交给一位从没听说过 xl3 的人
  类评审者。

这些特质让 xl3 即便 **不接入 LLM** 也很有用 —— 运营和分析人员可
以直接阅读和修改模板,因为表达式用的是他们日常熟悉的 `IF`、
`SUM` 与列引用。AI 友好性来自同一个设计选择:小型、声明式、可审查的规则。

## 责任驱动的文档自动化

大多数 Excel 自动化工具关注提升开发者生产力。xl3 的目标不同:让过去
必须由开发者处理的重复文档变更,可以由运营人员直接完成。

在传统模型中,布局调整、增加列、修改重复逻辑、改变输出格式都会变成
开发需求和一次部署。xl3 将责任拆开:

```text
Developer  -> Runtime maintenance
Operator   -> Template maintenance
Business   -> Result usage
```

开发者负责引擎、校验、集成与部署的可靠性。运营人员直接维护 Excel
模板以及具体文档的转换规则。业务使用生成好的工作簿。

这不只是理论。xl3 来自一个真实内部服务的长期运行经验:数月运营中,
非开发者可以直接在 Excel 中维护模板和转换规则,开发资源则几乎集中在
Runtime 改进上。真正减少的不只是代码量,而是必须由开发者完成的工作量。

因此 XTL 尽量保留 Excel 语法。目标体验不是“学习一门新语言”,而是
“把日常使用的 Excel 变得更强一点”。xl3 不是要取代开发者:开发者拥有
Runtime,运营拥有 Template。它把 Excel 自动化的所有权从开发者扩展到
运营组织。

## 横向对比

| 方案 | 擅长 | 取舍 |
|---|---|---|
| **xl3** | 声明式 Excel 模板执行。工作簿已经存在;xl3 只是把数据带进去执行。 | Alpha 阶段;只有一位维护者;XTL 表面刻意保持精简,在 1.0 之前仍在演进。 |
| 工作簿 API (ExcelJS / SheetJS / openpyxl / Apache POI) | 从代码生成低层或全功能工作簿。 | 布局、样式、合并、循环和业务规则都会变成应用代码,非开发者很难安全修改模板。 |
| Python / VBA 脚本 | 贴近现有电子表格的快速一次性自动化。 | 规则容易留在代码或某个维护者的记忆里,布局变化仍然需要改代码。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 内部的工作流、数据整形与操作自动化。 | 绑定具体租户;工作流规则不会跟随工作簿一起带走。 |
| JXLS / xltpl / jsreport xlsx recipe | 基于类电子表格模板的服务端报表生成。 | 有价值的先例,但往往绑定某个运行时,并未定位为小型、可移植的 Excel 规则格式。 |
| 文档生成 SaaS(Plumsail、Conga、Formstack) | 托管型的文档流程、集成、审批与分发。 | 规则留在供应商服务中,不是一个可自行审查和执行的可移植工作簿模板。 |
| LLM 直接生成 xlsx | 临时探索性草稿、一次性的图表。 | 不适合作为重复运营工作的确定性转换契约。 |

## 安装

```bash
npm install @xl3-lang/xl3
```

## 使用

```ts
import { convert } from '@xl3-lang/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — 根据模板里的分组规则,可能输出一个或多个 .xlsx
```

在浏览器和 Node(≥ 20.12)上都可以运行。

### 不依赖打包工具,直接用 `<script>`

对于不使用打包工具的项目,可以直接引用自包含的 IIFE 构建,在
`window.xl3` 上挂载所有 API:

```html
<script src="https://cdn.jsdelivr.net/npm/@xl3-lang/xl3@0.11.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

压缩后约 1 MB(gzip 后约 300 KB)。ExcelJS 和 JSZip 已经内联进来,不
需要额外的依赖。

可以在 [xl3.io](https://xl3.io) 直接体验浏览器流程:用页面自带的样
例文件原样跑一遍、下载原始/模板工作簿研究一下,或者把任意一份文件
换成你自己的来试。

### Excel 版本兼容性

xl3 通过 OOXML 读取 `.xlsx`,本身在设计上就尽量做到与版本无关 ——
直接读取公式的缓存结果,在 UTC 下归一化日期,并在单元格值层面忽略
OOXML 序列化层的差异。完整的兼容性矩阵参见
[ADR-0022](./spec/decisions/0022-excel-version-compatibility.md);
简短的建议是:动态内容统一走 XTL 的 `{{ ... }}` 语法,避免在数据
块内部使用图表/数据透视/原生公式,并在组织内部统一一种日期系统
(1900)。

模板通过隐藏的 `__config__` 工作表来指定源表格的位置:

| 键 | 示例 | 含义 |
|---|---|---|
| `source_sheet` | `原始数据` | 源工作表名称,或者以 `*` 结尾的前缀模式 |
| `source_table` | `1` | 第 1 行为列名,下面的所有行都是数据 |
| `source_table` | `A1:D` | A1-D1 为列名,下面的所有行都是数据 |
| `source_table` | `A1:D200` | A1-D1 为列名,A2-D200 为数据 |

最常见的情况(第 N 行为列名)用 `source_table = N` 就够了。只有当
表格从靠后的列开始、或者需要限定结束行时,才需要写区间形式。

### 保留工作表

模板使用四个两端带双下划线的保留工作表(参见 ADR-0011):

| 工作表 | 用途 |
|---|---|
| `__config__` | 作者定义的配置与取值字典;通过 `{{ __config__[name] }}` 访问 |
| `__inputs__` | 每次运行时由主程序提供的入参(ADR-0010);通过 `name`/`type`/`default`/`label`/`description`/`options` 这些列声明 |
| `__sources__` | 在默认 `source_sheet` 之外额外声明的命名数据源(ADR-0012);通过 `name`/`sheet`/`table`/`description` 这些列声明 |
| `__lists__` | 供 `@filter [field] in __lists__[name]` 等使用的成员列表 |

作者自定义的工作表名一旦匹配 `^__[a-z]+__$` 这种模式,会在解析阶段
直接被拒绝。

### 多源数据

除了默认的 `source_sheet`,模板还可以在 `__sources__` 中声明命名数
据源,并用 Excel 结构化引用的形式来引用它们:

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` 会把一个数据块的默认源切换为 `<Name>`,这样裸引用
形式 `[Column]` 也会按 `<Name>` 来解析。`@join` 则以键为基准,把第
二个数据源中的行与主行配对(inner join,取第一条匹配)。完整的指令
语法参见 [`spec/language.md`](./spec/language.md)。

### 运行时输入

需要每次运行时传入值(目标月份、客户过滤、标签等)的模板,可以在
`__inputs__` 中声明它们,主程序把这些值传给 `convert(...)`:

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '北京' },
});
```

输入会流入单元格(`{{ __inputs__[month] }}`)、文件名模式以及分组
键。

## 示例

[`examples/`](./examples) 里有四份贴近生产形态的模板:基础的续约报
表、按区域分工作表配合列表过滤、带运行时输入的多源 join,以及一份
咖啡店周报,展示了 `@group` + `@subtotal` 配合按类目小计的写法。可
以用 `npm run examples:build && npm run examples:run` 跑起来。

## 指南

[`docs/guides/`](./docs/guides) 中有面向常见场景的、可直接复制粘贴
的短小食谱,目前共 18 篇,涵盖入门、条件、聚合、按文件/工作表分
组、运行时输入、连接、`XLOOKUP`、排序与 Top-N、品牌样式、多行文本、
空值处理、错误处理、`__config__` 取值、指令组合、XTL 与 Excel 公式
对照、模板编写时的展示效果,以及 `@group` / `@subtotal`。

## Spec

XTL 规范是语言中立的,放在 [`spec/`](./spec) 下。本仓库提供的是
TypeScript 参考实现。欢迎用其他语言来移植 —— 详见
[IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md)。

在本地运行 conformance 语料库:

```bash
npm run conformance
npm run conformance:stage2
```

最新一次参考实现运行的汇总,以及任何放入
[`conformance/reports/`](./conformance/reports/) 的外部移植报告的对
应列,可以在 [`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md)
查看。使用 `npm run conformance:dashboard` 重新生成。

## 项目结构

- `spec/` —— 规范性的 XTL 语言草案。
- `conformance/` —— 实现无关的 fixture 语料库与 runner 协议。
- `impl/js/src/` —— TypeScript 参考实现。

规范是唯一的事实来源。Conformance fixture 把规范行为以可执行的形式
固定下来。参考实现很有用,但并不具有规范效力。

## 许可证

- 代码(`impl/js/src/`、`conformance/`):[MIT](./LICENSE)
- XTL 规范(`spec/`):[CC-BY-4.0](./spec/LICENSE)

---

Microsoft 和 Excel 是 Microsoft Corporation 的商标。xl3 与 Microsoft 没有任何关联。Office Open XML 格式(`.xlsx`)以 ISO/IEC 29500 的形式公开发布。
