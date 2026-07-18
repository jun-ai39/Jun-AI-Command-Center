/*
 * 無料のルールベース朝ブリーフを表示します。
 * 生成AIは使用せず、Pythonが整理した briefing.json だけを読み込みます。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("briefingStatus");
  const updatedAt = document.getElementById("briefingUpdatedAt");
  const mode = document.getElementById("briefingMode");
  const newsList = document.getElementById("briefingNewsList");
  const marketGrid = document.getElementById("briefingMarketGrid");
  const watchList = document.getElementById("briefingWatchList");
  const limitations = document.getElementById("briefingLimitations");
  const overviewValue = document.getElementById("aiOverviewValue");
  const overviewMeta = document.getElementById("aiOverviewMeta");
  const overviewFocusList = document.getElementById("overviewFocusList");
  const overviewFocusStatus = document.getElementById("overviewFocusStatus");

  const formatDate = (value) => {
    if (!value) return "更新待ち";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "日時不明";
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const createSafeLink = (url) => {
    try {
      const safeUrl = new URL(url);
      if (safeUrl.protocol !== "https:") throw new Error("HTTPS以外のURLです");
      const link = document.createElement("a");
      link.href = safeUrl.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "情報源を開く →";
      return link;
    } catch {
      const text = document.createElement("span");
      text.className = "briefing-link-disabled";
      text.textContent = "情報源URLなし";
      return text;
    }
  };

  const renderNews = (items) => {
    if (!newsList) return;
    newsList.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "briefing-empty";
      message.textContent = "ニュース整理データを準備中です。";
      newsList.append(message);
      return;
    }

    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = "briefing-news-item";

      const meta = document.createElement("p");
      meta.className = "briefing-item-meta";
      meta.textContent = `${item.category || "一般"}・${item.source || "情報源未設定"}・${formatDate(item.published_at)}`;

      const title = document.createElement("h3");
      title.textContent = item.title || "タイトルなし";

      article.append(meta, title, createSafeLink(item.url));
      newsList.append(article);
    });
  };

  const renderMarket = (items) => {
    if (!marketGrid) return;
    marketGrid.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "briefing-empty";
      message.textContent = "市場整理データを準備中です。";
      marketGrid.append(message);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "briefing-market-item";

      const label = document.createElement("p");
      label.className = "eyebrow";
      label.textContent = item.label || "MARKET";

      const value = document.createElement("p");
      value.className = "briefing-market-value";
      value.textContent = item.value || "データなし";

      const detail = document.createElement("p");
      detail.className = "briefing-market-detail";
      detail.textContent = item.detail || "詳細データなし";

      card.append(label, value, detail);
      marketGrid.append(card);
    });
  };

  const renderWatchPoints = (items) => {
    if (!watchList) return;
    watchList.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "briefing-empty";
      message.textContent = "確認ポイントを準備中です。";
      watchList.append(message);
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = `briefing-watch-item${item.level === "alert" ? " alert" : ""}`;

      const number = document.createElement("span");
      number.className = "briefing-watch-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const content = document.createElement("div");
      const title = document.createElement("h3");
      const detail = document.createElement("p");
      const meta = document.createElement("p");
      title.textContent = item.title || "確認ポイント";
      detail.textContent = item.detail || "詳細なし";
      meta.className = "briefing-item-meta";
      meta.textContent = item.meta || "機械的な整理結果";
      content.append(title, detail, meta);

      card.append(number, content);
      watchList.append(card);
    });
  };

  // TOP画面には、朝に最初に確認する3件をコンパクトに表示します。
  const renderOverviewFocus = (items) => {
    if (!overviewFocusList) return;
    overviewFocusList.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
      const message = document.createElement("p");
      message.className = "overview-focus-message";
      message.textContent = "確認ポイントを準備中です。";
      overviewFocusList.append(message);
      if (overviewFocusStatus) overviewFocusStatus.textContent = "STANDBY";
      return;
    }

    items.slice(0, 3).forEach((item, index) => {
      const card = document.createElement("article");
      card.className = `overview-focus-item${item.level === "alert" ? " alert" : ""}`;

      const number = document.createElement("span");
      number.className = "overview-focus-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const content = document.createElement("div");
      const title = document.createElement("h3");
      const detail = document.createElement("p");
      title.textContent = item.title || "確認ポイント";
      detail.textContent = item.detail || "詳細なし";
      content.append(title, detail);

      card.append(number, content);
      overviewFocusList.append(card);
    });

    if (overviewFocusStatus) {
      overviewFocusStatus.textContent = `${Math.min(items.length, 3)} POINTS`;
    }
  };

  const renderLimitations = (items) => {
    if (!limitations) return;
    limitations.replaceChildren();
    const messages = Array.isArray(items) && items.length
      ? items
      : ["AIを使用せず、取得済み情報だけを整理しています。"];
    messages.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      limitations.append(listItem);
    });
  };

  try {
    const response = await fetch("./data/briefing.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderNews(data.news_items);
    renderMarket(data.market_snapshot);
    renderWatchPoints(data.watch_points);
    renderOverviewFocus(data.watch_points);
    renderLimitations(data.limitations);

    const pointCount = Array.isArray(data.watch_points) ? data.watch_points.length : 0;
    if (status) status.textContent = data.generated_at ? "READY" : "STANDBY";
    if (updatedAt) updatedAt.textContent = `最終生成：${formatDate(data.generated_at)}`;
    if (mode) mode.textContent = data.mode_label || "ルールベース（AI未使用）";
    if (overviewValue) overviewValue.textContent = data.generated_at ? `${pointCount}件の確認ポイント` : "準備中";
    if (overviewMeta) {
      overviewMeta.textContent = data.generated_at
        ? "AI未使用・取得済みデータを自動整理"
        : "無料のルールベースブリーフを準備しています。";
    }
  } catch (error) {
    console.error("朝ブリーフの読み込みに失敗しました。", error);
    if (status) status.textContent = "ERROR";
    if (updatedAt) updatedAt.textContent = "朝ブリーフを取得できませんでした";
    renderNews([]);
    renderMarket([]);
    renderWatchPoints([]);
    renderOverviewFocus([]);
    renderLimitations([]);
  }
});
