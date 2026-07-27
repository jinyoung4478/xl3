---
slug: /implementations
---

# XTL 实现清单

[XTL 规范](./spec/) 的实现。xl3 是参考实现。

| 语言 | 仓库 | 包 | 规范版本 | 一致性 | 备注 |
|---|---|---|---|---|---|
| TypeScript | [`xl3-lang/xl3`](https://github.com/xl3-lang/xl3) | [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3) | XTL 0.1（草案） | 参考实现；**160/160** fixture 通过（154 Stage 1 + 仅 6 Stage 2） | 浏览器 + Node ≥ 20.12；通过 `npx xl3-conformance` 运行；CI 中带 3 时区矩阵 |
| Rust (WASM) | [`xl3-lang/xl3-rs`](https://github.com/xl3-lang/xl3-rs) | [`xl3-core`](https://crates.io/crates/xl3-core) + [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) | XTL 0.1（草案） | **partial 119/148** Stage 1（见下方新鲜度说明） | 纯 Rust 加速核心（calamine + rust_xlsxwriter），为浏览器 / Node 宿主做了封装。驱动 xl3 0.9.0 引入的可选 `engine: 'wasm'` 路径。尚未覆盖：HYPERLINK 函数、共享公式、约 20 处校验错误点 |
| Python | [`xl3-lang/xl3-py`](https://github.com/xl3-lang/xl3-py) | _（未发布）_ | XTL 0.1（草案） | 在其实际运行的语料上 **133/133** Stage 1（见下方新鲜度说明） | 与参考实现并行跟踪；在 [`conformance/reports/`](https://github.com/xl3-lang/xl3/tree/main/conformance/reports) 下放一份 `--report=json` 产物，`npm run conformance:dashboard` 就会把它接进来 |

### 报告新鲜度

上面两个数字来自提交在 [`conformance/reports/`](https://github.com/xl3-lang/xl3/tree/main/conformance/reports) 下的 JSON 报告，**两者都早于当前的 160 fixture 语料**：

| 报告 | 运行的语料 | 结果 |
|---|---|---|
| `xl3-wasm-0.1.0.json`（2026-06-08） | 154 个 fixture | 119 通过、29 失败、6 跳过 → 可比部分 119/148 |
| `xl3-py-0.1.0a3.json`（2026-05-23） | 139 个 fixture | 133 通过、0 失败、6 跳过 |

语料增长到 160 之后（fixture 158-161 在 0.9.0 / 0.10.0 落地），两者都没有重跑过；因此在提交新报告之前，各移植针对**当前**语料的实际状况是未知的。ROADMAP 的 **G13** 以最新报告为判据，而不是以这两份为准。

## 生产用户

ROADMAP 的关卡 **G15** 指向本节。当出现至少一个具名用户时它才勾选——要么是已授权公开列出的外部公司，要么是维护者所在公司在生产中按计划运行 xl3 并发布了公开案例研究。

| 组织 | 起始 | 工作负载 | 案例研究 |
|---|---|---|---|
| _暂无列出_ | — | — | — |

G15 处于**进行中**，而非受阻：维护者所在公司的生产部署自 2026-05-26 那一周起已在运行。案例研究公开发布并且此处落下一行时，关卡才勾选——仅有在跑的部署并不满足条件，因为这个关卡的要点是第三方可验证的参考案例。

如果你在生产中使用 xl3 并愿意具名，请提一个 PR 添加一行。信息不全也可以（只有组织 + 工作负载、没有案例研究链接）——在 PR 里说明即可，我们会相应标注该行。

## 新增一个实现

先阅读 [`PORTERS_GUIDE.md`](https://xl3.io/porters-guide)——它区分了规范性的硬性要求与 TS 实现的偶然细节，并给出了与一致性语料挂钩的推荐开发顺序。

要把一个移植列在这里：

1. 实现 XTL 0.1 中你打算覆盖的[一致性测试用例](https://github.com/xl3-lang/xl3/tree/main/conformance/fixtures)的足够子集。
2. 按 [`conformance/runner-protocol.md`](/conformance/runner-protocol) 在 [`conformance/`](./conformance/) 上跑你的实现。
3. 提一个 PR，在上面的表格中加一行：语言、包 URL、目标规范版本、一致性状态（full / partial / N of M fixtures）。

正在开发中的移植同样欢迎——即便一致性还是部分通过，也欢迎链接你的进行中仓库。

## 规范一致性级别

- **reference** —— 本实现。按定义对其声明的规范版本一致。
- **full** —— 通过所声明规范版本的所有一致性测试用例。
- **partial (N/M)** —— 通过 M 个中的 N 个。请列出尚不支持的 fixture 分类。
- **draft** —— 早期 WIP，尚未开始跑一致性。
