#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 8 Challenger: OpenAI (GPT) クライアント

phase8_evaluator.AuditAgent は provider非依存の
`challenger_fn(system_prompt: str, user_content: str) -> str` を受け取る設計
（Anthropic以外のプロバイダを想定しているため）。
本モジュールはその実装の1つとして、OpenAI Chat Completions API を使った
challenger_fn を構築する。

セキュリティ方針:
- APIキーはコードへ直書きせず、環境変数（既定: OPENAI_API_KEY）から読む。
- ログ・例外メッセージにAPIキー本体を出力しない。
- 実際の値はこのリポジトリのgitignore対象ファイル（.env / env.txt）に
  ローカルで設定し、コミットしないこと。

使用例:
    from openai_challenger import build_openai_challenger_fn
    from phase8_evaluator import AuditAgent

    agent = AuditAgent(challenger_fn=build_openai_challenger_fn())
    result = agent.audit(claims)

    # KengoodEngineV2 と組み合わせる場合:
    from kengood_engine_v2 import KengoodEngineV2
    engine = KengoodEngineV2(challenger_fn=build_openai_challenger_fn())
"""

import os
from typing import Callable, Optional

DEFAULT_API_KEY_ENV = "OPENAI_API_KEY"
DEFAULT_MODEL_ENV = "OPENAI_CHALLENGER_MODEL"

# 注意: "gpt-5.4-mini" はユーザー指定のモデル名をそのまま既定値として使用している。
# OpenAI側の実際のモデル一覧と食い違う場合はAPI呼び出し時にエラーになるだけで
# 安全に失敗する（存在しないモデル名を機械的に補完・変換したりはしない）。
# 環境変数 OPENAI_CHALLENGER_MODEL で上書き可能。
DEFAULT_MODEL = "gpt-5.4-mini"


def build_openai_challenger_fn(
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    api_key_env: str = DEFAULT_API_KEY_ENV,
    model_env: str = DEFAULT_MODEL_ENV,
    default_model: str = DEFAULT_MODEL,
) -> Callable[[str, str], str]:
    """
    AuditAgent(challenger_fn=...) に渡せる関数を構築する。

    モデル名解決の優先順位: 引数 model > 環境変数 model_env > default_model
    APIキー解決の優先順位: 引数 api_key > 環境変数 api_key_env

    Returns:
        (system_prompt, user_content) -> raw_response_text を満たす関数。
        openai パッケージ未インストール、またはAPIキー未設定の場合は
        「呼び出し時」に分かりやすい RuntimeError を送出する
        （AuditAgent側でtry/exceptされ analysis_source="challenger_error" になり、
        パイプライン全体は落ちない）。
    """
    resolved_model = model or os.getenv(model_env) or default_model
    resolved_api_key = api_key or os.getenv(api_key_env)

    def challenger_fn(system_prompt: str, user_content: str) -> str:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "openaiパッケージが未インストールです。`pip install openai` を実行してください。"
            ) from exc

        if not resolved_api_key:
            raise RuntimeError(
                f"OpenAI APIキーが設定されていません。環境変数 {api_key_env} を設定するか、"
                "build_openai_challenger_fn(api_key=...) を使用してください。"
            )

        client = OpenAI(api_key=resolved_api_key)
        response = client.chat.completions.create(
            model=resolved_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
        return response.choices[0].message.content or ""

    return challenger_fn


if __name__ == "__main__":
    # 疎通確認用の簡易スクリプト。
    # OPENAI_API_KEY が環境変数に設定されている場合のみ実際にAPIを呼び出す。
    fn = build_openai_challenger_fn()
    try:
        result = fn(
            "You are a connectivity test assistant. Reply with strict JSON only.",
            '{"ping": "pong"} を確認できたらそのまま返してください',
        )
        print("応答:", result)
    except RuntimeError as e:
        print(f"[未疎通] {e}")
