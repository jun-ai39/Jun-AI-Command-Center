/*
 * 投資管理画面（STEP6-2）
 * 公開リポジトリに置ける架空のサンプルデータだけを表示します。
 * 実際の資産情報や個人情報は、このファイルへ書かないでください。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    total: document.getElementById("portfolioTotal"),
    invested: document.getElementById("portfolioInvested"),
    profit: document.getElementById("portfolioProfit"),
    profitRate: document.getElementById("portfolioProfitRate"),
    updatedAt: document.getElementById("portfolioUpdatedAt"),
    allocationChart: document.getElementById("allocationChart"),
    allocationTotal: document.getElementById("allocationTotal"),
    allocationLegend: document.getElementById("allocationLegend"),
    history: document.getElementById("portfolioHistory"),
    holdingsBody: document.getElementById("holdingsBody"),
    holdingsCount: document.getElementById("holdingsCount")
  };

  // 日本円として見やすく表示します。
  const formatYen = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0
    }).format(number);
  };

  const formatPercent = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
  };

  const getDirection = (value) => {
    const number = Number(value);
    if (number > 0) return "positive";
    if (number < 0) return "negative";
    return "neutral";
  };

  const renderSummary = (summary) => {
    const total = Number(summary.total_value);
    const invested = Number(summary.invested_amount);
    const profit = total - invested;
    const profitRate = invested > 0 ? (profit / invested) * 100 : 0;
    const direction = getDirection(profit);

    if (elements.total) elements.total.textContent = formatYen(total);
    if (elements.invested) elements.invested.textContent = formatYen(invested);
    if (elements.profit) {
      elements.profit.textContent = `${profit > 0 ? "+" : ""}${formatYen(profit)}`;
      elements.profit.className = `portfolio-stat-value ${direction}`;
    }
    if (elements.profitRate) {
      elements.profitRate.textContent = `評価損益率 ${formatPercent(profitRate)}`;
      elements.profitRate.className = `portfolio-stat-meta ${direction}`;
    }
    if (elements.allocationTotal) elements.allocationTotal.textContent = formatYen(total);
  };

  const renderAllocation = (allocations) => {
    if (!elements.allocationChart || !elements.allocationLegend) return;

    const safeAllocations = Array.isArray(allocations) ? allocations : [];
    let current = 0;
    const gradientParts = safeAllocations.map((item) => {
      const start = current;
      current += Number(item.percent) || 0;
      return `${item.color} ${start}% ${current}%`;
    });

    elements.allocationChart.style.background = gradientParts.length
      ? `conic-gradient(${gradientParts.join(", ")})`
      : "var(--color-border)";
    elements.allocationChart.setAttribute(
      "aria-label",
      safeAllocations.map((item) => `${item.label} ${item.percent}%`).join("、") || "構成データなし"
    );

    elements.allocationLegend.replaceChildren();
    safeAllocations.forEach((item) => {
      const listItem = document.createElement("li");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const marker = document.createElement("i");

      marker.style.backgroundColor = item.color;
      label.append(marker, document.createTextNode(item.label));
      value.textContent = `${item.percent}%`;
      listItem.append(label, value);
      elements.allocationLegend.append(listItem);
    });
  };

  const renderHistory = (history) => {
    if (!elements.history) return;
    elements.history.replaceChildren();

    const values = Array.isArray(history) ? history.map((item) => Number(item.value)) : [];
    const maxValue = Math.max(...values.filter(Number.isFinite), 1);

    history.forEach((item) => {
      const column = document.createElement("div");
      const value = document.createElement("span");
      const barTrack = document.createElement("div");
      const bar = document.createElement("i");
      const label = document.createElement("small");
      const numericValue = Number(item.value);
      const height = Number.isFinite(numericValue) ? Math.max((numericValue / maxValue) * 100, 6) : 6;

      column.className = "history-column";
      value.className = "history-value";
      value.textContent = Number.isFinite(numericValue) ? `${(numericValue / 10000).toFixed(0)}万` : "--";
      barTrack.className = "history-bar-track";
      bar.className = "history-bar";
      bar.style.height = `${height}%`;
      label.textContent = item.month || "--";
      barTrack.append(bar);
      column.append(value, barTrack, label);
      column.setAttribute("aria-label", `${item.month} ${formatYen(numericValue)}`);
      elements.history.append(column);
    });
  };

  const renderHoldings = (holdings, totalValue) => {
    if (!elements.holdingsBody) return;
    elements.holdingsBody.replaceChildren();

    if (!Array.isArray(holdings) || holdings.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "holdings-message";
      cell.textContent = "保有資産のサンプルがありません。";
      row.append(cell);
      elements.holdingsBody.append(row);
      return;
    }

    holdings.forEach((item) => {
      const row = document.createElement("tr");
      const identityCell = document.createElement("td");
      const type = document.createElement("span");
      const name = document.createElement("strong");
      const valueCell = document.createElement("td");
      const profitCell = document.createElement("td");
      const ratioCell = document.createElement("td");
      const value = Number(item.value);
      const profit = Number(item.profit);
      const ratio = totalValue > 0 ? (value / totalValue) * 100 : 0;

      type.className = `holding-type ${item.category === "NISA" ? "nisa" : "crypto"}`;
      type.textContent = item.category;
      name.textContent = item.name;
      identityCell.append(type, name);
      valueCell.textContent = formatYen(value);
      profitCell.textContent = `${profit > 0 ? "+" : ""}${formatYen(profit)}`;
      profitCell.className = getDirection(profit);
      ratioCell.textContent = `${ratio.toFixed(1)}%`;
      row.append(identityCell, valueCell, profitCell, ratioCell);
      elements.holdingsBody.append(row);
    });

    if (elements.holdingsCount) elements.holdingsCount.textContent = `${holdings.length} ASSETS`;
  };

  const showError = () => {
    if (elements.updatedAt) elements.updatedAt.textContent = "サンプルを表示できません";
    if (elements.holdingsBody) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "holdings-message";
      cell.textContent = "データの読み込みに失敗しました。";
      row.append(cell);
      elements.holdingsBody.replaceChildren(row);
    }
  };

  try {
    const response = await fetch("./data/portfolio-sample.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // 実データの誤配置を防ぐため、sample フラグがないデータは表示しません。
    if (data.is_sample !== true) throw new Error("サンプルデータではありません");

    renderSummary(data.summary);
    renderAllocation(data.allocation);
    renderHistory(data.history || []);
    renderHoldings(data.holdings, Number(data.summary.total_value));
    if (elements.updatedAt) elements.updatedAt.textContent = `基準日 ${data.as_of}・架空データ`;
  } catch (error) {
    console.error("投資管理サンプルの読み込みに失敗しました。", error);
    showError();
  }
});
