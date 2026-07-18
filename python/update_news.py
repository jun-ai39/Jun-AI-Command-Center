"""Jun AI Command Center の世界情勢ニュースを更新します。

公開APIから見出しと情報源URLだけを取得し、data/news.jsonへ保存します。
API取得に失敗した場合は既存データを上書きしません。
"""

from __future__ import annotations

import json
import os
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "news.json"
API_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"
MAX_ITEMS = 9


def build_api_url() -> str:
    """GDELT DOC 2.0 APIの検索URLを作成します。"""
    parameters = {
        "query": "(conflict OR economy OR disaster OR diplomacy) sourcelang:japanese",
        "mode": "artlist",
        "maxrecords": "50",
        "format": "json",
        "sort": "datedesc",
        "timespan": "24h",
    }
    return f"{API_ENDPOINT}?{urllib.parse.urlencode(parameters)}"


def fetch_articles() -> list[dict]:
    """APIから記事一覧を取得します。"""
    request = urllib.request.Request(
        build_api_url(),
        headers={
            "User-Agent": "Jun-AI-Command-Center/1.0 (+GitHub Pages)",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"GDELT API returned HTTP {response.status}")
        payload = json.load(response)

    articles = payload.get("articles", [])
    if not isinstance(articles, list):
        raise ValueError("API response does not contain an article list")
    return articles


def classify(title: str) -> str:
    """見出しの単語から表示カテゴリーを分類します。"""
    categories = {
        "災害": ("地震", "津波", "台風", "洪水", "豪雨", "噴火", "災害"),
        "経済": ("経済", "市場", "株価", "金利", "物価", "関税", "貿易"),
        "紛争": ("戦争", "攻撃", "軍事", "紛争", "停戦", "ミサイル"),
        "外交": ("首脳", "会談", "外交", "協議", "条約", "合意"),
    }
    for category, keywords in categories.items():
        if any(keyword in title for keyword in keywords):
            return category
    return "世界情勢"


def normalize_article(article: dict) -> dict | None:
    """表示に必要な項目だけを検証して取り出します。"""
    title = str(article.get("title", "")).strip()
    url = str(article.get("url", "")).strip()
    parsed_url = urlparse(url)

    if not title or parsed_url.scheme != "https" or not parsed_url.netloc:
        return None

    return {
        "title": title[:240],
        "summary": "見出しの詳細は、リンク先の情報源で確認してください。",
        "url": url,
        "source": parsed_url.netloc.removeprefix("www.")[:100],
        "category": classify(title),
        "published_at": str(article.get("seendate", ""))[:32],
    }


def build_news_data(articles: list[dict]) -> dict:
    """重複URLを除き、画面表示用データを作成します。"""
    items: list[dict] = []
    seen_urls: set[str] = set()

    for article in articles:
        normalized = normalize_article(article)
        if not normalized or normalized["url"] in seen_urls:
            continue
        seen_urls.add(normalized["url"])
        items.append(normalized)
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        raise ValueError("No valid news articles were returned")

    return {
        "schema_version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "GDELT DOC 2.0 API",
        "items": items,
    }


def write_json_safely(data: dict) -> None:
    """一時ファイルへ書き込み、完成後に置き換えます。"""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        dir=OUTPUT_PATH.parent,
        prefix="news-",
        suffix=".json",
        text=True,
    )
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
        os.replace(temporary_name, OUTPUT_PATH)
    except Exception:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def main() -> None:
    articles = fetch_articles()
    news_data = build_news_data(articles)
    write_json_safely(news_data)
    print(f"Updated {OUTPUT_PATH} with {len(news_data['items'])} articles.")


if __name__ == "__main__":
    main()
