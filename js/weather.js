/*
 * 熊本市の天気表示（STEP7-1）
 * Open-Meteo Forecast APIから、現在天気と7日間予報を取得します。
 * APIキーは不要です。実際の予報は変化するため、参考情報として表示します。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    status: document.getElementById("weatherStatus"),
    updatedAt: document.getElementById("weatherUpdatedAt"),
    icon: document.getElementById("currentWeatherIcon"),
    temperature: document.getElementById("currentTemperature"),
    condition: document.getElementById("currentCondition"),
    feelsLike: document.getElementById("currentFeelsLike"),
    humidity: document.getElementById("currentHumidity"),
    precipitation: document.getElementById("currentPrecipitation"),
    wind: document.getElementById("currentWind"),
    windDirection: document.getElementById("currentWindDirection"),
    weekly: document.getElementById("weeklyWeather")
  };

  // 熊本市役所周辺の固定座標です。位置情報の取得は行いません。
  const latitude = "32.8031";
  const longitude = "130.7079";
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.search = new URLSearchParams({
    latitude,
    longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max"
    ].join(","),
    timezone: "Asia/Tokyo",
    forecast_days: "7"
  }).toString();

  // WMO weather interpretation codeを日本語と記号へ変換します。
  const getWeather = (code) => {
    const numericCode = Number(code);
    if (numericCode === 0) return { label: "快晴", icon: "☀" };
    if (numericCode === 1) return { label: "晴れ", icon: "☀" };
    if (numericCode === 2) return { label: "一部くもり", icon: "⛅" };
    if (numericCode === 3) return { label: "くもり", icon: "☁" };
    if ([45, 48].includes(numericCode)) return { label: "霧", icon: "≋" };
    if (numericCode >= 51 && numericCode <= 57) return { label: "霧雨", icon: "🌦" };
    if (numericCode >= 61 && numericCode <= 67) return { label: "雨", icon: "☂" };
    if (numericCode >= 71 && numericCode <= 77) return { label: "雪", icon: "❄" };
    if (numericCode >= 80 && numericCode <= 82) return { label: "にわか雨", icon: "🌦" };
    if (numericCode >= 85 && numericCode <= 86) return { label: "にわか雪", icon: "❄" };
    if (numericCode >= 95 && numericCode <= 99) return { label: "雷雨", icon: "⚡" };
    return { label: "不明", icon: "◇" };
  };

  const getWindDirection = (degrees) => {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return "風向不明";
    const directions = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    return `${directions[Math.round(value / 45) % 8]}の風`;
  };

  const formatValue = (value, unit, decimals = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return `-- ${unit}`.trim();
    return `${number.toFixed(decimals)}${unit}`;
  };

  const renderCurrent = (current) => {
    const weather = getWeather(current.weather_code);
    if (elements.icon) elements.icon.textContent = weather.icon;
    if (elements.temperature) elements.temperature.textContent = formatValue(current.temperature_2m, "°", 1);
    if (elements.condition) elements.condition.textContent = weather.label;
    if (elements.feelsLike) elements.feelsLike.textContent = `体感温度 ${formatValue(current.apparent_temperature, "°C", 1)}`;
    if (elements.humidity) elements.humidity.textContent = formatValue(current.relative_humidity_2m, "%");
    if (elements.precipitation) elements.precipitation.textContent = formatValue(current.precipitation, " mm", 1);
    if (elements.wind) elements.wind.textContent = formatValue(current.wind_speed_10m, " km/h", 1);
    if (elements.windDirection) elements.windDirection.textContent = getWindDirection(current.wind_direction_10m);
  };

  const renderWeekly = (daily) => {
    if (!elements.weekly) return;
    elements.weekly.replaceChildren();
    const dates = Array.isArray(daily?.time) ? daily.time : [];

    if (dates.length === 0) {
      const message = document.createElement("p");
      message.className = "weather-message";
      message.textContent = "週間予報を表示できません。";
      elements.weekly.append(message);
      return;
    }

    const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short"
    });

    dates.forEach((date, index) => {
      const item = document.createElement("article");
      const dateLabel = document.createElement("time");
      const icon = document.createElement("span");
      const condition = document.createElement("p");
      const temperatures = document.createElement("p");
      const precipitation = document.createElement("p");
      const wind = document.createElement("p");
      const weather = getWeather(daily.weather_code?.[index]);
      const max = Number(daily.temperature_2m_max?.[index]);
      const min = Number(daily.temperature_2m_min?.[index]);

      item.className = `forecast-card${index === 0 ? " today" : ""}`;
      dateLabel.dateTime = date;
      dateLabel.textContent = index === 0 ? "今日" : dateFormatter.format(new Date(`${date}T00:00:00+09:00`));
      icon.className = "forecast-icon";
      icon.textContent = weather.icon;
      icon.setAttribute("aria-hidden", "true");
      condition.className = "forecast-condition";
      condition.textContent = weather.label;
      temperatures.className = "forecast-temperature";
      temperatures.textContent = `${formatValue(max, "°")} / ${formatValue(min, "°")}`;
      precipitation.className = "forecast-detail";
      precipitation.textContent = `降水 ${formatValue(daily.precipitation_probability_max?.[index], "%")}`;
      wind.className = "forecast-detail";
      wind.textContent = `最大風速 ${formatValue(daily.wind_speed_10m_max?.[index], " km/h", 1)}`;

      item.append(dateLabel, icon, condition, temperatures, precipitation, wind);
      item.setAttribute(
        "aria-label",
        `${dateLabel.textContent}、${weather.label}、最高${formatValue(max, "度")}、最低${formatValue(min, "度")}、${precipitation.textContent}`
      );
      elements.weekly.append(item);
    });
  };

  const showError = () => {
    if (elements.status) elements.status.textContent = "ERROR";
    if (elements.updatedAt) elements.updatedAt.textContent = "天気情報を取得できませんでした";
    if (elements.condition) elements.condition.textContent = "取得エラー";
    renderWeekly(null);
  };

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.current || !data.daily) throw new Error("必要な予報データがありません");

    renderCurrent(data.current);
    renderWeekly(data.daily);
    if (elements.status) elements.status.textContent = "LIVE";
    if (elements.updatedAt) {
      const observedAt = new Date(`${data.current.time}:00+09:00`);
      elements.updatedAt.textContent = `予報基準：${observedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
    }
  } catch (error) {
    console.error("熊本の天気情報を取得できませんでした。", error);
    showError();
  }
});
