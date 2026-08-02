---
sidebar_label: '19 · JXLS から xl3 へ'
pagination_label: '19 · JXLS から xl3 へ'
---

# 19 · JXLS から xl3 へ — JavaScript の選択肢

## シナリオ

チームが JVM 上で [JXLS](https://jxls.sourceforge.net/) を使って Excel
レポートを生成していて、同じことを Node.js やブラウザでも必要になった —
あるいは「JXLS for JavaScript」で検索したら `node-java` を包んだ 8 年前の
ラッパーしか見つからなかった、という状況です。xl3 はメンテナンスされて
いる答えです。スプレッドシート自身がテンプレートになる Excel-to-Excel
テンプレートエンジンです。

機能が偶然重なったわけではありません。xl3 の仕様は JXLS が約 10 年かけて
踏んだエッジケースを項目単位で取り込んでいます — 結合されたデータ行の
セル、名前付き範囲、印刷範囲、アウトラインレベル、複数行テキストには
それぞれ専用の ADR と適合性フィクスチャがあります。運用原則は
([ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship))
**JXLS の経験は借りる、構文は借りない** です。

## モデルの違いを表 1 つで

| | JXLS | xl3 |
|---|---|---|
| ディレクティブの置き場所 | セルの**コメント** (`jx:each(items="rows" lastCell="D4")`) — グリッド上では見えない | セルの**値** (`{{ @filter [Status] = "Open" }}`) — 見える、レビューできる、diff が取れる |
| 式言語 | JEXL (`${employee.payment * 1.1}`) — 新たに覚える 2 つ目の言語 | Excel の構文 (`{{ [Payment] * 1.1 }}`, `IF`, `XLOOKUP`, `SUM`) — テンプレート作成者がすでに知っているもの |
| データの供給元 | コードでバインドした Java オブジェクト (`context.putVar("employees", list)`) | 2 つ目の `.xlsx`、または stdin から渡す JSON — `render(template, data)` は純粋関数。同じ入力なら同じバイト列 |
| ブロックの境界 | 明示的な `lastCell="D4"` 座標 | `{{ ... }}` マーカーから推論（必要なら明示的に `{{ @block A:D }}`） |
| 抜け道 | カスタム Java コマンド — チューリング完全で移植不可 | 設計上なし — テンプレートはどの実装でもレンダリングできる引き継ぎ成果物のまま ([ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)) |

結果として、JXLS のテンプレートはセルのコメントと Java のバインディングを
編集できる人、つまり開発者が所有します。xl3 のテンプレートは
スプレッドシートを編集できる人が所有します。

## ディレクティブ対応表

| JXLS | xl3 での書き方 | 備考 |
|---|---|---|
| `jx:each(items="rows" var="r" lastCell=…)` | **データブロック** — `{{ [Column] }}` マーカーを含むテンプレート行 | ループ宣言そのものがありません。ブロックがソース行 1 行あたり出力 1 行に展開されます。[はじめに](/guides/getting-started) 参照 |
| `${r.name}` | `{{ [Name] }}` | ソース行の列参照 |
| `${r.amount * 1.1}` | `{{ [Amount] * 1.1 }}` | JEXL ではなく Excel の演算子 |
| セルに付けた `jx:if(condition=…)` | `{{ IF([Renewal] > 10000, "Priority", "Standard") }}` | [条件付きセル](/guides/conditional-cells) |
| 行を落とすために使った `jx:if` | `{{ @filter [Status] = "Open" }}` | 複数の `@filter` は AND で結合されます |
| `orderBy` 付きの `jx:each` | `{{ @sort [Total] desc }}` | |
| `groupBy` 付きの `jx:each` | `{{ @group [Region] }}` + `{{ @subtotal SUM([Renewal]) }}` | 小計行を間に挟み、N 段のネストにも対応 — [グループと小計](/guides/group-and-subtotal) |
| `jx:each(direction="RIGHT")` | `{{ @repeat right 3 }}` | |
| 複数コレクション | ブロックごとに `{{ @source Renewals }}`、そして `{{ @join Customers on Customers[Account] = Renewals[Account] }}` | [マルチソース + @join](/guides/multi-source-join) |
| `jx:multisheet` | パターンを**シート名**に入れます: `Region-{{ [Region] }}` | [グループごとのシート](/guides/sheet-per-group)。グループごとの*ファイル*は `output_file_pattern` で — [グループごとのファイル](/guides/file-per-group) |
| `jx:link` | `{{ HYPERLINK(url, label) }}` | [ADR-0039](https://xl3.io/spec/decisions/hyperlink-function) |
| `jx:params(formulas=…)` | 宣言するものはありません。テンプレート内のネイティブ Excel 数式はそのまま保持されます | [ADR-0046](https://xl3.io/spec/decisions/cell-formula-preservation) |
| 展開されたブロックに対する SUM | `{{ SUM([Renewal]) }}` の集計、または通常の Excel `=SUM(...)` 数式 | [集計](/guides/aggregates) |

## 意図的に引き継がないもの

xl3 は JXLS の機能 3 つを、理由を記録した上で却下しました。そのため
境界は「抜け」ではなく「決定」として残っています。

- **`jx:image`（データ駆動の画像挿入）** — 却下、
  [ADR-0037](https://xl3.io/spec/decisions/rejected-dynamic-image-insertion)。
  *テンプレートに配置された*画像はレンダリングを経ても残ります。データから
  画像を挿入することは、ブラウザで安全かつ決定論的なパイプラインに
  合いません。
- **`jx:updateCell`（実行時のセル変更）** — 却下、
  [ADR-0042](https://xl3.io/spec/decisions/rejected-runtime-cell-mutation)。
  `{{ ... }}` の置換がすでにその用途を満たしており、評価順序を観測可能に
  しません。
- **カスタムコマンド（ホスト言語の抜け道）** — 却下、
  [ADR-0034](https://xl3.io/spec/decisions/prior-art-relationship)。
  あなたの Java/JS ヘルパーを必要とするテンプレートは、別のチームや別の
  実装に渡せません。

JXLS のテンプレートがカスタムコマンドに依存している場合、そのロジックは
テンプレートではなく**データファイル**へ移ります — データを生成する側で
その列をあらかじめ計算してください。

## レンダー呼び出しの比較

JXLS (Java):

```java
List<Employee> employees = loadEmployees();
Context context = new Context();
context.putVar("employees", employees);
JxlsHelper.getInstance().processTemplate(templateStream, outStream, context);
```

xl3 (Node.js またはブラウザ):

```js
import { convert } from '@xl3-lang/xl3';

const outputs = await convert(templateBuffer, dataBuffer);
// outputs: [{ filename: 'renewal-report.xlsx', buffer }, ...]
```

バインドするコンテキストオブジェクトはありません。レンダーに必要なものは
すべて入力の中にあります。だから出力が再現可能で、ホストプログラムなしで
テンプレートをテストできます。

## JVM に留まったまま使う

レンダー処理を Node へ移すのは選択肢の一つにすぎません。サービスを JVM に
残すなら、CLI を呼び出せば済みます。データは今ある形のまま、中間の
ワークブックを作らずに JSON で渡します。

```java
// xl3-source-json/0.1 をプロセスへ書き込み、書き出されたファイルを読む。
Process p = new ProcessBuilder(
        "xl3", "render", "template.xlsx", "--data=-", "--out=./out/", "--json")
    .start();
p.getOutputStream().write(sourceJson.getBytes(StandardCharsets.UTF_8));
p.getOutputStream().close();

int exit = p.waitFor();   // 0 成功 · 1 変換エラー · 2 使い方の誤り
```

JSON は列指向です ― `headers` と配列の `rows`。そのため `List<Employee>` の
対応付けはワークブックの構築ではなくループ 1 つで終わります。

```json
{
  "version": "xl3-source-json/0.1",
  "sources": {
    "default": {
      "headers": ["従業員", "支給額"],
      "rows": [["キム", 4200], ["イ", 3900]]
    }
  }
}
```

終了コードが 0 以外のときは `--json` が stderr に失敗内容を出力し、その中の
安定した `error.code` で分岐できます ― コード一覧は
[Cookbook 13](./13-error-handling.md) にあります。リクエストごとに `npx` を
呼ぶとレジストリ参照が毎回発生するので、`npm i -g @xl3-lang/xl3` で一度
インストールしておくほうが適切です。

JXLS の運用形態にいちばん近い形です。サーバーに成果物を 1 つ入れておき、
アプリケーションコードから呼ぶ。引き継げないのは SPI の拡張点で、上記の節を
参照してください。

## 移行チェックリスト

1. **データをコードの外へ出す。** `putVar` していたものがソースになります。
   シートに書き出すか（コレクション 1 つにつき表 1 つ）、
   `xl3-source-json/0.1` の `sources` エントリ 1 つにします。すでに持って
   いるコレクションをシリアライズするのが通常唯一の実作業で、JSON なら
   読み戻すためだけにワークブックを書く手間を省けます。
2. **コメントを消してセルに書く。** 各 `jx:each` の領域は
   `{{ [Column] }}` マーカーからなる 1 行のデータブロックになります。
   `lastCell` の境界は消えます。
3. **JEXL を Excel の式に書き換える。** `${...}` の算術と条件分岐は
   `IF`／演算子とともに `{{ ... }}` へ 1:1 で対応します。
4. **グループ化を宣言的に組み直す。** `groupBy`／`orderBy` はブロック内の
   `@group`／`@sort`／`@subtotal` セルになります。
5. **実行して diff を取る。** `convert()` は決定論的です ― zip エントリの
   タイムスタンプまで含め、同じ入力なら同じバイト列になるので、ゴールデン
   ファイルテストが目視確認を置き換えます。バイト単位の再現性は 0.12.0 で
   入りました。0.11.0 以前では正規化したパートを比較してください
   （`npx xl3-conformance canonicalize out.xlsx`）。

インストールなしで、ブラウザ上でテンプレート 1 つ分の移行を試せます —
[xl3.io/try](https://xl3.io/try)。

あわせて参照: [ADR-0048](https://xl3.io/spec/decisions/jxls-boundary-final)
（最終的な JXLS 境界）、[`spec/language.md`](https://xl3.io/spec/language)
"Directives"。
