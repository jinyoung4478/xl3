---
slug: /spec/stability
---

# XTL 安定性ポリシー

## 現在の状況

XTL のバージョンは **0.1** です。リファレンス実装は npm 上で `@xl3-lang/xl3` として XTL 0.1 を配布しています。パッケージのバージョンは仕様のバージョンとは独立したタイムラインで動くため（[RELEASING.md](https://github.com/xl3-lang/xl3/blob/main/RELEASING.md) 参照）、ここでは固定しません。1.0 のカットは、外部からの検証材料が十分に集まるまで意図的に延期されています。少なくとも、適合性コーパスをパスする 2 つめの言語ポートと、本番運用での採用事例が 1 件以上必要です。それまでは 0.x の minor 更新間で破壊的変更が発生する可能性があり、その場合は影響を受ける ADR に記載する必要があります（**SHOULD**）。

1.0 で凍結される契約のドラフトは既に書き上がっています（下記「1.0 への道筋」参照）。延期されているのは、仕様が未完成だからではなく、コミットに必要な外部からのシグナルの蓄積を待っているためです。

## 0.x の期間中

- 仕様の破壊的変更は影響を受ける ADR に記載し、次の minor リリースまでに適合性コーパスへ反映します。
- リファレンス実装（npm 上の `xl3`）は自身の API について SemVer に従います。仕様の破壊的変更は spec の minor バージョンを上げます。
- 実装は、自分がターゲットとする仕様バージョンを宣言してください（例：`XTL 0.2 partial`、`XTL 0.3 full`）。

## 1.0 において

- 仕様は後方互換な進化のみを許す形で凍結されます。
- 仕様の破壊的変更には XTL 2.0 が必要で、公開での議論とマイグレーションガイドを伴います。
- リファレンス実装は厳密に SemVer に従います。

## 1.0 への道筋

1.0 のカットは、XTL の最初の portability contract（ポータビリティ契約）を確定させるものです。その意図は、任意の適合実装が凍結されたフィクスチャコーパスに対して、ホストのタイムゾーン・ロケール・バイトオーダに依らず、同一の出力（Stage 1）と同一の正規 OOXML（Stage 2）を生成することにあります。

### 公開 API サーフェス（xl3 リファレンス実装）

TypeScript リファレンス実装は、1.0 時点で次の 13 個のランタイムエクスポートを凍結します。新しいエクスポートを追加するのは後方互換ですが、これらのいずれかを削除・改名することは 2.0 でのみ許される変更です。

**変換エントリポイント**

- `convert(template, source, options?) → Promise<OutputFile[]>`
- `preview(template, source, options?) → Promise<PreviewResult>`
- `readTemplateInputs(template) → Promise<InputSpec[]>`
- `analyze(template) → Promise<ParsedTemplate>`
- `analyzeModel(template) → Promise<TemplateModel>`
- `packageZip(files) → Promise<Blob>`

**低レベルヘルパー**

- `readConfigSheet(workbook) → ConfigResult`
- `writeConfigSheet(workbook, meta) → void`
- `readInputsSheet(workbook, configVars?) → InputSpec[]`（オプションの `configVars` 引数は ADR-0050 に基づき 0.6.0 で追加されました。1 引数での呼び出しも引き続き有効です）
- `batchMatch(...)` — ファイルパターンマッチング用ヘルパー
- `toTemplateModel(parsed) → TemplateModel`

**エラーヘルパー（ADR-0015）**

- `xtlError(code, message) → XtlError`
- `isXtlError(value) → boolean`

**安定型の再エクスポート** — 1.0 時点で凍結：
`TemplateMeta`、`TemplateModel`、`OutputFile`、`PreviewResult`、`PreviewSource`、`PreviewFile`、`PreviewSheet`、`ConvertOptions`、`InputSpec`、`InputType`、`SourceSpec`、`XtlError`、`XtlErrorCode`、`XtlWarning`、`XtlWarningCode`。

**Experimental（試験的）型の再エクスポート**（ROADMAP G22）— ツール用にエクスポートされていますが、その形状は minor バージョン間で変更される可能性があります（**MAY**）：
`ParsedTemplate`、`SheetTemplate`、`TemplateVariable`、`DataBlock`、`Directive`、`FilterDirective`、`FilterOp`、`SortDirective`、`TopDirective`、`RepeatDirective`、`SourceDirective`、`JoinDirective`。

各 experimental 型は JSDoc に `@experimental` タグを持っています。これらのオブジェクトを保持するホストは、`kind` でディスパッチする（ディレクティブの場合）か、形状を不透明として扱うべきであり（**SHOULD**）、特定のフィールド集合に依存する場合は xl3 の minor バージョンを固定すべきです（**SHOULD**）。多くのツール用途においてシリアライズ可能でゆっくり変化する代替手段は `TemplateModel`（`analyzeModel` の戻り値）です。

`impl/js/src/__tests__/api-surface.test.ts` のスナップショットテストはランタイムリストを固定し、サイレントな変更があれば CI で失敗させます。新しいエクスポートを追加するには、スナップショットの意図的な更新と CHANGELOG エントリの両方が必要です。

### 1.0 で凍結される内容

次の ADR がカバーするサーフェスは 1.0 契約の一部です。これらに対する破壊的変更は XTL 2.0 のカットを必要とします。

- ADR-0001 — `TODAY()` の UTC セマンティクス
- ADR-0002 — 出力ファイル名のサニタイズ
- ADR-0003 — numFmt 駆動の型変換
- ADR-0005 — 動的適合性アサーションプロトコル
- ADR-0006 — Stage 2 の正規 OOXML 比較（ルール 1-8 + ギャップ項目を列挙する amendment）
- ADR-0007 — 空値述語
- ADR-0008 — truthiness ルール
- ADR-0009 + ADR-0017 — 比較アルゴリズムとソース値モデル（1 つの契約として併読）
- ADR-0010 + ADR-0011 — 実行時入力と予約シートの命名
- ADR-0012 — マルチソースデータモデル
- ADR-0013 — XLOOKUP のクロスソース検索
- ADR-0014 — `@join` ブロックレベルペアリング（単一 inner join、決定論的な first-match）
- ADR-0015 — 構造化エラー報告（`xl3/...` コード + 英語の適合性メッセージ）
- ADR-0016 — 順序付けとソート安定性
- ADR-0033 — 結合セルのソースヘッダー
- ADR-0035 — データ行の結合セルブロードキャスト
- ADR-0036 — テンプレート機能保存マトリクス
- ADR-0038 — `@group` + `@subtotal` ディレクティブ（小計行のインターリーブ出力）
- ADR-0039 — `HYPERLINK` セル出力
- ADR-0040 — 保存マトリクス amendment（outline level は出荷済み；CF/DV 範囲の PE は 0.6.1 で保留）
- ADR-0041 — 複数行セルテキスト契約
- ADR-0044 — 関数バッチ（UPPER, LOWER, TRIM, IFERROR, IFS, DATE）
- ADR-0046 — セル数式の保存（OOXML エレメント契約）
- ADR-0047 — `ISBLANK` は `IFEMPTY` のエイリアス
- ADR-0050 — `__inputs__` の `default`/`label`/`description`/`options` を XTL テンプレートとして扱う
- ADR-0051 — `{{ ... }}` ブロック区切り境界 + 不整合リテラルの検出
- ADR-0052 — 単一式 vs. 混在テキストセルの分類（トリム後にアンカーマッチ；隣接ブロックは常に混在テキスト）
- ADR-0053 — Excel エラー sentinel の混在テキストへの伝播
- ADR-0054 — セル / ファイル / シートパターン中の裸の名前（ショートハンド解決 + `xl3/expression/unknown-name`）
- ADR-0055 — `@top` / `@repeat right` の正整数文法
- ADR-0056 — `__config__[system-key]` 読み込みポリシー
- ADR-0057 — `@filter in/!in` 以外の場所での `__lists__[name]` の拒否
- ADR-0058 — `@subtotal` 行構成（同一行レベルバインディング）
- ADR-0059 — 集計関数の引数形状（列参照のみ）
- ADR-0060 — `XLOOKUP` の value / fallback 引数ルール（fallback は遅延評価）
- ADR-0061 — ソース名 vs. 関数名の字句的曖昧性解消（ADR-0024 の拡張パススルーを保つ）
- ADR-0062 — `__inputs__` の `default = ""` セマンティクス
- ADR-0063 — `__inputs__` の `options` のパイプ分割ルール
- ADR-0064 — String→Number 強制のスコープ（指数表記は受理；hex / binary / octal は拒否）
- ADR-0065 — `@source default` の明示形式 + ソース名の大文字小文字感度
- ADR-0021（group-order amendment）— `@sort` にマッチしないグループ順序は実装定義
- ADR-0041（header amendment）— ヘッダーセルの改行正規化

ADR-0043 と ADR-0048 は **process-normative（プロセス規範的）** — 将来の ADR 著者を縛りますが、ランタイム契約は縛りません。ADR-0034 と ADR-0049 は informational です。ADR-0004 は informational（リファレンス実装結合監査）です。ADR-0037、ADR-0042、ADR-0045 は rejected（拒絶こそが契約）です。

### 1.0 に含まれないもの

以下は意図的に延期されています。これらを追加することは後方互換であり、新たな仕様 major を必要としません。

- 1 ブロック内の複数 `@join` ディレクティブ、`@join … left` セマンティクス、複数行 join マッチ（ADR-0014 の明示的な out-of-scope リスト）。
- XLOOKUP のワイルドカード、近似、逆方向検索モード（ADR-0013 の明示的な out-of-scope リスト）。
- ロケール対応の文字列照合。ソートは Unicode コードポイント順を使います。ロケール照合が必要なホストは上流で事前ソートしてください。
- 日付／日時演算関数（`EOMONTH`、`EDATE`、`DATEDIF` 等はありません）。
- ADR-0006 amendment のギャップ項目に対するクロスライター正規化（デフォルト属性の等価性、色 hex の大小文字、namespace prefix バインディング）。
- ADR-0010 / ADR-0012 のホスト API サーフェスを超える、入力・ソース・出力の規範的なワイヤフォーマット。

### 適合性ベースライン

1.0 適合性コーパスは、`spec_version: "0.1"` でタグ付けされたフィクスチャの和集合に、1.0 カット前に追加されたものを加えたものです。コーパスは次の条件を満たす必要があります：

1. Stage 1 のセル値比較。
2. `comparison_stage: 2` を宣言するフィクスチャに対する Stage 2 の正規 OOXML 比較。
3. 少なくとも 3 つのタイムゾーン（`UTC`、`America/New_York`、`Asia/Seoul`）下での Stage 1 — リファレンスリポジトリの CI ワークフローはこのマトリクスを実行します。ポートも同様にすべきです（**SHOULD**）。

1.0 を主張する実装は、このコーパスに対する適合性ランの結果を報告しなければならず（**MUST**）、ランナーがサポートする比較ステージよりも高いステージで宣言されたフィクスチャ以外をスキップしてはなりません（**MUST NOT**）。

## Core vs. extensions（コアと拡張）

仕様は次のように区別します：

- **Core（コア）** — 適合性に必要な言語機能。[`README.md`](/spec) で要約され、[`language.md`](/spec/language) と [`evaluation.md`](/spec/evaluation) で定義されています。ここでの破壊的変更は spec-version イベントです。
- **Extensions（拡張）** — 実装固有または領域固有の追加。実装ごとに異なってよいものです。仕様ではなく、実装の README に文書化されます。

実装は拡張を追加してもよいですが（**MAY**）、コアのセマンティクスを暗黙のうちに変更してはなりません（**MUST NOT**）。

例えば、実装は XTL 0.1 のコア表を超える追加の `TEXT()` 書式をサポートしてもかまいません。そうした書式は拡張です：ポータブルなテンプレートはそれらに依存すべきではなく、適合性フィクスチャもそれらについて同一の出力を要求しません。

## 適合性コーパスのバージョニング

適合性コーパスのバージョンは仕様バージョンを追跡します。spec 0.3 で追加されたフィクスチャはそのようにタグ付けされ、実装は自身がパスするフィクスチャを宣言することで、結果的に自身が適合する仕様バージョンを示します。

## 廃止ポリシー（1.0 以降）

機能を将来の major バージョンで削除する場合：

1. 削除前に少なくとも 1 つの minor バージョンに渡って、仕様上で **deprecated（非推奨）** とマーキングされます。
2. 非推奨機能を使う適合性フィクスチャには `deprecated` タグが付きます。
3. 実装は、非推奨機能の使用時に警告を出すことが推奨されます。
4. 削除は次の major で行われます（例：1.3 で deprecated → 2.0 で削除）。
