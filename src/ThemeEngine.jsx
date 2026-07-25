import { useEffect } from 'react';
import { useStore, themePresets } from './store.jsx';

export default function ThemeEngine() {
  const { state } = useStore();
  const themeId = state.theme || 'rose';

  useEffect(() => {
    const preset = themePresets.find(t => t.id === themeId) || themePresets[0];

    const root = document.documentElement;
    root.style.setProperty('--tp', preset.primary);
    root.style.setProperty('--tp-light', preset.primaryLight);
    root.style.setProperty('--tp-dark', preset.primaryDark);
    root.style.setProperty('--tp-bg', preset.bg);
    root.style.setProperty('--tp-card', preset.cardBg);
    root.style.setProperty('--tp-border', preset.border);
    root.style.setProperty('--tp-text', preset.text);
    root.style.setProperty('--tp-muted', preset.textMuted);
    root.style.setProperty('--tp-radius', preset.radius);
    root.style.setProperty('--tp-gradient', `linear-gradient(135deg, ${preset.primary}, ${preset.primaryDark})`);

    // update theme-color meta for PWA
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = preset.bg;
  }, [themeId]);

  return null;
}
