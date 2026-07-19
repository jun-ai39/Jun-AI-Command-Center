/*
 * TOP画面の直近経済イベント表示
 * data/economic-calendar.jsonから、最も近い予定を1件だけ表示します。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const card = document.querySelector(".overview-calendar-card");
  const title = document.getElementById("overviewCalendarTitle");
  const dateText = document.getElementById("overviewCalendarDate");
  const meta = document.getElementById("overviewCalendarMeta");
  const countdown = document.getElementById("overviewCalendarCountdown");
  const calendarData = window.JunEconomicCalendar;

  if (!card || !title || !dateText || !meta || !countdown) return;

  const categoryLabels = {
    fomc: "FOMC",
    cpi: "米CPI",
    employment: "米雇用統計",
    boj: "日銀"
  };

  const formatEventDate = (event) => {
    const start = calendarData.parseDate(event);
    if (Number.isNaN(start.getTime())) return "日時未定";

    const dateOptions = {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short"
    };

    if (event.all_day && event.start_date) {
      const startText = start.toLocaleDateString("ja-JP", dateOptions);

      if (event.end_date && event.end_date !== event.start_date) {
        const end = new Date(event.end_date + "T00:00:00+09:00");
        const endText = end.toLocaleDateString("ja-JP", {
          timeZone: "Asia/Tokyo",
          month: "numeric",
          day: "numeric"
        });
        return startText + "〜" + endText;
      }

      return startText;
    }

    return start.toLocaleString("ja-JP", {
      ...dateOptions,
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCountdown = (remainingDays) => {
    if (remainingDays === 0) return "本日";
    if (remainingDays === 1) return "明日";
    if (Number.isFinite(remainingDays) && remainingDays > 1) {
      return "あと" + remainingDays + "日";
    }
    return "予定";
  };

  try {
    if (!calendarData) {
      throw new Error("共通カレンダー処理を読み込めません");
    }

    const data = await calendarData.load();
    const events = calendarData.getUpcomingEvents(data.events);
    const nextEvent = events[0];

    if (!nextEvent) {
      title.textContent = "今後の登録イベントはありません";
      dateText.textContent = "公式日程を確認してください。";
      meta.textContent = data.notice || "公表日程は変更される場合があります。";
      countdown.textContent = "CHECK";
      card.dataset.urgency = "normal";
      return;
    }

    const remainingDays = calendarData.daysUntil(nextEvent);

    title.textContent = nextEvent.title || "重要経済イベント";
    dateText.textContent = formatEventDate(nextEvent);

    const metaParts = [
      categoryLabels[nextEvent.category] || "経済イベント",
      nextEvent.country || "地域未設定",
      nextEvent.period || nextEvent.timing_note || "公式日程"
    ];
    meta.textContent = metaParts.join(" · ");

    countdown.textContent = formatCountdown(remainingDays);
    card.dataset.urgency = remainingDays <= 1
      ? "urgent"
      : remainingDays <= 7
        ? "soon"
        : "normal";

    card.setAttribute(
      "aria-label",
      title.textContent + "、" + dateText.textContent
      + "。経済カレンダーを開く"
    );
  } catch (error) {
    console.error("TOPの経済イベントを表示できませんでした。", error);
    title.textContent = "経済予定を表示できません";
    dateText.textContent = "時間をおいて再読み込みしてください。";
    meta.textContent = "経済カレンダー画面で公式リンクを確認できます。";
    countdown.textContent = "ERROR";
    card.dataset.urgency = "error";
  }
});
