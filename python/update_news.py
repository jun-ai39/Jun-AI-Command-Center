"""Jun AI Command Center の世界情勢ニュースを更新します。

報道機関のRSSから見出しと情報源URLを取得し、data/news.jsonへ保存します。
API取得に失敗した場合は既存データを上書きしません。
"""

from __future__ import annotations

import json
import os
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "news.json"
MAX_ITEMS = 9
MAX_RESPONSE_BYTES = 5_000_000

# APIキーを必要としない、報道機関のRSSだけを使用します。
RSS_SOURCES = (
    ("BBC News 日本語", "https://feeds.bbci.co.uk/japanese/rss.xml"),
    ("NHK NEWS WEB", "https://www.nhk.or.jp/rss/news/cat0.xml"),
)

# 地域の表示名は js/world-map.js と対応しています。
REGION_KEYWORDS = (
    (
        "japan",
        ("日本", "国内", "東京", "北海道", "沖縄", "日銀", "国会"),
    ),
    (
        "middle-east",
        (
            "中東",
            "イラン",
            "イスラエル",
            "ガザ",
            "パレスチナ",
            "シリア",
            "レバノン",
            "イラク",
            "サウジ",
            "イエメン",
            "ヨルダン",
            "カタール",
            "アラブ首長国連邦",
            "uae",
        ),
    ),
    (
        "latin-america",
        (
            "中南米",
            "メキシコ",
            "ブラジル",
            "アルゼンチン",
            "チリ",
            "ペルー",
            "コロンビア",
            "キューバ",
            "ベネズエラ",
        ),
    ),
    (
        "north-america",
        (
            "北米",
            "アメリカ",
            "米国",
            "カナダ",
            "ワシントン",
            "ニューヨーク",
            "トランプ",
            "united states",
            "u.s.",
            "canada",
        ),
    ),
    (
        "europe",
        (
            "欧州",
            "ヨーロッパ",
            "イギリス",
            "英国",
            "英仏",
            "フランス",
            "ドイツ",
            "イタリア",
            "スペイン",
            "ウクライナ",
            "ロシア",
            "ポーランド",
            "nato",
            "eu",
        ),
    ),
    (
        "africa",
        (
            "アフリカ",
            "南アフリカ",
            "スーダン",
            "エジプト",
            "ナイジェリア",
            "ケニア",
            "エチオピア",
            "コンゴ",
            "ソマリア",
        ),
    ),
    (
        "oceania",
        (
            "オセアニア",
            "オーストラリア",
            "ニュージーランド",
            "太平洋諸島",
            "フィジー",
            "パプアニューギニア",
        ),
    ),
    (
        "asia",
        (
            "アジア",
            "中国",
            "韓国",
            "北朝鮮",
            "台湾",
            "香港",
            "インド",
            "パキスタン",
            "東南アジア",
            "asean",
            "フィリピン",
            "インドネシア",
            "タイ",
            "ベトナム",
            "ミャンマー",
            "シンガポール",
        ),
    ),
)


def fetch_rss(source_name: str, feed_url: str) -> list[dict]:
    """1つのRSSから記事一覧を安全に取得します。"""
    parsed_feed_url = urlparse(feed_url)
    if parsed_feed_url.scheme != "https" or not parsed_feed_url.netloc:
        raise ValueError(f"{source_name} has an invalid RSS URL")

    request = urllib.request.Request(
        feed_url,
        headers={
            "User-Agent": "Jun-AI-Command-Center/1.0 (+GitHub Pages)",
            "Accept": "application/rss+xml, application/xml, text/xml",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"{source_name} returned HTTP {response.status}")

        # 想定外に大きなレスポンスを読み込まないよう上限を設定します。
        xml_data = response.read(MAX_RESPONSE_BYTES + 1)
        if len(xml_data) > MAX_RESPONSE_BYTES:
            raise RuntimeError(f"{source_name} RSS response is too large")

    root = ET.fromstring(xml_data)
    articles: list[dict] = []

    for item in root.findall(".//item"):
        articles.append(
            {
                "title": item.findtext("title", default=""),
                "url": item.findtext("link", default=""),
                "published_at": item.findtext("pubDate", default=""),
                "source": source_name,
            }
        )

    return articles


def fetch_articles() -> list[dict]:
    """複数RSSを取得し、1つが失敗しても残りを使用します。"""
    articles: list[dict] = []
    errors: list[str] = []

    for source_name, feed_url in RSS_SOURCES:
        try:
            articles.extend(fetch_rss(source_name, feed_url))
        except Exception as error:
            errors.append(f"{source_name}: {error}")

    if not articles:
        raise RuntimeError("All RSS sources failed: " + " | ".join(errors))
    if errors:
        print("Some RSS sources failed: " + " | ".join(errors))

    return articles


def classify(title: str) -> str:
    """見出しの単語から表示カテゴリーを分類します。"""
    categories = {
        "災害": ("地震", "津波", "台風", "洪水", "豪雨", "噴火", "災害"),
        "経済": ("経済", "市場", "株価", "金利", "物価", "関税", "貿易"),
        "紛争": ("戦争", "攻撃", "軍事", "紛争", "停戦", "ミサイル", "空爆"),
        "外交": ("首脳", "会談", "外交", "協議", "条約", "合意"),
    }

    for category, keywords in categories.items():
        if any(keyword in title for keyword in keywords):
            return category

    return "世界情勢"


def classify_region(title: str) -> str:
    """見出しの語句から地図用の地域を推定します。"""
    normalized_title = title.casefold()

    # REGION_KEYWORDSの順番が分類の優先順位です。
    for region, keywords in REGION_KEYWORDS:
        if any(keyword.casefold() in normalized_title for keyword in keywords):
            return region

    return "global"


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
        "source": str(article.get("source", parsed_url.netloc)).strip()[:100],
        "category": classify(title),
        "region": classify_region(title),
        "published_at": str(article.get("published_at", ""))[:64],
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
        "schema_version": 2,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Official news RSS feeds",
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
