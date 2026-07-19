/*
 * TOP画面の熊本天気カード
 * 共通天気データから現在気温・最高最低・降水確率・風速を表示します。
 */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const card = document.querySelector(".overview-weather-card");
  const icon = document.getElementById("overviewWeatherIcon");
  const title = document.getElementById("overviewWeatherTitle");
  const updated = document.getElementById("overviewWeatherUpdated");
  const temperature = document.getElementById("overviewWeatherTemperature");
  const range = document.getElementById("overviewWeatherRange");
  const rain = document.getElementById("overviewWeatherRain");
  const wind = document.getElementById("overviewWeatherWind");
  const weatherData = window.JunWeatherData;

  if (
    !card || !icon || !title || !updated
    || !temperature || !range || !rain || !wind
  ) {
    return;
  }

  try {
    if (!weatherData) {
      throw new Error("共通天気処理を読み込めません");
    }

    const data = await weatherData.load();
    const current = data.current;
    const today = weatherData.getTodayForecast(data);

    if (!today) throw new Error("今日の予報がありません");

    const weather = weatherData.getWeather(current.weather_code);
    const precipitationProbability = Number(today.precipitationProbability);
    const currentWindSpeed = Number(current.wind_speed_10m);

    icon.textContent = weather.icon;
    title.textContent = "熊本市・" + weather.label;
    temperature.textContent = weatherData.formatValue(
      current.temperature_2m,
      "°",
      1
    );
    range.textContent = weatherData.formatValue(today.temperatureMax, "°")
      + " / "
      + weatherData.formatValue(today.temperatureMin, "°");
    rain.textContent = weatherData.formatValue(
      today.precipitationProbability,
      "%"
    );
    wind.textContent = weatherData.formatValue(
      current.wind_speed_10m,
      " km/h",
      1
    );

    const observedAt = new Date(current.time + ":00+09:00");
    updated.textContent = Number.isNaN(observedAt.getTime())
      ? "予報基準時刻を確認中"
      : "予報基準 "
        + observedAt.toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

    card.dataset.weatherState = precipitationProbability >= 70
      ? "rain"
      : currentWindSpeed >= 30
        ? "wind"
        : "normal";

    card.setAttribute(
      "aria-label",
      "熊本市、" + weather.label
      + "、現在" + temperature.textContent
      + "、最高最低" + range.textContent
      + "、降水確率" + rain.textContent
      + "、風速" + wind.textContent
      + "。熊本の天気を開く"
    );
  } catch (error) {
    console.error("TOPの熊本天気を表示できませんでした。", error);
    icon.textContent = "◇";
    title.textContent = "熊本の天気を表示できません";
    updated.textContent = "時間をおいて再読み込みしてください。";
    card.dataset.weatherState = "error";
  }
});
