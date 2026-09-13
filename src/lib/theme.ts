import { SiteTheme } from '../types';

export interface ThemeMeta {
  id: SiteTheme;
  name: string;
  description: string;
  badge: string;
  bgHex: string;
  cardHex: string;
  primaryHex: string;
  borderHex: string;
  isDark?: boolean;
}

export const AVAILABLE_THEMES: ThemeMeta[] = [
  {
    id: 'warm-neutral',
    name: 'Clean White Reader',
    description: 'Pristine pure white canvas, high-legibility dark typography, and optimal reading ergonomics',
    badge: 'Default',
    bgHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    primaryHex: '#0F172A',
    borderHex: '#E2E8F0',
    isDark: false
  },
  {
    id: 'editorial-slate',
    name: 'Editorial Slate',
    description: 'Crisp cold slate, high-contrast navy structure, and subtle blue cues',
    badge: 'Modern',
    bgHex: '#FFFFFF',
    cardHex: '#FFFFFF',
    primaryHex: '#0F172A',
    borderHex: '#E2E8F0',
    isDark: false
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Dark',
    description: 'Deep obsidian night canvas, charcoal containers, and sky cyan highlights',
    badge: 'Dark',
    bgHex: '#0B0F19',
    cardHex: '#111827',
    primaryHex: '#38BDF8',
    borderHex: '#1F2937',
    isDark: true
  },
  {
    id: 'emerald-archive',
    name: 'Emerald Archive',
    description: 'Heritage archival mint canvas, deep forest tones, and gold foil accents',
    badge: 'Vintage',
    bgHex: '#F4F9F5',
    cardHex: '#FFFFFF',
    primaryHex: '#064E3B',
    borderHex: '#D1E7DD',
    isDark: false
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    description: 'Strict monochrome stark white, hairline charcoal borders, pure Swiss type',
    badge: 'Minimalist',
    bgHex: '#FFFFFF',
    cardHex: '#FAFAFA',
    primaryHex: '#000000',
    borderHex: '#E5E5E5',
    isDark: false
  }
];

export function applyThemeToDOM(themeId: SiteTheme) {
  const meta = AVAILABLE_THEMES.find(t => t.id === themeId) || AVAILABLE_THEMES[0];
  const root = document.documentElement;

  root.setAttribute('data-theme', meta.id);
  if (meta.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Set CSS custom variables
  root.style.setProperty('--color-bg', meta.bgHex);
  root.style.setProperty('--color-card', meta.cardHex);
  root.style.setProperty('--color-primary', meta.primaryHex);
  root.style.setProperty('--color-border', meta.borderHex);
}
