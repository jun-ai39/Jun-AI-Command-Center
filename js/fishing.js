/*
 * 天草の海況表示（STEP7-3）
 * Open-MeteoのWeather APIとMarine APIを利用します。
 * 沿岸の予報には誤差があるため、安全を保証する判定は行いません。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    status: document.getElementById("fishingStatus"),
    updatedAt: document.getElementById("fishingUpdatedAt"),
    locationName: document.getElementById("fishingLocationName"),
    locationButtons: document.getElementById("fishingLocationButtons"),
    waveHeight: document.getElementById("currentWaveHeight"),
    waveDirection: document.getElementById("currentWaveDirection"),
    wavePeriod: document.getElementById("currentWavePeriod"),
    windSpeed: document.getElementById("fishingWindSpeed"),
    windDirection: document.getElementById("fishingWindDirection"),
    windGust: document.getElementById("fishingWindGust"),
    precipitation: document.getElementById("fishingPrecipitation"),
    seaTemperature: document.getElementById("seaTemperature"),
    currentSpeed: document.getElementById("oceanCurrentSpeed"),
    currentDirection: document.getElementById("oceanCurrentDirection"),
    forecast: document.getElementById("marineForecast")
  };

  let activeRequest = null;

  const formatValue = (value, unit, decimals = 1) => {
    if (value === null || value === undefined || value === "") return `-- ${unit}`.trim();
    const number = Number(value);
    if (!Number.isFinite(number)) return `-- ${unit}`.trim();
    return `${number.toFixed(decimals)}${unit}`;
  };

  const getDirection = (degrees, mode) => {
    if (degrees === null || degrees === undefined || degrees === "") return "方向不明";
    const value = Number(degrees);
    if (!Number.isFinite(value)) return "方向不明";
    const directions = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    const direction = directions[Math.round(value / 45) % 8];
    if (mode === "toward") return `${direction}へ流れる予報`;
    if (mode === "wave") return `${direction}からの波`;
    return `${direction}の風`;
  };

  const getWeather = (code) => {
    if (code === null || code === undefined || code === "") return { label: "不明", icon: "◇" };
    const value = Number(code);
    if (value <= 1) return { label: "晴れ", icon: "☀" };
    if (value === 2) return { label: "一部くもり", icon: "⛅" };
    if (value === 3) return { label: "くもり", icon: "☁" };
    if ([45, 48].includes(value)) return { label: "霧", icon: "≋" };
    if (value >= 51 && value <= 67) return { label: "雨", icon: "☂" };
    if (value >= 71 && value <= 77) return { label: "雪", icon: "❄" };
    if (value >= 80 && value <= 82) return { label: "にわか雨", icon: "🌦" };
    if (value >= 85 && value <= 86) return { label: "にわか雪", icon: "❄" };
    if (value >= 95) return { label: "雷雨", icon: "⚡" };
    return { label: "不明", icon: "◇" };
  };

  const createWeatherUrl = (location) => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "weather_code,temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
      daily: "weather_code,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
      timezone: "Asia/Tokyo",
      forecast_days: "7",
      cell_selection: "nearest"
    }).toString();
    return url;
  };

  const createMarineUrl = (location) => {
    const url = new URL("https://marine-api.open-meteo.com/v1/marine");
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction",
      daily: "wave_height_max,wave_direction_dominant,wave_period_max",
      timezone: "Asia/Tokyo",
      forecast_days: "7",
      cell_selection: "sea"
    }).toString();
    return url;
  };

  const renderCurrent = (weather, marine) => {
    if (elements.waveHeight) elements.waveHeight.textContent = formatValue(marine.wave_height, " m");
    if (elements.waveDirection) elements.waveDirection.textContent = getDirection(marine.wave_direction, "wave");
    if (elements.wavePeriod) elements.wavePeriod.textContent = `周期 ${formatValue(marine.wave_period, " 秒")}`;
    if (elements.windSpeed) elements.windSpeed.textContent = formatValue(weather.wind_speed_10m, " km/h");
    if (elements.windDirection) elements.windDirection.textContent = getDirection(weather.wind_direction_10m, "wind");
    if (elements.windGust) elements.windGust.textContent = formatValue(weather.wind_gusts_10m, " km/h");
    if (elements.precipitation) elements.precipitation.textContent = formatValue(weather.precipitation, " mm");
    if (elements.seaTemperature) elements.seaTemperature.textContent = formatValue(marine.sea_surface_temperature, "°C");
    if (elements.currentSpeed) elements.currentSpeed.textContent = formatValue(marine.ocean_current_velocity, " km/h", 2);
    if (elements.currentDirection) elements.currentDirection.textContent = getDirection(marine.ocean_current_direction, "toward");
  };

  const renderForecast = (weather, marine) => {
    if (!elements.forecast) return;
    elements.forecast.replaceChildren();
    const dates = Array.isArray(weather?.time) ? weather.time : [];
    if (dates.length === 0) {
      const message = document.createElement("p");
      message.className = "marine-message";
      message.textContent = "週間海況を表示できません。";
      elements.forecast.append(message);
      return;
    }

    const formatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short"
    });

    dates.forEach((date, index) => {
      const card = document.createElement("article");
      const dateLabel = document.createElement("time");
      const icon = document.createElement("span");
      const condition = document.createElement("p");
      const wave = document.createElement("p");
      const wind = document.createElement("p");
      const rain = document.createElement("p");
      const weatherInfo = getWeather(weather.weather_code?.[index]);

      card.className = `marine-forecast-card${index === 0 ? " today" : ""}`;
      dateLabel.dateTime = date;
      dateLabel.textContent = index === 0 ? "今日" : formatter.format(new Date(`${date}T00:00:00+09:00`));
      icon.className = "marine-forecast-icon";
      icon.textContent = weatherInfo.icon;
      icon.setAttribute("aria-hidden", "true");
      condition.className = "marine-forecast-condition";
      condition.textContent = weatherInfo.label;
      wave.textContent = `最大波 ${formatValue(marine.wave_height_max?.[index], " m")}`;
      wind.textContent = `最大風速 ${formatValue(weather.wind_speed_10m_max?.[index], " km/h")}`;
      rain.textContent = `降水 ${formatValue(weather.precipitation_probability_max?.[index], "%", 0)}`;
      [wave, wind, rain].forEach((item) => item.className = "marine-forecast-detail");

      card.append(dateLabel, icon, condition, wave, wind, rain);
      card.setAttribute("aria-label", `${dateLabel.textContent}、${weatherInfo.label}、${wave.textContent}、${wind.textContent}、${rain.textContent}`);
      elements.forecast.append(card);
    });
  };

  const setActiveButton = (locationId) => {
    elements.locationButtons?.querySelectorAll("button").forEach((button) => {
      const isActive = button.dataset.locationId === locationId;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const showError = (message) => {
    if (elements.status) elements.status.textContent = "ERROR";
    if (elements.updatedAt) elements.updatedAt.textContent = message;
    renderForecast(null, null);
  };

  const loadForecast = async (location) => {
    if (activeRequest) activeRequest.abort();
    activeRequest = new AbortController();
    setActiveButton(location.id);
    if (elements.status) elements.status.textContent = "LOADING";
    if (elements.locationName) elements.locationName.textContent = `${location.name}・${location.description}`;

    try {
      const [weatherResponse, marineResponse] = await Promise.all([
        fetch(createWeatherUrl(location), { cache: "no-store", signal: activeRequest.signal }),
        fetch(createMarineUrl(location), { cache: "no-store", signal: activeRequest.signal })
      ]);
      if (!weatherResponse.ok || !marineResponse.ok) throw new Error("海況APIの応答エラー");
      const [weatherData, marineData] = await Promise.all([weatherResponse.json(), marineResponse.json()]);
      if (!weatherData.current || !weatherData.daily || !marineData.current || !marineData.daily) {
        throw new Error("必要な海況データがありません");
      }

      renderCurrent(weatherData.current, marineData.current);
      renderForecast(weatherData.daily, marineData.daily);
      if (elements.status) elements.status.textContent = "LIVE";
      if (elements.updatedAt) {
        const observedAt = new Date(`${weatherData.current.time}:00+09:00`);
        elements.updatedAt.textContent = `予報基準：${observedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("天草の海況を取得できませんでした。", error);
      showError("海況を取得できませんでした");
    }
  };

  const renderLocationButtons = (locations) => {
    if (!elements.locationButtons) return;
    elements.locationButtons.replaceChildren();
    locations.forEach((location) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.locationId = location.id;
      button.textContent = location.name;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => loadForecast(location));
      elements.locationButtons.append(button);
    });
  };

  try {
    const response = await fetch("./data/fishing-locations.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.locations) || data.locations.length === 0) throw new Error("地点データがありません");
    renderLocationButtons(data.locations);
    await loadForecast(data.locations[0]);
  } catch (error) {
    console.error("釣り地点データを読み込めませんでした。", error);
    showError("地点データを読み込めませんでした");
  }
});
