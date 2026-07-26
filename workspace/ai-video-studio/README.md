# AI 動画制作スタジオ

企画から最終レンダリングまでを一気通貫で実行する動画制作パイプライン。

```
企画 → 台本 → 素材生成 → モーション制作 → 実写編集 → 字幕 → 画面合成 → 最終レンダリング
```

## 構成ツール

| 工程 | 担当 |
|---|---|
| 企画 | Claude + Figma MCP |
| 台本 | Claude |
| 素材生成 | codex exec + GPT Image 2 |
| モーション制作 | HyperFrames（HTML→動画） / Kling（生成モーション） |
| 実写編集 | video-use（ffmpeg + 単語レベル ASR） |
| 字幕 | スタジオ内製（出力タイムライン基準の SRT 生成） |
| 画面合成・最終レンダリング | Remotion |

## 使い方

```bash
npm install
npm run studio -- doctor                                    # 依存チェック
npm run studio -- new demo --title "デモ" --brief "..."      # プロジェクト作成
npm run studio -- run demo                                  # パイプライン実行
npm run studio -- status demo                               # 進捗確認
```

## 押さえておくこと

**オーケストレータは agent 層の工程で必ず止まる。** これは失敗ではなく設計である。

Kling / Figma / video-use は MCP ないし Claude Code スキルとして提供されており、
Node の子プロセスからは呼べない。呼べるのは Claude 本体だけである。
そこで該当工程に到達すると、`project.json` の `agentTask` に作業指示を書き出して停止する
（exit code 2）。Claude がそれを実行して結果を書き戻し、`run` を再開すると続きから進む。

詳しくは [00_設計/アーキテクチャ.md](00_設計/アーキテクチャ.md) を参照。

## ディレクトリ

```
00_設計/          アーキテクチャ・セットアップ・パイプライン契約
01_AIスタッフ/     各工程の担当者定義
src/
  types.ts        project.json のスキーマ（全工程の契約）
  timeline.ts     合成の組み立てロジック（Node 非依存。工程7 と Remotion が共有）
  orchestrator.ts 工程の実行制御と agent 層での停止
  steps/          8 工程の実装
  adapters/       各ツールへの接続
remotion/         合成・レンダリングの Composition
projects/         プロジェクトごとの作業領域
```

## 関連リポジトリ

- [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) — HTML から動画を作る
- [browser-use/video-use](https://github.com/browser-use/video-use) — 実写編集スキル
- [remotion-dev/remotion](https://github.com/remotion-dev/remotion) — React で動画を作る
