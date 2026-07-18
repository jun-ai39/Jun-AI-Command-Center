/* 現在の日付表示とスマートフォン用メニューを管理します。 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dateElement = document.getElementById("currentDate");
  const menuButton = document.getElementById("menuButton");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
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
    const closeMenu = () => {
      sidebar.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "メニューを開く");
    };

    menuButton.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      document.body.classList.toggle("menu-open", isOpen);
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
    });

    sidebar.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
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
      window.history.pushState(null, "", `#${pageName}`);
    });
  });

  // URLの # に対応する画面を表示します。
  const showPageFromHash = () => {
    const pageName = window.location.hash.replace("#", "") || "overview";
    const targetLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
    if (targetLink) showPage(pageName, targetLink.dataset.title);
    else showPage("overview", "今日の概要");
  };

  // 戻る・進むボタンや、URLの直接変更にも対応します。
  window.addEventListener("hashchange", showPageFromHash);
  window.addEventListener("popstate", showPageFromHash);
  showPageFromHash();
});
