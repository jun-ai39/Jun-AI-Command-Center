/*
 * 経済カレンダー表示
 * 公的機関の日程を整理した data/economic-calendar.json を読み込みます。
 * 画面へ追加するときは textContent を使用し、外部文字列をHTMLとして実行しません。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const calendarSection = document.getElementById("calendar");
  const placeholder = calendarSection?.querySelector(".placeholder-grid");
  if (!calendarSection || !placeholder) return;

  const CATEGORY_LABELS = {
    fomc: "FOMC",
    cpi: "米CPI",
    employment: "米雇用統計",
    boj: "日銀"
  };

  const toJapanDateKey = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const parseDate = (event) => {
    if (event.starts_at) return new Date(event.starts_at);
    if (event.start_date) return new Date(`${event.start_date}T00:00:00+09:00`);
    return new Date(Number.NaN);
  };

  const formatDate = (event) => {
    const options = {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short"
    };

    if (event.all_day && event.start_date) {
      const start = new Date(`${event.start_date}T00:00:00+09:00`);
      const end = new Date(`${event.end_date || event.start_date}T00:00:00+09:00`);
      const startText = start.toLocaleDateString("ja-JP", options);
      const endText = end.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
      return event.end_date && event.end_date !== event.start_date
        ? `${startText}〜${endText}`
        : startText;
    }

    const date = parseDate(event);
    if (Number.isNaN(date.getTime())) return "日時未定";
    return date.toLocaleString("ja-JP", {
      ...options,
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const daysUntil = (event) => {
    const target = parseDate(event);
    if (Number.isNaN(target.getTime())) return null;
    const todayKey = toJapanDateKey(new Date());
    const targetKey = toJapanDateKey(target);
    const today = Date.parse(`${todayKey}T00:00:00+09:00`);
    const targetDay = Date.parse(`${targetKey}T00:00:00+09:00`);
    return Math.round((targetDay - today) / 86400000);
  };

  const createSafeLink = (event) => {
    const link = document.createElement("a");
    link.className = "calendar-source-link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "公式日程を確認 ↗";
    try {
      const url = new URL(event.source_url);
      if (url.protocol !== "https:") throw new Error("HTTPS以外のURLです");
      link.href = url.href;
    } catch {
      link.removeAttribute("href");
      link.textContent = "公式URL未設定";
      link.setAttribute("aria-disabled", "true");
    }
    return link;
  };

  const createEventCard = (event, index) => {
    const card = document.createElement("article");
    card.className = `calendar-event-card panel category-${event.category || "other"}${index === 0 ? " next-event" : ""}`;

    const dateColumn = document.createElement("div");
    dateColumn.className = "calendar-event-date";
    const dateText = document.createElement("strong");
    const countdown = document.createElement("span");
    dateText.textContent = formatDate(event);
    const remainingDays = daysUntil(event);
    countdown.textContent = remainingDays === 0
      ? "本日"
      : remainingDays === 1
        ? "明日"
        : Number.isFinite(remainingDays) && remainingDays > 1
          ? `あと${remainingDays}日`
          : "予定";
    dateColumn.append(dateText, countdown);

    const content = document.createElement("div");
    content.className = "calendar-event-content";
    const meta = document.createElement("div");
    meta.className = "calendar-event-meta";
    const category = document.createElement("span");
    const country = document.createElement("span");
    category.className = "calendar-category";
    category.textContent = CATEGORY_LABELS[event.category] || "経済イベント";
    country.textContent = event.country || "地域未設定";
    meta.append(category, country);

    const title = document.createElement("h3");
    title.textContent = event.title || "名称未設定";
    const period = document.createElement("p");
    period.className = "calendar-event-period";
    period.textContent = event.period || event.timing_note || "重要日程";
    const detail = document.createElement("p");
    detail.className = "calendar-event-detail";
    detail.textContent = event.detail || "詳細は公式日程で確認してください。";
    const officialTime = document.createElement("p");
    officialTime.className = "calendar-official-time";
    officialTime.textContent = event.official_time ? `現地公表：${event.official_time}` : "公表時刻は公式情報で確認";

    content.append(meta, title, period, detail, officialTime, createSafeLink(event));
    card.append(dateColumn, content);
    return card;
  };

  const showMessage = (title, message) => {
    placeholder.replaceChildren();
    placeholder.className = "calendar-panel panel";
    const heading = document.createElement("h3");
    const text = document.createElement("p");
    heading.textContent = title;
    text.textContent = message;
    placeholder.append(heading, text);
  };

  try {
    const response = await fetch("./data/economic-calendar.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const todayKey = toJapanDateKey(new Date());
    const events = Array.isArray(data.events)
      ? data.events
        .filter((event) => (event.end_date || toJapanDateKey(parseDate(event))) >= todayKey)
        .sort((a, b) => parseDate(a) - parseDate(b))
      : [];

    placeholder.replaceChildren();
    placeholder.className = "calendar-layout";

    const toolbar = document.createElement("div");
    toolbar.className = "calendar-toolbar panel";
    const toolbarText = document.createElement("div");
    const updated = document.createElement("p");
    const notice = document.createElement("p");
    updated.className = "calendar-verified-at";
    updated.textContent = data.verified_at ? `公式日程確認日：${data.verified_at}` : "確認日未設定";
    notice.className = "calendar-notice";
    notice.textContent = data.notice || "日程変更の可能性があります。";
    toolbarText.append(updated, notice);
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${events.length} EVENTS`;
    toolbar.append(toolbarText, badge);

    const eventList = document.createElement("div");
    eventList.className = "calendar-event-list";
    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "calendar-empty panel";
      empty.textContent = "今後の登録イベントはありません。公式日程を確認してください。";
      eventList.append(empty);
    } else {
      events.forEach((event, index) => eventList.append(createEventCard(event, index)));
    }

    placeholder.append(toolbar, eventList);
  } catch (error) {
    console.error("経済カレンダーを読み込めませんでした。", error);
    showMessage("経済カレンダーを表示できません", "時間をおいて再読み込みしてください。");
  }
});
