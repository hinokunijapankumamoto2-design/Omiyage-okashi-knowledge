// 閲覧キー不一致時の表示。本文は一切レンダリングしない
export function Gate() {
  return (
    <div className="no-print flex min-h-screen items-center justify-center bg-cream px-6">
      <p className="text-center leading-relaxed text-heading">
        閲覧用URLをお持ちの方のみご覧いただけます
      </p>
    </div>
  );
}
