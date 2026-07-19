/*
 * 経済カレンダーの共通データ処理
 * TOP画面と経済カレンダー画面が同じデータ・日付判定を共有します。
 */
"use strict";

(() => {
  const DATA_URL = "./data/economic-calendar.json";
  let loadPromise = null;

  const toJapanDateKey = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return values.year + "-" + values.month + "-" + values.day;
  };

  const parseDate = (event) => {
    if (event && event.starts_at) return new Date(event.starts_at);
    if (event && event.start_date) {
      return new Date(event.start_date + "T00:00:00+09:00");
    }
    return new Date(Number.NaN);
  };

  const daysUntil = (event, now = new Date()) => {
    const target = parseDate(event);
    if (Number.isNaN(target.getTime())) return null;

    const todayKey = toJapanDateKey(now);
    const targetKey = toJapanDateKey(target);
    const today = Date.parse(todayKey + "T00:00:00+09:00");
    const targetDay = Date.parse(targetKey + "T00:00:00+09:00");

    return Math.round((targetDay - today) / 86400000);
  };

  const getUpcomingEvents = (events, now = new Date()) => {
    const todayKey = toJapanDateKey(now);

    return (Array.isArray(events) ? events : [])
      .filter((event) => {
        const eventDate = parseDate(event);
        if (Number.isNaN(eventDate.getTime())) return false;

        const endKey = event.end_date || toJapanDateKey(eventDate);
        return endKey >= todayKey;
      })
      .sort((eventA, eventB) => parseDate(eventA) - parseDate(eventB));
  };

  const load = () => {
    /*
     * 同じページ内で複数画面が利用しても、通信は1回だけにします。
     * 失敗後の再読み込みでは再試行できるようPromiseを解除します。
     */
    if (!loadPromise) {
      loadPromise = fetch(DATA_URL, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then((data) => {
          if (!data || !Array.isArray(data.events)) {
            throw new Error("経済カレンダーのデータ形式が不正です");
          }
          return data;
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }

    return loadPromise;
  };

  window.JunEconomicCalendar = Object.freeze({
    load,
    parseDate,
    daysUntil,
    getUpcomingEvents,
    toJapanDateKey
  });
})();
