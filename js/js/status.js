/*
 * ダッシュボード全体のデータ更新状態を確認します。
 *
 * news.json・market.json・briefing.json の更新日時を読み取り、
 * TOPバーへ「最新」「更新遅延」「確認エラー」を表示します。
 * APIキーや個人情報は使用しません。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const statusContainer = document.querySelector(".topbar-status");
  const statusText = statusContainer?.querySelector("span:last-child");

  // 対象の表示場所がない場合は、何も変更せず終了します。
  if (!statusContainer || !statusText) return;

  statusContainer.classList.add("data-health-status");

  // 毎日更新される設計のため、30時間を超えたら更新遅延と判断します。
  // GitHub Actionsの開始時刻が多少ずれても、すぐ警告にならない余裕を含みます。
  const STALE_LIMIT_HOURS = 30;
  const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

  const dataFiles = [
    { path: "./data/news.json", timestampKey: "updated_at", label: "ニュース" },
    { path: "./data/market.json", timestampKey: "updated_at", label: "市場" },
    { path: "./data/briefing.json", timestampKey: "generated_at", label: "ブリーフ" }
  ];

  const setStatus = (state, text, detail) => {
    statusContainer.classList.remove("is-checking", "is-fresh", "is-stale", "is-error");
    statusContainer.classList.add(`is-${state}`);
    statusContainer.setAttribute("role", "status");
    statusContainer.setAttribute("aria-live", "polite");
    statusContainer.title = detail;
    statusText.textContent = text;
  };

  const formatDate = (timestamp) => new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));

  setStatus("checking", "データ確認中", "3種類の公開データを確認しています。");

  try {
    const results = await Promise.all(dataFiles.map(async (file) => {
      const response = await fetch(file.path, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${file.label}: HTTP ${response.status}`);
      }

      const data = await response.json();
      const timestamp = Date.parse(data[file.timestampKey]);
      if (!Number.isFinite(timestamp)) {
        throw new Error(`${file.label}: 更新日時が不正です`);
      }

      return { ...file, timestamp };
    }));

    // 3種類のうち最も古い更新時刻を、全体の安全側の基準にします。
    const oldestTimestamp = Math.min(...results.map((result) => result.timestamp));
    const ageHours = Math.max(0, (Date.now() - oldestTimestamp) / HOUR_IN_MILLISECONDS);
    const formattedTime = formatDate(oldestTimestamp);

    if (ageHours > STALE_LIMIT_HOURS) {
      setStatus(
        "stale",
        "更新遅延",
        `最も古いデータ：${formattedTime}（約${Math.floor(ageHours)}時間前）`
      );
      return;
    }

    setStatus(
      "fresh",
      `更新 ${formattedTime}`,
      `ニュース・市場・ブリーフを確認済み。最も古い更新：${formattedTime}`
    );
  } catch (error) {
    console.error("データ更新状態を確認できませんでした。", error);
    setStatus("error", "確認エラー", "公開データの一部を確認できませんでした。");
  }
});
