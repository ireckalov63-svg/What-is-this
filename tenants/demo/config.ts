import type { TenantConfig } from 'shared';

/**
 * ЕДИНСТВЕННЫЙ файл настроек студии «demo».
 * Название, цены, часы, адрес, телефон, график и фото меняются только здесь.
 */
const config: TenantConfig = {
  slug: 'demo',
  status: 'published',
  name: 'AquaGloss Detailing',
  tagline: 'Детейлинг и кузовной ремонт в Москве',
  description:
    'Керамика, полировка, химчистка и лёгкий кузовной ремонт в двух светлых боксах. ' +
    'Работаем на составах Koch Chemistry, ведём историю обслуживания вашей машины.',
  timezone: 'Europe/Moscow',
  currency: 'RUB',
  phone: '+7 (495) 120-45-67',
  address: 'Москва, ул. Техническая, 12, стр. 3',
  mapsUrl: 'https://maps.google.com/?q=Москва+ул.+Техническая+12',
  instagram: '@aquagloss.msk',
  logoText: 'AG',
  heroPhoto: 'photos/hero.svg',
  services: [
    { id: 'wash', name: 'Комплексная мойка', description: 'Кузов, коврики, стёкла, чернение', price: 2500, durationMin: 90, days: 1, category: 'Мойка', active: true },
    { id: 'polish', name: 'Полировка кузова', description: 'Абразивная + защитная паста', price: 18000, durationMin: 480, days: 1, category: 'Кузов', active: true },
    { id: 'ceramic', name: 'Керамика 12 мес', description: 'Подготовка, 2 слоя, полимеризация', price: 42000, durationMin: 600, days: 2, category: 'Защита', active: true },
    { id: 'dry', name: 'Химчистка салона', description: 'Полная разбортовка, кожа, потолок', price: 12000, durationMin: 360, days: 1, category: 'Салон', active: true },
    { id: 'windows', name: 'Тонировка', description: 'Плёнка Lumark, весь периметр', price: 9000, durationMin: 240, days: 1, category: 'Кузов', active: true },
  ],
  bays: [
    { id: 'bay-1', name: 'Бокс 1 — мойка/полировка', active: true },
    { id: 'bay-2', name: 'Бокс 2 — керамика/салон', active: true },
  ],
  schedule: [
    { weekday: 0, open: '10:00', close: '18:00', working: true },
    { weekday: 1, open: '09:00', close: '21:00', working: true },
    { weekday: 2, open: '09:00', close: '21:00', working: true },
    { weekday: 3, open: '09:00', close: '21:00', working: true },
    { weekday: 4, open: '09:00', close: '21:00', working: true },
    { weekday: 5, open: '09:00', close: '21:00', working: true },
    { weekday: 6, open: '09:00', close: '21:00', working: false },
  ],
  holidays: [{ date: '2026-11-04', reason: 'День народного единства' }],
  infoCards: [
    { icon: 'clock', title: 'Часы работы', text: 'Пн–Пт 09:00–21:00, Вс 10:00–18:00, Сб — выходной' },
    { icon: 'map-pin', title: 'Адрес', text: 'Москва, ул. Техническая, 12, стр. 3. Парковка во дворе' },
    { icon: 'shield', title: 'Гарантия', text: '12 месяцев на керамику, фотофиксация до и после' },
  ],
  workPhotos: [
    { id: 'p1', src: 'photos/work-1.svg', caption: 'Керамика на BMW M3 — эффект мокрых стёкол' },
    { id: 'p2', src: 'photos/work-2.svg', caption: 'Полировка перед продажей Audi A6' },
    { id: 'p3', src: 'photos/work-3.svg', caption: 'Химчистка салона Kia Rio после 5 лет' },
    { id: 'p4', src: 'photos/work-4.svg', caption: 'Тонировка Lumark, Mercedes W206' },
  ],
  rules: { cancelHoursBefore: 4, slotStepMin: 60, bufferMin: 30, minLeadTimeHours: 2, bookingHorizonDays: 21 },
  assistantExamples: ['Когда ближайшее окно?', 'Сколько стоит полировка?', 'Как найти студию?'],
};

export default config;
