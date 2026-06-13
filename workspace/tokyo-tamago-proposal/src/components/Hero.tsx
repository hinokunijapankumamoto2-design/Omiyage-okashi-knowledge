import { MAILTO } from "../config";
import { SenderBlock } from "./Sender";

export function Hero() {
  return (
    <header className="mb-14 break-inside-avoid border-b border-[#E2D5C3] pb-10 pt-12 text-center">
      <p className="mb-6 text-lg font-bold text-heading">株式会社東京玉子本舗 御中</p>
      <h1 className="mb-4 text-2xl font-bold leading-snug text-heading md:text-4xl">
        SNS需要シグナル分析サービス ご提案書
      </h1>
      <p className="mb-8 text-caramel md:text-lg">
        ―『買えない』『お取り寄せしたい』の声を、経営判断のデータに ―
      </p>
      <p className="mb-2 text-sm text-heading">2026年6月13日</p>
      <div className="mx-auto mb-8 inline-block text-left">
        <SenderBlock />
      </div>
      <div className="no-print flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href={MAILTO.trial}
          className="rounded bg-caramel px-6 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          無償トライアルに申し込む
        </a>
        <a
          href={MAILTO.sample}
          className="rounded border-2 border-caramel px-6 py-3 text-sm font-bold text-caramel hover:bg-tablehead"
        >
          サンプルレポートを請求する
        </a>
      </div>
    </header>
  );
}
