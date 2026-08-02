# xl3 — Excel の帳票を、コードではなくテンプレートで

> 変換ロジックは Excel ファイルの中で直接直せます。データを渡せば実行され、
> 書式はそのまま、結果は毎回同じです。Jinja が HTML をテンプレートにした
> ように、**xl3 は Excel ワークブックを実行可能なテンプレートにします** —
> 単一のライブラリではなく、実装に依存しないオープンな標準として。

**ステータス:** alpha · **XTL spec 0.1 (draft)** · リファレンス実装
`@xl3-lang/xl3` 0.11.0 · 1.0 までは breaking change の可能性あり

**xl3** は、普通の `.xlsx` ワークブックを決定論的で宣言的な変換テンプレート
に変えるためのオープンな標準です。レイアウト・スタイル・結合セル・ルールは
*ワークブックの中* に置かれ、仕様に準拠したエンジンであればどれでも、
与えられたデータに対してそれを実行します — 同じ入力なら常に同じ出力。この
リポジトリがその標準を 3 つの要素で *定義* します:

- **[スペック](./spec/)** — 規範的定義。ワークブックが書き出される *前* に
  確定していなければならないもの(フィルタ・グループ・集計・ファイル名
  パターン)のための小さな埋め込み式言語 **XTL** と設計記録 (ADR) を含む。
- **[Conformance スイート](./conformance/)** — どの実装も準拠を証明する
  ために実行する言語非依存の fixture 群。
- **リファレンス実装** —
  [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3)
  (TypeScript、[`impl/js/`](./impl/js/)) — 複数ある[実装](./IMPLEMENTATIONS.md)の
  一つ (Rust/WASM・Python は進行中)。

**3 つの名前、1 つのスタック:** **xl3** = 標準(このフォーマット) · **XTL**
= その埋め込み式言語 · **`@xl3-lang/xl3`** = その TypeScript リファレンス
実装。

月次レポート・見積書・取引明細・財務ワークブックのような繰り返しの Excel
文書を、Excel で編集できる形に保ちながら、実行は決定論的で検査・検証
可能にしたい場合に向いています。AI による作成にも向いています。LLM は、
数百行のワークブック API コードよりも、小さなテンプレート契約を安定して
生成しやすいからです。

[English](./README.md) · [한국어](./README.ko.md) · **日本語** · [简体中文](./README.zh-CN.md) · [Website](https://xl3.io) · [Spec](./spec) · [LLM authoring guide](./docs/llm-template-authoring.md) · [Implementations](./IMPLEMENTATIONS.md) · [Roadmap](./ROADMAP.md) · [Governance](./GOVERNANCE.md)

---

## 役割分担: Excel がテンプレートで、xl3 が実行する

```text
  ┌──────────────────────────┐
  │  業務担当 / デザイナー   │
  │  Excel でレイアウト編集  │
  └─────────────┬────────────┘
                │ template.xlsx
                ▼
  ┌──────────────────────────┐       ┌──────────────────────────┐
  │     開発者アプリ         │       │           xl3            │
  │     data + inputs を渡す ├──────►│    テンプレートを実行    │
  └──────────────────────────┘       └─────────────┬────────────┘
                                                    │
                                                    ▼
                                             result.xlsx
```

ワークブック API はスプレッドシートにおける DOM API のようなものです。
強力ですが冗長です。繰り返し使う文書では、ワークブック自体が View であり
テンプレート契約であるべきです。xl3 は、アプリケーションがデータを渡し、
Excel がレイアウトと業務ルールを持つ形にします。

この役割分担こそが、[`docs/llm-template-authoring.md`](./docs/llm-template-authoring.md)、
169 件の conformance fixture コーパス、そして意図的に小さく保たれた
XTL の表面が想定している対象です。

## 簡単な例

テンプレートには通常の Excel コンテンツ、`__config__`、xl3 の式を同居させられます。

| `__config__` キー | 値 |
|---|---|
| `source_sheet` | `元データ` |
| `source_table` | `1` |
| `output_file_pattern` | `取引先-更新レポート.xlsx` |

| セル | テンプレート値 |
|---|---|
| A5 | `{{ [取引先] }}` |
| B5 | `{{ [地域] }}` |
| C5 | `{{ [更新金額] }}` |
| E5 | `{{ IF([更新金額] > 10000, "優先", "標準") }}` |

データワークブックが次のような内容だとすると:

| 取引先 | 地域 | 更新金額 | 担当者 |
|---|---|---:|---|
| アクメ商事 | 東京 | 18400 | 美咲 |
| ベータワークス | 大阪 | 7200 | 健太 |

xl3 は次のように出力します。

| 取引先 | 地域 | 更新金額 | 担当者 | ランク |
|---|---|---:|---|---|
| アクメ商事 | 東京 | 18400 | 美咲 | 優先 |
| ベータワークス | 大阪 | 7200 | 健太 | 標準 |

…テンプレートの数値書式、塗りつぶし、罫線、結合ヘッダ、フッタ行などは
そのまま保たれます。出力は Excel、Numbers、Google Sheets で変換なしに
そのまま開ける `.xlsx` です。

何が保持され、何が保持されないかは
[サポート範囲のドキュメント](./docs/support-matrix.md)に機能ごとにまとめて
あります。1.1 に先送りした 4 機能とサイズ上限も同じページにあります。

言語仕様のドラフトは [`spec/`](./spec) に、実装に依存しない fixture
コーパスとランナープロトコルは [`conformance/`](./conformance) にあります。

## なぜ Excel がテンプレートであるべきなのか

一文で言えば — **レポートのレイアウトはすでに Excel の中にあります。**
そのレイアウトをコードへ移すと、行追加、スタイル変更、結合セルの調整、
小計ルールの変更まで、すべてがデプロイになります。xl3 はレイアウトを
Excel に残し、ワークブックを実行可能にします。アプリケーションはデータと
デプロイを担当し、テンプレートは繰り返し使う文書契約を担当します。

具体的には:

- **小さく監査可能な XTL の表面 (ADR-0043)。** XTL に関数が存在するのは、
  その値がワークブック書き出し *前* に確定している必要がある場合に
  限ります。それ以外はすべて普通の Excel セル数式とし、Excel が開いた
  時点で評価します。言語が小さければ、人間がレビューしやすく、
  AI も下書きしやすくなります。並べて見たい場合は
  [Cookbook 16](./docs/guides/16-xtl-vs-excel-formula.md) を参照して
  ください。
- **Conformance コーパス。** 169 件の fixture、すべて green、77 件の
  ADR を網羅。変換契約を実行可能な形で検証するテストベッドです。
- **実装は 1 つ、仕様は 1 つ。** [`spec/`](./spec) ディレクトリは XTL を
  この TypeScript リファレンス実装から独立に定義しています。他ランタイム
  への移植は歓迎します。契約はコーパスです。
- **マクロなし、ベンダークラウドなし。** テンプレートは普通の `.xlsx`
  です。差分を取り、pull request でレビューし、xl3 のことを知らない
  人間レビュアーにも渡せます。

同じ性質は、**LLM がループに入っていなくても** xl3 を有用にします — 運用者や
アナリストはテンプレートを直接読み書きできます。式は彼らが日常的に使っている
`IF`、`SUM`、列参照と同じ語彙で書かれているからです。AI との相性は、
小さく、宣言的で、レビューしやすいルール形式にした結果です。

## 責任駆動の文書自動化

多くの Excel 自動化ツールは、開発者の生産性を高めることに集中します。
xl3 の狙いは別です。これまで開発者が担当していた繰り返し文書の変更を、
運用担当が直接扱えるようにすることです。

従来のモデルでは、レイアウト変更、列追加、繰り返しロジックの調整、
出力形式の変更がすべて開発依頼とデプロイになります。xl3 は責任を
次のように分けます。

```text
Developer  -> Runtime maintenance
Operator   -> Template maintenance
Business   -> Result usage
```

開発者はエンジン、バリデーション、連携、デプロイの信頼性を担当します。
運用担当は Excel テンプレートと、文書ごとの変換ルールを直接管理します。
ビジネス側は生成されたワークブックを利用します。

これは理論だけではありません。xl3 は実際の社内サービスで数か月運用され、
非開発者がテンプレートと変換ルールを Excel の中で維持できることを確認して
きました。開発リソースはほぼ Runtime 改善に集中でき、減ったのはコード量
だけでなく、開発者が必ず行わなければならない仕事そのものでした。

そのため XTL は可能な限り Excel の構文を保ちます。目指す体験は
「新しい言語を学ぶ」ではなく、「いつもの Excel を少し強力に使う」です。
xl3 は開発者を置き換えるプロジェクトではありません。開発者は Runtime を
作り、運用担当は Template を管理します。文書自動化の所有権を、開発者だけ
から運用組織へ広げる Runtime です。

## 他のアプローチとの比較

| アプローチ | 得意な領域 | トレードオフ |
|---|---|---|
| **xl3** | 宣言的な Excel テンプレート実行。ワークブックはすでに存在し、xl3 はデータを渡してそれを実行します。 | Alpha 段階。メンテナー 1 名。XTL の表面は意図的に小さく、1.0 までは進化中。 |
| ワークブック API (ExcelJS / SheetJS / openpyxl / Apache POI) | コードからの低レベルまたは高機能なワークブック生成。 | レイアウト、スタイル、結合、繰り返し、業務ルールがアプリケーションコードになります。非開発者が安全にテンプレートを編集しにくくなります。 |
| Python / VBA スクリプト | 既存スプレッドシートに近い、素早い使い捨て自動化。 | ルールがコードや担当者 1 人の頭の中に残りやすく、レイアウト変更にもコード変更が必要です。 |
| Power Query / Office Scripts / Power Automate | Microsoft 365 ワークフロー、データ整形、Excel エコシステム内でのアクション自動化。 | テナント拘束で、ワークフロールールはワークブックと一緒に旅をしない。 |
| JXLS / xltpl / jsreport xlsx recipe | スプレッドシート風テンプレートからのサーバーサイドレポート生成。 | 有用な先行事例ですが、特定ランタイムに縛られやすく、小さく可搬な Excel ルール形式としては位置づけられていません。 |
| ドキュメント生成 SaaS (Plumsail、Conga、Formstack) | マネージド文書ワークフロー、外部連携、承認、配信。 | ルールはベンダーサービス内に残り、自分たちでレビューして実行できる可搬なワークブックテンプレートではありません。 |
| LLM から直接 xlsx を生成 | 探索的なドラフト作成、一回限りの図表。 | 繰り返しの運用業務に使う決定論的な変換契約には向きません。 |

## インストール

```bash
npm install @xl3-lang/xl3
```

## 使い方

```ts
import { convert } from '@xl3-lang/xl3';

const templateBuffer = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
const dataBuffer = await fetch('./data.xlsx').then((r) => r.arrayBuffer());

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: OutputFile[] — テンプレートのグルーピングルールに応じて 1 つ以上の .xlsx
```

ブラウザと Node (20.12 以上) で動作します。

### `data.xlsx` の代わりに JSON ソース

Excel 以外のホスト(Python サービス、DB/ETL ジョブ)は、ワークブックの往復を
省略し、言語非依存の `xl3-source-json/0.1` ワイヤフォーマットをそのまま
渡せます。`convertJson` は、同等の `data.xlsx` に対する `convert` と
まったく同じ出力をレンダリングします。

```ts
import { convertJson } from '@xl3-lang/xl3';

const outputs = await convertJson(templateBuffer, {
  version: 'xl3-source-json/0.1',
  sources: {
    default: { headers: ['Customer', 'Amount'], rows: [['Acme', 100]] },
  },
});
```

preview 側の対応物は `previewJson` です。不正な入力は
`xl3/source-json/invalid` を送出します。0.11.0 で
[ADR-0075](./spec/decisions/0075-xl3-source-json.md) として追加され、
ワイヤフォーマットは実装間で可搬、`.xlsx` の経路は変更ありません。

### バンドラなしの `<script>` での利用

バンドラを使わないプロジェクト向けに、自己完結型の IIFE バンドルを提供しています。読み込むと `window.xl3` として利用できます。

```html
<script src="https://cdn.jsdelivr.net/npm/@xl3-lang/xl3@0.11.0/dist/xl3.bundle.iife.min.js"></script>
<script>
  const tpl = await fetch('./template.xlsx').then((r) => r.arrayBuffer());
  const data = await fetch('./data.xlsx').then((r) => r.arrayBuffer());
  const outputs = await xl3.convert(tpl, data);
</script>
```

バンドルサイズは約 1 MB (minified、gzip で約 300 KB) です。ExcelJS と JSZip がインライン化されているため、他に依存はありません。

ブラウザでのフローは [xl3.io](https://xl3.io) でそのまま試せます。添付のサンプルファイルをそのまま実行することも、元データ/テンプレートのワークブックをダウンロードして調べることも、どちらかを自分のファイルに差し替えて動かすこともできます。

### Excel バージョン互換性

xl3 は `.xlsx` ファイルを OOXML 経由で読み取り、設計上はおおむねバージョン非依存です — キャッシュ済みの数式結果を読み、日付を UTC で正規化し、セル値層では OOXML のシリアライズ差異を無視します。完全なマトリックスは [ADR-0022](./spec/decisions/0022-excel-version-compatibility.md) を参照してください。要点を言えば、動的なものはすべて XTL の `{{ ... }}` 文法に寄せ、データブロック内ではグラフ/ピボット/ネイティブ数式を避け、組織として日付システム (1900) を 1 つに統一する、ということです。

テンプレートは、非表示の `__config__` シートでソーステーブルを指定します。

| キー | 例 | 意味 |
|---|---|---|
| `source_sheet` | `元データ` | ソースワークシート名、または `*` で終わる接頭辞パターン |
| `source_table` | `1` | 1 行目を列名として読み、その下を行データとして扱う |
| `source_table` | `A1:D` | A1-D1 を列名として読み、その下を行データとして扱う |
| `source_table` | `A1:D200` | A1-D1 を列名として読み、A2-D200 領域を行データとして扱う |

ソースの N 行目に列名が並ぶ一般的なケースでは `source_table = N` の一行で済みます。テーブルが途中の列から始まる、または終了行を制限したい場合にだけ範囲形式を使います。

### 予約シート

テンプレートは、両端をダブルアンダースコアで囲まれた 4 つの予約シートを使います (ADR-0011 に準拠)。

| シート | 用途 |
|---|---|
| `__config__` | テンプレート作成者が定義する設定と値辞書。`{{ __config__[name] }}` で参照 |
| `__inputs__` | 実行時にホストが渡す値 (ADR-0010)。`name`/`type`/`default`/`label`/`description`/`options` 列で宣言 |
| `__sources__` | デフォルトの `source_sheet` 以外で使う名前付きデータソース (ADR-0012)。`name`/`sheet`/`table`/`description` 列で宣言 |
| `__lists__` | `@filter [field] in __lists__[name]` などで使うメンバーシップリスト |

作成者が `^__[a-z]+__$` パターンに一致するシート名を付けると、パース時点で拒否されます。

### マルチソースデータ

デフォルトの `source_sheet` 以外にも、テンプレートは `__sources__` で名前付きソースを宣言し、Excel の構造化参照形式で参照できます。

```text
{{ Customers[Account] }}
{{ SUM(Renewals[Amount]) }}
{{ XLOOKUP([Account], Customers[Account], Customers[Name]) }}
```

`@source <Name>` はデータブロックのデフォルトソースを `<Name>` に切り替え、ブラケット短縮形 (`[Column]`) も `<Name>` を基準に解決されるようにします。`@join` は 2 つ目のソースの行を、キーをもとに主たる行とペアリングします (inner-join、最初のマッチを採用)。完全なディレクティブ文法は [`spec/language.md`](./spec/language.md) を参照してください。

### ランタイム入力

実行ごとの値 (対象月、取引先フィルタ、ラベルなど) が必要なテンプレートは、それらを `__inputs__` で宣言し、ホスト側が `convert(...)` に渡します。

```ts
await convert(templateBuffer, dataBuffer, {
  inputs: { month: '2026-05', region: '東京' },
});
```

入力値はセル (`{{ __inputs__[month] }}`)、ファイル名パターン、グループキーへ流れ込みます。

## サンプル

実運用に近い形のテンプレートが 4 つ [`examples/`](./examples) にあります: 基本的な更新レポート、地域ごとのシート分割 + リストフィルタ、ランタイム入力付きのマルチソース join、そして `@group` + `@subtotal` のカテゴリ別小計を示すカフェ週次レポート。`npm run examples:build && npm run examples:run` で実行できます。

## ガイド

よくあるワークフロー向けの短いコピー & ペースト用レシピは [`docs/guides/`](./docs/guides) にあります。レシピは 18 本あり、入門、条件分岐、集計、ファイル/シート単位のグルーピング、ランタイム入力、join、`XLOOKUP`、ソート/トップ N、スタイリング、複数行テキスト、空値、エラーハンドリング、`__config__` 値、ディレクティブ組み合わせ、XTL と Excel 数式の使い分け、テンプレート作成時の表示、`@group` / `@subtotal` までを網羅しています。

## Spec

XTL の仕様は言語中立で、[`spec/`](./spec) にあります。このリポジトリは TypeScript リファレンス実装を提供します。他言語への移植も歓迎します — 詳細は [IMPLEMENTATIONS.md](./IMPLEMENTATIONS.md) を参照してください。

Conformance コーパスはローカルで実行できます。

```bash
npm run conformance
npm run conformance:stage2
```

最新のリファレンス実装の実行サマリと、[`conformance/reports/`](./conformance/reports/) に置かれた外部ポートのレポート列は、[`conformance/DASHBOARD.md`](./conformance/DASHBOARD.md) にまとまっています。`npm run conformance:dashboard` で再生成できます。

## プロジェクト構造

- `spec/` — 規範的な XTL 言語ドラフト。
- `conformance/` — 実装に依存しない fixture コーパスとランナープロトコル。
- `impl/js/src/` — TypeScript リファレンス実装。

仕様 (spec) が真の出典です。Conformance fixture は仕様の挙動を実行可能な形で固定します。リファレンス実装は有用ですが、それ自体は規範ではありません。

## ライセンス

- コード (`impl/js/src/`、`conformance/`): [MIT](./LICENSE)
- XTL 仕様 (`spec/`): [CC-BY-4.0](./spec/LICENSE)

---

Microsoft および Excel は Microsoft Corporation の商標です。xl3 は Microsoft とは関係ありません。Office Open XML 形式 (`.xlsx`) は ISO/IEC 29500 として公開されています。
