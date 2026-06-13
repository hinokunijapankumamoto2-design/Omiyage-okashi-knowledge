// デモチャート用ダミーデータ（docs/構築指示書.md §5.5 のとおり）
// ※実データに差し替える場合もこのファイルのみを編集する

export type WeeklyPoint = { week: string; count: number; alert?: boolean };

// ① 需要シグナル週次推移（「買えない・通販希望」言及件数）
export const weeklyTrend: WeeklyPoint[] = [
  { week: "4/6", count: 42 },
  { week: "4/13", count: 51 },
  { week: "4/20", count: 47 },
  { week: "4/27", count: 88, alert: true },
  { week: "5/4", count: 134, alert: true },
  { week: "5/11", count: 71 },
  { week: "5/18", count: 58 },
  { week: "5/25", count: 63 },
  { week: "6/1", count: 55 },
  { week: "6/8", count: 60 },
];

// ② 文脈別UGC構成比
export type ContextShare = { name: string; value: number };

export const contextShare: ContextShare[] = [
  { name: "もらった（受贈）", value: 38 },
  { name: "手土産・贈答購入", value: 27 },
  { name: "自分用", value: 18 },
  { name: "実食感想のみ", value: 12 },
  { name: "通販・入手方法の質問", value: 5 },
];

// ③ 需要の地理分布（上位8都道府県、sales_area=false は現販売エリア外）
export type GeoPoint = { pref: string; count: number; sales_area: boolean };

export const geoDistribution: GeoPoint[] = [
  { pref: "東京", count: 210, sales_area: true },
  { pref: "神奈川", count: 95, sales_area: true },
  { pref: "大阪", count: 88, sales_area: false },
  { pref: "愛知", count: 64, sales_area: false },
  { pref: "福岡", count: 52, sales_area: false },
  { pref: "北海道", count: 41, sales_area: false },
  { pref: "埼玉", count: 39, sales_area: true },
  { pref: "宮城", count: 28, sales_area: false },
];
