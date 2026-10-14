/**
 * shared/src/engine.ts — движок свободного времени.
 * Чистые функции без зависимостей от React/БД: один и тот же код считает
 * доступность на клиенте (превью) и на сервере (Supabase edge function).
 *
 * Модель времени: все вычисления идут в «локальных минутах студии» для каждого дня.
 * Граница между сутками = 00:00 локального времени; даты передаются строками YYYY-MM-DD,
 * чтобы не зависеть от часового пояса браузера.
 */
import type { BookingRules, DayAvailability, DaySchedule, Holiday, Service, Slot } from './types';

/** Занятость бокса в «локальных днях студии»: интервал [startMin..endMin) от полуночи дня `day`,
 *  endMin может превышать 24*60 для многодневных записей. Готовится на сервере из БД. */
export interface OccRange { bayId: string; day: string; startMin: number; endMin: number }

export const WEEKDAY_RU_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** "HH:MM" -> минуты с полуночи */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** минуты -> "HH:MM" */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Локальная дата "YYYY-MM-DD" -> weekday 0..6 (без зависимости от таймзоны браузера) */
export function weekdayOf(dayISO: string): number {
  const [y, m, d] = dayISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Прибавить N дней к "YYYY-MM-DD" */
export function addDays(dayISO: string, n: number): string {
  const [y, m, d] = dayISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export interface EngineInput {
  schedule: DaySchedule[];        // 7 дней
  holidays: Holiday[];
  bays: { id: string; active: boolean }[];
  rules: BookingRules;
  service: Pick<Service, 'durationMin' | 'days'>;
  /** занятость боксов (уже приведена к локальным дням студии) */
  occupancy: OccRange[];
  /** день, для которого считаем ("YYYY-MM-DD") */
  day: string;
  /** текущий момент в локальных минутах студии (для cut-off сегодня) */
  nowMinOfDay?: number;
  /** true — это сегодня (учитываем minLeadTime) */
  isToday?: boolean;
}

/** Интервалы занятости одного дня в минутах [start,end) */
export interface BusyInterval { start: number; end: number }

export function busyByBay(occupancy: OccRange[], bayId: string, day: string): BusyInterval[] {
  return occupancy
    .filter((o) => o.bayId === bayId && overlapsDay(o, day))
    .map((o) => ({
      start: o.day === day ? o.startMin : 0,
      end: o.day === day ? o.endMin : 24 * 60,
    }));
}

function overlapsDay(o: OccRange, day: string): boolean {
  // интервал может начинаться раньше, но заканчиваться в этот день
  const endDay = endDayOf(o);
  return o.day <= day && endDay >= day;
}
function endDayOf(o: OccRange): string {
  let d = o.day;
  let e = o.endMin;
  while (e > 24 * 60) { e -= 24 * 60; d = addDays(d, 1); }
  return d;
}

export function isWorkingDay(input: EngineInput): { working: boolean; reason?: string } {
  const sched = input.schedule.find((s) => s.weekday === weekdayOf(input.day));
  if (!sched || !sched.working) return { working: false, reason: 'Выходной' };
  const hol = input.holidays.find((h) => h.date === input.day);
  if (hol) return { working: false, reason: hol.reason ?? 'Закрыто' };
  return { working: true };
}

/** Слоты рабочего дня с учётом длительности услуги, буфера, занятости боксов и lead-time */
export function computeSlots(input: EngineInput): Slot[] {
  const sched = input.schedule.find((s) => s.weekday === weekdayOf(input.day));
  const wd = isWorkingDay(input);
  if (!wd.working || !sched) return [];

  const open = toMin(sched.open);
  const close = toMin(sched.close);
  const step = input.rules.slotStepMin;
  const dur = input.service.durationMin;
  const buffer = input.rules.bufferMin;
  const need = dur + buffer; // слот свободен, если влезает работа + подготовка после

  const activeBays = input.bays.filter((b) => b.active).map((b) => b.id);
  const occ = input.occupancy;

  const cutoff = input.isToday
    ? (input.nowMinOfDay ?? 0) + input.rules.minLeadTimeHours * 60
    : -Infinity;

  const slots: Slot[] = [];
  for (let t = open; t + dur <= close; t += step) {
    const freeBays: string[] = [];
    for (const bay of activeBays) {
      const busy = busyByBay(occ, bay, input.day);
      const clash = busy.some((b) => b.start < t + need && b.end > t - buffer);
      if (!clash) freeBays.push(bay);
    }
    const pastCutoff = t < cutoff;
    slots.push({
      day: input.day,
      time: toHHMM(t),
      free: !pastCutoff && freeBays.length > 0,
      busy: pastCutoff || freeBays.length === 0,
      bayIdsFree: freeBays,
    });
  }
  return slots;
}

/** Неделя доступности начиная с `from` (включительно) */
export function computeWeek(input: Omit<EngineInput, 'day' | 'isToday' | 'nowMinOfDay'> & {
  from: string; daysCount: number; today: string; nowMinOfDay: number;
}): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < input.daysCount; i++) {
    const day = addDays(input.from, i);
    const one: EngineInput = {
      ...input,
      day,
      isToday: day === input.today,
      nowMinOfDay: day === input.today ? input.nowMinOfDay : undefined,
    };
    const wd = isWorkingDay(one);
    out.push({
      day,
      weekdayName: WEEKDAY_RU_SHORT[weekdayOf(day)],
      isWorking: wd.working,
      closedReason: wd.reason,
      slots: wd.working ? computeSlots(one) : [],
    });
  }
  return out;
}

/** Ближайшее свободное окно для услуги (перебор horizon-дней) */
export function nextOpening(input: Omit<EngineInput, 'day' | 'isToday' | 'nowMinOfDay'> & {
  today: string; nowMinOfDay: number;
}): { day: string; time: string; bayId: string } | null {
  for (let i = 0; i < input.rules.bookingHorizonDays; i++) {
    const day = addDays(input.today, i);
    const one: EngineInput = {
      ...input, day, isToday: i === 0,
      nowMinOfDay: i === 0 ? input.nowMinOfDay : undefined,
    };
    if (!isWorkingDay(one).working) continue;
    const slot = computeSlots(one).find((s) => s.free);
    if (slot) return { day, time: slot.time, bayId: slot.bayIdsFree[0] };
  }
  return null;
}

/** Проверка возможности забронировать конкретный слот (используется сервером) */
export function canBookSlot(input: EngineInput, time: string, bayId: string):
  { ok: true; startMin: number; endMin: number } | { ok: false; reason: string } {
  const sched = input.schedule.find((s) => s.weekday === weekdayOf(input.day));
  if (!sched) return { ok: false, reason: 'Нет графика на этот день' };
  const wd = isWorkingDay(input);
  if (!wd.working) return { ok: false, reason: wd.reason ?? 'Не рабочий день' };
  if (!input.bays.some((b) => b.id === bayId && b.active)) return { ok: false, reason: 'Бокс недоступен' };

  const start = toMin(time);
  const end = start + input.service.durationMin;
  const need = end + input.rules.bufferMin;
  if (start < toMin(sched.open) || need > toMin(sched.close) && end > toMin(sched.close)) {
    return { ok: false, reason: 'Вне часов работы' };
  }
  if (input.isToday) {
    const cutoff = (input.nowMinOfDay ?? 0) + input.rules.minLeadTimeHours * 60;
    if (start < cutoff) return { ok: false, reason: 'Слишком близко к текущему времени' };
  }
  // многодневная услуга: каждый день диапазона должен быть рабочим и бокс свободен весь день
  const occ = input.occupancy;
  for (let d = 0; d < input.service.days; d++) {
    const day = addDays(input.day, d);
    const dd: EngineInput = { ...input, day };
    if (d > 0 && !isWorkingDay(dd).working) return { ok: false, reason: 'Услуга попадает на выходной' };
    const winStart = d === 0 ? start - input.rules.bufferMin : 0;
    const winEnd = d === input.service.days - 1 ? end + input.rules.bufferMin : 24 * 60;
    const clash = busyByBay(occ, bayId, day)
      .some((b) => b.start < winEnd && b.end > winStart);
    if (clash) return { ok: false, reason: 'Бокс занят в это время' };
  }
  return { ok: true, startMin: start, endMin: end };
}
