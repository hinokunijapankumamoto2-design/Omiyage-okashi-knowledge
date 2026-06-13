import { MAILTO } from "../../config";
import { P, Section } from "../ui";

// §11。本文は docs/構築指示書.md の文言をそのまま掲載（改変禁止）

type Card = {
  plan: string;
  how: string;
  burden: string;
  gain: string;
  cta: string;
  href: string;
  recommended?: boolean;
};

const CARDS: Card[] = [
  {
    plan: "A",
    how: "サンプルレポート送付",
    burden: "メール1本のみ",
    gain: "N.Y.C.SANDの直近SNS言及を分析したサンプル（2営業日以内に送付）",
    cta: "サンプルレポートを請求する",
    href: MAILTO.sample,
  },
  {
    plan: "B",
    how: "30分オンラインMTG",
    burden: "30分",
    gain: "課題感のすり合わせ＋その場でサンプル提示",
    cta: "打ち合わせを希望する",
    href: MAILTO.meeting,
  },
  {
    plan: "C",
    how: "無償トライアル（推奨）",
    burden: "キックオフ30分＋週次レポートの確認",
    gain: "4週分の実データレポート。費用ゼロ・契約義務なし・途中終了自由",
    cta: "無償トライアルに申し込む",
    href: MAILTO.trial,
    recommended: true,
  },
];

export function Section11() {
  return (
    <Section title="11. 次のステップ ― まずは「実データ」をご覧ください">
      <P>
        机上の提案で導入をご判断いただく必要はありません。貴社のご負担に応じて、3つの進め方をご用意しました。
      </P>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.plan}
            className={`relative flex break-inside-avoid flex-col rounded border bg-white p-4 ${
              card.recommended ? "border-2 border-caramel" : "border-[#E2D5C3]"
            }`}
          >
            {card.recommended && (
              <span className="absolute -top-3 left-3 rounded bg-caramel px-2 py-0.5 text-xs font-bold text-white">
                推奨
              </span>
            )}
            <p className="mb-1 text-sm font-bold text-caramel">案{card.plan}</p>
            <h3 className="mb-3 font-bold text-heading">{card.how}</h3>
            <dl className="mb-4 flex-1 space-y-2 text-sm leading-relaxed text-heading">
              <div>
                <dt className="font-bold">貴社のご負担</dt>
                <dd>{card.burden}</dd>
              </div>
              <div>
                <dt className="font-bold">得られるもの</dt>
                <dd>{card.gain}</dd>
              </div>
            </dl>
            <a
              href={card.href}
              className={`no-print rounded px-4 py-2 text-center text-sm font-bold ${
                card.recommended
                  ? "bg-caramel text-white hover:opacity-90"
                  : "border border-caramel text-caramel hover:bg-tablehead"
              }`}
            >
              {card.cta}
            </a>
          </div>
        ))}
      </div>

      <div className="mb-6 break-inside-avoid rounded border-2 border-caramel bg-tablehead px-4 py-3">
        <h3 className="mb-2 font-bold text-heading">受付枠と期限</h3>
        <p className="leading-relaxed text-heading">
          専用辞書はアナリストが手作業で構築するため、無償トライアルの受付は毎月3社に限定しております。2026年6月30日（火）までにお申込みいただいた場合、7月第1週からレポート配信を開始でき、夏休み・お盆商戦（8月）の需要データを本契約のご判断材料としてお使いいただけます。この繁忙期データを取り逃すと、次に同等の検証機会が来るのは年末年始商戦となります。
        </p>
      </div>

      <div className="mb-6 break-inside-avoid">
        <h3 className="mb-2 font-bold text-heading">リスクがないことの確認</h3>
        <ul className="space-y-1 leading-relaxed text-heading">
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-bold text-caramel">✓</span>
            トライアル期間中の費用は一切発生しません（初期費用・解約金なし）
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-bold text-caramel">✓</span>
            本契約の義務はなく、途中終了も自由です
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="font-bold text-caramel">✓</span>
            貴社からお預かりするのは商品名リストのみで、顧客情報・販売データは不要です
          </li>
        </ul>
      </div>

      <P>
        <strong>まずは、貴社のお客様がいまSNSで何を語っているか、その実物をご覧ください。</strong>
        ご返信を心よりお待ちしております。
      </P>
    </Section>
  );
}
