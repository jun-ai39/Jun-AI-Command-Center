/*
 * 熊本市の天気データ共通処理
 * TOP画面と熊本画面が同じOpen-Meteo通信と表示変換を共有します。
 */
"use strict";

(() => {
  // 熊本市役所周辺の固定座標です。端末の位置情報は取得しません。
  const latitude = "32.8031";
  const longitude = "130.7079";
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  let loadPromise = null;

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

  const getWeather = (code) => {
    const numericCode = Number(code);

    if (numericCode === 0) return { label: "快晴", icon: "☀" };
    if (numericCode === 1) return { label: "晴れ", icon: "☀" };
    if (numericCode === 2) return { label: "一部くもり", icon: "⛅" };
    if (numericCode === 3) return { label: "くもり", icon: "☁" };
    if ([45, 48].includes(numericCode)) {
      return { label: "霧", icon: "≋" };
    }
    if (numericCode >= 51 && numericCode <= 57) {
      return { label: "霧雨", icon: "🌦" };
    }
    if (numericCode >= 61 && numericCode <= 67) {
      return { label: "雨", icon: "☂" };
    }
    if (numericCode >= 71 && numericCode <= 77) {
      return { label: "雪", icon: "❄" };
    }
    if (numericCode >= 80 && numericCode <= 82) {
      return { label: "にわか雨", icon: "🌦" };
    }
    if (numericCode >= 85 && numericCode <= 86) {
      return { label: "にわか雪", icon: "❄" };
    }
    if (numericCode >= 95 && numericCode <= 99) {
      return { label: "雷雨", icon: "⚡" };
    }

    return { label: "不明", icon: "◇" };
  };

  const getWindDirection = (degrees) => {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return "風向不明";

    const directions = [
      "北", "北東", "東", "南東", "南", "南西", "西", "北西"
    ];

    return directions[Math.round(value / 45) % 8] + "の風";
  };

  const formatValue = (value, unit, decimals = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return ("-- " + unit).trim();
    return number.toFixed(decimals) + unit;
  };

  const getTodayForecast = (data) => {
    const dates = Array.isArray(data && data.daily && data.daily.time)
      ? data.daily.time
      : [];

    if (dates.length === 0) return null;

    const currentDate = String(data.current && data.current.time || "")
      .slice(0, 10);
    const todayIndex = Math.max(0, dates.indexOf(currentDate));

    return {
      date: dates[todayIndex],
      weatherCode: data.daily.weather_code && data.daily.weather_code[todayIndex],
      temperatureMax:
        data.daily.temperature_2m_max
        && data.daily.temperature_2m_max[todayIndex],
      temperatureMin:
        data.daily.temperature_2m_min
        && data.daily.temperature_2m_min[todayIndex],
      precipitationProbability:
        data.daily.precipitation_probability_max
        && data.daily.precipitation_probability_max[todayIndex],
      windSpeedMax:
        data.daily.wind_speed_10m_max
        && data.daily.wind_speed_10m_max[todayIndex]
    };
  };

  const load = () => {
    /*
     * TOPと熊本画面が同時に要求しても、API通信は1回だけです。
     * 15秒で応答しない場合は中断し、画面を待機状態のままにしません。
     */
    if (!loadPromise) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      loadPromise = fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal
      })
        .then((response) => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then((data) => {
          if (!data || !data.current || !data.daily) {
            throw new Error("必要な予報データがありません");
          }
          if (!Array.isArray(data.daily.time)) {
            throw new Error("日別予報のデータ形式が不正です");
          }
          return data;
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        })
        .finally(() => window.clearTimeout(timeoutId));
    }

    return loadPromise;
  };

  window.JunWeatherData = Object.freeze({
    load,
    getWeather,
    getWindDirection,
    formatValue,
    getTodayForecast
  });
})();
