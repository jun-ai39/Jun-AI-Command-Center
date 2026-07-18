/* 現在の日付表示とスマートフォン用メニューを管理します。 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dateElement = document.getElementById("currentDate");
  const menuButton = document.getElementById("menuButton");
  const sidebar = document.getElementById("sidebar");
  const pageTitle = document.getElementById("pageTitle");
  const navLinks = document.querySelectorAll(".nav-link[data-page]");
  const pageSections = document.querySelectorAll("[data-page-section]");

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

  // 左メニューで表示する画面を切り替えます。
  const showPage = (pageName, title) => {
    pageSections.forEach((section) => {
      const isTarget = section.id === pageName;
      section.hidden = !isTarget;
      section.classList.toggle("active", isTarget);
    });

    navLinks.forEach((link) => {
      const isCurrent = link.dataset.page === pageName;
      link.classList.toggle("active", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (pageTitle) pageTitle.textContent = title;
    document.title = `${title} | Jun AI Command Center`;
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const pageName = link.dataset.page;
      const title = link.dataset.title;
      if (!pageName || !title) return;
      showPage(pageName, title);
      window.history.replaceState(null, "", `#${pageName}`);
    });
  });

  // ページを再読込しても、URLの # に対応する画面を表示します。
  const initialPage = window.location.hash.replace("#", "") || "overview";
  const initialLink = document.querySelector(`.nav-link[data-page="${initialPage}"]`);
  if (initialLink) showPage(initialPage, initialLink.dataset.title);
});
