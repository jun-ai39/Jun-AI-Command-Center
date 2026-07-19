/*
 * ニュース表示
 * GitHub Actionsが生成する data/news.json を読み込みます。
 * 外部APIキーをブラウザへ保存しない設計です。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const newsGrid = document.getElementById("newsGrid");
  const newsFilters = document.getElementById("newsFilters");
  const newsStatus = document.getElementById("newsStatus");
  const newsUpdatedAt = document.getElementById("newsUpdatedAt");
  const topNewsTitle = document.getElementById("topNewsTitle");
  const topNewsMeta = document.getElementById("topNewsMeta");

  if (!newsGrid) return;

  let newsItems = [];
  let activeCategory = "すべて";
  let activeRegion = "all";

  const showMessage = (title, message) => {
    newsGrid.replaceChildren();

    const card = document.createElement("article");
    card.className = "panel news-message";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const text = document.createElement("p");
    text.textContent = message;

    card.append(heading, text);
    newsGrid.append(card);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "日時不明";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "日時不明";

    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const resolveRegion = (item) => {
    /*
     * world-map.jsと同じ分類処理を使用します。
     * 読み込みに失敗した場合でも、保存済みregionで最低限動作します。
     */
    if (window.JunWorldMap && typeof window.JunWorldMap.resolveRegion === "function") {
      return window.JunWorldMap.resolveRegion(item);
    }
    return String(item && item.region || "global");
  };

  const createNewsCard = (item) => {
    const card = document.createElement("article");
    card.className = "panel news-card";

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const category = document.createElement("span");
    category.className = "news-category";
    category.textContent = item.category || "一般";

    const source = document.createElement("span");
    source.textContent = item.source || "情報源未設定";

    const published = document.createElement("span");
    published.textContent = formatDate(item.published_at);

    meta.append(category, source, published);

    const heading = document.createElement("h3");
    heading.textContent = item.title || "タイトルなし";

    const summary = document.createElement("p");
    summary.textContent = item.summary || "要約はありません。";

    const link = document.createElement("a");

    try {
      const safeUrl = new URL(item.url);
      if (safeUrl.protocol !== "https:") {
        throw new Error("HTTPS以外のURLです");
      }

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
    return card;
  };

  const renderNews = () => {
    const filteredItems = newsItems.filter((item) => {
      const matchesCategory = activeCategory === "すべて"
        || (item.category || "一般") === activeCategory;
      const matchesRegion = activeRegion === "all"
        || resolveRegion(item) === activeRegion;

      return matchesCategory && matchesRegion;
    });

    newsGrid.replaceChildren();

    if (filteredItems.length === 0) {
      showMessage(
        "該当するニュースはありません",
        "別の地域またはカテゴリを選択してください。"
      );
    } else {
      filteredItems.slice(0, 9).forEach((item) => {
        newsGrid.append(createNewsCard(item));
      });
    }

    if (newsStatus) {
      newsStatus.textContent = filteredItems.length + " NEWS";
    }

    window.dispatchEvent(new CustomEvent("world-news-filtered", {
      detail: {
        category: activeCategory,
        region: activeRegion,
        count: filteredItems.length
      }
    }));
  };

  const createFilters = () => {
    if (!newsFilters) return;

    const categories = [
      "すべて",
      ...new Set(newsItems.map((item) => item.category || "一般"))
    ];

    newsFilters.replaceChildren();

    categories.forEach((categoryName, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button" + (index === 0 ? " active" : "");
      button.textContent = categoryName;
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");

      button.addEventListener("click", () => {
        activeCategory = categoryName;

        newsFilters.querySelectorAll(".filter-button").forEach((filterButton) => {
          const isCurrent = filterButton === button;
          filterButton.classList.toggle("active", isCurrent);
          filterButton.setAttribute("aria-pressed", String(isCurrent));
        });

        renderNews();
      });

      newsFilters.append(button);
    });
  };

  /*
   * 地図で地域が選択されたとき、現在のカテゴリ条件と組み合わせて絞り込みます。
   */
  window.addEventListener("world-region-change", (event) => {
    activeRegion = String(event.detail && event.detail.region || "all");
    if (newsItems.length > 0) renderNews();
  });

  try {
    const response = await fetch("./data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    newsItems = Array.isArray(data.items) ? data.items : [];

    if (newsUpdatedAt) {
      newsUpdatedAt.textContent = data.updated_at
        ? "最終更新：" + new Date(data.updated_at).toLocaleString(
          "ja-JP",
          { timeZone: "Asia/Tokyo" }
        )
        : "更新データはまだありません";
    }

    if (newsItems.length === 0) {
      if (newsStatus) newsStatus.textContent = "STANDBY";
      showMessage(
        "ニュースデータ準備中",
        "次回の自動更新後にニュースを表示します。"
      );
      return;
    }

    /*
     * 地図へ全記事を渡し、地域別の記事件数を表示します。
     * 記事本文ではなく、取得済みの見出しデータだけを渡します。
     */
    window.dispatchEvent(new CustomEvent("world-news-loaded", {
      detail: { items: newsItems }
    }));

    createFilters();
    renderNews();

    if (topNewsTitle) {
      topNewsTitle.textContent = newsItems[0].title || "最新ニュース";
    }
    if (topNewsMeta) {
      topNewsMeta.textContent = (newsItems[0].source || "情報源未設定")
        + "・詳細は世界情勢へ";
    }
  } catch (error) {
    console.error("ニュースデータの読み込みに失敗しました。", error);

    if (newsStatus) newsStatus.textContent = "ERROR";
    if (newsUpdatedAt) {
      newsUpdatedAt.textContent = "ニュースデータを取得できませんでした";
    }

    showMessage(
      "ニュースを表示できません",
      "時間をおいて再読み込みしてください。"
    );
  }
});
