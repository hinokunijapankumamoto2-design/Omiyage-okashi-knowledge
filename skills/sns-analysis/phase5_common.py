#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 5以降（LLM統合層）で共有するユーティリティ

設計方針：
- anthropicパッケージが未インストール、またはAPIキー未設定の環境でも
  各Phaseモジュールが単体でインポート・テスト可能であること。
- 実LLM呼び出しは `client`（呼び出し側が生成した anthropic.Anthropic() 等の
  インスタンス）を各Phaseクラスへ注入する方式とし、本ファイル自体は
  SDKの初期化・APIキー管理を行わない。
- client が渡されない場合、各Phaseクラスは決定論的なフォールバック処理
  （ルールベース分類・簡易ヒューリスティック）で代替し、
  「Phase 0-4と同様にAPIキー無しでもパイプライン全体を検証できる」
  ことを保証する。フォールバックはあくまでオフライン検証用であり、
  実運用の分析結果として使うことは想定しない。
- 実際のprovider/model IDはビジネスロジックへハードコードせず、
  環境設定（model-routing.yaml 等）から注入する
  （KENGOOD_SNS_Intelligence_Engine_v2.md §26 準拠）。
"""

import json
import re
from typing import Any, Dict, Optional

# KENGOOD_SNS_Intelligence_Engine_v2.md §2 "COMMON SYSTEM RULE" をそのまま採用
COMMON_SYSTEM_RULE = """あなたはKENGOOD SNS Intelligence Engineの分析エージェントです。

与えられたEvidenceだけを根拠として分析してください。

必ず以下を区別してください。

FACT
= データまたはEvidenceから直接確認できること

INFERENCE
= 複数FACTから合理的に導けること

HYPOTHESIS
= 検証が必要な仮説

UNKNOWN
= 現在のEvidenceでは判断できないこと

禁止事項：

1. 存在しない数字を補完しない
2. 未取得データを0として扱わない
3. 相関を因果として断定しない
4. フォロワー規模の差を無視しない
5. バズ投稿だけを見て結論を出さない
6. Evidence IDのない重要主張を作らない
7. UNKNOWNを無理に推測しない
8. 前提に疑問がある場合はconfidenceを下げる
9. 数値計算を独自に再計算しない
10. 出力Schemaを変更しない

重要な結論には必ず以下を付与してください。

claim_type
evidence_ids
confidence
counter_evidence
limitations"""

# デフォルトモデルID（実際の注入は呼び出し側 / model-routing.yaml が担う）
DEFAULT_MODELS = {
    "classifier": "claude-haiku-4-5-20251001",
    "analyst": "claude-sonnet-5",
    "strategist": "claude-opus-5",
}


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """
    LLM応答テキストから最初のJSONオブジェクトを抽出する。
    ```json ... ``` のコードフェンス、素のJSON文字列の両方に対応する。
    解析に失敗した場合は None を返す（呼び出し側でUNKNOWN/低confidence扱いにする）。
    """
    if not text:
        return None

    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else None

    if candidate is None:
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        candidate = brace_match.group(0) if brace_match else None

    if candidate is None:
        return None

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def call_model(
    client: Any,
    model: str,
    system_prompt: str,
    user_content: str,
    max_tokens: int = 1024,
) -> str:
    """
    Anthropic Messages API互換クライアントでモデルを呼び出し、応答テキストを返す。

    client は `.messages.create(model=, max_tokens=, system=, messages=[...])` を
    持つオブジェクト（anthropic.Anthropic() のインスタンス等）を想定する。
    """
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    return "".join(
        block.text for block in response.content if hasattr(block, "text")
    )
