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
  const overviewValue = document.getElementById("marketOverviewValue");
  const overviewMeta = document.getElementById("marketOverviewMeta");

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

    const changeValue = Number(item.change_percent);
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

  try {
    const response = await fetch("./data/market.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderList(elements.stocks, data.stocks, "株式市場データを準備中です。");
    renderList(elements.crypto, data.crypto, "仮想通貨データを準備中です。");
    renderList(elements.forex, data.forex, "為替データを準備中です。");
    renderList(elements.commodities, data.commodities, "商品データを準備中です。");

    const stockCount = Array.isArray(data.stocks) ? data.stocks.length : 0;
    const cryptoCount = Array.isArray(data.crypto) ? data.crypto.length : 0;
    if (marketStatus) marketStatus.textContent = stockCount ? `${stockCount} INDEX` : "STANDBY";
    if (cryptoStatus) cryptoStatus.textContent = cryptoCount ? `${cryptoCount} ASSETS` : "STANDBY";
    if (marketUpdatedAt) {
      marketUpdatedAt.textContent = data.updated_at
        ? `最終更新：${new Date(data.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
        : "市場データはまだありません";
    }

    if (stockCount && overviewValue && overviewMeta) {
      const lead = data.stocks[0];
      overviewValue.textContent = formatNumber(lead.price, lead.currency, lead.decimals);
      overviewMeta.textContent = `${lead.name || lead.symbol}・前日比 ${Number(lead.change_percent).toFixed(2)}%`;
    }
  } catch (error) {
    console.error("市場データの読み込みに失敗しました。", error);
    Object.values(elements).forEach((element) => {
      renderList(element, [], "市場データを表示できません。");
    });
    if (marketStatus) marketStatus.textContent = "ERROR";
    if (cryptoStatus) cryptoStatus.textContent = "ERROR";
  }
});
