/*
 * ニュース表示
 * GitHub Actionsが生成する data/news.json を読み込みます。
 * 外部APIキーをブラウザへ保存しない設計です。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const newsGrid = document.getElementById("newsGrid");
  const newsStatus = document.getElementById("newsStatus");
  const newsUpdatedAt = document.getElementById("newsUpdatedAt");
  const topNewsTitle = document.getElementById("topNewsTitle");
  const topNewsMeta = document.getElementById("topNewsMeta");

  if (!newsGrid) return;

  const showMessage = (title, message) => {
    newsGrid.replaceChildren();
    const card = document.createElement("article");
    card.className = "panel news-message";
    const heading = document.createElement("h3");
    const text = document.createElement("p");
    heading.textContent = title;
    text.textContent = message;
    card.append(heading, text);
    newsGrid.append(card);
  };

  try {
    const response = await fetch("./data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    if (newsUpdatedAt) {
      newsUpdatedAt.textContent = data.updated_at
        ? `最終更新：${new Date(data.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
        : "更新データはまだありません";
    }

    if (items.length === 0) {
      if (newsStatus) newsStatus.textContent = "STANDBY";
      showMessage("ニュースデータ準備中", "次のSTEPで自動取得を設定します。");
      return;
    }

    newsGrid.replaceChildren();
    items.slice(0, 9).forEach((item) => {
      const card = document.createElement("article");
      card.className = "panel news-card";

      const meta = document.createElement("div");
      meta.className = "news-meta";
      const category = document.createElement("span");
      category.className = "news-category";
      category.textContent = item.category || "一般";
      const source = document.createElement("span");
      source.textContent = item.source || "情報源未設定";
      meta.append(category, source);

      const heading = document.createElement("h3");
      heading.textContent = item.title || "タイトルなし";
      const summary = document.createElement("p");
      summary.textContent = item.summary || "要約はありません。";
      const link = document.createElement("a");
      try {
        const safeUrl = new URL(item.url);
        if (safeUrl.protocol !== "https:") throw new Error("HTTPS以外のURLです");
        link.href = safeUrl.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "情報源を開く →";
      } catch {
        link.href = "#";
        link.textContent = "情報源URLなし";
        link.setAttribute("aria-disabled", "true");
      }

      card.append(meta, heading, summary, link);
      newsGrid.append(card);
    });

    if (newsStatus) newsStatus.textContent = `${items.length} NEWS`;
    if (topNewsTitle) topNewsTitle.textContent = items[0].title || "最新ニュース";
    if (topNewsMeta) topNewsMeta.textContent = `${items[0].source || "情報源未設定"}・詳細は世界情勢へ`;
  } catch (error) {
    console.error("ニュースデータの読み込みに失敗しました。", error);
    if (newsStatus) newsStatus.textContent = "ERROR";
    if (newsUpdatedAt) newsUpdatedAt.textContent = "ニュースデータを取得できませんでした";
    showMessage("ニュースを表示できません", "時間をおいて再読み込みしてください。");
  }
});
