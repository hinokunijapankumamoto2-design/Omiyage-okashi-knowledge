#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Anthropic (Claude) クライアント構築ヘルパー

Phase 5A（Haiku）/ Phase 5B・6・7・8のSonnet自己レビュー / Opus昇格は、
Anthropic Messages API準拠のclientオブジェクト
（`.messages.create(model=, max_tokens=, system=, messages=[...])` を持つもの）
を想定している（phase5_common.call_model 参照）。
本モジュールはその構築ロジックを1箇所にまとめる。

セキュリティ方針:
- APIキーはコードへ直書きせず、環境変数（既定: ANTHROPIC_API_KEY）から読む。
- 実際の値はこのリポジトリのgitignore対象ファイル（.env / env.txt）に
  ローカルで設定し、コミットしないこと。

使用例:
    from anthropic_client import try_build_anthropic_client
    from kengood_engine_v2 import KengoodEngineV2

    client = try_build_anthropic_client()  # 未設定ならNone
    engine = KengoodEngineV2(
        classifier_client=client,  # Haiku役
        analyst_client=client,     # Sonnet役
        strategist_client=client,  # Opus役
    )
    # 実際に使われるモデル名はKengoodEngineV2がmodel-routing.yamlから注入するため、
    # 同一のclientインスタンスを複数役に共有してよい。
"""

import os
from typing import Any, Optional

DEFAULT_API_KEY_ENV = "ANTHROPIC_API_KEY"


def build_anthropic_client(
    api_key: Optional[str] = None,
    api_key_env: str = DEFAULT_API_KEY_ENV,
) -> Any:
    """
    各Phaseクラスの `client=` 引数に渡せる anthropic.Anthropic() インスタンスを構築する。

    Raises:
        RuntimeError: anthropicパッケージ未インストール、またはAPIキー未設定の場合。
    """
    resolved_api_key = api_key or os.getenv(api_key_env)
    if not resolved_api_key:
        raise RuntimeError(
            f"Anthropic APIキーが設定されていません。環境変数 {api_key_env} を設定するか、"
            "build_anthropic_client(api_key=...) を使用してください。"
        )

    try:
        from anthropic import Anthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropicパッケージが未インストールです。`pip install anthropic` を実行してください。"
        ) from exc

    return Anthropic(api_key=resolved_api_key)


def try_build_anthropic_client(
    api_key: Optional[str] = None,
    api_key_env: str = DEFAULT_API_KEY_ENV,
) -> Optional[Any]:
    """
    build_anthropic_client() のエラー握りつぶし版。
    キー未設定・パッケージ未インストール時は None を返す。
    呼び出し側は None ならフォールバック動作にする、という使い方を想定する
    （main.py 参照）。
    """
    try:
        return build_anthropic_client(api_key=api_key, api_key_env=api_key_env)
    except RuntimeError:
        return None


if __name__ == "__main__":
    client = try_build_anthropic_client()
    if client is None:
        print("[未疎通] ANTHROPIC_API_KEY未設定、またはanthropicパッケージ未インストール")
    else:
        print("✅ Anthropicクライアントを構築しました（このスクリプトは実際のAPI呼び出しは行いません）")
