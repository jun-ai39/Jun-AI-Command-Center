"""ニュースと市場データから無料の朝ブリーフを作成します。

このスクリプトは生成AIを使用しません。既存JSONの見出しと数値を
決められたルールで整理し、因果関係や将来予測は生成しません。
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
NEWS_PATH = PROJECT_ROOT / "data" / "news.json"
MARKET_PATH = PROJECT_ROOT / "data" / "market.json"
OUTPUT_PATH = PROJECT_ROOT / "data" / "briefing.json"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return data


def safe_text(value, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def safe_number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def safe_https_url(value) -> str | None:
    url = safe_text(value)
    parsed = urlparse(url)
    if parsed.scheme == "https" and parsed.netloc:
        return url
    return None


def parse_news_date(value) -> datetime:
    """RSS日時とISO 8601日時の両方を読み取ります。"""
    text = safe_text(value)
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        date = parsedate_to_datetime(text)
        if not isinstance(date, datetime):
            raise ValueError("RSS date is invalid")
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        return date.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return datetime.min.replace(tzinfo=timezone.utc)


def select_latest_news(news_data: dict, limit: int = 3) -> list[dict]:
    items = news_data.get("items", [])
    if not isinstance(items, list):
        return []

    valid_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = safe_text(item.get("title"))
        if not title:
            continue
        valid_items.append(
            {
                "title": title,
                "category": safe_text(item.get("category"), "一般"),
                "source": safe_text(item.get("source"), "情報源未設定"),
                "published_at": safe_text(item.get("published_at")) or None,
                "url": safe_https_url(item.get("url")),
            }
        )

    valid_items.sort(
        key=lambda item: parse_news_date(item.get("published_at")), reverse=True
    )
    return valid_items[:limit]


def valid_market_items(market_data: dict, group_name: str) -> list[dict]:
    group = market_data.get(group_name, [])
    if not isinstance(group, list):
        return []
    return [item for item in group if isinstance(item, dict)]


def direction_summary(items: list[dict]) -> str:
    changes = [
        safe_number(item.get("change_percent"))
        for item in items
    ]
    valid_changes = [change for change in changes if change is not None]
    if not valid_changes:
        return "変動率データなし"

    rising = sum(change > 0.01 for change in valid_changes)
    falling = sum(change < -0.01 for change in valid_changes)
    flat = len(valid_changes) - rising - falling
    return f"上昇 {rising}・下落 {falling}・横ばい {flat}"


def largest_move(items: list[dict]) -> dict | None:
    candidates = []
    for item in items:
        change = safe_number(item.get("change_percent"))
        if change is None:
            continue
        candidates.append(
            {
                "name": safe_text(item.get("name"), safe_text(item.get("symbol"), "名称未設定")),
                "symbol": safe_text(item.get("symbol")),
                "change_percent": change,
            }
        )
    return max(candidates, key=lambda item: abs(item["change_percent"]), default=None)


def format_move(item: dict | None) -> str:
    if not item:
        return "最大変動を計算できません"
    change = item["change_percent"]
    return f"最大変動：{item['name']} {change:+.2f}%"


def build_market_snapshot(market_data: dict) -> list[dict]:
    stocks = valid_market_items(market_data, "stocks")
    crypto = valid_market_items(market_data, "crypto")
    forex = valid_market_items(market_data, "forex")
    sentiment = market_data.get("sentiment")

    snapshot = [
        {
            "label": "株式",
            "value": direction_summary(stocks),
            "detail": format_move(largest_move(stocks)),
        },
        {
            "label": "暗号資産",
            "value": direction_summary(crypto),
            "detail": format_move(largest_move(crypto)),
        },
    ]

    if isinstance(sentiment, dict):
        value = safe_number(sentiment.get("value"))
        if value is not None and 0 <= value <= 100:
            snapshot.append(
                {
                    "label": "市場心理",
                    "value": f"{value:.0f} / 100",
                    "detail": safe_text(
                        sentiment.get("classification_ja"),
                        safe_text(sentiment.get("classification"), "分類なし"),
                    ),
                }
            )

    usd_jpy = next(
        (item for item in forex if safe_text(item.get("symbol")) == "USD/JPY"),
        None,
    )
    if usd_jpy:
        price = safe_number(usd_jpy.get("price"))
        change = safe_number(usd_jpy.get("change_percent"))
        if price is not None:
            detail = f"前日比 {change:+.2f}%" if change is not None else "前日比データなし"
            snapshot.append(
                {"label": "ドル円", "value": f"{price:.3f} JPY", "detail": detail}
            )

    return snapshot


def build_watch_points(news_items: list[dict], market_data: dict) -> list[dict]:
    points = []

    if news_items:
        latest = news_items[0]
        points.append(
            {
                "title": "最新ニュースを確認",
                "detail": latest["title"],
                "meta": f"{latest['category']}・{latest['source']}",
                "level": "normal",
            }
        )

    stock_move = largest_move(valid_market_items(market_data, "stocks"))
    if stock_move:
        change = stock_move["change_percent"]
        points.append(
            {
                "title": "株式市場の最大変動",
                "detail": f"{stock_move['name']}が前日比{change:+.2f}%です。",
                "meta": "取得対象の中で絶対値が最大",
                "level": "alert" if abs(change) >= 2 else "normal",
            }
        )

    sentiment = market_data.get("sentiment")
    if isinstance(sentiment, dict):
        value = safe_number(sentiment.get("value"))
        if value is not None and 0 <= value <= 100:
            label = safe_text(
                sentiment.get("classification_ja"),
                safe_text(sentiment.get("classification"), "分類なし"),
            )
            points.append(
                {
                    "title": "Bitcoin市場心理",
                    "detail": f"Fear & Greed Indexは{value:.0f}（{label}）です。",
                    "meta": "Alternative.meの参考指標",
                    "level": "alert" if value <= 25 or value >= 75 else "normal",
                }
            )

    return points[:3]


def build_briefing(news_data: dict, market_data: dict) -> dict:
    news_items = select_latest_news(news_data)
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": "rule_based",
        "mode_label": "ルールベース（AI未使用）",
        "ai_generated": False,
        "news_items": news_items,
        "market_snapshot": build_market_snapshot(market_data),
        "watch_points": build_watch_points(news_items, market_data),
        "limitations": [
            "記事見出しと取得済み数値を機械的に整理しています。",
            "出来事の因果関係や背景は自動判定していません。",
            "将来予測・売買判断・投資助言は生成していません。",
        ],
        "source_updated_at": {
            "news": news_data.get("updated_at"),
            "market": market_data.get("updated_at"),
        },
    }


def write_json_safely(data: dict) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        dir=OUTPUT_PATH.parent,
        prefix="briefing-",
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
    try:
        news_data = load_json(NEWS_PATH)
        market_data = load_json(MARKET_PATH)
        briefing = build_briefing(news_data, market_data)
        write_json_safely(briefing)
        print(
            "Updated rule-based briefing with "
            f"{len(briefing['news_items'])} news items and "
            f"{len(briefing['watch_points'])} watch points."
        )
    except Exception as error:
        # 一時ファイル方式なので前回データは壊れません。失敗はActions上で明示します。
        print(f"ERROR: Rule-based briefing was not updated: {error}")
        raise


if __name__ == "__main__":
    main()
