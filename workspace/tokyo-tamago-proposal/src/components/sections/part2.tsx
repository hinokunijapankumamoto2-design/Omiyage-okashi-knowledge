import { ContextPieChart, DemandTrendChart, GeoBarChart } from "../charts";
import { P, Section, Table } from "../ui";

// §5・§5.5。本文は docs/構築指示書.md の文言をそのまま掲載（改変禁止）

export function Section5() {
  return (
    <Section title="5. ご提案：需要シグナル週次レポートサービス">
      <h3 className="mb-2 font-bold text-heading">5-1. サービス概要</h3>
      <P>
        X（旧Twitter）・Instagram・主要ECモールのレビューから貴社商品への言及を収集し、土産菓子特化のAI分類エンジンで「商品 × 文脈 × 地域 × 感情」に構造化。アナリストが監修した週次レポートを毎週月曜朝にメールでお届けします。貴社側でのツール操作・学習コストはゼロです。
      </P>
      <h3 className="mb-2 font-bold text-heading">5-2. レポートに含まれる内容</h3>
      <Table
        headers={["項目", "内容", "活用される意思決定"]}
        rows={[
          [
            "需要シグナル推移",
            "「買えない」「通販してほしい」言及の週次推移と急増アラート",
            "EC在庫計画・増産判断",
          ],
          [
            "需要の地理分布",
            "言及者の推定所在地マップ（販売エリアとの乖離を可視化）",
            "催事出店エリア・新販路選定",
          ],
          [
            "文脈別UGC分析",
            "もらった／手土産／自分用／実食感想の構成比と代表的な生の声",
            "商品開発・パッケージ・販促",
          ],
          [
            "シェアオブボイス",
            "競合ブランドとの言及シェア比較（CARAMER向け）",
            "認知施策の効果検証",
          ],
          [
            "イベント相関",
            "連休・物産展・メディア露出と言及量の相関",
            "投稿・在庫タイミング最適化",
          ],
        ]}
      />
      <h3 className="mb-2 font-bold text-heading">5-3. 当社の差別化：土産菓子特化の分類技術</h3>
      <P>
        汎用のソーシャルリスニングツールは、言及の「量」と「ポジネガ」しか測れません。当社は土産菓子業界専用の語彙辞書（贈答語彙・入手難語彙・表記ゆれ・混同リスク）を構築し、最新の生成AIで投稿1件ごとに文脈を判定します。例えば「ニューヨーク」「キャラメル」「サンド」を含む無関係な投稿の除外や、「実家の母が送ってくれた」という受贈文脈の判別は、この特化設計でのみ実現できます。
      </P>
    </Section>
  );
}

export function SectionDemo() {
  return (
    <Section title="サンプルレポートのイメージ">
      <div className="mb-6 break-inside-avoid rounded border-2 border-accent bg-white px-4 py-3">
        <p className="font-bold leading-relaxed text-accent">
          ※以下はレポートのイメージを示すダミーデータです。実データではありません。
        </p>
      </div>
      <DemandTrendChart />
      <ContextPieChart />
      <GeoBarChart />
    </Section>
  );
}
