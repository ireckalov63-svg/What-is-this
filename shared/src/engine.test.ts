import { describe, it, expect } from 'vitest';
import {
  computeSlots, canBookSlot, nextOpening, addDays, weekdayOf, toMin, toHHMM,
  type EngineInput, type OccRange,
} from './engine';

const schedule = [
  { weekday: 0 as const, open: '10:00', close: '18:00', working: true },   // вс
  { weekday: 1 as const, open: '09:00', close: '20:00', working: true },   // пн
  { weekday: 2 as const, open: '09:00', close: '20:00', working: true },
  { weekday: 3 as const, open: '09:00', close: '20:00', working: true },
  { weekday: 4 as const, open: '09:00', close: '20:00', working: true },
  { weekday: 5 as const, open: '09:00', close: '20:00', working: true },
  { weekday: 6 as const, open: '09:00', close: '20:00', working: false },  // сб — выходной
];

const rules = {
  cancelHoursBefore: 2, slotStepMin: 60, bufferMin: 30,
  minLeadTimeHours: 2, bookingHorizonDays: 14,
};

const base = {
  schedule,
  holidays: [],
  bays: [{ id: 'bay-1', active: true }, { id: 'bay-2', active: true }],
  rules,
  service: { durationMin: 120, days: 1 },
  occupancy: [] as OccRange[],
};

// 2026-10-15 — четверг (рабочий), 2026-10-17 — суббота (выходной)
const THU = '2026-10-15';
const SAT = '2026-10-17';

describe('helpers', () => {
  it('toMin/toHHMM roundtrip', () => {
    expect(toMin('09:30')).toBe(570);
    expect(toHHMM(570)).toBe('09:30');
  });
  it('weekdayOf is timezone-independent', () => {
    expect(weekdayOf(THU)).toBe(4);
    expect(weekdayOf(SAT)).toBe(6);
  });
  it('addDays crosses month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('computeSlots', () => {
  it('empty day: slots every step within hours, last start fits duration', () => {
    const slots = computeSlots({ ...base, day: THU });
    expect(slots[0].time).toBe('09:00');
    // 09:00..20:00, dur 120 -> последний старт 18:00
    expect(slots.at(-1)!.time).toBe('18:00');
    expect(slots.every((s) => s.free)).toBe(true);
    expect(slots.length).toBe(10);
  });

  it('closed on weekend', () => {
    expect(computeSlots({ ...base, day: SAT })).toEqual([]);
  });

  it('holiday closes the day', () => {
    const slots = computeSlots({
      ...base, day: THU,
      holidays: [{ date: THU, reason: 'Праздник' }],
    });
    expect(slots).toEqual([]);
  });

  it('busy interval marks overlapping slots busy but keeps others free (two bays)', () => {
    const occ: OccRange[] = [{ bayId: 'bay-1', day: THU, startMin: toMin('10:00'), endMin: toMin('14:00') }];
    const slots = computeSlots({ ...base, day: THU, occupancy: occ });
    const s11 = slots.find((s) => s.time === '11:00')!;
    expect(s11.busy).toBe(false); // второй бокс свободен
    expect(s11.bayIdsFree).toEqual(['bay-2']);
    const s09 = slots.find((s) => s.time === '09:00')!;
    // 09:00 + 120 + 30 буфер = 12:00 > 10:00 старт занятости bay-1 -> clash по буферу? нет:
    // busy.start(600) < t+need(540+150=690) && busy.end(840) > t-buffer(540-30=510) -> clash для bay-1
    expect(s09.bayIdsFree).toEqual(['bay-2']);
  });

  it('both bays busy -> slot explicitly busy', () => {
    const occ: OccRange[] = [
      { bayId: 'bay-1', day: THU, startMin: toMin('10:00'), endMin: toMin('14:00') },
      { bayId: 'bay-2', day: THU, startMin: toMin('10:00'), endMin: toMin('14:00') },
    ];
    const slots = computeSlots({ ...base, day: THU, occupancy: occ });
    const s11 = slots.find((s) => s.time === '11:00')!;
    expect(s11.free).toBe(false);
    expect(s11.busy).toBe(true);
  });

  it('today cut-off by minLeadTimeHours', () => {
    const slots = computeSlots({
      ...base, day: THU, isToday: true, nowMinOfDay: toMin('08:00'), // cutoff 10:00
    });
    expect(slots.find((s) => s.time === '09:00')!.busy).toBe(true);
    expect(slots.find((s) => s.time === '10:00')!.free).toBe(true);
  });

  it('multi-day occupancy blocks whole following day', () => {
    // запись началась в среду вечером и занимает 2 дня: endMin > 24h
    const occ: OccRange[] = [{ bayId: 'bay-1', day: '2026-10-14', startMin: toMin('20:00'), endMin: toMin('20:00') + 24 * 60 }];
    const wed = computeSlots({ ...base, day: '2026-10-14', occupancy: occ });
    const thu = computeSlots({ ...base, day: THU, occupancy: occ, bays: [{ id: 'bay-1', active: true }] });
    expect(wed.find((s) => s.time === '18:00')!.bayIdsFree).toContain('bay-2');
    // на чтu bay-1 занят весь день (интервал перетекает)
    expect(thu.every((s) => s.bayIdsFree.length === 0)).toBe(true);
  });
});

describe('canBookSlot', () => {
  it('rejects occupied time', () => {
    const occ: OccRange[] = [{ bayId: 'bay-1', day: THU, startMin: toMin('11:00'), endMin: toMin('15:00') }];
    const r = canBookSlot({ ...base, day: THU, occupancy: occ }, '12:00', 'bay-1');
    expect(r.ok).toBe(false);
  });
  it('respects buffer before existing booking', () => {
    const occ: OccRange[] = [{ bayId: 'bay-1', day: THU, startMin: toMin('14:00'), endMin: toMin('16:00') }];
    // старт 12:00 + 120 = 14:00, нужен буфер 30 -> нельзя
    const r = canBookSlot({ ...base, day: THU, occupancy: occ }, '12:00', 'bay-1');
    expect(r.ok).toBe(false);
    // старт 11:00 закончит в 13:00 + 30 буфер = 13:30 <= 14:00 -> можно
    expect(canBookSlot({ ...base, day: THU, occupancy: occ }, '11:00', 'bay-1').ok).toBe(true);
  });
  it('rejects weekend and outside hours', () => {
    expect(canBookSlot({ ...base, day: SAT }, '11:00', 'bay-1').ok).toBe(false);
    expect(canBookSlot({ ...base, day: THU }, '08:00', 'bay-1').ok).toBe(false);
    expect(canBookSlot({ ...base, day: THU }, '19:00', 'bay-1').ok).toBe(false);
  });
  it('multi-day service needs all days working and free', () => {
    const two = { ...base, service: { durationMin: 600, days: 2 } };
    // старт в пятницу 09:00 на 2 дня -> попадает на субботу-выходной
    const FRI = '2026-10-16';
    expect(canBookSlot({ ...two, day: FRI }, '09:00', 'bay-1').ok).toBe(false);
    // старт в понедельник — ок
    const MON = '2026-10-19';
    expect(canBookSlot({ ...two, day: MON }, '09:00', 'bay-1').ok).toBe(true);
  });
});

describe('nextOpening', () => {
  it('skips closed days and returns first free slot', () => {
    const r = nextOpening({
      ...base, today: SAT, nowMinOfDay: toMin('12:00'), // сб закрыт
    });
    expect(r).not.toBeNull();
    expect(r!.day).toBe('2026-10-18'); // вс открыт с 10:00, но lead-time... вс рабочий 10-18
    // lead time не применяется к будущим дням
    expect(r!.time).toBe('10:00');
  });
  it('returns null when horizon exhausted', () => {
    const occ: OccRange[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(THU, i);
      occ.push({ bayId: 'bay-1', day: d, startMin: 0, endMin: 24 * 60 });
      occ.push({ bayId: 'bay-2', day: d, startMin: 0, endMin: 24 * 60 });
    }
    const r = nextOpening({ ...base, today: THU, nowMinOfDay: 0, occupancy: occ });
    expect(r).toBeNull();
  });
});
