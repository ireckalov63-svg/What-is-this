/**
 * Общие UI-мелочи: появление секций при прокрутке (с уважением к prefers-reduced-motion),
 * форматирование денег/дат, стеклянная обёртка.
 */
import React, { useEffect, useRef, useState } from 'react';
import { glassStyle, glassHighlightStyle } from 'liquid-gil';

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setReduce(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduce;
}

/** Плавное появление блока при попадании во вьюпорт. Если анимации отключены — виден сразу. */
export function Reveal({ children, className = '', delayMs = 0 }: {
  children: React.ReactNode; className?: string; delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (reduce) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={delayMs && !reduce ? { transitionDelay: `${delayMs}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Стеклянный контейнер (настоящий blur+specular из liquid-gil). */
export function Glass({ children, radius = 20, tintAlpha = 0.35, style, className = '', ...rest }: {
  children: React.ReactNode; radius?: number; tintAlpha?: number;
  style?: React.CSSProperties; className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`lg-glass ${className}`.trim()}
      style={{ ...glassStyle({ radius, tintAlpha }), ...style }} {...rest}>
      <span aria-hidden style={glassHighlightStyle()} />
      {children}
    </div>
  );
}

export function formatMoney(n: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n);
}

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function formatDay(dayISO: string): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][date.getUTCDay()];
  return `${d} ${RU_MONTHS[m - 1]} (${wd})`;
}
