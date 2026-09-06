#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 5A: Content Classification

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §9 準拠）：
- Default: Haiku 4.5。600投稿などの大量データ処理を担当する。
- 各投稿を Content DNA Schema に従って「分類」のみ行う（戦略提案はしない）。
- 判断できないカテゴリーは unknown とし、各分類に confidence を付ける。
- Quality Gate: confidence < 0.75 の投稿だけを Sonnet（Phase 5B）へ送る
  （全投稿を再送しない＝Token Funnel）。

client（anthropic.Anthropic() 等のインスタンス）が渡されない場合は、
決定論的なキーワードヒューリスティックにフォールバックする。
フォールバックはオフライン検証専用であり、confidence は意図的に
Quality Gate閾値（0.75）未満に固定し、Sonnetへのエスカレーション対象と
なることを明示する。
"""

import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

from phase5_common import COMMON_SYSTEM_RULE, DEFAULT_MODELS, call_model, extract_json_object

PHASE5A_INSTRUCTION = """ROLE:
SNS Content Classification Agent

TASK:
投稿をContent DNA Schemaに従って分類してください。

目的は戦略提案ではありません。

このPhaseでは「分類」だけをしてください。

投稿内容に書かれていない意図を勝手に補完してはいけません。

判断できないカテゴリーはunknownとしてください。

各分類にconfidenceを付けてください。

出力は以下のJSON Schemaに厳密に従ってください（キーを追加・削除しない）:

{
  "post_id": "",
  "topic": [],
  "content_pillar": "",
  "hook": "",
  "format": "",
  "narrative": "",
  "emotion": [],
  "audience": [],
  "problem": null,
  "promise": null,
  "proof": null,
  "cta": null,
  "novelty": "",
  "authority": "",
  "commercial_intent": "",
  "confidence": 0.0
}"""

# Quality Gate 閾値（設計書 §9）
CONFIDENCE_ESCALATION_THRESHOLD = 0.75

# フォールバック分類器の confidence（Quality Gate閾値未満に固定 = 常にエスカレーション対象）
_FALLBACK_CONFIDENCE = 0.5

_FALLBACK_TOPIC_KEYWORDS = {
    "AI": ["ai", "claude", "gpt", "llm", "人工知能"],
    "productivity": ["生産性", "効率化", "時短"],
    "career": ["キャリア", "転職", "起業", "副業"],
    "education": ["学習", "勉強", "講座", "コミュニティ"],
    "tools": ["ツール", "アプリ", "サービス"],
}

_FALLBACK_EMOTION_KEYWORDS = {
    "excitement": ["！", "!", "驚き", "すごい"],
    "curiosity": ["？", "?", "とは", "なぜ"],
    "trust": ["実績", "事例", "証拠"],
}


@dataclass
class ContentClassification:
    """Phase 5A 出力スキーマ（設計書 §9 準拠）"""
    post_id: str
    topic: List[str] = field(default_factory=list)
    content_pillar: str = "unknown"
    hook: str = "unknown"
    format: str = "unknown"
    narrative: str = "unknown"
    emotion: List[str] = field(default_factory=list)
    audience: List[str] = field(default_factory=list)
    problem: Optional[str] = None
    promise: Optional[str] = None
    proof: Optional[str] = None
    cta: Optional[str] = None
    novelty: str = "unknown"
    authority: str = "unknown"
    commercial_intent: str = "unknown"
    confidence: float = 0.0
    classification_source: str = "unknown"  # "llm" or "fallback_heuristic"

    def to_dict(self) -> Dict:
        return asdict(self)


class HaikuContentClassifier:
    """Phase 5A: Content DNA Classification"""

    def __init__(self, client: Optional[Any] = None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["classifier"]

    def classify_post(self, post: Dict, post_id: Optional[str] = None) -> ContentClassification:
        """
        1投稿を分類する。

        Args:
            post: phase3_normalizer.Normalizer.normalize_post() 互換の辞書
                （少なくとも "text" キーを持つ）
            post_id: 投稿の一意識別子（省略時は post の url を使用）
        """
        post_id = post_id or post.get("url") or post.get("text", "")[:32]

        if self.client is not None:
            return self._classify_with_llm(post, post_id)
        return self._classify_with_fallback(post, post_id)

    def classify_posts(
        self,
        posts: List[Dict],
        confidence_threshold: float = CONFIDENCE_ESCALATION_THRESHOLD,
    ) -> Tuple[List[ContentClassification], List[ContentClassification]]:
        """
        複数投稿を分類し、(全分類結果, 低confidence分=Sonnetへのエスカレーション候補) を返す。
        Token Funnel: 全投稿を再送するのではなく、低confidence分のみを対象とする。
        """
        classified = [self.classify_post(p) for p in posts]
        low_confidence = [c for c in classified if c.confidence < confidence_threshold]
        return classified, low_confidence

    # ==================== 実LLM呼び出し ====================

    def _classify_with_llm(self, post: Dict, post_id: str) -> ContentClassification:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE5A_INSTRUCTION}"
        user_content = (
            f"post_id: {post_id}\n"
            f"text: {post.get('text', '')}\n"
            f"author: {post.get('author', '')}\n"
        )

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content)
        except Exception:
            # API呼び出し失敗時はUNKNOWN・低confidenceとして扱う（数字を捏造しない）
            return ContentClassification(post_id=post_id, confidence=0.0, classification_source="llm_error")

        parsed = extract_json_object(raw_text)
        if parsed is None:
            return ContentClassification(post_id=post_id, confidence=0.0, classification_source="llm_parse_error")

        return ContentClassification(
            post_id=parsed.get("post_id", post_id),
            topic=parsed.get("topic", []) or [],
            content_pillar=parsed.get("content_pillar", "unknown"),
            hook=parsed.get("hook", "unknown"),
            format=parsed.get("format", "unknown"),
            narrative=parsed.get("narrative", "unknown"),
            emotion=parsed.get("emotion", []) or [],
            audience=parsed.get("audience", []) or [],
            problem=parsed.get("problem"),
            promise=parsed.get("promise"),
            proof=parsed.get("proof"),
            cta=parsed.get("cta"),
            novelty=parsed.get("novelty", "unknown"),
            authority=parsed.get("authority", "unknown"),
            commercial_intent=parsed.get("commercial_intent", "unknown"),
            confidence=float(parsed.get("confidence", 0.0) or 0.0),
            classification_source="llm",
        )

    # ==================== フォールバック（オフライン検証用） ====================

    def _classify_with_fallback(self, post: Dict, post_id: str) -> ContentClassification:
        """
        client未指定時の決定論的フォールバック。
        単純なキーワードマッチングであり、意味理解は行わない。
        confidence は常に Quality Gate 閾値未満に固定し、
        「本来はSonnetでの再検証が必要」であることを明示する。
        """
        text = (post.get("text") or "").lower()

        topics = [
            topic for topic, keywords in _FALLBACK_TOPIC_KEYWORDS.items()
            if any(kw.lower() in text for kw in keywords)
        ]
        emotions = [
            emotion for emotion, keywords in _FALLBACK_EMOTION_KEYWORDS.items()
            if any(kw in (post.get("text") or "") for kw in keywords)
        ]

        has_url_cta = bool(re.search(r"https?://", post.get("text") or ""))
        format_guess = "question" if "?" in text or "？" in (post.get("text") or "") else "statement"

        return ContentClassification(
            post_id=post_id,
            topic=topics,
            content_pillar="unknown",
            hook="unknown",
            format=format_guess,
            narrative="unknown",
            emotion=emotions,
            audience=[],
            cta="link_click" if has_url_cta else None,
            novelty="unknown",
            authority="unknown",
            commercial_intent="unknown",
            confidence=_FALLBACK_CONFIDENCE,
            classification_source="fallback_heuristic",
        )


if __name__ == "__main__":
    import json

    classifier = HaikuContentClassifier()  # client未指定 = フォールバックモード

    sample_posts = [
        {"text": "Claude Codeでこんな時短ができた！みんな試して", "author": "ichiaimarketer"},
        {"text": "AirCleコミュニティの新規募集を開始しました https://example.com/apply", "author": "ichiaimarketer"},
        {"text": "なぜAIエージェントが注目されているのか？", "author": "AIbusiness9"},
    ]

    classified, low_confidence = classifier.classify_posts(sample_posts)

    print(json.dumps([c.to_dict() for c in classified], ensure_ascii=False, indent=2))
    print(f"\n低confidence（Sonnetへエスカレーション対象）: {len(low_confidence)}/{len(classified)}件")
