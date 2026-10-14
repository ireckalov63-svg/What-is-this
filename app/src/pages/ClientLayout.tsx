/**
 * Каркас клиента: маршруты /s/:slug (главная, услуги, запись, моя запись, помощник),
 * нижняя стеклянная навигация, PWA-манифест и заголовок — под конкретную студию.
 */
import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { House, Wrench, CalendarCheck } from '@phosphor-icons/react';
import { Text } from '@astryxdesign/core';
import { getTenant } from '../lib/tenantRegistry';
import { Glass } from '../components/ui';
import HomePage from '../pages/HomePage';
import ServicesPage from '../pages/ServicesPage';
import BookingPage from '../pages/BookingPage';
import MyBookingPage from '../pages/MyBookingPage';
import AssistantPage from '../pages/AssistantPage';

const NAV = [
  { seg: '', label: 'Главная', icon: House },
  { seg: 'services', label: 'Услуги', icon: Wrench },
  { seg: 'my', label: 'Моя запись', icon: CalendarCheck },
];

function BottomNav({ base }: { base: string }) {
  return (
    <nav aria-label="Навигация" data-testid="bottom-nav" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
      padding: '8px max(12px, env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-right))',
      pointerEvents: 'none',
    }}>
      <Glass radius={22} tintAlpha={0.45} style={{ margin: '0 auto', maxWidth: 560, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          {NAV.map((it) => (
            <NavLink key={it.seg} to={base + (it.seg ? `/${it.seg}` : '')} end={it.seg === ''}
              style={{ textDecoration: 'none' }}>
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

export function applyTenantMeta(name: string, slug: string) {
  document.title = `${name} — запись онлайн`;
  const manifest = `/manifest.webmanifest?slug=${slug}`;
  let link = document.getElementById('manifest-link') as HTMLLinkElement | null;
  if (!link) { link = document.createElement('link'); link.id = 'manifest-link'; link.rel = 'manifest'; document.head.appendChild(link); }
  link.href = manifest;
  let apple = document.getElementById('apple-touch-icon') as HTMLLinkElement | null;
  if (!apple) { apple = document.createElement('link'); apple.id = 'apple-touch-icon'; apple.rel = 'apple-touch-icon'; document.head.appendChild(apple); }
  apple.href = `/tenants/${slug}/icons/icon.svg`;
}

export default function ClientLayout() {
  const { slug = '' } = useParams();
  const cfg = getTenant(slug);
  const base = `/s/${slug}`;
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { if (cfg) applyTenantMeta(cfg.name, cfg.slug); }, [cfg]);
  if (!cfg) return <NotFound text={`Студия «${slug}» не найдена`} onHome={() => nav('/')} />;
  const hideNav = /^\/s\/[^/]+\/booking\/[^/]+$/.test(loc.pathname) || loc.pathname.endsWith('/assistant');
  return (
    <div className={hideNav ? '' : 'page-pad-bottom'} style={{ minHeight: '100dvh' }}>
      <Routes>
        <Route index element={<HomePage cfg={cfg} />} />
        <Route path="services" element={<ServicesPage cfg={cfg} />} />
        <Route path="book" element={<BookingPage cfg={cfg} step="service" />} />
        <Route path="booking/:serviceId" element={<BookingPage cfg={cfg} />} />
        <Route path="my" element={<MyBookingPage cfg={cfg} />} />
        <Route path="assistant" element={<AssistantPage cfg={cfg} scope="client" />} />
        <Route path="*" element={<NotFound text="Такой страницы нет" onHome={() => nav(base)} />} />
      </Routes>
      {!hideNav && <BottomNav base={base} />}
    </div>
  );
}

export function NotFound({ text, onHome }: { text: string; onHome: () => void }) {
  useEffect(() => { document.title = 'Autobooth — запись в студию'; }, []);
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Glass radius={20} style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
        <Text type="large">{text}</Text>
        <div style={{ marginTop: 16 }}>
          <button onClick={onHome} style={btnStyle}>На главную</button>
        </div>
      </Glass>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#4690FF', color: '#fff', border: 0, borderRadius: 12, padding: '10px 18px', fontSize: 15,
};
