/*
 * 市場データ表示
 * GitHub Actionsが生成する data/market.json を読み込みます。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    stocks: document.getElementById("stockList"),
    crypto: document.getElementById("cryptoList"),
    forex: document.getElementById("forexList"),
    commodities: document.getElementById("commodityList")
  };
  const marketStatus = document.getElementById("marketStatus");
  const cryptoStatus = document.getElementById("cryptoStatus");
  const marketUpdatedAt = document.getElementById("marketUpdatedAt");
  const marketSourceNote = document.getElementById("marketSourceNote");
  const overviewValue = document.getElementById("marketOverviewValue");
  const overviewMeta = document.getElementById("marketOverviewMeta");
  const marketHeatmap = document.getElementById("marketHeatmap");
  const fearGreedValue = document.getElementById("fearGreedValue");
  const fearGreedLabel = document.getElementById("fearGreedLabel");
  const fearGreedDate = document.getElementById("fearGreedDate");
  const fearGreedMeter = document.getElementById("fearGreedMeter");

  const formatNumber = (value, currency, decimals = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    const formatted = new Intl.NumberFormat("ja-JP", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(number);
    return `${formatted}${currency ? ` ${currency}` : ""}`;
  };

  const createRow = (item) => {
    const row = document.createElement("div");
    row.className = "market-row";

    const identity = document.createElement("div");
    const symbol = document.createElement("p");
    const name = document.createElement("p");
    symbol.className = "market-symbol";
    name.className = "market-name";
    symbol.textContent = item.symbol || "--";
    name.textContent = item.name || "名称未設定";
    identity.append(symbol, name);

    const price = document.createElement("p");
    price.className = "market-price";
    price.textContent = formatNumber(item.price, item.currency, item.decimals);

    const changeValue = item.change_percent === null || item.change_percent === undefined
      ? Number.NaN
      : Number(item.change_percent);
    const change = document.createElement("p");
    const direction = changeValue > 0 ? "positive" : changeValue < 0 ? "negative" : "neutral";
    change.className = `market-change ${direction}`;
    change.textContent = Number.isFinite(changeValue)
      ? `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(2)}%`
      : "--";

    row.append(identity, price, change);
    return row;
  };

  const renderList = (container, items, emptyMessage) => {
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "market-message";
      message.textContent = emptyMessage;
      container.append(message);
      return;
    }
    items.forEach((item) => container.append(createRow(item)));
  };

  const createHeatmapTile = (item, index) => {
    const tile = document.createElement("div");
    const changeValue = item.change_percent === null || item.change_percent === undefined
      ? Number.NaN
      : Number(item.change_percent);
    const direction = changeValue > 0.01
      ? "positive"
      : changeValue < -0.01
        ? "negative"
        : "neutral";
    const intensity = Number.isFinite(changeValue)
      ? Math.min(Math.abs(changeValue) / 5, 1) * 0.42 + 0.08
      : 0.08;

    tile.className = `heatmap-tile ${direction}${index === 0 ? " lead" : ""}`;
    tile.style.setProperty("--heat-intensity", intensity.toFixed(3));

    const symbol = document.createElement("p");
    symbol.className = "heatmap-symbol";
    symbol.textContent = item.symbol || "--";

    const name = document.createElement("p");
    name.className = "heatmap-name";
    name.textContent = item.name || "名称未設定";

    const change = document.createElement("p");
    change.className = "heatmap-change";
    change.textContent = Number.isFinite(changeValue)
      ? `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(2)}%`
      : "--";

    tile.setAttribute(
      "aria-label",
      `${name.textContent}、前日比${Number.isFinite(changeValue) ? change.textContent : "データなし"}`
    );
    tile.append(symbol, name, change);
    return tile;
  };

  const renderHeatmap = (items) => {
    if (!marketHeatmap) return;
    marketHeatmap.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "market-message";
      message.textContent = "ヒートマップデータを準備中です。";
      marketHeatmap.append(message);
      return;
    }
    items.forEach((item, index) => marketHeatmap.append(createHeatmapTile(item, index)));
  };

  const renderFearGreed = (sentiment) => {
    const rawValue = sentiment?.value;
    const value = rawValue === null || rawValue === undefined || rawValue === ""
      ? Number.NaN
      : Number(rawValue);
    const hasValue = Number.isFinite(value) && value >= 0 && value <= 100;

    if (fearGreedValue) fearGreedValue.textContent = hasValue ? String(Math.round(value)) : "--";
    if (fearGreedLabel) {
      fearGreedLabel.textContent = hasValue
        ? sentiment.classification_ja || sentiment.classification || "分類なし"
        : "取得待ち";
    }
    if (fearGreedDate) {
      fearGreedDate.textContent = sentiment?.observed_at
        ? `指標日：${new Date(sentiment.observed_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`
        : "指標日を確認できません";
    }
    if (fearGreedMeter) {
      const meterValue = hasValue ? Math.round(value) : 50;
      fearGreedMeter.style.setProperty("--fear-greed-value", String(meterValue));
      if (hasValue) {
        fearGreedMeter.setAttribute("aria-valuenow", String(meterValue));
        fearGreedMeter.setAttribute(
          "aria-valuetext",
          `${meterValue} ${sentiment.classification_ja || sentiment.classification || "分類なし"}`
        );
      } else {
        fearGreedMeter.removeAttribute("aria-valuenow");
        fearGreedMeter.setAttribute("aria-valuetext", "データ取得待ち");
      }
    }
  };

  try {
    const response = await fetch("./data/market.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderList(elements.stocks, data.stocks, "株式市場データを準備中です。");
    renderHeatmap(data.stocks);
    renderList(elements.crypto, data.crypto, "仮想通貨データを準備中です。");
    renderList(elements.forex, data.forex, "為替データを準備中です。");
    renderList(elements.commodities, data.commodities, "商品データを準備中です。");
    renderFearGreed(data.sentiment);

    const stockCount = Array.isArray(data.stocks) ? data.stocks.length : 0;
    const cryptoCount = Array.isArray(data.crypto) ? data.crypto.length : 0;
    if (marketStatus) marketStatus.textContent = stockCount ? `${stockCount} INDEX` : "STANDBY";
    if (cryptoStatus) cryptoStatus.textContent = cryptoCount ? `${cryptoCount} ASSETS` : "STANDBY";
    if (marketUpdatedAt) {
      marketUpdatedAt.textContent = data.updated_at
        ? `最終更新：${new Date(data.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
        : "市場データはまだありません";
    }
    if (marketSourceNote) {
      marketSourceNote.textContent = data.sources?.market
        ? "データ：Yahoo Finance非公式エンドポイント（参考値・遅延あり）"
        : "市場データの取得元はまだありません";
    }

    if (stockCount && overviewValue && overviewMeta) {
      const lead = data.stocks[0];
      overviewValue.textContent = formatNumber(lead.price, lead.currency, lead.decimals);
      const leadChange = Number(lead.change_percent);
      overviewMeta.textContent = Number.isFinite(leadChange)
        ? `${lead.name || lead.symbol}・前日比 ${leadChange.toFixed(2)}%`
        : `${lead.name || lead.symbol}・前日比データなし`;
    }
  } catch (error) {
    console.error("市場データの読み込みに失敗しました。", error);
    Object.values(elements).forEach((element) => {
      renderList(element, [], "市場データを表示できません。");
    });
    if (marketStatus) marketStatus.textContent = "ERROR";
    if (cryptoStatus) cryptoStatus.textContent = "ERROR";
    renderHeatmap([]);
    renderFearGreed(null);
  }
});
