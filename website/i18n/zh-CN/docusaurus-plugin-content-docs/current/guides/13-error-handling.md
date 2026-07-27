---
sidebar_label: '13 · 宿主侧的错误处理'
pagination_label: '13 · 宿主侧的错误处理'
---

# 13 · 宿主侧的错误处理

## 场景

你的应用调用 `convert(templateBuffer, dataBuffer)`。结果模板里有个拼写错误，或者数据缺了一列必填字段。下一步怎么办？

xl3 会抛出**结构化错误**（按 ADR-0015），并附带稳定的 `error.code` 字符串。宿主可以基于这个 code 做分发——用于本地化、重试逻辑、面向操作员的友好提示。

## 捕获 + 分发

```ts
import { convert, isXtlError } from '@xl3-lang/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // 投递输出
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('数据文件缺少必需的列。', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('两个输出文件会重名，请检查数据。', err.message);
      default:
        return showOperator('转换失败。', err.message);
    }
  }
  // 非 xl3 错误：通常是系统层故障，重新抛出。
  throw err;
}
```

`isXtlError(value)` 仅当传入的是 `code` 以 `xl3/` 开头的 `Error` 实例时返回 `true`。普通 `Error` 或 DOMException 等不会被命中。

## 错误码目录

稳定，只追加。重命名按 ADR-0015 是破坏性变更。当前集合：

- **`xl3/cell/*`** ——单元格级失败（`formula-no-cache`、`numfmt-coercion`、`row-outside-repeat`）
- **`xl3/eval/*`** ——表达式求值（`arity-mismatch`、`operand-coercion`、`unsupported-syntax`）
- **`xl3/config/*`** ——`__config__` 相关
- **`xl3/inputs/*`** ——运行时输入相关
- **`xl3/source/*`** ——源数据相关（缺表头、未声明源、保留列名）
- **`xl3/sources/*`** ——`__sources__` 工作表相关
- **`xl3/sheet/*`** ——工作表名相关
- **`xl3/directive/*`** ——指令语法
- **`xl3/join/*`** ——`@join` 子句相关
- **`xl3/xlookup/*`** ——`XLOOKUP` 失败
- **`xl3/filename/*`** ——输出文件名相关
- **`xl3/parser/*`** ——解析器失败
- **`xl3/lists/*`** ——`__lists__` 引用相关
- **`xl3/expression/*`** ——表达式层面的拒绝（`bracket-outside-block`、`unknown-name`）
- **`xl3/block/*`** ——数据块布局（`overlap`、`empty-table`）
- **`xl3/group/*`** ——`@group` 相关（`missing-key`）
- **`xl3/subtotal/*`** ——`@subtotal` 相关（`outside-group`、`bad-aggregate`、`mixed-row`、`explicit-block-unsupported`）
- **`xl3/source-json/*`** ——JSON 源输入（`invalid`）——仅在 `convertJson` / `previewJson` 路径上出现

完整列表见 [`impl/js/src/error-codes.ts`](https://github.com/xl3-lang/xl3/blob/main/impl/js/src/error-codes.ts)。

## 值得显式处理的常见情况

**必填输入缺失**（`xl3/inputs/missing-required`）：
模板把某个输入声明为 `required: true`，但宿主没有提供。展示表单、询问操作员、重试。

**文件名冲突**（`xl3/filename/collision`）：
两个不同的文件分组键净化后变成了同一文件名（例如 `Seoul/Korea` 和 `Seoul:Korea` 都变成 `Seoul_Korea.xlsx`）。通常需要操作员清理数据，而不是改模板。

**XLOOKUP 跨源不一致**（`xl3/xlookup/source-mismatch`）：
模板作者写了 `XLOOKUP(x, A[k], B[v])`，但 `A` 和 `B` 是不同源。这是模板的问题，不是操作员的问题。

**XLOOKUP 无匹配**（`xl3/xlookup/no-match`）：
要查找的值不在查找列里。要么是操作员的数据不完整，要么是模板应改用 `@join`（会丢弃未匹配的行）。

## 本地化

`error.message` 是英文的。要本地化，请在宿主里基于 `error.code` 分发并提供你自己的提示文案——**不要**翻译引擎抛出的英文字符串。英文文案是一致性合规契约的一部分（fixture 会按其子串匹配）。

## 在 convert 前先 preview

`preview(template, data, options)` 跑的解析 + 派发流程与 `convert` 完全一致，但不渲染工作簿。如果你的宿主有"Validate"按钮先于"Convert"按钮，请调用 `preview`——速度快，能捕获同样的错误，不浪费 xlsx 生成的资源。

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings：非致命问题
// preview.inputs：已解析的输入值（应用默认值 + 类型转换后）
// preview.files / preview.sources：convert() 将会产出的内容
```

## 规范参考

- ADR-0015 ——结构化错误上报。
- [`spec/evaluation.md`](/spec/evaluation) "Errors"。
- [Cookbook 06](/guides/runtime-inputs) ——与输入相关的错误。
