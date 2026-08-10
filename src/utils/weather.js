/** Open-Meteo weather service for Hefei. No API key required. */
const HEFEI = { lat: 31.82, lon: 117.23 };
const CACHE_KEY = 'xiaohe_weather_cache_v2';
const CACHE_MS = 30 * 60 * 1000;

const weatherMap = {
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '较强毛毛雨',
  56: '冻毛毛雨', 57: '较强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '较强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
  80: '小阵雨', 81: '阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '强阵雪',
  95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴冰雹',
};

let memoryCache = null;
let memoryCacheTime = 0;

function readFallbackCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached?.data && Date.now() - cached.savedAt < 6 * 60 * 60 * 1000) return cached.data;
  } catch { /* unavailable storage */ }
  return null;
}

function weatherText(code) {
  return weatherMap[Number(code)] || '天气变化中';
}

export async function fetchWeather() {
  if (memoryCache && Date.now() - memoryCacheTime < CACHE_MS) return memoryCache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      latitude: String(HEFEI.lat),
      longitude: String(HEFEI.lon),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'Asia/Shanghai',
      forecast_days: '7',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`天气服务返回 ${response.status}`);
    const data = await response.json();
    if (!data.current || !data.daily?.time?.length) throw new Error('天气数据格式异常');

    const result = {
      current: {
        temp: Math.round(data.current.temperature_2m),
        text: weatherText(data.current.weather_code),
        wind: Math.round(data.current.wind_speed_10m || 0),
      },
      forecast: data.daily.time.map((isoDate, index) => ({
        isoDate,
        date: new Date(`${isoDate}T00:00:00+08:00`).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
        text: weatherText(data.daily.weather_code[index]),
        rain: data.daily.precipitation_probability_max?.[index] ?? 0,
      })),
      stale: false,
    };

    memoryCache = result;
    memoryCacheTime = Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: result })); } catch { /* unavailable storage */ }
    return result;
  } catch (error) {
    const fallback = memoryCache || readFallbackCache();
    if (fallback) return { ...fallback, stale: true };
    console.warn('天气获取失败:', error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
