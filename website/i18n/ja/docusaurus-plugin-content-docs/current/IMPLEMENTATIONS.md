---
slug: /implementations
---

# XTL 実装一覧

[XTL 仕様](./spec/) の実装一覧です。xl3 がリファレンス実装です。

| 言語 | リポジトリ | パッケージ | 仕様バージョン | 適合性 | 備考 |
|---|---|---|---|---|---|
| TypeScript | [`xl3-lang/xl3`](https://github.com/xl3-lang/xl3) | [`@xl3-lang/xl3`](https://www.npmjs.com/package/@xl3-lang/xl3) | XTL 0.1(ドラフト) | リファレンス。**160/160** フィクスチャが通過(Stage 1 が 154 件 + Stage 2 のみ 6 件) | ブラウザ + Node ≥ 20.12;ランナーは `npx xl3-conformance`;CI で 3 タイムゾーンのマトリクスを実行 |
| Rust (WASM) | [`xl3-lang/xl3-rs`](https://github.com/xl3-lang/xl3-rs) | [`xl3-core`](https://crates.io/crates/xl3-core) + [`xl3-wasm`](https://www.npmjs.com/package/xl3-wasm) | XTL 0.1(ドラフト) | **partial 119/148** Stage 1(下の鮮度メモ参照) | 純 Rust の高速化コア(calamine + rust_xlsxwriter)をブラウザ / Node ホスト向けにラップ。xl3 0.9.0 で導入されたオプトインの `engine: 'wasm'` 経路を駆動。未対応: HYPERLINK 関数、共有数式、約 20 箇所のバリデーションエラー地点 |
| Python | [`xl3-lang/xl3-py`](https://github.com/xl3-lang/xl3-py) | _(未公開)_ | XTL 0.1(ドラフト) | 実行したコーパスに対して **133/133** Stage 1(下の鮮度メモ参照) | リファレンス実装と並走して追跡。[`conformance/reports/`](https://github.com/xl3-lang/xl3/tree/main/conformance/reports) 配下に `--report=json` のアーティファクトを置けば、`npm run conformance:dashboard` が拾います |

### レポートの鮮度

上記の 2 つの数値は [`conformance/reports/`](https://github.com/xl3-lang/xl3/tree/main/conformance/reports) にコミットされている JSON レポート由来で、**どちらも現在の 160 フィクスチャのコーパスより前**のものです:

| レポート | 対象コーパス | 結果 |
|---|---|---|
| `xl3-wasm-0.1.0.json`(2026-06-08) | 154 フィクスチャ | 119 通過、29 失敗、6 スキップ → 比較可能分で 119/148 |
| `xl3-py-0.1.0a3.json`(2026-05-23) | 139 フィクスチャ | 133 通過、0 失敗、6 スキップ |

コーパスが 160 に増えた後(フィクスチャ 158-161 が 0.9.0 / 0.10.0 で着地)は、どちらも再実行されていません。したがって **現在の** コーパスに対するポートの位置づけは、新しいレポートが提出されるまで不明です。ROADMAP の **G13** は、これらではなく最新のレポートで判定されます。

## 本番利用者

ROADMAP のゲート **G15** はこのセクションを指しています。掲載許諾のある外部企業、または公開事例研究とともに xl3 をスケジュール化された本番で運用しているメンテナ自身の雇用主 — そのいずれかで、名前の挙がった利用者が 1 件以上になった時点でチェックされます。

| 組織 | 開始 | ワークロード | 事例研究 |
|---|---|---|---|
| _まだ掲載なし_ | — | — | — |

G15 は **進行中** であり、ブロックされてはいません: メンテナの雇用主における本番デプロイが 2026-05-26 の週から稼働しています。事例研究が公開され、ここに行が入った時点でゲートがチェックされます — 稼働中のデプロイだけでは満たされません。このゲートの主眼は、第三者が検証できるリファレンスだからです。

xl3 を本番で使っていて名前を出してよい場合は、行を追加する PR を送ってください。詳細が一部だけ(組織 + ワークロードのみ、事例研究リンクなし)でも構いません — PR でそう伝えていただければ、行にその旨を記します。

## 実装の追加

まず [`PORTERS_GUIDE.md`](https://xl3.io/porters-guide) を読んでください — 仕様上の規範的要件と TS 実装に固有の都合を区別し、適合性コーパスに沿った推奨開発順を提示しています。

ここに移植を掲載するには:

1. 対象とする [適合性フィクスチャ](https://github.com/xl3-lang/xl3/tree/main/conformance/fixtures) を通過できる程度に XTL 0.1 を実装する。
2. [`conformance/runner-protocol.md`](/conformance/runner-protocol) に従って [`conformance/`](./conformance/) に対して実装を動かす。
3. 上の表に言語、パッケージ URL、対象とする仕様バージョン、適合性ステータス(full / partial / N of M フィクスチャ)を加える PR を送る。

積極的に開発中の移植も歓迎します — 適合性が部分的でも、進行中のリポジトリをリンクしてください。

## 仕様適合レベル

- **reference** — 本実装。宣言された仕様バージョンに対して定義上適合。
- **full** — 宣言された仕様バージョンの適合性フィクスチャをすべて通過。
- **partial(N/M)** — M 件中 N 件を通過。未対応のフィクスチャカテゴリを併記する。
- **draft** — 初期 WIP、適合性はまだ走らせていない。
