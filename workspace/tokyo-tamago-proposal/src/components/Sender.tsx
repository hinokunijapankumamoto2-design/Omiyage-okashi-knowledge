import { SENDER } from "../config";

// 未設定項目は赤字「【要記入】」を表示する（この挙動は仕様。消さないこと）
export function SenderValue({ value }: { value: string }) {
  if (!value) {
    return <span className="font-bold text-red-600">【要記入】</span>;
  }
  return <>{value}</>;
}

export function SenderBlock() {
  return (
    <dl className="text-sm leading-relaxed text-heading">
      <div className="flex gap-2">
        <dt className="shrink-0 font-bold">提案者：</dt>
        <dd>
          <SenderValue value={SENDER.company} />　<SenderValue value={SENDER.dept} />
          <SenderValue value={SENDER.name} />
        </dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 font-bold">連絡先：</dt>
        <dd>
          <SenderValue value={SENDER.email} />　／　<SenderValue value={SENDER.tel} />
        </dd>
      </div>
    </dl>
  );
}
