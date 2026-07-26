# Kling Web アプリでの生成手順（ボーナスクレジット66を使う）

ボーナスクレジットは Web プラットフォーム専用のため、生成は kling.ai/app で行い、
結果をリポジトリに入れて合成に回す。所要 5 分・2 ジョブ。

## 共通設定

- メニュー: **動画生成 → 画像から動画（image to video）**
- モデル: **Kling 3.0 Turbo**（なければ 3.0 / 2.6 でも可）
- 長さ: **3秒**（選べなければ 5秒でも可。合成側で 2.5 秒に切り出すためどちらでも成立）
- 解像度: 720p（標準）

## ジョブ1: s1 暖簾オープニング

1. 入力画像: 下記 URL をブラウザで開いて保存し、アップロード
   https://raw.githubusercontent.com/hinokunijapankumamoto2-design/Omiyage-okashi-knowledge/claude/awakening-mode-activation-4mxgl1/workspace/ai-video-studio/projects/zunda-pr-10s/plates/s1_plate.png
2. プロンプト（そのまま貼り付け）:

```
2Dフラットステッカー調のマスコットが緑の暖簾の前で嬉しそうに小さく弾み、頭の二枚の葉がぴょこぴょこ揺れる。背景の暖簾の布がゆったりとなびく。キャラクターの紙のような平面質感・色・デザインは一切変えない。カメラ固定
```

## ジョブ2: s3 こっそり味見

1. 入力画像:
   https://raw.githubusercontent.com/hinokunijapankumamoto2-design/Omiyage-okashi-knowledge/claude/awakening-mode-activation-4mxgl1/workspace/ai-video-studio/projects/zunda-pr-10s/plates/s3_plate.png
2. プロンプト:

```
2Dフラットステッカー調のマスコットが大きなシェイクカップの横でいたずらっぽく体を傾け、こっそりストローに口を近づける。頭の二枚の葉が小刻みに揺れる。キャラクターの紙のような平面質感・色・デザインは一切変えない。カメラ固定
```

## 結果の渡し方（どちらでも可）

**方法A: GitHub に直接アップロード（推奨・ブラウザだけで完結）**

1. https://github.com/hinokunijapankumamoto2-design/Omiyage-okashi-knowledge/tree/claude/awakening-mode-activation-4mxgl1/workspace/ai-video-studio/projects/zunda-pr-10s/plates を開く
2. 「Add file → Upload files」で、生成した mp4 を 2 本ドラッグ&ドロップ
   - ファイル名: `s1_kling.mp4` / `s3_kling.mp4` にリネームしてから
3. そのまま「Commit changes」（ブランチはこのブランチのまま）
4. このチャットで「アップロードした」と教えてください

**方法B: チャットで報告のみ**

生成完了画面の共有リンク（またはダウンロード URL）を貼ってください。
こちらで取得できるか試します（環境の通信制限で取れない場合は方法Aに切り替え）。

## その後（こちらで自動）

1. `s1_kling.mp4` / `s3_kling.mp4` を motion 素材として登録（source=kling）
2. 合成ロジックが自動で Kling を base、吹き出し透過 WebM を overlay に配置
3. 音声を再ミックスして v1 を出力・納品

## 品質チェックの観点（生成結果を選ぶとき）

- キャラの顔・三粒・葉のデザインが崩れていないか（多少の揺らぎは可）
- 文字が画面に出現していないか（プレートは文字なしなので出ないはず）
- 動きが過剰でないか（上品さを守る。跳ねすぎ・変形しすぎはNG）
- 気に入らなければ再生成（1ジョブ数クレジットなので 66 あれば十分試せる）
