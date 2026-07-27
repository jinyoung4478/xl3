---
slug: /governance
---

# 治理

XTL 规范与 xl3 参考实现的决策机制。

本文档刻意写得很短。它描述项目当前所处的状态（单一维护者，形成期），以及随着采用增长向多方治理过渡的路径。

## 当前状态

xl3 处于**形成期**。一位维护者同时是：

- `impl/js/src/` 的作者（TypeScript 参考实现）
- `spec/` 的编辑（XTL 语言定义）
- `spec/decisions/` 中 [ADR](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 的接受者
- 所有 PR 的评审者

对于这个阶段的项目来说，这是常态。下文的结构说明变更如何进入项目，以及随着更多贡献者加入，会发生哪些变化。

## 角色

| 角色 | 职责 | 担任者 |
|---|---|---|
| **维护者** | 对 ADR 和实现 PR 拥有最终接受/拒绝权。发布版本。 | 当前为项目作者本人。 |
| **规范编辑** | 起草 ADR，编辑 `spec/language.md` 与 `spec/evaluation.md`。 | 当前由维护者担任。 |
| **移植作者** | 用其他语言实现 XTL；在 [`conformance/fixtures/`](https://github.com/xl3-lang/xl3/tree/main/conformance/fixtures) 上跑一致性测试。 | 任何人。在 [IMPLEMENTATIONS.md](/implementations) 中列出。 |
| **贡献者** | 提议题、发 PR、提案测试用例或 ADR。 | 任何人。参见 [CONTRIBUTING.md](/contributing)。 |

当外部贡献者能够持续审阅并落地变更时，维护者集合就会扩大。没有正式的投票流程——维护者承诺会在合适的时机扩大维护者集合，并在那一刻进行文档记录。

## 变更如何进入项目

### 实现 bug / 小型规范澄清

- 直接开议题或发 PR。
- 由维护者审阅。
- 满足以下任一条件即合入：(a) 不改变规范的规范性行为，或 (b) 显然是正确的澄清。

### 规范的规范性变更（新增行为，或改变已有行为）

规范变更走 **ADR 流程**：

1. **发现** —— 一个真实的边界场景（使用过程中、编写 fixture 时、移植过程中）暴露出规范沉默或含混的地方。
2. **议题** —— 提一个 `spec` 议题，说明缺口、备选方案以及相关交叉引用。
3. **ADR 草稿** —— 维护者（或贡献者）按照 `spec/decisions/0000-template.md` 模板，在
   [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 中起草 ADR。包括 Context、Considered Options、
   Decision、Consequences、References。
4. **评审** —— 在引入该 ADR 的 PR 上讨论。接受标准是"理由足够充分，让另一名实现者在不看实现源码的情况下也能得出同样的结论"。
5. **接受** —— 满足以下全部条件时设置 `status: accepted`：
   - 至少有一个一致性测试用例演示新行为；以及
   - 参考实现的修改包含在同一个 PR 中（或在发布前的跟进 PR 落地）；以及
   - 维护者签字通过。
6. **发布** —— 下一个小版本号在变更是新增式时提升规范版本号，是不兼容时提升大版本号。

[`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 中的 ADR 是项目对每一项规范性决策及其推理过程的公开记录。

### 一致性测试用例新增

测试用例让 XTL 成为_可执行_的。新测试用例扩展整个语料库：

1. 提议题或使用 **fixture 提案** 议题模板。
2. 按照 [`conformance/AUTHORING.md`](/conformance/authoring) 编写测试用例。
   核心准则：**期望输出来自规范，不来自跑参考实现得到的结果。**
3. 提交 PR。
4. 维护者评审。比 ADR 的批准更快，因为测试用例的约束力更弱——它记录一个已存在的规范规则，而不是创造一个新规则。

## 向后兼容承诺

| 面向 | 稳定性承诺 |
|---|---|
| 规范 `XTL 1.0`（发布之后） | 不兼容变更需要 `XTL 2.0`，并配迁移指南 |
| 规范 `XTL 0.x`（当前） | 允许不兼容变更；提升小版本号；变更与 fixture 更新一同发布 |
| `xl3` npm `1.x`（发布之后） | 公开 API 冻结在 `impl/js/src/__tests__/api-surface.test.ts` 的快照。重命名或移除需要提大版本号 |
| `xl3` npm `0.x`（当前） | 公开 API 仍可能调整；快照测试用于捕获意外漂移 |
| 错误码（`xl3/<category>/<id>`） | 只追加。重命名属于不兼容变更。移除需要提大版本号 |

## 意见分歧

技术上的分歧是健康的。解决路径：

1. 在议题/PR 上讨论具体的权衡。
2. 如果未能达成共识，维护者做出判断决定，并在 ADR 的 Consequences 章节中记录。
3. 后续的 ADR 可以重新评估并取代更早的 ADR。ADR 并非不可变；它们记录的是某一个时间点的推理。当后来的 ADR 取代更早的 ADR 时，更早的 ADR 会被标记为 `status: superseded`，并带上指针。

这是一个刻意保持低仪式感的流程。随着贡献者数量增长，本章节将需要扩展（投票、RFC 期、技术指导委员会等）。维护者承诺在那一刻进行公开的扩展。

## 如何在今天影响项目

最有效的影响 xl3 的方式：

1. **在生产中使用它，并反馈缺什么。** 真实采用是优先级最强的信号。
2. **提案一个 fixture。** 一个新测试用例迫使规范文字比单纯散文更清晰。即便是未被接受的 fixture 提案，通常也能触发规范改进。
3. **移植到第二门语言并跑通一致性语料。** 一个独立的第二实现发现规范缺口的速度比任何评审都快。
   参见 [PORTERS_GUIDE.md](https://xl3.io/porters-guide)。
4. **在延期项上发起一份 ADR 草稿。** 在 [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 中延期的事项（日期运算、区域感知排序、多表 join 等）都是未来 ADR 的候选项——欢迎具体提案。

## 本文档如何演进

当维护者集合扩大时，本文档将被重写以反映新状态——包括所采纳的任何投票 / RFC / TSC 流程。在那之前，这就是当前的工作描述。
