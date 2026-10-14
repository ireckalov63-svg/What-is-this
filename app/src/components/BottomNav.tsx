/**
 * Нижняя навигация клиента со стеклянным эффектом.
 * Фиксирована снизу, не перекрывает контент (страницы имеют page-pad-bottom).
 */
import { NavLink } from 'react-router-dom';
import { House, Wrench, CalendarCheck } from '@phosphor-icons/react';
import { Text } from '@astryxdesign/core';
import { Glass } from './ui';

const items = [
  { to: '', label: 'Главная', icon: House, end: true },
  { to: 'services', label: 'Услуги', icon: Wrench, end: false },
  { to: 'my', label: 'Моя запись', icon: CalendarCheck, end: false },
];

export default function BottomNav({ base }: { base: string }) {
  return (
    <nav aria-label="Навигация" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
      padding: '8px max(12px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-right))',
    }}>
      <Glass radius={22} tintAlpha={0.45} style={{ margin: '0 auto', maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          {items.map((it) => (
            <NavLink key={it.to} to={`${base}/${it.to}`} end={it.end as boolean | undefined}
              style={{ textDecoration: 'none' }}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
              {({ isActive }) => (
                <span style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '6px 14px', borderRadius: 14,
                  color: isActive ? '#4690FF' : 'rgba(255,255,255,.72)',
                }}>
                  <it.icon size={22} weight={isActive ? 'fill' : 'regular'} />
                  <Text type="supporting" size="xs" color={isActive ? 'accent' : 'secondary'}>{it.label}</Text>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </Glass>
    </nav>
  );
}
