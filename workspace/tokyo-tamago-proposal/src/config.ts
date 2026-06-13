// 案件ごとの差し替えはこのファイルだけで完結させる

// 閲覧キー。URLクエリ ?key= がこれと一致しないと本文を表示しない
export const ACCESS_KEY = "tamago2026";

// 提案者情報。空欄の項目は画面に赤字「【要記入】」が表示される
export const SENDER = {
  company: "",
  dept: "",
  name: "",
  email: "",
  tel: "",
};

// mailto リンク（宛先は SENDER.email、件名・本文はプリセット）
function buildMailto(subject: string, body: string): string {
  return `mailto:${SENDER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const MAILTO = {
  // 案A: サンプルレポート送付
  sample: buildMailto(
    "サンプルレポート希望（東京玉子本舗）",
    "サンプルレポートの送付を希望します。担当窓口："
  ),
  // 案B: 30分オンラインMTG
  meeting: buildMailto(
    "30分オンラインMTG希望（東京玉子本舗）",
    "打ち合わせを希望します。候補日時："
  ),
  // 案C: 無償トライアル
  trial: buildMailto(
    "無償トライアル申込（東京玉子本舗）",
    "無償トライアルを希望します。担当窓口："
  ),
};
