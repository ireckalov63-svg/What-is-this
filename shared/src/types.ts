/**
 * shared/src/types.ts — единый контракт данных студии.
 * Все настройки конкретной студии описываются этими типами и zod-схемой (tenantConfig).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = воскресенье (как date-fns)

/** График работы в один день недели */
export interface DaySchedule {
  weekday: Weekday;
  /** "09:00" — время открытия, локальное для города студии */
  open: string;
  /** "20:00" — время закрытия */
  close: string;
  /** false — выходной */
  working: boolean;
}

/** Конкретный нерабочий день (праздник/технологический день) */
export interface Holiday {
  /** "YYYY-MM-DD" */
  date: string;
  reason?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  /** цена в рублях */
  price: number;
  /** длительность работ в минутах */
  durationMin: number;
  /** занимает несколько дней подряд (например, детейлинг с полимеризацией) */
  days: number;
  category?: string;
  active: boolean;
}

export interface Bay {
  id: string;
  name: string;
  active: boolean;
}

export interface InfoCard {
  icon: 'clock' | 'map-pin' | 'phone' | 'shield' | 'sparkle' | 'car';
  title: string;
  text: string;
}

export interface WorkPhoto {
  id: string;
  /** путь внутри папки студии: photos/wet-look.jpg или полный URL Supabase Storage */
  src: string;
  caption: string;
}

export interface BookingRules {
  /** за сколько часов до начала можно отменить клиенту */
  cancelHoursBefore: number;
  /** шаг сетки слотов в минутах */
  slotStepMin: number;
  /** буфер подготовки между машинами в минутах */
  bufferMin: number;
  /** бронь не позже чем за N часов до начала */
  minLeadTimeHours: number;
  /** на сколько дней вперёд можно бронировать */
  bookingHorizonDays: number;
}

/** Полная конфигурация одной студии — ОДИН файл tenants/<slug>/config.ts */
export interface TenantConfig {
  slug: string;
  status: 'draft' | 'published';
  name: string;
  tagline: string;
  description: string;
  /** IANA timezone, например Europe/Moscow */
  timezone: string;
  currency: string; // RUB
  phone: string;
  address: string;
  mapsUrl?: string;
  instagram?: string;
  logoText: string;
  heroPhoto: string;   // photos/hero.jpg
  logoPhoto?: string;
  services: Service[];
  bays: Bay[];
  schedule: DaySchedule[];      // 7 элементов
  holidays: Holiday[];
  infoCards: [InfoCard, InfoCard, InfoCard];
  workPhotos: WorkPhoto[];
  rules: BookingRules;
  assistantExamples: string[];  // примеры вопросов кнопками
}

/** Занятость бокса из БД (интервалы в UTC ISO) */
export interface Occupancy {
  bayId: string;
  startIso: string;
  endIso: string;
  allDay?: boolean; // многодневная запись блокирует весь день
}

export interface Slot {
  /** "YYYY-MM-DD" локальная дата студии */
  day: string;
  /** "HH:MM" локальное время старта */
  time: string;
  /** свободен хотя бы на одном активном боксе */
  free: boolean;
  /** true — занят явно (отмечается в UI) */
  busy: boolean;
  bayIdsFree: string[];
}

export interface DayAvailability {
  day: string;        // YYYY-MM-DD локально
  weekdayName: string;
  isWorking: boolean;
  closedReason?: string;
  slots: Slot[];
}

export type BookingStatus =
  | 'confirmed'
  | 'received'   // машина принята
  | 'done'       // работа завершена
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface Booking {
  id: string;
  tenantSlug: string;
  serviceId: string;
  serviceName: string;
  bayId: string;
  day: string;          // первая дата YYYY-MM-DD (локально)
  startTime: string;    // "HH:MM" локально
  endTime: string;      // "HH:MM" локально (в последний день)
  days: number;
  clientName: string;
  clientPhone: string;
  car: string;
  status: BookingStatus;
  payment: PaymentStatus;
  amount: number;
  note?: string;
  createdAt: string;
}
