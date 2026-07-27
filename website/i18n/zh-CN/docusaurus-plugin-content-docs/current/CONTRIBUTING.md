---
slug: /contributing
---

# 为 xl3 做贡献

xl3 是 [XTL 规范](./spec/) 的 TypeScript 参考实现。本文档同时涵盖对实现和规范的贡献路径。

在 0.x 阶段，项目由单一作者维护。欢迎贡献，但规范变更的门槛较高——XTL 的目标是成为一个稳定、语言中立的标准。

变更如何进入项目请参见 [GOVERNANCE.md](/governance)；1.0 发布的阻塞项请参见 [ROADMAP.md](/roadmap)。

## 快速开始

```bash
git clone https://github.com/xl3-lang/xl3.git
cd xl3
npm install
npm test
```

## 三类贡献

### 1. 实现 bug（本仓库，`impl/js/src/`）

参考实现与规范不一致的 bug 始终欢迎。步骤：

1. 开一个议题，附最小复现（template.xlsx + data.xlsx + 实际输出 vs 期望输出）。
2. 如果你有修复，提一个 PR，并在 `impl/js/src/__tests__/` 中加一个回归测试。

如果情形是"实现与规范一致，但规范本身是错的"，参见第 (3) 类。

### 2. 规范问题与澄清（`spec/`）

规范是规范性的。如果你发现行为定义不清：

1. 开一个打了 `spec` 标签的议题。
2. 如果答案很小（错别字、澄清），欢迎直接发 PR。
3. 如果答案需要设计决策，维护者会在 [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 中起草一份 ADR。

### 3. 一致性测试用例（`conformance/fixtures/`）

一致性语料是 XTL 的可执行定义。这里的测试用例的寿命超过任何单一实现。**编写之前请阅读 [`conformance/AUTHORING.md`](/conformance/authoring)。**

核心准则：**期望输出从规范编写而来，不从 JS 实现的运行结果生成。** 一个只是记录 JS 实现行为的 fixture，会把这个实现冻结为事实上的规范——这正是 XTL 想要避免的。

### 4. 移植到其他语言

欢迎其他语言的实现，在 [IMPLEMENTATIONS.md](/implementations) 中跟踪。要把一个移植列上去：

1. 对照规范实现，而不是对照 JS 实现。
2. 按 [`conformance/runner-protocol.md`](/conformance/runner-protocol) 跑你的实现通过一致性语料。
3. 提一个 PR，在 `IMPLEMENTATIONS.md` 中加一行。

## 编码规范（TypeScript 实现）

- TypeScript 严格模式开启；PR 必须通过类型检查（`npm run typecheck`）。
- 测试位于 `impl/js/src/__tests__/`。用 `npm test` 运行。
- 新功能需要测试。bug 修复需要回归测试。
- 除非必要，不要新增运行时依赖。当前依赖：`exceljs`、`jszip`。

## 提交信息

如果适用，请使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` —— 实现中的新功能
- `fix:` —— 实现中的 bug 修复
- `spec:` —— `spec/` 下规范文本的修改
- `conformance:` —— 测试用例语料或 runner 协议的修改
- `docs:` —— README、CONTRIBUTING 等
- `chore:` —— 工具链、CI、依赖
- `test:` —— 仅修改实现中的测试

不兼容变更加 `!`（例如 `feat!: rename count to rowcount`）。

## 0.x 期间的规范变更

0.x 阶段允许规范的不兼容变更，但必须：

1. 由 [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 中 `status: accepted` 的 ADR 驱动。
2. 提升规范的小版本号（`0.1` → `0.2`）。
3. 与 `conformance/fixtures/` 中的 fixture 更新一同落地。

1.0 之后，规范的不兼容变更需要 XTL 2.0，并配迁移指南。

## 发布（仅维护者）

1. 解决所有计划随该版本发布的、仍在进行中的 ADR。
2. 更新 `CHANGELOG.md`。
3. 提升 `package.json` 中的版本号。
4. `npm publish`（由 `prepublishOnly` 把关，运行类型检查 + 测试 + 构建）。
5. 给提交打 tag（`git tag v0.1.0 && git push --tags`）。

## 适合上手的第一份贡献

如果你想做贡献，但还没有具体想挠的痒处，下面这些是杠杆率最高的事项。每一项都对应到 [ROADMAP.md](/roadmap) 中一个 1.0 阻塞项。

1. **为某条尚无 fixture 的规范规则提案一个一致性测试用例。** 使用 **"Conformance fixture proposal"** 议题模板。编写 fixture 本身不需要会 TypeScript——只需要
   `template.xlsx` + `data.xlsx` + 期望输出（或期望错误）。
2. **指南翻译。** 从 [`docs/guides/`](/guides) 中的 15 篇配方里挑一篇，翻译成韩文（或其他任意语言）。文件放到 `docs/guides/<lang>/NN-*.md`，发 PR。协作成本低、价值高。
3. **在真实报表数据上跑 xl3，反馈摩擦点。** 一个打了 `early-adopter-feedback` 标签的简短议题，说明：你试了什么报表、什么跑通了、什么没跑通、你希望 XTL 还有什么能力。这会塑造 1.0 的形态。
4. **规范澄清。** 如果你读规范时发现一句话含混，开一个打 `spec` 标签的议题，附上有歧义的句子 + 两种合理的解读。即便未被接受的反馈，通常也能触发规范改进。
5. **移植进度。** 在做 [xl3-py](https://github.com/jinyoung4478/xl3-py) 或其他移植？放一份
   `conformance/reports/<impl>-<version>.json`（格式记录在
   [`conformance/runner-protocol.md`](/conformance/runner-protocol)），面板会自动把你包含进来。

## 行为准则

请相互尊重。技术决策上的分歧受欢迎；人身攻击不行。
