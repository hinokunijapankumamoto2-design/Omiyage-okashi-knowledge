# AI 動画制作スタジオ — Claude 向け運用規約

このディレクトリで作業するとき、Claude は**パイプラインの agent 層の実行者**である。
script 層は CLI が回すので手を出さない。

## 最初にやること

```bash
npm run studio -- status <projectId>
```

`agentTask` が入っていれば、それが自分への作業指示である。何をすべきかはそこに書いてある。

## 役割分担

| 自分（Claude）がやる | CLI がやる |
|---|---|
| 企画の策定（工程1） | 素材生成（工程3・codex exec） |
| 台本と shots[] の設計（工程2） | HyperFrames のレンダリング（工程4の一部） |
| Kling の呼び出し（工程4の一部） | 字幕 SRT の生成（工程6） |
| video-use による実写編集（工程5） | 画面合成・最終レンダリング（工程7・8） |
| Figma からのデザイン参照 | |

## agent 層の作業手順

1. `project.json` の `agentTask.instruction` を読む
2. `agentTask.tool` のツールを呼ぶ。requests[].params は実スキーマどおりの形で
   組み立て済みなので、原則そのまま渡す（構築ロジックは `src/adapters/kling.ts`）。
   Kling の手順詳細は `00_設計/Kling実装ノート.md` を参照。
   MCP コネクタが無いローカル環境では kling-cli スキル（`.agents/skills/kling-cli/`）で代替できる
3. 成果物を `projects/<id>/assets/<種別>/` に保存する
4. `project.json` の `assets[]` に登録し、対応ショットの `assetIds` に追加する
5. `agentTask` を `null` に戻す
6. `npm run studio -- run <projectId>` で再開する

## キャラクター資材

`02_キャラクター/<名前>/` に、動画に登場するキャラクターの正本がある。

- `ペルソナ.md` — 正本。性格・セリフ規則・禁止演出・関係性のすべて
- `生成キット.md` — 工程別の蒸留版。外見プロンプト・モーション語彙・NG 制約・字幕規則
- `参照シート.png` — 角度・表情・アクションの正準画像（image_to_image の参照入力）

キャラクターが登場する動画では、工程2（台本）の前に該当キャラクターの生成キットを読み、
imagePrompt / motionPrompt / caption をその規則で書くこと。
実在の人物は実写フッテージでのみ登場させ、容姿の AI 生成はしない。

## 守ること

- **`project.json` が唯一の真実。** 素材をどこかに置いただけでは工程が進まない。必ず登録する。
- **字幕は最後。** 合成のレイヤー順序（base → overlay → 字幕）を入れ替えない。
  先に焼くとオーバーレイに隠れて消える。これは好みではなく正しさの問題である。
- **`durationInFrames` の合計を目標尺に一致させる。** 工程2 が誤差 1.5 秒でエラーにする。
- **課金が発生する生成（Kling の画像・動画生成）は、ユーザーの承認を得てから実行する。**
  取り消せないため。
- **実写編集では video-use の Hard Rules に従う。** 特にカットを単語境界にスナップすること、
  全カット境界に 30ms のオーディオフェードを入れること。

## 設計を変えるとき

工程の追加・順序変更をする場合は `src/types.ts` の `STEP_NAMES` と
`src/orchestrator.ts` の `STEPS` を両方直す。片方だけだと型は通るが実行時に落ちる。

合成のレイヤー構成を変える場合は `src/steps/07-compose.ts` の `buildTimeline()` を直す。
`remotion/src/MainVideo.tsx` が同じ関数を共有しているので、描画側は自動で追随する。
