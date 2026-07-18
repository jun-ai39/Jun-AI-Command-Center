"""CoinGeckoから主要暗号資産の価格を取得します。

取得に失敗した場合は既存のmarket.jsonを保持し、ニュース更新や
GitHub Pages公開を止めない設計です。
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "market.json"
API_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets"

COIN_NAMES = {
    "bitcoin": "Bitcoin",
    "ethereum": "Ethereum",
    "solana": "Solana",
    "ripple": "XRP",
}


def build_api_url() -> str:
    parameters = {
        "vs_currency": "jpy",
        "ids": ",".join(COIN_NAMES),
        "order": "market_cap_desc",
        "per_page": str(len(COIN_NAMES)),
        "page": "1",
        "sparkline": "false",
        "price_change_percentage": "24h",
        "precision": "full",
    }
    return f"{API_ENDPOINT}?{urllib.parse.urlencode(parameters)}"


def fetch_crypto() -> list[dict]:
    """一時的なアクセス制限を考慮して最大3回取得します。"""
    request = urllib.request.Request(
        build_api_url(),
        headers={
            "User-Agent": "Jun-AI-Command-Center/1.0 (+GitHub Pages)",
            "Accept": "application/json",
        },
    )

    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise RuntimeError(f"CoinGecko returned HTTP {response.status}")
                payload = json.load(response)
            if not isinstance(payload, list):
                raise ValueError("CoinGecko response is not a list")
            return payload
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(attempt * 10)

    raise RuntimeError(f"CoinGecko request failed after retries: {last_error}")


def normalize_crypto(coins: list[dict]) -> list[dict]:
    items: list[dict] = []
    for coin in coins:
        coin_id = str(coin.get("id", ""))
        price = coin.get("current_price")
        change = coin.get("price_change_percentage_24h")
        if coin_id not in COIN_NAMES or not isinstance(price, (int, float)):
            continue
        items.append(
            {
                "symbol": str(coin.get("symbol", "")).upper(),
                "name": COIN_NAMES[coin_id],
                "price": price,
                "currency": "JPY",
                "change_percent": change if isinstance(change, (int, float)) else None,
                "decimals": 2 if price < 1000 else 0,
            }
        )
    if not items:
        raise ValueError("No valid cryptocurrency prices were returned")
    return items


def load_existing_data() -> dict:
    if not OUTPUT_PATH.exists():
        return {
            "schema_version": 1,
            "updated_at": None,
            "stocks": [],
            "crypto": [],
            "forex": [],
            "commodities": [],
        }
    with OUTPUT_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def write_json_safely(data: dict) -> None:
    file_descriptor, temporary_name = tempfile.mkstemp(
        dir=OUTPUT_PATH.parent,
        prefix="market-",
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
        crypto = normalize_crypto(fetch_crypto())
        data = load_existing_data()
        data["schema_version"] = 1
        data["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        data["crypto"] = crypto
        data.setdefault("stocks", [])
        data.setdefault("forex", [])
        data.setdefault("commodities", [])
        write_json_safely(data)
        print(f"Updated cryptocurrency data with {len(crypto)} assets.")
    except Exception as error:
        # 一時的なAPI障害で、サイト全体の公開を止めないようにします。
        print(f"WARNING: Cryptocurrency data was not updated: {error}")


if __name__ == "__main__":
    main()
