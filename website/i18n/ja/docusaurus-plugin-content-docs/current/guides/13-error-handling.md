---
sidebar_label: '13 · ホスト側エラーハンドリング'
pagination_label: '13 · ホスト側エラーハンドリング'
---

# 13 · ホストのためのエラー処理

## シナリオ

アプリで `convert(templateBuffer, dataBuffer)` を呼びました。ところがテンプレートに誤字があったり、データに必須列が抜けていたりしたら? どうしましょうか?

xl3 は安定した `error.code` 文字列を持つ**構造化エラー**を投げます(ADR-0015 基準)。ホストはこのコードを基準に分岐できます ― 多言語対応、リトライロジック、運用担当者にわかりやすいメッセージを作るのに適しています。

## catch + 分岐

```ts
import { convert, isXtlError } from '@xl3-lang/xl3';

try {
  const outputs = await convert(templateBuffer, dataBuffer, options);
  // ship outputs
} catch (err) {
  if (isXtlError(err)) {
    switch (err.code) {
      case 'xl3/source/missing-header':
        return showOperator('Your data file is missing required columns.', err.message);
      case 'xl3/inputs/missing-required':
        return promptForMissingInput(err.message);
      case 'xl3/filename/collision':
        return showOperator('Two output files would have the same name. Check your data.', err.message);
      default:
        return showOperator('Conversion failed.', err.message);
    }
  }
  // Non-xl3 error: probably a system fault. Re-throw.
  throw err;
}
```

`isXtlError(value)` は `code` が `xl3/` で始まる `Error` インスタンスにだけ `true` を返します。普通の `Error` や DOMException などはマッチしません。

## エラーコードカタログ

安定的で、append-only です。名前変更は ADR-0015 基準で breaking change として扱います。現在のカタログは次の通りです:

- **`xl3/cell/*`** ― セル単位の失敗(`formula-no-cache`、`numfmt-coercion`、`row-outside-repeat`)
- **`xl3/eval/*`** ― 式評価(`arity-mismatch`、`operand-coercion`、`unsupported-syntax`)
- **`xl3/config/*`** ― `__config__` 関連の問題
- **`xl3/inputs/*`** ― ランタイム入力失敗
- **`xl3/source/*`** ― ソースデータ問題(ヘッダー欠落、未宣言ソース、予約列名)
- **`xl3/sources/*`** ― `__sources__` シート問題
- **`xl3/sheet/*`** ― シート名関連の問題
- **`xl3/directive/*`** ― ディレクティブ構文
- **`xl3/join/*`** ― `@join` 句関連の問題
- **`xl3/xlookup/*`** ― `XLOOKUP` 失敗
- **`xl3/filename/*`** ― 結果ファイル名関連の問題
- **`xl3/parser/*`** ― パーサー失敗
- **`xl3/lists/*`** ― `__lists__` 参照問題
- **`xl3/expression/*`** ― 式レベルの拒否(`bracket-outside-block`、`unknown-name`)
- **`xl3/block/*`** ― データブロックのレイアウト(`overlap`、`empty-table`)
- **`xl3/group/*`** ― `@group` の問題(`missing-key`)
- **`xl3/subtotal/*`** ― `@subtotal` の問題(`outside-group`、`bad-aggregate`、`mixed-row`、`explicit-block-unsupported`)
- **`xl3/source-json/*`** ― JSON ソース入力(`invalid`)― `convertJson` / `previewJson` の経路でのみ発生

完全なリストは [`impl/js/src/error-codes.ts`](https://github.com/xl3-lang/xl3/blob/main/impl/js/src/error-codes.ts) にあります。

## 明示的に扱うべきよくあるケース

**必須入力の欠落** (`xl3/inputs/missing-required`):
テンプレートがある入力を `required: true` として宣言しているのにホストがその値を渡していないケースです。入力フォームを表示するか、運用担当者にもう一度尋ねて、リトライすればよいです。

**ファイル名衝突** (`xl3/filename/collision`):
異なるグループキーが sanitize 処理で同じファイル名になってしまったケースです(例: `東京/日本` と `東京:日本` の両方が `東京_日本.xlsx` に)。通常はテンプレートではなく運用担当者がデータを整理する必要がある問題です。

**XLOOKUP のソース不一致** (`xl3/xlookup/source-mismatch`):
テンプレート作成者が `XLOOKUP(x, A[k], B[v])` のように `A` と `B` が別ソースの式を書いたケースです。運用担当者の問題ではなくテンプレートを修正する必要があります。

**XLOOKUP マッチ失敗** (`xl3/xlookup/no-match`):
検索値が検索列に無いケースです。運用担当者のデータが不完全か、あるいはテンプレートで `@join` を使う方が良いかもしれません(マッチしなかった行は自動的に落ちます)。

## ロケール

`error.message` は英語です。多言語対応はホストで `error.code` を基準に分岐して独自メッセージを提供してください ― エンジンの英語文字列を直接翻訳しては**いけません**。英語テキストは conformance 契約の一部であり、fixture たちがその文字列の部分一致で検証します。

## 変換前に preview で検査

`preview(template, data, options)` は `convert` と同じパース/ディスパッチ段階を実行しますが、Excel ファイルはレンダリングしません。ホストに「Convert」ボタンの前に「Validate」ボタンがあるなら `preview` を呼んでください ― 速くて、同じエラーを捕まえて、xlsx 生成コストもかかりません。

```ts
const preview = await xl3.preview(template, data, options);
// preview.warnings: non-fatal issues
// preview.inputs: resolved input values (after defaults + coercion)
// preview.files / preview.sources: what convert() would produce
```

## スペックポインタ

- ADR-0015 ― 構造化エラーレポート。
- [`spec/evaluation.md`](/spec/evaluation) の「Errors」。
- 入力関連のエラーは [Cookbook 06](/guides/runtime-inputs) を参照。
