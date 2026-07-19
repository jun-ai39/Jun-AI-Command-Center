/*
 * STEP15 世界情勢マップ
 * ニュースを地域別に絞り込むための軽量な地図UIです。
 */
"use strict";

(() => {
  /*
   * 地域名・地図上の表示位置・分類用キーワードを1か所へまとめます。
   * 地図は模式図のため、位置はおおよその表示位置です。
   */
  const regions = [
    { id: "all", label: "すべて", marker: false },
    {
      id: "japan",
      label: "日本",
      x: "91%",
      y: "38%",
      keywords: ["日本", "国内", "東京", "北海道", "沖縄", "日銀", "国会"]
    },
    {
      id: "middle-east",
      label: "中東",
      x: "64%",
      y: "48%",
      keywords: [
        "中東", "イラン", "イスラエル", "ガザ", "パレスチナ", "シリア",
        "レバノン", "イラク", "サウジ", "イエメン", "ヨルダン", "カタール",
        "アラブ首長国連邦", "uae"
      ]
    },
    {
      id: "latin-america",
      label: "中南米",
      x: "31%",
      y: "70%",
      keywords: [
        "中南米", "メキシコ", "ブラジル", "アルゼンチン", "チリ", "ペルー",
        "コロンビア", "キューバ", "ベネズエラ"
      ]
    },
    {
      id: "north-america",
      label: "北米",
      x: "20%",
      y: "30%",
      keywords: [
        "北米", "アメリカ", "米国", "カナダ", "ワシントン", "ニューヨーク",
        "トランプ", "united states", "u.s.", "canada"
      ]
    },
    {
      id: "europe",
      label: "欧州",
      x: "50%",
      y: "29%",
      keywords: [
        "欧州", "ヨーロッパ", "イギリス", "英国", "英仏", "フランス", "ドイツ",
        "イタリア", "スペイン", "ウクライナ", "ロシア", "ポーランド",
        "nato", "eu"
      ]
    },
    {
      id: "africa",
      label: "アフリカ",
      x: "53%",
      y: "62%",
      keywords: [
        "アフリカ", "南アフリカ", "スーダン", "エジプト", "ナイジェリア",
        "ケニア", "エチオピア", "コンゴ", "ソマリア"
      ]
    },
    {
      id: "oceania",
      label: "オセアニア",
      x: "83%",
      y: "75%",
      keywords: [
        "オセアニア", "オーストラリア", "ニュージーランド", "太平洋諸島",
        "フィジー", "パプアニューギニア"
      ]
    },
    {
      id: "asia",
      label: "アジア",
      x: "76%",
      y: "30%",
      keywords: [
        "アジア", "中国", "韓国", "北朝鮮", "台湾", "香港", "インド",
        "パキスタン", "東南アジア", "asean", "フィリピン", "インドネシア",
        "タイ", "ベトナム", "ミャンマー", "シンガポール"
      ]
    },
    { id: "global", label: "その他・世界", marker: false, keywords: [] }
  ];

  const regionIds = new Set(regions.map((region) => region.id));

  const classifyTitle = (title) => {
    const normalizedTitle = String(title || "").toLocaleLowerCase("ja-JP");

    /*
     * 配列の順番が優先順位です。
     * 例：「アメリカ軍、イランを…」は中東として分類します。
     */
    for (const region of regions) {
      if (!region.keywords) continue;
      if (region.keywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))) {
        return region.id;
      }
    }
    return "global";
  };

  const resolveRegion = (item) => {
    const savedRegion = String(item && item.region || "");
    return regionIds.has(savedRegion) && savedRegion !== "all"
      ? savedRegion
      : classifyTitle(item && item.title);
  };

  /*
   * news.jsからも同じ分類処理を使用できるよう、専用名前空間だけを公開します。
   * APIキーや個人情報は含みません。
   */
  window.JunWorldMap = Object.freeze({
    regions,
    resolveRegion
  });

  document.addEventListener("DOMContentLoaded", () => {
    const markersContainer = document.getElementById("worldMapMarkers");
    const filtersContainer = document.getElementById("worldRegionFilters");
    const selectionText = document.getElementById("worldMapSelection");

    if (!markersContainer || !filtersContainer || !selectionText) return;

    let activeRegion = "all";
    let newsItems = [];

    const getRegion = (regionId) => (
      regions.find((region) => region.id === regionId) || regions[0]
    );

    const updateActiveButtons = () => {
      document.querySelectorAll("[data-world-region]").forEach((button) => {
        const isActive = button.dataset.worldRegion === activeRegion;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    };

    const activateRegion = (regionId, notifyNews = true) => {
      if (!regionIds.has(regionId)) return;

      activeRegion = regionId;
      const region = getRegion(regionId);
      const count = regionId === "all"
        ? newsItems.length
        : newsItems.filter((item) => resolveRegion(item) === regionId).length;

      selectionText.textContent = regionId === "all"
        ? "すべての地域を表示中（" + count + "件）"
        : region.label + "のニュースを表示中（" + count + "件）";

      updateActiveButtons();

      if (notifyNews) {
        window.dispatchEvent(new CustomEvent("world-region-change", {
          detail: { region: regionId }
        }));
      }
    };

    const createMarker = (region) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-region-marker";
      button.dataset.worldRegion = region.id;
      button.style.setProperty("--map-x", region.x);
      button.style.setProperty("--map-y", region.y);
      button.textContent = region.label;
      button.setAttribute("aria-label", region.label + "のニュースを表示");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => activateRegion(region.id));
      return button;
    };

    const createFilterButton = (region) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-region-button";
      button.dataset.worldRegion = region.id;
      button.setAttribute("aria-pressed", "false");

      const label = document.createElement("span");
      label.textContent = region.label;

      const count = document.createElement("span");
      count.className = "world-region-count";
      count.dataset.worldRegionCount = region.id;
      count.textContent = "0";

      button.append(label, count);
      button.addEventListener("click", () => activateRegion(region.id));
      return button;
    };

    regions.forEach((region) => {
      filtersContainer.append(createFilterButton(region));
      if (region.marker) markersContainer.append(createMarker(region));
    });

    window.addEventListener("world-news-loaded", (event) => {
      newsItems = Array.isArray(event.detail && event.detail.items)
        ? event.detail.items
        : [];

      regions.forEach((region) => {
        const count = region.id === "all"
          ? newsItems.length
          : newsItems.filter((item) => resolveRegion(item) === region.id).length;

        filtersContainer
          .querySelectorAll('[data-world-region-count="' + region.id + '"]')
          .forEach((element) => {
            element.textContent = String(count);
          });
      });

      activateRegion(activeRegion, false);
    });

    activateRegion("all", false);
  });
})();
