/*
 * 熊本ツーリング画面（STEP7-2）
 * 参考ルートを data/bike-routes.json から読み込みます。
 * Google Maps URLはAPIキー不要の公式共通URLを使用します。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const routeGrid = document.getElementById("bikeRouteGrid");
  const routeCount = document.getElementById("bikeRouteCount");

  // ルート情報をGoogle Mapsの経路URLへ安全に変換します。
  const createMapUrl = (map) => {
    const url = new URL("https://www.google.com/maps/dir/");
    const parameters = new URLSearchParams({
      api: "1",
      origin: map.origin,
      destination: map.destination,
      travelmode: "driving"
    });
    if (Array.isArray(map.waypoints) && map.waypoints.length > 0) {
      parameters.set("waypoints", map.waypoints.slice(0, 3).join("|"));
    }
    url.search = parameters.toString();
    return url.href;
  };

  const createRouteCard = (route, index) => {
    const card = document.createElement("article");
    const top = document.createElement("div");
    const number = document.createElement("span");
    const region = document.createElement("span");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    const tags = document.createElement("div");
    const stops = document.createElement("ol");
    const caution = document.createElement("p");
    const mapLink = document.createElement("a");

    card.className = "panel bike-route-card";
    top.className = "bike-route-top";
    number.className = "bike-route-number";
    number.textContent = String(index + 1).padStart(2, "0");
    region.className = "bike-region";
    region.textContent = route.region;
    top.append(number, region);

    title.textContent = route.title;
    description.className = "bike-route-description";
    description.textContent = route.description;

    tags.className = "bike-tags";
    (route.tags || []).forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = tag;
      tags.append(item);
    });

    stops.className = "bike-stops";
    (route.stops || []).forEach((stop) => {
      const item = document.createElement("li");
      item.textContent = stop;
      stops.append(item);
    });

    caution.className = "bike-caution";
    caution.textContent = `確認：${route.caution}`;

    mapLink.className = "bike-map-link";
    mapLink.href = createMapUrl(route.map);
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.textContent = "Google Mapsでルート候補を開く ↗";

    card.append(top, title, description, tags, stops, caution, mapLink);
    return card;
  };

  const showError = () => {
    if (routeCount) routeCount.textContent = "ERROR";
    if (!routeGrid) return;
    const message = document.createElement("article");
    message.className = "panel bike-message";
    message.textContent = "ルート候補を表示できません。";
    routeGrid.replaceChildren(message);
  };

  try {
    const response = await fetch("./data/bike-routes.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.is_reference !== true || !Array.isArray(data.routes)) {
      throw new Error("参考ルートデータではありません");
    }

    if (routeGrid) {
      routeGrid.replaceChildren();
      data.routes.forEach((route, index) => routeGrid.append(createRouteCard(route, index)));
    }
    if (routeCount) routeCount.textContent = `${data.routes.length} ROUTES`;
  } catch (error) {
    console.error("ツーリング候補の読み込みに失敗しました。", error);
    showError();
  }
});
