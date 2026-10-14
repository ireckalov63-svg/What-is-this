import { z } from 'zod';

export const weekdaySchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6),
]);

const hhmm = /^\d{2}:\d{2}$/;

export const dayScheduleSchema = z.object({
  weekday: weekdaySchema,
  open: z.string().regex(hhmm, 'Формат ЧЧ:ММ'),
  close: z.string().regex(hhmm, 'Формат ЧЧ:ММ'),
  working: z.boolean(),
});

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().int().nonnegative(),
  durationMin: z.number().int().positive(),
  days: z.number().int().min(1).default(1),
  category: z.string().optional(),
  active: z.boolean().default(true),
});

export const baySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().default(true),
});

export const infoCardSchema = z.object({
  icon: z.enum(['clock', 'map-pin', 'phone', 'shield', 'sparkle', 'car']),
  title: z.string().min(1),
  text: z.string().min(1),
});

export const workPhotoSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  caption: z.string().min(1),
});

export const bookingRulesSchema = z.object({
  cancelHoursBefore: z.number().min(0).max(72),
  slotStepMin: z.number().int().min(15).max(120),
  bufferMin: z.number().int().min(0).max(180),
  minLeadTimeHours: z.number().min(0).max(48),
  bookingHorizonDays: z.number().int().min(1).max(90),
});

export const tenantConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'slug: строчные латиница/цифры/дефис'),
  status: z.enum(['draft', 'published']).default('draft'),
  name: z.string().min(2).max(80),
  tagline: z.string().min(2).max(120),
  description: z.string().min(10).max(600),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  phone: z.string().min(6).max(24),
  address: z.string().min(5).max(200),
  mapsUrl: z.string().url().optional(),
  instagram: z.string().optional(),
  logoText: z.string().min(1).max(20),
  heroPhoto: z.string().min(1),
  logoPhoto: z.string().optional(),
  services: z.array(serviceSchema).min(1),
  bays: z.array(baySchema).min(1),
  schedule: z.array(dayScheduleSchema).length(7),
  holidays: z.array(holidaySchema).default([]),
  infoCards: z.tuple([infoCardSchema, infoCardSchema, infoCardSchema]),
  workPhotos: z.array(workPhotoSchema).min(1),
  rules: bookingRulesSchema,
  assistantExamples: z.array(z.string().min(3)).min(1).max(6),
}).refine((c) => new Set(c.schedule.map((d) => d.weekday)).size === 7, {
  message: 'schedule должен содержать все 7 дней недели',
}).refine((c) => new Set(c.services.map((s) => s.id)).size === c.services.length, {
  message: 'id услуг должны быть уникальны',
}).refine((c) => new Set(c.bays.map((b) => b.id)).size === c.bays.length, {
  message: 'id боксов должны быть уникальны',
}).refine((c) => c.schedule.every((d) => !d.working || d.open < d.close), {
  message: 'open должен быть раньше close в рабочий день',
});

/** Ввод клиента при записи */
export const clientBookingSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(60),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{6,20}$/, 'Проверьте номер телефона'),
  car: z.string().trim().min(2, 'Укажите марку и модель').max(60),
  note: z.string().trim().max(300).optional(),
});

/** Данные для ручного создания записи владельцем */
export const ownerBookingInputSchema = clientBookingSchema.extend({
  serviceId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(hhmm),
  bayId: z.string().min(1).optional(),
});

export type ClientBookingInput = z.infer<typeof clientBookingSchema>;
