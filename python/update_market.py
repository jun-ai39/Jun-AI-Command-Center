"""市場・為替・商品・暗号資産データを更新します。

暗号資産はCoinGecko公式API、市場データはYahoo Financeの
非公式チャートエンドポイントを使用します。取得失敗時は、
前回の正常データを保持してサイト公開を継続します。
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
COINGECKO_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets"
FEAR_GREED_ENDPOINT = "https://api.alternative.me/fng/?limit=1&format=json"
YAHOO_ENDPOINTS = (
    "https://query1.finance.yahoo.com/v8/finance/chart",
    "https://query2.finance.yahoo.com/v8/finance/chart",
)

COIN_NAMES = {
    "bitcoin": "Bitcoin",
    "ethereum": "Ethereum",
    "solana": "Solana",
    "ripple": "XRP",
}

FEAR_GREED_LABELS_JA = {
    "Extreme Fear": "極度の恐怖",
    "Fear": "恐怖",
    "Neutral": "中立",
    "Greed": "強欲",
    "Extreme Greed": "極度の強欲",
}

# Yahoo Financeの記号は公開API仕様ではないため、変更時は見直します。
MARKET_ASSETS = {
    "stocks": (
        {"symbol": "^N225", "name": "日経平均", "decimals": 2},
        {
            # Yahoo FinanceではTOPIX指数そのものを安定取得できないため、
            # TOPIXへの連動を目指すETFを参考値として使用します。
            "symbol": "1308.T",
            "display_symbol": "1308",
            "name": "TOPIX連動ETF（参考値）",
            "decimals": 1,
            "instrument_type": "proxy_etf",
            "proxy_for": "TOPIX",
        },
        {"symbol": "^DJI", "name": "NYダウ", "decimals": 2},
        {"symbol": "^IXIC", "name": "NASDAQ総合", "decimals": 2},
        {"symbol": "^GSPC", "name": "S&P 500", "decimals": 2},
    ),
    "forex": (
        {"symbol": "JPY=X", "display_symbol": "USD/JPY", "name": "ドル円", "decimals": 3},
        {"symbol": "EURJPY=X", "display_symbol": "EUR/JPY", "name": "ユーロ円", "decimals": 3},
    ),
    "commodities": (
        {"symbol": "GC=F", "display_symbol": "GOLD", "name": "金先物", "decimals": 2},
        {"symbol": "CL=F", "display_symbol": "WTI", "name": "WTI原油先物", "decimals": 2},
    ),
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/142 Safari/537.36"
    ),
    "Accept": "application/json",
}


def fetch_json(url: str, timeout: int = 30):
    request = urllib.request.Request(url, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return json.load(response)


def build_coingecko_url() -> str:
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
    return f"{COINGECKO_ENDPOINT}?{urllib.parse.urlencode(parameters)}"


def fetch_crypto() -> list[dict]:
    """一時的なアクセス制限を考慮して最大3回取得します。"""
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            payload = fetch_json(build_coingecko_url())
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


def normalize_fear_greed(payload: dict) -> dict:
    """Alternative.meのレスポンスを画面表示用に整形します。"""
    metadata = payload.get("metadata", {})
    if metadata.get("error"):
        raise ValueError(f"Alternative.me error: {metadata['error']}")

    results = payload.get("data")
    if not isinstance(results, list) or not results:
        raise ValueError("Fear & Greed Index result is empty")

    result = results[0]
    try:
        value = int(result.get("value"))
    except (TypeError, ValueError) as error:
        raise ValueError("Fear & Greed Index value is invalid") from error
    if not 0 <= value <= 100:
        raise ValueError("Fear & Greed Index value is outside 0-100")

    classification = str(result.get("value_classification", "")).strip()
    timestamp = result.get("timestamp")
    observed_at = None
    try:
        observed_at = datetime.fromtimestamp(
            int(timestamp), tz=timezone.utc
        ).isoformat(timespec="seconds")
    except (TypeError, ValueError, OSError):
        # 指標値が正常なら、日時だけ欠けても表示を継続します。
        pass

    return {
        "name": "Crypto Fear & Greed Index",
        "scope": "Bitcoin market sentiment",
        "value": value,
        "classification": classification,
        "classification_ja": FEAR_GREED_LABELS_JA.get(
            classification, classification or "分類なし"
        ),
        "observed_at": observed_at,
        "source": "Alternative.me",
    }


def fetch_fear_greed() -> dict:
    """一時的な通信エラーを考慮して最大3回取得します。"""
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            return normalize_fear_greed(fetch_json(FEAR_GREED_ENDPOINT))
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(attempt * 5)
    raise RuntimeError(f"Fear & Greed Index request failed after retries: {last_error}")


def parse_yahoo_chart(payload: dict, asset: dict) -> dict:
    """Yahoo Financeのレスポンスから現在値と前日比を取り出します。"""
    chart = payload.get("chart", {})
    if chart.get("error"):
        raise ValueError(f"Yahoo Finance error: {chart['error']}")
    results = chart.get("result")
    if not isinstance(results, list) or not results:
        raise ValueError("Yahoo Finance result is empty")

    result = results[0]
    meta = result.get("meta", {})
    price = meta.get("regularMarketPrice")
    previous = meta.get("chartPreviousClose") or meta.get("previousClose")

    # メタ情報が不足した場合は日足の終値から補います。
    closes = (
        result.get("indicators", {})
        .get("quote", [{}])[0]
        .get("close", [])
    )
    valid_closes = [value for value in closes if isinstance(value, (int, float))]
    if not isinstance(price, (int, float)) and valid_closes:
        price = valid_closes[-1]
    if not isinstance(previous, (int, float)) and len(valid_closes) >= 2:
        previous = valid_closes[-2]

    if not isinstance(price, (int, float)):
        raise ValueError("Yahoo Finance price is missing")

    change_percent = None
    if isinstance(previous, (int, float)) and previous != 0:
        change_percent = ((price - previous) / previous) * 100

    item = {
        "symbol": asset.get("display_symbol", asset["symbol"]),
        "name": asset["name"],
        "price": price,
        "currency": str(meta.get("currency", "")),
        "change_percent": change_percent,
        "decimals": asset["decimals"],
    }

    # 代替指標であることをJSONにも保存し、将来のUI変更でも判別できるようにします。
    for key in ("instrument_type", "proxy_for"):
        if key in asset:
            item[key] = asset[key]

    return item


def fetch_yahoo_asset(asset: dict) -> dict:
    """query1が失敗した場合、query2へ切り替えます。"""
    encoded_symbol = urllib.parse.quote(asset["symbol"], safe="")
    last_error: Exception | None = None
    for endpoint in YAHOO_ENDPOINTS:
        url = f"{endpoint}/{encoded_symbol}?range=5d&interval=1d&events=history"
        try:
            return parse_yahoo_chart(fetch_json(url), asset)
        except Exception as error:
            last_error = error
    raise RuntimeError(f"{asset['symbol']} failed: {last_error}")


def fetch_market_group(assets: tuple[dict, ...]) -> list[dict]:
    items: list[dict] = []
    for asset in assets:
        try:
            items.append(fetch_yahoo_asset(asset))
        except Exception as error:
            print(f"WARNING: {error}")
        time.sleep(1)
    return items


def load_existing_data() -> dict:
    if not OUTPUT_PATH.exists():
        return {
            "schema_version": 1,
            "updated_at": None,
            "stocks": [],
            "crypto": [],
            "sentiment": None,
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
    data = load_existing_data()
    data["schema_version"] = 2
    updated_any = False

    try:
        data["crypto"] = normalize_crypto(fetch_crypto())
        updated_any = True
        print(f"Updated cryptocurrency data with {len(data['crypto'])} assets.")
    except Exception as error:
        print(f"WARNING: Cryptocurrency data was not updated: {error}")

    try:
        data["sentiment"] = fetch_fear_greed()
        updated_any = True
        print("Updated Crypto Fear & Greed Index.")
    except Exception as error:
        data.setdefault("sentiment", None)
        print(f"WARNING: Fear & Greed Index was not updated: {error}")

    for group_name, assets in MARKET_ASSETS.items():
        items = fetch_market_group(assets)
        if items:
            data[group_name] = items
            updated_any = True
            print(f"Updated {group_name} with {len(items)} items.")
        else:
            data.setdefault(group_name, [])
            print(f"WARNING: {group_name} kept previous data.")

    data["sources"] = {
        "crypto": "CoinGecko API",
        "sentiment": "Alternative.me Crypto Fear & Greed Index",
        "market": "Yahoo Finance chart endpoint (unofficial)",
    }
    if updated_any:
        data["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        write_json_safely(data)
    else:
        print("WARNING: No market data was updated.")


if __name__ == "__main__":
    main()
