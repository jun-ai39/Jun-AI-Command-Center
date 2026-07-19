/*
 * 熊本市の天気表示
 * TOP画面と共通のOpen-Meteoデータから、現在天気と7日間予報を表示します。
 * 固定座標を使い、端末の位置情報は取得しません。
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
  const weatherData = window.JunWeatherData;

  const renderCurrent = (current) => {
    const weather = weatherData.getWeather(current.weather_code);

    if (elements.icon) elements.icon.textContent = weather.icon;
    if (elements.temperature) {
      elements.temperature.textContent = weatherData.formatValue(
        current.temperature_2m,
        "°",
        1
      );
    }
    if (elements.condition) elements.condition.textContent = weather.label;
    if (elements.feelsLike) {
      elements.feelsLike.textContent = "体感温度 "
        + weatherData.formatValue(current.apparent_temperature, "°C", 1);
    }
    if (elements.humidity) {
      elements.humidity.textContent = weatherData.formatValue(
        current.relative_humidity_2m,
        "%"
      );
    }
    if (elements.precipitation) {
      elements.precipitation.textContent = weatherData.formatValue(
        current.precipitation,
        " mm",
        1
      );
    }
    if (elements.wind) {
      elements.wind.textContent = weatherData.formatValue(
        current.wind_speed_10m,
        " km/h",
        1
      );
    }
    if (elements.windDirection) {
      elements.windDirection.textContent = weatherData.getWindDirection(
        current.wind_direction_10m
      );
    }
  };

  const renderWeekly = (daily) => {
    if (!elements.weekly) return;

    elements.weekly.replaceChildren();
    const dates = Array.isArray(daily && daily.time) ? daily.time : [];

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

      const weather = weatherData.getWeather(
        daily.weather_code && daily.weather_code[index]
      );
      const max = Number(
        daily.temperature_2m_max && daily.temperature_2m_max[index]
      );
      const min = Number(
        daily.temperature_2m_min && daily.temperature_2m_min[index]
      );

      item.className = "forecast-card" + (index === 0 ? " today" : "");
      dateLabel.dateTime = date;
      dateLabel.textContent = index === 0
        ? "今日"
        : dateFormatter.format(new Date(date + "T00:00:00+09:00"));

      icon.className = "forecast-icon";
      icon.textContent = weather.icon;
      icon.setAttribute("aria-hidden", "true");

      condition.className = "forecast-condition";
      condition.textContent = weather.label;

      temperatures.className = "forecast-temperature";
      temperatures.textContent = weatherData.formatValue(max, "°")
        + " / "
        + weatherData.formatValue(min, "°");

      precipitation.className = "forecast-detail";
      precipitation.textContent = "降水 "
        + weatherData.formatValue(
          daily.precipitation_probability_max
          && daily.precipitation_probability_max[index],
          "%"
        );

      wind.className = "forecast-detail";
      wind.textContent = "最大風速 "
        + weatherData.formatValue(
          daily.wind_speed_10m_max && daily.wind_speed_10m_max[index],
          " km/h",
          1
        );

      item.append(
        dateLabel,
        icon,
        condition,
        temperatures,
        precipitation,
        wind
      );

      item.setAttribute(
        "aria-label",
        dateLabel.textContent + "、" + weather.label
        + "、最高" + weatherData.formatValue(max, "度")
        + "、最低" + weatherData.formatValue(min, "度")
        + "、" + precipitation.textContent
      );

      elements.weekly.append(item);
    });
  };

  const showError = () => {
    if (elements.status) elements.status.textContent = "ERROR";
    if (elements.updatedAt) {
      elements.updatedAt.textContent = "天気情報を取得できませんでした";
    }
    if (elements.condition) elements.condition.textContent = "取得エラー";
    renderWeekly(null);
  };

  try {
    if (!weatherData) {
      throw new Error("共通天気処理を読み込めません");
    }

    const data = await weatherData.load();

    renderCurrent(data.current);
    renderWeekly(data.daily);

    if (elements.status) elements.status.textContent = "LIVE";

    if (elements.updatedAt) {
      const observedAt = new Date(data.current.time + ":00+09:00");
      elements.updatedAt.textContent = "予報基準："
        + observedAt.toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo"
        });
    }
  } catch (error) {
    console.error("熊本の天気情報を取得できませんでした。", error);
    showError();
  }
});
