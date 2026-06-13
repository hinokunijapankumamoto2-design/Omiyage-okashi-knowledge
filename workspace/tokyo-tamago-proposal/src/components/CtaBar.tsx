import { useEffect, useState } from "react";
import { MAILTO } from "../config";

// 追従CTAバー。スクロール量300px超で表示、印刷時は非表示
export function CtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[#E2D5C3] bg-heading px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-sm font-bold text-white">無償トライアル（毎月3社限定・6/30締切）</p>
        <div className="flex gap-2">
          <a
            href={MAILTO.trial}
            className="rounded bg-caramel px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            申し込む
          </a>
          <a
            href={MAILTO.sample}
            className="rounded border border-white px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            サンプルを請求
          </a>
        </div>
      </div>
    </div>
  );
}
