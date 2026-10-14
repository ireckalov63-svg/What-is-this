# План реализации (проверено через Astryx CLI: build, template, component, docs layout, docs tokens)

## Стек (версии проверены в npm)
- react@19, react-dom@19 (peerdep @astryxdesign/core >= 19)
- @astryxdesign/core@0.7.0 + @astryxdesign/theme-neutral@0.7.0 + @astryxdesign/build@0.7.0 (vite плагин `astryxStylex()` из '@astryxdesign/build/vite')
- @stylexjs/stylex@0.19.1 (peer)
- @phosphor-icons/react@2.1.10
- vite-plugin-pwa, workbox; TanStack Query; Zod; date-fns + date-fns-tz; OpenAI SDK; Supabase (@supabase/supabase-js, @supabase/ssr для кабинета)
- «liquid-gil» в npm отсутствует (404). Реализую настоящий стеклянный эффект (backdrop-filter: blur+saturate + specular border + inset highlights) в модуле `src/lib/glass.ts` под именем пакета-обёртки `liquid-gil` (локальный workspace-пакет), чтобы импорт соответствовал ТЗ.

## Структура
```
/workspace
  package.json (npm workspaces: app, functions, liquid-gil)
  tenants/<slug>/config.ts + photos/*.jpg   ← ЕДИНСТВЕННЫЙ файл настроек студии
  tools/new-tenant.mjs / validate-tenants.mjs / check-live.mjs  ← команды create/check/publish-check
  app/            Vite+React+TS, роутер /s/:tenant/* и /s/:tenant/admin/*
    src/features/{booking,schedule,assistant,owner}/...
    supabase/     schema.sql (RLS), functions (edge): book (rpc транзакция), assistant-chat (OpenAI tool-calling, rate-limit, budget)
  liquid-gil/     локальный пакет стекла
  e2e/            Playwright
  *.test.ts       Vitest (schedule engine, zod, tenant validation)
  vercel.json
```

## Ключевые решения интерфейса (по Astryx-докам)
- Theme: defineTheme({name:'darkflow', color:{accent:'#4690FF'}, neutralStyle:'cool'}), <Theme mode="dark">
- Компоненты: AppShell/Section/VStack/HStack/Grid/Card/Button/Text/Heading/Badge/Token/TextInput/TextArea/Selector/DateInput/Calendar/Chat(ChatLayout+ChatMessageList+ChatMessage+ChatMessageBubble+ChatComposer)/Toast(useToast — работает без провайдера)/SegmentedControl/Divider/Switch/FileInput
- Иконки: Phosphor SVG-компоненты передаются в prop `icon` (поддержано: `IconName | ComponentType<SVGProps>`)
- Низкая навигация: фиксированная панель со стеклом (glass), padding-bottom страницы = высота панели (не перекрывает контент); safe-area-inset
- Hero: Stack — фото + absolutely позиционированная кнопка «Записаться» (движется с фото, overflow:hidden на контейнере => текст соседних секций не просвечивает; на кнопке собственный backdrop-filter + изолированный слой текста)
- Появление секций: IntersectionObserver + CSS transition; @media (prefers-reduced-motion: reduce) — отключается
- PWA: манифест на студию генерируется сервер-функцией/статикой tenants, иконки в public/icons/<slug>/, /manifest.webmanifest отдаётся per-route

## Расписание (серверная правда + клиентский превью того же движка)
- Движок `app/src/features/schedule/engine.ts` (чистый TS, тестируется Vitest, тот же код в edge-функции через общий пакет `shared/`)
- Учёт: график по дням недели, выходные/holidays, длительность услуги, buffer подготовки между машинами, несколько боксов; многодневные услуги блокируют бокс на весь срок (slot'ы внутри занятого периода скрыты/отмечены занятыми)
- Бронь = Postgres RPC `book_slot` (SERIALIZABLE, unique index (tenant_id, bay_id, day, slot) => гонка даёт ровно одну победу); идемпотентность по client_request_id

## Безопасность
- Ключи Supabase service role / OpenAI только в env функций (Vercel), клиент видит лишь anon key + URL (env префикс VITE_ только для публичных)
- RLS: политики по tenant_id; owner-доступ через membership table; клиентские функции читают только слоты/услуги/публичные настройки
- Assistant: сервер делает retrieval (tools: services, availability, bookings-limited, studio-info) ДО ответа LLM; клиентскому ассистенту недоступен список клиентов; owner-assistant read-only; rate limit (per IP/tenant, upstash-free: таблица + pg advisory) и дневной бюджет токенов (model configurable via SERVER env OPENAI_MODEL)

## Tenant onboarding
- `npm run tenant:new <slug>` — копирует шаблон tenants/_template
- `npm run tenant:check` — zod-валидация всех tenants/config.ts + наличие фото/иконок
- `npm run deploy` — vercel; `npm run tenant:verify <url>` — Playwright smoke по готовой ссылке (бронь-поток, glass nav, manifest)
- До проверки студия доступна как образец (?sample=1 / статус draft в конфиге)
