/**
 * Слой данных. Если настроен Supabase (env VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) —
 * работаем с реальной БД и edge-функциями. Иначе — локальный демо-бэкенд на localStorage
 * (тот же контракт, тот же движок расписания), чтобы приложение открывалось по ссылке сразу.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  computeWeek, canBookSlot, addDays, toMin,
  type TenantConfig, type Booking, type DayAvailability, type OccRange,
} from 'shared';
import { studioNow } from '../lib/tenantRegistry';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabase = Boolean(url && anon);
export const sb: SupabaseClient | null = hasSupabase ? createClient(url!, anon!) : null;

// ---------- локальное хранилище (демо) ----------
interface LocalBooking extends Booking { clientRequestId?: string }
const LS_BK = (slug: string) => `bookings:${slug}`;
const LS_CODE = (slug: string) => `codes:${slug}`; // код подтверждения -> bookingId

function readJson<T>(k: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(k) ?? '') as T; } catch { return def; }
}
function writeJson(k: string, v: unknown) { localStorage.setItem(k, JSON.stringify(v)); }

export function occupancyFromBookings(cfg: TenantConfig, bookings: LocalBooking[]): OccRange[] {
  const svcDays = (b: LocalBooking) => b.days;
  return bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({
      bayId: b.bayId,
      day: b.day,
      startMin: toMin(b.startTime),
      endMin: svcDays(b) > 1
        ? toMin(b.endTime) + (svcDays(b) - 1) * 24 * 60
        : toMin(b.endTime),
    }));
}

export async function fetchAvailability(
  cfg: TenantConfig, serviceId: string, fromDate: string, daysCount: number,
): Promise<DayAvailability[]> {
  const service = cfg.services.find((s) => s.id === serviceId)!;
  if (sb) {
    const { data, error } = await sb.functions.invoke('availability', {
      body: { slug: cfg.slug, serviceId, fromDate, daysCount },
    });
    if (error) throw error;
    return (data as { days: DayAvailability[] }).days;
  }
  const bookings = readJson<LocalBooking[]>(LS_BK(cfg.slug), []);
  const now = studioNow(cfg);
  return computeWeek({
    schedule: cfg.schedule, holidays: cfg.holidays, bays: cfg.bays, rules: cfg.rules,
    service, occupancy: occupancyFromBookings(cfg, bookings),
    from: fromDate, daysCount, today: now.day, nowMinOfDay: now.minOfDay,
  });
}

export interface BookInput {
  serviceId: string; day: string; time: string; bayId?: string;
  name: string; phone: string; car: string; note?: string;
  clientRequestId: string; tenantSlug: string;
}

export async function createBooking(cfg: TenantConfig, input: BookInput): Promise<Booking> {
  if (sb) {
    const { data, error } = await sb.functions.invoke('book', { body: input });
    if (error) throw new Error(String((error as { context?: { error?: string } })?.context?.error ?? error.message));
    return (data as { booking: Booking }).booking;
  }
  // атомарность в демо: синхронная проверка+запись в один тик (JS однопоточный)
  const bookings = readJson<LocalBooking[]>(LS_BK(cfg.slug), []);
  const dup = bookings.find((b) => b.clientRequestId === input.clientRequestId);
  if (dup) return strip(dup); // идемпотентность повторного нажатия
  const service = cfg.services.find((s) => s.id === input.serviceId)!;
  const occ = occupancyFromBookings(cfg, bookings);
  const now = studioNow(cfg);
  const bayId = input.bayId ?? '';
  const verdict = canBookSlot({
    schedule: cfg.schedule, holidays: cfg.holidays, bays: cfg.bays, rules: cfg.rules,
    service, occupancy: occ, day: input.day,
    isToday: input.day === now.day, nowMinOfDay: now.minOfDay,
  }, input.time, bayId);
  if (!verdict.ok) throw new Error(verdict.reason);
  const endMin = verdict.endMin;
  const lastDay = addDays(input.day, service.days - 1);
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  const bk: LocalBooking = {
    id: crypto.randomUUID(), tenantSlug: cfg.slug, serviceId: service.id, serviceName: service.name,
    bayId, day: input.day, startTime: input.time,
    endTime: `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
    days: service.days, clientName: input.name, clientPhone: input.phone, car: input.car,
    status: 'confirmed', payment: 'unpaid', amount: service.price, note: input.note,
    createdAt: new Date().toISOString(), clientRequestId: input.clientRequestId,
  };
  void lastDay;
  bookings.push(bk);
  writeJson(LS_BK(cfg.slug), bookings);
  const codes = readJson<Record<string, string>>(LS_CODE(cfg.slug), {});
  codes[code] = bk.id; writeJson(LS_CODE(cfg.slug), codes);
  return strip(bk);
}

function strip(b: LocalBooking): Booking { const { clientRequestId: _c, ...rest } = b; return rest; }

/** Клиент смотрит свою запись по id + коду подтверждения (или по телефону) */
export async function fetchMyBooking(cfg: TenantConfig, id: string, code?: string): Promise<Booking | null> {
  if (sb) {
    const { data } = await sb.functions.invoke('my-booking', { body: { slug: cfg.slug, id, code } });
    return (data as { booking: Booking | null }).booking;
  }
  const codes = readJson<Record<string, string>>(LS_CODE(cfg.slug), {});
  if (code && codes[code] !== id) return null;
  const bk = readJson<LocalBooking[]>(LS_BK(cfg.slug), []).find((b) => b.id === id);
  return bk ? strip(bk) : null;
}

export async function cancelBooking(cfg: TenantConfig, id: string, actor: 'client' | 'owner', code?: string): Promise<void> {
  if (sb) {
    const { error } = await sb.functions.invoke('cancel', { body: { slug: cfg.slug, id, actor, code } });
    if (error) throw error; return;
  }
  const bookings = readJson<LocalBooking[]>(LS_BK(cfg.slug), []);
  const b = bookings.find((x) => x.id === id);
  if (!b) throw new Error('Запись не найдена');
  if (actor === 'client') {
    const codes = readJson<Record<string, string>>(LS_CODE(cfg.slug), {});
    if (!code || codes[code] !== id) throw new Error('Неверный код подтверждения');
    const start = new Date(`${b.day}T${b.startTime}:00`);
    const hrsLeft = (start.getTime() - Date.now()) / 36e5;
    if (hrsLeft < cfg.rules.cancelHoursBefore) {
      throw new Error(`Отмена возможна не позднее чем за ${cfg.rules.cancelHoursBefore} ч до визита. Позвоните в студию.`);
    }
  }
  b.status = 'cancelled';
  writeJson(LS_BK(cfg.slug), bookings);
}

// ---------- владелец (локально — master-код из env или demo-код) ----------
const OWNER_KEY = 'owner-auth-demo';
export async function ownerSignIn(email: string, password: string): Promise<boolean> {
  if (sb) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return !error;
  }
  const ok = password === 'demo1234'; // демо без Supabase
  if (ok) sessionStorage.setItem(OWNER_KEY, email);
  return ok;
}
export async function ownerSignOut(): Promise<void> {
  if (sb) await sb.auth.signOut();
  sessionStorage.removeItem(OWNER_KEY);
}
export function ownerIsAuthed(): boolean {
  if (sb) return true; // реальный статус проверяется запросом к функциям
  return sessionStorage.getItem(OWNER_KEY) !== null;
}

export async function fetchOwnerBookings(cfg: TenantConfig, from: string, to: string): Promise<Booking[]> {
  if (sb) {
    const { data, error } = await sb.functions.invoke('owner-data', {
      body: { op: 'list', slug: cfg.slug, from, to },
    });
    if (error) throw error;
    return (data as { bookings: Booking[] }).bookings;
  }
  if (!ownerIsAuthed()) throw new Error('Нужен вход владельца');
  return readJson<LocalBooking[]>(LS_BK(cfg.slug), []).map(strip)
    .filter((b) => b.day >= from && b.day <= to)
    .sort((a, b) => (a.day + a.startTime).localeCompare(b.day + b.startTime));
}

export async function ownerUpdateBooking(cfg: TenantConfig, id: string, patch: Partial<Pick<Booking, 'status' | 'payment'>>): Promise<void> {
  if (sb) {
    const { error } = await sb.functions.invoke('owner-mutate', { body: { op: 'patch', slug: cfg.slug, id, patch } });
    if (error) throw error; return;
  }
  if (!ownerIsAuthed()) throw new Error('Нужен вход владельца');
  const bookings = readJson<LocalBooking[]>(LS_BK(cfg.slug), []);
  const b = bookings.find((x) => x.id === id);
  if (!b) throw new Error('Нет такой записи');
  Object.assign(b, patch);
  writeJson(LS_BK(cfg.slug), bookings);
}

export async function ownerCreateBooking(cfg: TenantConfig, input: Omit<BookInput, 'clientRequestId'>): Promise<Booking> {
  return createBooking(cfg, { ...input, clientRequestId: crypto.randomUUID() });
}

// ---------- помощник ----------
export interface AssistantTurn { messages: { role: 'user' | 'assistant'; content: string }[] }
export async function askAssistant(cfg: TenantConfig, scope: 'client' | 'owner', turn: AssistantTurn):
  Promise<{ answer: string }> {
  if (sb) {
    const { data, error } = await sb.functions.invoke('assistant-chat', {
      body: { slug: cfg.slug, scope, messages: turn.messages },
    });
    if (error) throw error;
    return data as { answer: string };
  }
  return localAssistant(cfg, scope, turn.messages[turn.messages.length - 1].content);
}

/** Демо-помощник без OpenAI: детерминированные ответы по реальным данным студии. */
async function localAssistant(cfg: TenantConfig, scope: 'client' | 'owner', q: string): Promise<{ answer: string }> {
  const lower = q.toLowerCase();
  const money = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
  const bookings = readJson<LocalBooking[]>(LS_BK(cfg.slug), []);
  const now = studioNow(cfg);
  if (/цена|стоим|сколько стоит|прайс/.test(lower)) {
    const s = cfg.services.find((x) => lower.includes(x.name.toLowerCase().split(' ')[0]) || lower.includes(x.id));
    if (s) return { answer: `«${s.name}» — ${money(s.price)}, ${s.durationMin} мин${s.days > 1 ? `, занимает ${s.days} дн.` : ''}.` };
    return { answer: 'Уточните, какая услуга интересует. Вот прайс: ' + cfg.services.filter(x=>x.active).map((x) => `${x.name} — ${money(x.price)}`).join('; ') };
  }
  if (/окно|свободн|ближайш|записаться|когда/.test(lower)) {
    const first = cfg.services.find((s) => s.active)!;
    const days = await fetchAvailability(cfg, first.id, now.day, 7);
    for (const d of days) {
      const slot = d.slots.find((s) => s.free);
      if (slot) return { answer: `Ближайшее окно на «${first.name}»: ${d.day} (${d.weekdayName}) в ${slot.time}. Скажите дату и время — помогу записаться.` };
    }
    return { answer: 'На неделю вперёд всё занято. Есть отмены — загляните позже или позвоните: ' + cfg.phone };
  }
  if (/найт|адрес|как доехать|где вы|карт/.test(lower)) {
    return { answer: `${cfg.address}. Телефон ${cfg.phone}${cfg.mapsUrl ? '. Маршрут: ' + cfg.mapsUrl : ''}` };
  }
  if (/часы|график|работаете/.test(lower)) {
    const wd = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const lines = [...cfg.schedule].sort((a,b)=>(a.weekday+6)%7-(b.weekday+6)%7)
      .map((d) => `${wd[(d.weekday+6)%7]}: ${d.working ? d.open+'–'+d.close : 'выходной'}`);
    return { answer: 'График: ' + lines.join(', ') };
  }
  if (scope === 'owner') {
    if (/завтра/.test(lower)) {
      const t = addDays(now.day, 1);
      const list = bookings.filter((b) => b.day === t && b.status !== 'cancelled');
      return { answer: list.length ? `Завтра ${t}: ${list.map((b) => `${b.startTime} ${b.car} (${b.serviceName})`).join('; ')}` : `Завтра ${t}: записей нет.` };
    }
    if (/недел|машин/.test(lower)) {
      const week = bookings.filter((b) => b.day >= addDays(now.day, -6) && b.day <= now.day && b.status !== 'cancelled');
      return { answer: `За последние 7 дней: ${week.length} машин.` };
    }
    if (/денег|оплат|выручк|получено/.test(lower)) {
      const paid = bookings.filter((b) => b.payment === 'paid' && b.status !== 'cancelled');
      const sum = paid.reduce((a, b) => a + b.amount, 0);
      return { answer: `Получено ${money(sum)} по ${paid.length} оплаченным записям.` };
    }
  }
  return { answer: 'Уточните вопрос: про услуги и цены, свободное время, адрес и график. Я знаю только данные этой студии.' };
}
