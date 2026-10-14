import type React from 'react';

/**
 * liquid-gil — настоящий стеклянный эффект (glassmorphism).
 * CSS-модуль без зависимостей: blur + saturate, specular-рамка, внутренние блики.
 * Используется для нижней навигации и кнопки «Записаться» на hero-фото.
 */

export interface GlassOptions {
  /** радиус скругления, px */
  radius?: number;
  /** сила размытия, px */
  blur?: number;
  /** насыщенность под стеклом (%) */
  saturate?: number;
  /** затемнение/осветление подложки (0..1) */
  tintAlpha?: number;
  /** цвет акцента для бликов */
  accent?: string;
}

export function glassStyle(o: GlassOptions = {}): React.CSSProperties {
  const {
    radius = 20, blur = 24, saturate = 160, tintAlpha = 0.35, accent = '#4690FF',
  } = o;
  return {
    position: 'relative',
    borderRadius: radius,
    backdropFilter: `blur(${blur}px) saturate(${saturate}%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(${saturate}%)`,
    backgroundColor: `color-mix(in srgb, #0b0d10 ${Math.round(tintAlpha * 100)}%, transparent)`,
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.22)',   // верхний блик
      'inset 0 -1px 0 rgba(255,255,255,0.06)',  // нижняя кромка
      `0 8px 32px rgba(0,0,0,0.45)`,            // тень
      `0 0 0 0.5px color-mix(in srgb, ${accent} 25%, transparent)`, // лёгкий ореол акцента
    ].join(', '),
    isolation: 'isolate', // текст слоя не смешивается с фоном при прокрутке
  } as React.CSSProperties;
}

/** Слой-подсветка сверху стекла (specular highlight), абсолютный внутри контейнера */
export function glassHighlightStyle(): React.CSSProperties {
  return {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 30%, transparent 60%)',
    zIndex: 0,
  };
}

/** Инъекция глобальных правил один раз: класс .lg-glass + уважение prefers-reduced-motion */
let injected = false;
export function injectGlassCss(accent = '#4690FF'): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.id = 'liquid-gil';
  el.textContent = `
.lg-glass{position:relative;border-radius:20px;
 backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);
 background-color:rgba(11,13,16,.35);border:1px solid rgba(255,255,255,.14);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(255,255,255,.06),0 8px 32px rgba(0,0,0,.45);}
.lg-glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
 background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.02) 30%,transparent 60%);}
.lg-glass > *{position:relative;z-index:1;}
.lg-accent-ring{box-shadow:0 0 0 0.5px color-mix(in srgb, ${accent} 30%, transparent),
 inset 0 1px 0 rgba(255,255,255,.22),0 8px 32px rgba(0,0,0,.45);}
@media (prefers-reduced-motion: reduce){
 .lg-fade-in-up{opacity:1 !important;transform:none !important;transition:none !important;}
 html{scroll-behavior:auto !important;}
}
`;
  document.head.appendChild(el);
}
