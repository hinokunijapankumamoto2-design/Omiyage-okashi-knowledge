#!/usr/bin/env python3
"""
SNS Analysis Skill - Web Scraper Module
APIを使わず、公開情報から正しいデータを取得
Playwright を用いた動的スクレイピング対応
"""

import re
import json
import time
import os
from datetime import datetime
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass, asdict
from urllib.parse import quote
import urllib.request
import urllib.error
from http.client import HTTPResponse

# Playwright 設定（環境変数で既存ブラウザを使用）
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/opt/pw-browsers'
os.environ['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1'

try:
    from playwright.sync_api import sync_playwright, Browser, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


@dataclass
class ScrapedData:
    """スクレイピング結果のデータ構造"""
    platform: str
    followers: Optional[int] = None
    posts: Optional[int] = None
    last_updated: str = ""
    source_url: str = ""
    data_quality: str = "unknown"  # high / medium / low
    notes: str = ""  # スクレイピング時の注記


@dataclass
class PostMetrics:
    """X投稿のメトリクス"""
    text: str
    author: str
    likes: int = 0
    retweets: int = 0
    replies: int = 0
    impressions: int = 0
    url: str = ""
    timestamp: str = ""
    engagement_rate: float = 0.0

    def to_dict(self):
        return asdict(self)


class WebScraper:
    """API なしで公開情報からデータを取得"""

    def __init__(self, company_name: str):
        self.company_name = company_name
        self.scraped_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
        self.sources: List[Dict] = []

    def _fetch_page(self, url: str, timeout: int = 10) -> Optional[str]:
        """ウェブページをフェッチ（User-Agent付き）"""
        try:
            req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="ignore")
        except urllib.error.URLError as e:
            print(f"⚠️ ネットワークエラー ({url}): {e}")
            return None
        except Exception as e:
            print(f"⚠️ エラー ({url}): {e}")
            return None

    # ==================== note スクレイピング ====================

    def scrape_note_mentions(self) -> Optional[ScrapedData]:
        """
        note で商品名の言及数を取得
        note 検索ページ: https://note.com/search?q={company_name}
        """
        print(f"🔍 note をスクレイピング中: {self.company_name}")

        search_url = f"https://note.com/search?q={quote(self.company_name)}&d=1"
        html = self._fetch_page(search_url)

        if not html:
            return ScrapedData(
                platform="note",
                data_quality="low",
                notes="ネットワークエラー"
            )

        # 検索結果数を抽出（例：「123件の記事が見つかりました」）
        match = re.search(r'data-total-count="(\d+)"', html)
        if match:
            count = int(match.group(1))
            self.sources.append({
                "platform": "note",
                "url": search_url,
                "accessed_at": self.scraped_at,
                "method": "web scraping"
            })
            return ScrapedData(
                platform="note",
                posts=count,
                source_url=search_url,
                data_quality="high",
                notes=f"{self.company_name} を含む記事数（{self.scraped_at} 取得）"
            )

        # フォールバック：もしデータ属性が見つからない場合は、正規表現で試す
        match = re.search(r'>(\d+)<.*?件の記事', html)
        if match:
            count = int(match.group(1))
            return ScrapedData(
                platform="note",
                posts=count,
                source_url=search_url,
                data_quality="medium",
                notes="正規表現抽出（精度は中程度）"
            )

        return ScrapedData(
            platform="note",
            data_quality="low",
            notes="言及数を取得できませんでした"
        )

    def scrape_note_official_account(self, account_handle: str) -> Optional[ScrapedData]:
        """
        note 公式アカウント情報を取得
        例：https://note.com/kashosanzen
        """
        print(f"🔍 note 公式アカウント確認中: {account_handle}")

        account_url = f"https://note.com/{account_handle}"
        html = self._fetch_page(account_url)

        if not html:
            return ScrapedData(
                platform="note_official",
                data_quality="low",
                notes="ページ取得失敗"
            )

        # アカウントが存在するかチェック（404 でない = 存在）
        if "404" in html or "ページが見つかりません" in html:
            return ScrapedData(
                platform="note_official",
                posts=0,
                source_url=account_url,
                data_quality="high",
                notes="公式アカウント：存在しない"
            )

        # 投稿数を抽出（例：<span class="count">42</span>）
        match = re.search(r'投稿\s*</span>\s*<span[^>]*>(\d+)<', html)
        if match:
            posts = int(match.group(1))
            self.sources.append({
                "platform": "note_official",
                "url": account_url,
                "accessed_at": self.scraped_at
            })
            return ScrapedData(
                platform="note_official",
                posts=posts,
                source_url=account_url,
                data_quality="high",
                notes=f"公式アカウント投稿数: {posts}本"
            )

        return ScrapedData(
            platform="note_official",
            posts=0,
            source_url=account_url,
            data_quality="medium",
            notes="アカウント存在（投稿数抽出失敗）"
        )

    # ==================== YouTube スクレイピング ====================

    def scrape_youtube_channel(self, channel_url: str) -> Optional[ScrapedData]:
        """
        YouTube チャンネル情報を取得
        例：https://www.youtube.com/@kashosanzen
        """
        print(f"🔍 YouTube をスクレイピング中: {channel_url}")

        html = self._fetch_page(channel_url)
        if not html:
            return ScrapedData(platform="youtube", data_quality="low")

        # 登録者数を抽出（単位は K, M など）
        subscriber_match = re.search(
            r'"subscriberCountText":\s*"([^"]*)"',
            html
        )
        if subscriber_match:
            subscriber_text = subscriber_match.group(1)
            subscribers = self._parse_youtube_count(subscriber_text)

            self.sources.append({
                "platform": "youtube",
                "url": channel_url,
                "accessed_at": self.scraped_at
            })

            return ScrapedData(
                platform="youtube",
                followers=subscribers,
                source_url=channel_url,
                data_quality="high",
                notes=f"登録者数: {subscriber_text}"
            )

        return ScrapedData(
            platform="youtube",
            data_quality="low",
            notes="登録者数を抽出できませんでした"
        )

    @staticmethod
    def _parse_youtube_count(count_str: str) -> int:
        """
        YouTube の登録者数文字列をパース
        例：「1.5万」「42.3万」「123」
        """
        count_str = count_str.strip()

        # 数字とアルファベットを分離
        match = re.match(r'([0-9.]+)\s*([KM万]?)', count_str)
        if not match:
            return 0

        num_str, unit = match.groups()
        num = float(num_str)

        if unit in ["K", "万"]:
            return int(num * 10000)
        elif unit == "M":
            return int(num * 1000000)
        else:
            return int(num)

    # ==================== X（Twitter）スクレイピング ====================

    def scrape_x_profile(self, x_handle: str) -> Optional[ScrapedData]:
        """
        X（Twitter）のプロフィール情報を取得
        注：X は Bot 対策が強いため、限定的な情報取得のみ推奨
        """
        print(f"🔍 X プロフィール確認中: @{x_handle}")

        # X の公開 API ドキュメント URL（情報のみ）
        profile_url = f"https://twitter.com/{x_handle}"
        html = self._fetch_page(profile_url)

        if not html:
            return ScrapedData(
                platform="x",
                data_quality="low",
                notes="X のスクレイピングはbot対策により困難。代替方法を推奨"
            )

        # X はクライアントサイドレンダリング（CSR）のため、静的スクレイピングは不正確
        # 以下は参考実装のみ
        return ScrapedData(
            platform="x",
            data_quality="low",
            notes="X はブラウザ自動化またはセミナンティック HTML API が必要"
        )

    # ==================== Instagram スクレイピング ====================

    def scrape_instagram_profile(self, ig_handle: str) -> Optional[ScrapedData]:
        """
        Instagram のプロフィール情報を取得
        注：Instagram も API 厳格化されているため、限定的な情報取得のみ推奨
        """
        print(f"🔍 Instagram プロフィール確認中: @{ig_handle}")

        profile_url = f"https://www.instagram.com/{ig_handle}/"
        html = self._fetch_page(profile_url)

        if not html:
            return ScrapedData(
                platform="instagram",
                data_quality="low",
                notes="Instagram のスクレイピングは制限されています"
            )

        # Instagram も CSR のため静的スクレイピングは不正確
        return ScrapedData(
            platform="instagram",
            data_quality="low",
            notes="Instagram はブラウザ自動化が必要"
        )

    # ==================== 企業情報スクレイピング ====================

    def scrape_company_info(self, company_url: str) -> Optional[Dict]:
        """
        企業公式サイトから基本情報を取得
        例：https://www.sanzen.co.jp/
        """
        print(f"🔍 企業サイト情報取得中: {company_url}")

        html = self._fetch_page(company_url)
        if not html:
            return None

        info = {}

        # 採用情報リンク検出
        if "採用" in html or "recruit" in html.lower():
            info["has_recruitment_page"] = True
            recruitment_match = re.search(
                r'href="([^"]*(?:recruit|採用)[^"]*)"',
                html,
                re.IGNORECASE
            )
            if recruitment_match:
                info["recruitment_url"] = recruitment_match.group(1)

        # 企業規模情報（従業員数など）
        employees_match = re.search(
            r'従業員数[：:\s]*([0-9,]+)',
            html
        )
        if employees_match:
            emp_str = employees_match.group(1).replace(",", "")
            try:
                info["employee_count"] = int(emp_str)
            except ValueError:
                pass

        # 設立年
        founded_match = re.search(
            r'(?:設立|創立)[：:\s]*([0-9]{4})',
            html
        )
        if founded_match:
            info["founded_year"] = int(founded_match.group(1))

        self.sources.append({
            "platform": "company_website",
            "url": company_url,
            "accessed_at": self.scraped_at
        })

        return info if info else None

    # ==================== 採用情報スクレイピング ====================

    def scrape_recruitment_info(self, recruitment_url: str) -> Optional[Dict]:
        """
        採用情報ページから最終更新日と職種情報を取得
        """
        print(f"🔍 採用情報ページ確認中: {recruitment_url}")

        html = self._fetch_page(recruitment_url)
        if not html:
            return None

        info = {}

        # 最終更新日
        update_match = re.search(
            r'(?:更新|Updated)[：:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})',
            html
        )
        if update_match:
            info["last_updated"] = update_match.group(1)

        # 募集職種数
        job_count = len(re.findall(r'<(?:h[3-4]|div)[^>]*class="[^"]*job[^"]*"', html))
        if job_count > 0:
            info["active_job_postings"] = job_count

        self.sources.append({
            "platform": "recruitment_page",
            "url": recruitment_url,
            "accessed_at": self.scraped_at
        })

        return info if info else None

    # ==================== データ品質評価 ====================

    def evaluate_data_quality(self, data: ScrapedData) -> str:
        """
        スクレイピングしたデータの品質を評価
        """
        if not data or not data.posts and not data.followers:
            return "low"  # データなし

        # ソースがある + データがある = 高品質
        if data.source_url and (data.posts or data.followers):
            return "high"

        return "medium"

    def get_sources_json(self) -> str:
        """
        すべてのデータ取得元（ソース）を JSON で返す
        """
        return json.dumps(self.sources, ensure_ascii=False, indent=2)

    # ==================== X（Twitter）投稿取得（Playwright使用） ====================

    def scrape_x_posts(self, handle: str, limit: int = 10) -> List[PostMetrics]:
        """
        X（Twitter）アカウントの投稿を取得（Playwright使用）

        Args:
            handle: Xハンドル（@記号なし）
            limit: 取得する投稿数

        Returns:
            PostMetrics のリスト（いいね数でソート済み）
        """
        if not PLAYWRIGHT_AVAILABLE:
            print("❌ Playwright がインストールされていません")
            return []

        print(f"🔍 X投稿を取得中: @{handle} (最新{limit}件)")

        posts = []
        try:
            with sync_playwright() as p:
                # Chromium を起動（既存ブラウザを使用）
                browser = p.chromium.launch(
                    executable_path='/opt/pw-browsers/chromium',
                    headless=True
                )
                page = browser.new_page()

                # X プロフィールにアクセス
                profile_url = f"https://x.com/{handle}"
                print(f"   → {profile_url} に接続中...")

                try:
                    page.goto(profile_url, wait_until='networkidle', timeout=30000)
                except Exception as e:
                    print(f"   ⚠️ ページ読み込みタイムアウト: {e}")
                    browser.close()
                    return []

                # 投稿フィードをスクロール
                print(f"   → 投稿フィードをスクロール中...")
                for i in range(3):  # 3回スクロール
                    page.evaluate("window.scrollBy(0, 1000)")
                    time.sleep(1)

                # 投稿要素を抽出
                print(f"   → 投稿を解析中...")
                post_elements = page.query_selector_all('article')

                for i, element in enumerate(post_elements[:limit]):
                    try:
                        post = self._extract_post_metrics(element)
                        if post:
                            posts.append(post)
                            print(f"      投稿 {i+1}: {post.likes}♥ {post.retweets}🔄 {post.impressions}👁️")
                    except Exception as e:
                        print(f"      投稿 {i+1} 抽出失敗: {e}")
                        continue

                browser.close()

                # いいね数でソート（降順）
                posts.sort(key=lambda p: p.likes, reverse=True)

                # ソース記録
                self.sources.append({
                    "platform": "x",
                    "url": profile_url,
                    "accessed_at": self.scraped_at,
                    "method": "playwright"
                })

                print(f"✅ {len(posts)}件の投稿を取得しました")

        except Exception as e:
            print(f"❌ X スクレイピングエラー: {e}")

        return posts

    def _extract_post_metrics(self, element) -> Optional[PostMetrics]:
        """
        記事要素から投稿のメトリクスを抽出
        """
        try:
            # テキスト抽出
            text_elem = element.query_selector('[data-testid="tweetText"]')
            text = text_elem.inner_text() if text_elem else ""

            # 投稿URL
            link_elem = element.query_selector('a[href*="/status/"]')
            url = link_elem.get_attribute('href') if link_elem else ""

            # 作成者
            author_elem = element.query_selector('[data-testid="User-Name"]')
            author = author_elem.inner_text() if author_elem else "Unknown"

            # メトリクス抽出（アイコンの隣のテキストから）
            metrics_container = element.query_selector_all('[role="group"]')

            likes = self._parse_metric(element, "like")
            retweets = self._parse_metric(element, "retweet")
            replies = self._parse_metric(element, "reply")
            impressions = self._parse_metric(element, "analytics")

            # エンゲージメント率計算（合計エンゲージメント）
            total_engagement = likes + retweets + replies

            # タイムスタンプ
            time_elem = element.query_selector('time')
            timestamp = time_elem.get_attribute('datetime') if time_elem else ""

            if text:  # テキストがある場合のみ
                return PostMetrics(
                    text=text[:100],  # 最初の100文字
                    author=author,
                    likes=likes,
                    retweets=retweets,
                    replies=replies,
                    impressions=impressions,
                    url=url,
                    timestamp=timestamp,
                    engagement_rate=total_engagement
                )
        except Exception as e:
            print(f"        メトリクス抽出エラー: {e}")

        return None

    def _parse_metric(self, element, metric_type: str) -> int:
        """
        投稿メトリクス（いいね、リツートなど）を抽出
        metric_type: "like", "retweet", "reply", "analytics"
        """
        try:
            # Xの構造に応じた抽出（data-testid属性）
            metric_map = {
                "like": "favorite",
                "retweet": "retweet",
                "reply": "reply",
                "analytics": "analytics"
            }

            selector = f'[data-testid="{metric_map.get(metric_type, "")}_button"]'
            metric_elem = element.query_selector(selector)

            if metric_elem:
                text = metric_elem.inner_text()
                # "1.2K", "42", "0" などの形式をパース
                return self._parse_metric_text(text)
        except Exception:
            pass

        return 0

    @staticmethod
    def _parse_metric_text(text: str) -> int:
        """
        「1.2K」「42」などのメトリクステキストを数値に変換
        """
        if not text:
            return 0

        text = text.strip().upper()

        # 数字部分を抽出
        match = re.match(r'([0-9.]+)\s*([KMB])?', text)
        if not match:
            return 0

        num_str, unit = match.groups()
        num = float(num_str)

        if unit == 'K':
            return int(num * 1000)
        elif unit == 'M':
            return int(num * 1000000)
        elif unit == 'B':
            return int(num * 1000000000)
        else:
            return int(num)

    def scrape_multiple_x_accounts(self, handles: List[str], limit: int = 10) -> Dict[str, List[PostMetrics]]:
        """
        複数のXアカウントの投稿を一括取得

        Args:
            handles: Xハンドルのリスト
            limit: 各アカウントから取得する投稿数

        Returns:
            {handle: [PostMetrics, ...]} の辞書
        """
        print(f"\n{'='*60}")
        print(f"🔍 複数Xアカウントを分析中 ({len(handles)}個)")
        print(f"{'='*60}\n")

        all_posts = {}

        for handle in handles:
            print(f"\n📊 @{handle}")
            posts = self.scrape_x_posts(handle, limit)
            all_posts[handle] = posts
            time.sleep(2)  # Rate limit 回避

        return all_posts


def main():
    """デモンストレーション"""
    scraper = WebScraper("いちさん (@ichiaimarketer)")

    print("=" * 60)
    print("SNS Scraper デモ（Playwright対応）")
    print("=" * 60)
    print()

    # 1. note 言及数取得
    print("📝 Note 言及数取得...")
    note_mentions = scraper.scrape_note_mentions()
    print(f"✅ note 言及数: {note_mentions.posts} 件")
    print(f"   品質: {note_mentions.data_quality}")
    print()

    # 2. X投稿取得（Playwright）
    print("🔍 X投稿取得テスト...")
    if PLAYWRIGHT_AVAILABLE:
        print("   注: 実際のX接続はbot対策により失敗する場合があります")
        print("   これは開発環境での制限です\n")

        # テスト用に複数アカウントのハンドルを指定
        test_handles = [
            "ichiaimarketer",      # メインアカウント
            "ClaudeCode_love",     # Claude Code特化
            "AiAircle34052"        # AirCle公式
        ]

        print(f"✅ Playwright は利用可能です")
        print(f"   以下のアカウントから投稿を取得可能:")
        for handle in test_handles:
            print(f"     - @{handle}")
        print()

        # 実際のスクレイピングはコメント（環境制限により実行不可）
        # posts = scraper.scrape_x_posts("ichiaimarketer", limit=10)
        # print(f"   取得投稿数: {len(posts)}")
    else:
        print("❌ Playwright がインストールされていません")
    print()

    # 3. ソース一覧
    print("=" * 60)
    print("📍 データ取得元")
    print("=" * 60)
    print(scraper.get_sources_json())


if __name__ == "__main__":
    main()
