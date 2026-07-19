/*
 * AIニュース画面
 * data/ai-news.json に保存した公式発表だけを読み込みます。
 * 外部データをHTMLとして直接挿入せず、textContentで安全に表示します。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const section = document.getElementById("ai-news");
  const placeholder = section?.querySelector(".placeholder-grid");
  if (!section || !placeholder) return;

  const SOURCE_LABELS = {
    all: "すべて",
    openai: "OpenAI",
    google: "Google",
    anthropic: "Anthropic"
  };

  const CATEGORY_LABELS = {
    product: "製品",
    model: "モデル",
    safety: "安全性",
    business: "ビジネス",
    education: "教育",
    society: "社会"
  };

  const ALLOWED_HOSTS = new Set([
    "openai.com",
    "www.openai.com",
    "blog.google",
    "anthropic.com",
    "www.anthropic.com"
  ]);

  const formatDate = (value) => {
    const date = new Date(`${value}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return "日付未設定";
    return date.toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    });
  };

  const createOfficialLink = (item) => {
    const link = document.createElement("a");
    link.className = "ai-news-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "公式記事を読む ↗";

    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error("許可されていないURLです");
      }
      link.href = url.href;
    } catch {
      link.removeAttribute("href");
      link.textContent = "公式URLを確認できません";
      link.setAttribute("aria-disabled", "true");
    }

    return link;
  };

  const createNewsCard = (item) => {
    const card = document.createElement("article");
    card.className = `ai-news-card panel source-${item.source || "other"}`;

    const meta = document.createElement("div");
    meta.className = "ai-news-meta";

    const source = document.createElement("span");
    source.className = "ai-news-source";
    source.textContent = SOURCE_LABELS[item.source] || item.source_name || "公式情報";

    const category = document.createElement("span");
    category.className = "ai-news-category";
    category.textContent = CATEGORY_LABELS[item.category] || "AIニュース";

    const date = document.createElement("time");
    date.dateTime = item.published_at || "";
    date.textContent = formatDate(item.published_at);
    meta.append(source, category, date);

    const title = document.createElement("h3");
    title.textContent = item.title_ja || item.original_title || "タイトル未設定";

    const originalTitle = document.createElement("p");
    originalTitle.className = "ai-news-original-title";
    originalTitle.textContent = item.original_title || "";

    const summary = document.createElement("p");
    summary.className = "ai-news-summary";
    summary.textContent = item.summary_ja || "概要は公式記事で確認してください。";

    card.append(meta, title, originalTitle, summary, createOfficialLink(item));
    return card;
  };

  const showMessage = (titleText, messageText) => {
    placeholder.replaceChildren();
    placeholder.className = "ai-news-message panel";
    const title = document.createElement("h3");
    const message = document.createElement("p");
    title.textContent = titleText;
    message.textContent = messageText;
    placeholder.append(title, message);
  };

  try {
    const response = await fetch("./data/ai-news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const items = Array.isArray(data.items)
      ? [...data.items].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
      : [];

    placeholder.replaceChildren();
    placeholder.className = "ai-news-layout";

    const toolbar = document.createElement("div");
    toolbar.className = "ai-news-toolbar panel";

    const toolbarInfo = document.createElement("div");
    const verifiedAt = document.createElement("p");
    const notice = document.createElement("p");
    verifiedAt.className = "ai-news-verified";
    verifiedAt.textContent = data.verified_at
      ? `公式情報確認日：${formatDate(data.verified_at)}`
      : "確認日未設定";
    notice.className = "ai-news-notice";
    notice.textContent = data.notice || "詳細は公式記事で確認してください。";
    toolbarInfo.append(verifiedAt, notice);

    const count = document.createElement("span");
    count.className = "badge";
    toolbar.append(toolbarInfo, count);

    const filters = document.createElement("div");
    filters.className = "ai-news-filters";
    filters.setAttribute("aria-label", "企業で絞り込み");

    const list = document.createElement("div");
    list.className = "ai-news-grid";
    list.setAttribute("aria-live", "polite");

    const render = (selectedSource) => {
      const filtered = selectedSource === "all"
        ? items
        : items.filter((item) => item.source === selectedSource);

      list.replaceChildren();
      count.textContent = `${filtered.length} NEWS`;

      if (filtered.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ai-news-empty panel";
        empty.textContent = "該当する公式発表はありません。";
        list.append(empty);
        return;
      }

      filtered.forEach((item) => list.append(createNewsCard(item)));
    };

    Object.entries(SOURCE_LABELS).forEach(([sourceId, label], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ai-news-filter${index === 0 ? " active" : ""}`;
      button.textContent = label;
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", () => {
        filters.querySelectorAll("button").forEach((filterButton) => {
          const isCurrent = filterButton === button;
          filterButton.classList.toggle("active", isCurrent);
          filterButton.setAttribute("aria-pressed", isCurrent ? "true" : "false");
        });
        render(sourceId);
      });
      filters.append(button);
    });

    placeholder.append(toolbar, filters, list);
    render("all");
  } catch (error) {
    console.error("AIニュースを読み込めませんでした。", error);
    showMessage("AIニュースを表示できません", "時間をおいて再読み込みしてください。");
  }
});
