#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 4: Metrics Engine

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §8 準拠）：
- Pythonのみで処理する。LLMへは計算結果を渡すのみで、再計算はさせない。
- 外部依存（numpyなど）を持たず、標準ライブラリのみで動作する
  （実行環境にnumpyが無くても Phase 0-4 基盤層が単体で動くようにするため）。

計算対象:
    Engagement Count / Engagement Rate / Like Rate / Reply Rate /
    Repost Rate / Share Rate / Reach Efficiency / Velocity /
    Percentile (P25/P50/P75/P90/P95) / Hit Rate / Viral Rate /
    Follower-normalized performance
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence


@dataclass
class EngagementMetrics:
    """1投稿分のエンゲージメント指標"""
    engagement_count: int
    engagement_rate: float
    like_rate: float
    reply_rate: float
    repost_rate: float
    share_rate: float
    reach_efficiency: Optional[float] = None
    velocity_per_hour: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)


class MetricsEngine:
    """Phase 4: Metrics Calculation（Pythonのみ・決定論的）"""

    # ---------------- 単一投稿の指標 ----------------

    @staticmethod
    def calculate_engagement_count(likes: int, retweets: int, replies: int) -> int:
        return int(likes or 0) + int(retweets or 0) + int(replies or 0)

    @staticmethod
    def _safe_ratio(numerator: float, denominator: float) -> float:
        if not denominator:
            return 0.0
        return numerator / denominator

    @staticmethod
    def calculate_engagement_rate(
        likes: int, retweets: int, replies: int, impressions: int
    ) -> float:
        """(likes + retweets + replies) / impressions × 100（%）"""
        total = MetricsEngine.calculate_engagement_count(likes, retweets, replies)
        return round(MetricsEngine._safe_ratio(total, impressions) * 100, 4)

    @staticmethod
    def calculate_like_rate(likes: int, impressions: int) -> float:
        return round(MetricsEngine._safe_ratio(likes or 0, impressions) * 100, 4)

    @staticmethod
    def calculate_reply_rate(replies: int, impressions: int) -> float:
        return round(MetricsEngine._safe_ratio(replies or 0, impressions) * 100, 4)

    @staticmethod
    def calculate_repost_rate(retweets: int, impressions: int) -> float:
        return round(MetricsEngine._safe_ratio(retweets or 0, impressions) * 100, 4)

    @staticmethod
    def calculate_share_rate(retweets: int, quotes: int, impressions: int) -> float:
        """
        Share Rate = (retweets + quote tweets) / impressions × 100
        quotes が取得できない場合は 0 として扱う（retweetsのみで近似）。
        """
        shares = (retweets or 0) + (quotes or 0)
        return round(MetricsEngine._safe_ratio(shares, impressions) * 100, 4)

    @staticmethod
    def calculate_reach_efficiency(impressions: int, followers: int) -> Optional[float]:
        """impressions / followers（フォロワー数に対する到達効率）"""
        if not followers:
            return None
        return round(impressions / followers, 4)

    @staticmethod
    def calculate_follower_normalized_performance(
        likes: int, followers: int
    ) -> Optional[float]:
        """likes / followers（impressionsが取れない場合の代替指標）"""
        if not followers:
            return None
        return round((likes or 0) / followers, 6)

    @staticmethod
    def calculate_velocity(
        engagement_count: int,
        post_timestamp: str,
        as_of: Optional[datetime] = None,
        min_hours: float = 1.0,
    ) -> Optional[float]:
        """
        投稿からの経過時間あたりのエンゲージメント増加速度（Velocity）。

        Args:
            engagement_count: 現時点までの累積エンゲージメント数
            post_timestamp: ISO8601形式の投稿日時（phase3_normalizerの出力形式）
            as_of: 計測基準時刻（省略時は現在時刻UTC）
            min_hours: ゼロ除算・異常値を避けるための最小経過時間

        Returns:
            1時間あたりのエンゲージメント増加数。post_timestampが解釈できない場合はNone。
        """
        if not post_timestamp:
            return None
        try:
            posted_at = datetime.fromisoformat(post_timestamp.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None
        if posted_at.tzinfo is None:
            posted_at = posted_at.replace(tzinfo=timezone.utc)

        as_of = as_of or datetime.now(timezone.utc)
        elapsed_hours = max(min_hours, (as_of - posted_at).total_seconds() / 3600.0)

        return round((engagement_count or 0) / elapsed_hours, 4)

    @staticmethod
    def build_engagement_metrics(
        likes: int,
        retweets: int,
        replies: int,
        impressions: int,
        followers: Optional[int] = None,
        post_timestamp: Optional[str] = None,
        as_of: Optional[datetime] = None,
        quotes: int = 0,
    ) -> EngagementMetrics:
        """1投稿分の指標一式をまとめて計算する"""
        engagement_count = MetricsEngine.calculate_engagement_count(likes, retweets, replies)

        return EngagementMetrics(
            engagement_count=engagement_count,
            engagement_rate=MetricsEngine.calculate_engagement_rate(
                likes, retweets, replies, impressions
            ),
            like_rate=MetricsEngine.calculate_like_rate(likes, impressions),
            reply_rate=MetricsEngine.calculate_reply_rate(replies, impressions),
            repost_rate=MetricsEngine.calculate_repost_rate(retweets, impressions),
            share_rate=MetricsEngine.calculate_share_rate(retweets, quotes, impressions),
            reach_efficiency=MetricsEngine.calculate_reach_efficiency(impressions, followers)
            if followers else None,
            velocity_per_hour=MetricsEngine.calculate_velocity(
                engagement_count, post_timestamp, as_of
            ) if post_timestamp else None,
        )

    # ---------------- 分布・集計指標 ----------------

    @staticmethod
    def percentile(values: Sequence[float], p: float) -> float:
        """
        線形補間による百分位数計算（numpy不使用）。
        numpyのデフォルト方式（'linear'）と同じ結果になる。
        """
        if not values:
            return 0.0
        data = sorted(values)
        n = len(data)
        if n == 1:
            return float(data[0])

        rank = (p / 100.0) * (n - 1)
        lower = int(rank)
        upper = min(lower + 1, n - 1)
        fraction = rank - lower

        return data[lower] + (data[upper] - data[lower]) * fraction

    @staticmethod
    def calculate_percentiles(values: Sequence[float]) -> Dict[str, float]:
        return {
            "p25": round(MetricsEngine.percentile(values, 25), 4),
            "p50": round(MetricsEngine.percentile(values, 50), 4),
            "p75": round(MetricsEngine.percentile(values, 75), 4),
            "p90": round(MetricsEngine.percentile(values, 90), 4),
            "p95": round(MetricsEngine.percentile(values, 95), 4),
        }

    @staticmethod
    def calculate_median(values: Sequence[float]) -> float:
        return round(MetricsEngine.percentile(values, 50), 4)

    @staticmethod
    def calculate_hit_rate(
        values: Sequence[float], threshold: Optional[float] = None
    ) -> float:
        """
        しきい値（省略時は中央値）を超える投稿の割合。
        """
        if not values:
            return 0.0
        threshold = threshold if threshold is not None else MetricsEngine.calculate_median(values)
        hits = sum(1 for v in values if v > threshold)
        return round(hits / len(values), 4)

    @staticmethod
    def calculate_viral_rate(
        values: Sequence[float], multiplier: float = 5.0
    ) -> float:
        """
        中央値の multiplier 倍を超える投稿を「バズった」とみなし、その割合を返す。
        中央値が0の場合はp75を基準に切り替える。
        """
        if not values:
            return 0.0
        median = MetricsEngine.calculate_median(values)
        baseline = median if median > 0 else MetricsEngine.percentile(values, 75)
        if baseline <= 0:
            return 0.0
        threshold = baseline * multiplier
        hits = sum(1 for v in values if v >= threshold)
        return round(hits / len(values), 4)


if __name__ == "__main__":
    import json

    metrics = MetricsEngine.build_engagement_metrics(
        likes=1200, retweets=300, replies=45, impressions=80000,
        followers=15000, post_timestamp="2026-08-20T09:00:00+00:00",
        as_of=datetime(2026, 8, 21, 9, 0, 0, tzinfo=timezone.utc),
    )
    print(json.dumps(metrics.to_dict(), ensure_ascii=False, indent=2))

    sample_engagement_rates = [0.4, 1.2, 2.5, 0.8, 5.6, 3.1, 0.2, 9.9, 1.1, 0.6]
    print(json.dumps(MetricsEngine.calculate_percentiles(sample_engagement_rates), indent=2))
    print("hit_rate:", MetricsEngine.calculate_hit_rate(sample_engagement_rates))
    print("viral_rate:", MetricsEngine.calculate_viral_rate(sample_engagement_rates))
