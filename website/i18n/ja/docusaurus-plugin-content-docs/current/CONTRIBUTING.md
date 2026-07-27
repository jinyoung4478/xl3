---
slug: /contributing
---

# xl3 へのコントリビュート

xl3 は [XTL 仕様](./spec/) の TypeScript リファレンス実装です。本書では、実装と仕様の双方に対するコントリビューションの経路を扱います。

0.x の期間中、本プロジェクトは単一の著者によって維持されています。コントリビューションは歓迎しますが、仕様変更のバーは高いです — XTL は安定した言語非依存の標準を目指しているためです。

意思決定の流れは [GOVERNANCE.md](/governance) を、1.0 リリースを阻むものは [ROADMAP.md](/roadmap) を参照してください。

## クイックスタート

```bash
git clone https://github.com/xl3-lang/xl3.git
cd xl3
npm install
npm test
```

## 3 種類のコントリビューション

### 1. 実装バグ(このリポジトリ、`impl/js/src/`)

仕様と食い違うリファレンス実装のバグはいつでも歓迎します。手順:

1. 最小再現(template.xlsx + data.xlsx + 観測出力 vs 期待出力)を添えてイシューを立てる。
2. 修正があれば、`impl/js/src/__tests__/` にリグレッションテストを添えて PR を送る。

バグが「実装は仕様に従っているが仕様の方が誤っている」というものであれば、(3) を参照してください。

### 2. 仕様の質問と明確化(`spec/`)

仕様は規範的です。仕様化が不十分な挙動を見つけた場合:

1. `spec` タグでイシューを立てる。
2. 答えが小さいもの(誤字、明確化)なら、PR も歓迎です。
3. 答えが設計判断を要するなら、メンテナが [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) に ADR を起草します。

### 3. 適合性フィクスチャ(`conformance/fixtures/`)

適合性コーパスは XTL の実行可能な定義です。ここのフィクスチャは個々の実装より長く生き残ります。**作成前に [`conformance/AUTHORING.md`](/conformance/authoring) を読んでください。**

基本ルール: **期待出力は仕様から書き起こすものであり、JS 実装から生成するものではありません。** JS 実装の挙動をただ記録するだけのフィクスチャは、その実装を事実上の仕様として凍結してしまいます — XTL がまさに避けたい状態です。

### 4. 他言語への移植

他言語の実装は歓迎し、[IMPLEMENTATIONS.md](/implementations) に追跡しています。移植を掲載するには:

1. JS 実装ではなく仕様に対して実装する。
2. [`conformance/runner-protocol.md`](/conformance/runner-protocol) に従って実装を適合性コーパスにかける。
3. `IMPLEMENTATIONS.md` に行を追加する PR を送る。

## コーディング規約(TypeScript 実装)

- TypeScript の strict モードを有効化済み。PR は型チェックを通す必要があります(`npm run typecheck`)。
- テストは `impl/js/src/__tests__/` にあります。`npm test` で実行できます。
- 新機能にはテストが必要。バグ修正にはリグレッションテストが必要。
- 必要でない限りランタイム依存を増やさないでください。現在の依存: `exceljs`、`jszip`。

## コミットメッセージ

可能な範囲で [Conventional Commits](https://www.conventionalcommits.org/) を使用してください:

- `feat:` — 実装への新機能
- `fix:` — 実装のバグ修正
- `spec:` — `spec/` 配下の仕様テキストの変更
- `conformance:` — フィクスチャコーパスやランナープロトコルの変更
- `docs:` — README、CONTRIBUTING など
- `chore:` — ツール、CI、依存
- `test:` — 実装のテストのみの変更

破壊的変更には `!` を付けます(例: `feat!: rename count to rowcount`)。

## 0.x 中の仕様変更

0.x の期間中、仕様の破壊的変更は許可されていますが、以下を満たす必要があります。

1. [`spec/decisions/`](https://github.com/xl3-lang/xl3/tree/main/spec/decisions) 配下に `status: accepted` の ADR で動機付けられていること。
2. 仕様のマイナーバージョンを上げること(`0.1` → `0.2`)。
3. `conformance/fixtures/` のフィクスチャ更新と同時に着地すること。

1.0 以降は、仕様の破壊的変更は移行ガイドを伴った XTL 2.0 を要します。

## リリース(メンテナのみ)

1. リリース対象として進行中の ADR をすべて解決する。
2. `CHANGELOG.md` を更新する。
3. `package.json` のバージョンを上げる。
4. `npm publish` を実行する(`prepublishOnly` が typecheck + tests + build を実行することでゲートされる)。
5. コミットにタグを打つ(`git tag v0.1.0 && git push --tags`)。

## はじめてのコントリビューションに向いた候補

特定の困りごとはないが貢献したい場合は、これらがもっともレバレッジの高い候補です。それぞれが [ROADMAP.md](/roadmap) 上の 1.0 ブロッカーに対応しています。

1. **適合性フィクスチャを提案する。** まだフィクスチャを持たない仕様ルールに対して、**「Conformance fixture proposal」** のイシューテンプレートを利用してください。フィクスチャ自体の作成に TypeScript は不要 — `template.xlsx` + `data.xlsx` + 期待出力(あるいは期待エラー)だけで構いません。
2. **ガイドの翻訳。** [`docs/guides/`](/guides) の 15 レシピから 1 つを選び、韓国語(あるいは他の任意の言語)に翻訳してください。ファイルを `docs/guides/<lang>/NN-*.md` に置き、PR を送るだけです。調整コストが低く価値の高い貢献です。
3. **xl3 を実データのレポートに使い、引っかかった点を報告する。** `early-adopter-feedback` タグで短いイシューを立て、試したレポート、うまくいったこと、いかなかったこと、XTL に欲しかったものを書いてください。これが 1.0 の中身を形作ります。
4. **仕様の明確化。** 仕様を読んで曖昧な文を見つけたら、`spec` タグで該当文と妥当な 2 種類の解釈を添えてイシューを立てください。受理されない報告でも、たいてい仕様改善のきっかけになります。
5. **移植の進捗。** [xl3-py](https://github.com/jinyoung4478/xl3-py) や他のポートに取り組んでいるなら、[`conformance/runner-protocol.md`](/conformance/runner-protocol) に書式が定義されている `conformance/reports/<impl>-<version>.json` を投入してください。ダッシュボードが自動で取り込みます。

## 行動規範

敬意を払って接してください。技術判断についての反対意見は歓迎しますが、人格攻撃は許されません。
