"""公式RSSからAIニュースを更新します。

OpenAIとGoogleの公式RSSだけを取得し、data/ai-news.jsonへ保存します。
Anthropicは公開RSSを確認できないため、既存の公式Newsroom記事を保持します。

安全上の方針:
- APIキーや個人情報を使用しません。
- 許可したHTTPSドメイン以外のURLは保存しません。
- 取得サイズに上限を設けます。
- 一時ファイルへ書き込み、完成後に置き換えます。
- 通信失敗時は、その情報源の前回データを保持します。
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "ai-news.json"

MAX_ITEMS_PER_SOURCE = 10
MAX_ANTHROPIC_ITEMS = 10
MAX_FEED_BYTES = 5_000_000
REQUEST_TIMEOUT = 30
JAPAN_TIMEZONE = timezone(timedelta(hours=9))

RSS_SOURCES = (
    {
        "id": "openai",
        "name": "OpenAI",
        "feed_url": "https://openai.com/news/rss.xml",
        "page_url": "https://openai.com/news/",
        "allowed_hosts": {"openai.com", "www.openai.com"},
        "filter_ai": False,
    },
    {
        "id": "google",
        "name": "Google",
        "feed_url": "https://blog.google/rss/",
        "page_url": "https://blog.google/innovation-and-ai/",
        "allowed_hosts": {"blog.google"},
        # GoogleのRSSは全分野を含むため、AI関連だけを選びます。
        "filter_ai": True,
    },
)

AI_KEYWORDS = (
    "ai",
    "artificial intelligence",
    "gemini",
    "deepmind",
    "machine learning",
    "generative",
    "language model",
    "agentic",
    "ai agent",
    "notebooklm",
    "gemma",
    "veo",
    "imagen",
)

CATEGORY_KEYWORDS = {
    "safety": ("safety", "security", "risk", "safeguard", "responsible"),
    "education": ("education", "teacher", "student", "school", "learn", "study"),
    "business": ("business", "enterprise", "company", "economic", "investment"),
    "model": ("model", "gpt", "gemini", "gemma", "veo", "imagen"),
}


class TextExtractor(HTMLParser):
    """RSSの説明文からHTMLタグを除き、文字列だけを取り出します。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def clean_text(value, limit: int) -> str:
    """HTMLをプレーンテキストへ変換し、長さを制限します。"""
    extractor = TextExtractor()
    try:
        extractor.feed(str(value or ""))
        text = " ".join(extractor.parts)
    except Exception:
        text = str(value or "")
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def element_name(element: ET.Element) -> str:
    """XML名前空間を除いたタグ名を返します。"""
    return element.tag.rsplit("}", 1)[-1].lower()


def child_text(element: ET.Element, *names: str) -> str:
    """RSS 2.0とAtomの両方から指定要素の文字列を探します。"""
    expected = {name.lower() for name in names}
    for child in element:
        if element_name(child) in expected:
            return "".join(child.itertext()).strip()
    return ""


def entry_link(element: ET.Element) -> str:
    """RSSのlink本文またはAtomのhref属性を取得します。"""
    for child in element:
        if element_name(child) != "link":
            continue
        href = str(child.attrib.get("href", "")).strip()
        relation = str(child.attrib.get("rel", "alternate")).strip()
        if href and relation in {"", "alternate"}:
            return href
        if child.text and child.text.strip():
            return child.text.strip()
    return ""


def parse_date(value: str) -> datetime:
    """RSS日時またはISO 8601日時をUTCへ変換します。"""
    text = str(value or "").strip()
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)

    try:
        parsed = parsedate_to_datetime(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return datetime.min.replace(tzinfo=timezone.utc)


def is_allowed_https_url(value: str, allowed_hosts: set[str]) -> bool:
    parsed = urlparse(str(value or "").strip())
    return parsed.scheme == "https" and parsed.hostname in allowed_hosts


def fetch_feed(source: dict) -> bytes:
    """取得先と容量を検証して公式RSSをダウンロードします。"""
    request = urllib.request.Request(
        source["feed_url"],
        headers={
            "User-Agent": "Jun-AI-Command-Center/1.0 (+GitHub Pages)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
    )

    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        final_url = response.geturl()
        if not is_allowed_https_url(final_url, source["allowed_hosts"]):
            raise RuntimeError("RSS redirected to an unapproved host")
        payload = response.read(MAX_FEED_BYTES + 1)

    if len(payload) > MAX_FEED_BYTES:
        raise RuntimeError("RSS response exceeded the size limit")
    return payload


def is_ai_related(raw_item: dict) -> bool:
    haystack = " ".join(
        str(raw_item.get(key, ""))
        for key in ("title", "summary", "category", "url")
    ).lower()
    return any(keyword in haystack for keyword in AI_KEYWORDS)


def classify(title: str, summary: str, category: str) -> str:
    """公式RSSの語句から表示カテゴリーを分類します。"""
    haystack = f"{title} {summary} {category}".lower()
    for category_id, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return category_id
    return "product"


def parse_feed(payload: bytes, source: dict) -> list[dict]:
    """RSS 2.0またはAtomを画面共通形式へ変換します。"""
    root = ET.fromstring(payload)
    entries = [
        element
        for element in root.iter()
        if element_name(element) in {"item", "entry"}
    ]

    items: list[dict] = []
    seen_urls: set[str] = set()
    for entry in entries:
        raw_item = {
            "title": child_text(entry, "title"),
            "url": entry_link(entry),
            "published_at": child_text(entry, "pubdate", "published", "updated", "date"),
            "summary": child_text(entry, "description", "summary", "content", "encoded"),
            "category": child_text(entry, "category"),
        }

        title = clean_text(raw_item["title"], 240)
        summary = clean_text(raw_item["summary"], 360)
        url = str(raw_item["url"]).strip()

        if not title or not is_allowed_https_url(url, source["allowed_hosts"]):
            continue
        if source["filter_ai"] and not is_ai_related(raw_item):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)

        published = parse_date(raw_item["published_at"])
        published_at = (
            published.astimezone(JAPAN_TIMEZONE).date().isoformat()
            if published.year > 1
            else ""
        )
        stable_id = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]

        items.append(
            {
                "id": f"{source['id']}-{stable_id}",
                "source": source["id"],
                "source_name": source["name"],
                "published_at": published_at,
                "category": classify(title, summary, raw_item["category"]),
                # 新着記事は公式の原文タイトルを表示します。
                # 手作業で確認済みの日本語タイトルがあれば、後で引き継ぎます。
                "title_ja": title,
                "original_title": title,
                "summary_ja": summary or "詳細は公式記事で確認してください。",
                "url": url,
            }
        )

    items.sort(key=lambda item: item.get("published_at", ""), reverse=True)
    return items[:MAX_ITEMS_PER_SOURCE]


def load_existing_data() -> dict:
    if not OUTPUT_PATH.exists():
        return {
            "schema_version": 1,
            "verified_at": None,
            "display_timezone": "Asia/Tokyo",
            "notice": "詳細と最新情報は必ず公式記事で確認してください。",
            "sources": [],
            "items": [],
        }
    with OUTPUT_PATH.open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise ValueError("ai-news.json must contain a JSON object")
    return data


def existing_items_for_source(data: dict, source_id: str) -> list[dict]:
    items = data.get("items", [])
    if not isinstance(items, list):
        return []
    return [
        item
        for item in items
        if isinstance(item, dict) and item.get("source") == source_id
    ]


def preserve_reviewed_text(new_items: list[dict], old_items: list[dict]) -> list[dict]:
    """同じURLの日本語タイトルと説明があれば引き継ぎます。"""
    previous_by_url = {
        str(item.get("url", "")): item
        for item in old_items
        if isinstance(item, dict) and item.get("url")
    }
    for item in new_items:
        previous = previous_by_url.get(item["url"])
        if not previous:
            continue
        for key in ("title_ja", "summary_ja"):
            reviewed_text = clean_text(previous.get(key), 360 if key == "summary_ja" else 240)
            if reviewed_text:
                item[key] = reviewed_text
    return new_items


def ensure_sources(data: dict) -> list[dict]:
    """公式情報源の一覧を重複なく保持します。"""
    sources_by_id = {
        str(source.get("id")): source
        for source in data.get("sources", [])
        if isinstance(source, dict) and source.get("id")
    }
    for source in RSS_SOURCES:
        sources_by_id[source["id"]] = {
            "id": source["id"],
            "name": source["name"],
            "url": source["page_url"],
        }
    sources_by_id.setdefault(
        "anthropic",
        {
            "id": "anthropic",
            "name": "Anthropic",
            "url": "https://www.anthropic.com/news",
        },
    )
    return [sources_by_id[source_id] for source_id in ("openai", "google", "anthropic")]


def write_json_safely(data: dict) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        dir=OUTPUT_PATH.parent,
        prefix="ai-news-",
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
    data = load_existing_data()
    source_status: dict[str, str] = {}
    combined_items: list[dict] = []
    updated_any = False

    for source in RSS_SOURCES:
        previous_items = existing_items_for_source(data, source["id"])
        try:
            fetched_items = parse_feed(fetch_feed(source), source)
            if not fetched_items:
                raise ValueError("No valid AI news items were found")
            combined_items.extend(preserve_reviewed_text(fetched_items, previous_items))
            source_status[source["id"]] = "updated"
            updated_any = True
            print(f"Updated {source['name']} with {len(fetched_items)} items.")
        except Exception as error:
            combined_items.extend(previous_items)
            source_status[source["id"]] = "kept_previous"
            print(f"WARNING: {source['name']} kept previous data: {error}")

    # AnthropicはHTML構造変更による誤取得を避け、確認済みの公式記事を保持します。
    anthropic_items = existing_items_for_source(data, "anthropic")[:MAX_ANTHROPIC_ITEMS]
    combined_items.extend(anthropic_items)
    source_status["anthropic"] = "manual_official_newsroom"

    if not updated_any:
        print("WARNING: No RSS source was updated. Existing ai-news.json was not changed.")
        return

    # URL単位で重複を除き、発表日の新しい順に並べます。
    unique_items: list[dict] = []
    seen_urls: set[str] = set()
    for item in sorted(
        combined_items,
        key=lambda news_item: str(news_item.get("published_at", "")),
        reverse=True,
    ):
        url = str(item.get("url", "")).strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        unique_items.append(item)

    now_utc = datetime.now(timezone.utc)
    data.update(
        {
            "schema_version": 2,
            "updated_at": now_utc.isoformat(timespec="seconds"),
            "verified_at": now_utc.astimezone(JAPAN_TIMEZONE).date().isoformat(),
            "display_timezone": "Asia/Tokyo",
            "notice": (
                "OpenAIとGoogleは公式RSSから自動更新しています。"
                "Anthropicは確認済みの公式Newsroom記事を保持しています。"
                "詳細は必ず公式記事で確認してください。"
            ),
            "sources": ensure_sources(data),
            "source_status": source_status,
            "items": unique_items,
        }
    )
    write_json_safely(data)
    print(f"Updated {OUTPUT_PATH} with {len(unique_items)} official AI news items.")


if __name__ == "__main__":
    main()
