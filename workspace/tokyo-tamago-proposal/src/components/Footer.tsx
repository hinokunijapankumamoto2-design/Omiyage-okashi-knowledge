import { SenderBlock } from "./Sender";

export function Footer() {
  return (
    <footer className="break-inside-avoid border-t border-[#E2D5C3] pb-24 pt-8">
      <div className="mb-4">
        <SenderBlock />
      </div>
      <p className="text-xs leading-relaxed text-heading/70">
        本資料は東京玉子本舗様向けに作成した機密資料です。第三者への転送はご遠慮ください。
      </p>
    </footer>
  );
}
