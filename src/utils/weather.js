/**
 * 天气服务 — 使用 Open-Meteo 免费 API（无需密钥）
 */

const HEFEI = { lat: 31.82, lon: 117.23 };

// 天气代码 → 中文+图标
const weatherMap = {
  0: { icon: '☀️', text: '晴' },
  1: { icon: '🌤', text: '少云' },
  2: { icon: '⛅', text: '多云' },
  3: { icon: '☁️', text: '阴' },
  45: { icon: '🌫', text: '雾' },
  48: { icon: '🌫', text: '霜雾' },
  51: { icon: '🌦', text: '小雨' },
  53: { icon: '🌦', text: '中雨' },
  55: { icon: '🌧', text: '大雨' },
  61: { icon: '🌧', text: '阵雨' },
  71: { icon: '❄️', text: '小雪' },
  73: { icon: '❄️', text: '中雪' },
  80: { icon: '🌦', text: '雷阵雨' },
  95: { icon: '⛈', text: '雷暴' },
};

let cachedWeather = null;
let cacheTime = 0;

export async function fetchWeather() {
  // 缓存 30 分钟
  if (cachedWeather && Date.now() - cacheTime < 30 * 60 * 1000) return cachedWeather;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${HEFEI.lat}&longitude=${HEFEI.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=Asia/Shanghai&forecast_days=3`;
    const res = await fetch(url);
    const data = await res.json();

    const now = data.current_weather;
    const daily = data.daily;

    const result = {
      current: {
        temp: Math.round(now.temperature),
        icon: weatherMap[now.weathercode]?.icon || '🌡',
        text: weatherMap[now.weathercode]?.text || '未知',
        wind: now.windspeed,
      },
      forecast: daily.time.slice(1).map((date, i) => ({
        date: new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        high: Math.round(daily.temperature_2m_max[i + 1]),
        low: Math.round(daily.temperature_2m_min[i + 1]),
        icon: weatherMap[daily.weathercode[i + 1]]?.icon || '🌡',
        rain: daily.precipitation_probability_max?.[i + 1] || 0,
      })),
    };

    cachedWeather = result;
    cacheTime = Date.now();
    return result;
  } catch (e) {
    console.warn('天气获取失败:', e.message);
    return cachedWeather || null;
  }
}
