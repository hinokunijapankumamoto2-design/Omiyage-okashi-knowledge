# 素材の置き場

ここに以下のファイル名で画像を置く（GitHub の Web からアップロード可能）:

- `poster.png` … ずんだ茶寮ポスター（暖簾＋久保さん＋シェイク2種が写っている横型画像）
- `kubo_sheet.png` … 久保さんリファレンスシート（任意。表情差し替え用）

アップロード用URL:
https://github.com/hinokunijapankumamoto2-design/Omiyage-okashi-knowledge/upload/claude/awakening-mode-activation-4mxgl1/workspace/ai-video-studio/projects/shake-jiken-12s/photos

置いたら次の3コマンドで v1 が出る（Claude 側で自動実行）:
1. python3 scenes/build_photo_bases.py     … 静止画→各ビートのズーム映像
2. node scenes/register_photo_v1.mjs       … footage+overlay の2層登録
3. compose/render --force → 音声ミックス   … 完成
