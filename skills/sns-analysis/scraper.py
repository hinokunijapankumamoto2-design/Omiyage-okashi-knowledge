#!/usr/bin/env python3
"""
SNS Analysis Skill - Web Scraper Module
APIを使わず、公開情報から正しいデータを取得
"""

import re
import json
import time
from datetime import datetime
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
from urllib.parse import quote
import urllib.request
import urllib.error
from http.client import HTTPResponse


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


def main():
    """デモンストレーション"""
    scraper = WebScraper("菓匠三全")

    print("=" * 60)
    print("API なし Web Scraper デモ")
    print("=" * 60)
    print()

    # 1. note 言及数取得
    note_mentions = scraper.scrape_note_mentions()
    print(f"✅ note 言及数: {note_mentions.posts} 件")
    print(f"   品質: {note_mentions.data_quality}")
    print(f"   出典: {note_mentions.source_url}")
    print()

    # 2. note 公式アカウント確認
    note_official = scraper.scrape_note_official_account("kashosanzen")
    print(f"✅ note 公式: {note_official.posts} 本")
    print(f"   注記: {note_official.notes}")
    print()

    # 3. YouTube チャンネル情報（例）
    # youtube_data = scraper.scrape_youtube_channel("https://www.youtube.com/@kashosanzen")
    # print(f"✅ YouTube 登録者: {youtube_data.followers}")
    # print()

    # 4. 企業情報
    company_info = scraper.scrape_company_info("https://www.sanzen.co.jp/")
    if company_info:
        print(f"✅ 企業情報:")
        for key, val in company_info.items():
            print(f"   {key}: {val}")
    print()

    # 5. ソース一覧
    print("=" * 60)
    print("📍 データ取得源（すべてAPI不使用）")
    print("=" * 60)
    print(scraper.get_sources_json())


if __name__ == "__main__":
    main()
