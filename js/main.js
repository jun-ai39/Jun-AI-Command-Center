/* 現在の日付表示とスマートフォン用メニューを管理します。 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dateElement = document.getElementById("currentDate");
  const menuButton = document.getElementById("menuButton");
  const sidebar = document.getElementById("sidebar");

  if (dateElement) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short"
    });
    dateElement.textContent = formatter.format(now);
    dateElement.dateTime = now.toISOString().slice(0, 10);
  }

  if (menuButton && sidebar) {
    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
    });

    sidebar.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        sidebar.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "メニューを開く");
      });
    });
  }
});
