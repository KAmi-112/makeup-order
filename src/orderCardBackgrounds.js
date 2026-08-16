export async function loadLocalOrderBackgrounds() {
  try {
    const response = await fetch('/local-order-backgrounds/index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const items = await response.json();
    return Array.isArray(items) ? items.filter(item => item?.url) : [];
  } catch {
    return [];
  }
}

export function pickOrderBackground(items, previousUrl = '') {
  if (!items?.length) return null;
  const candidates = items.length > 1 ? items.filter(item => item.url !== previousUrl) : items;
  return candidates[Math.floor(Math.random() * candidates.length)] || items[0];
}
