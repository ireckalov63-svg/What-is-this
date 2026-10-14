/**
 * Реестр студий. Vite `import.meta.glob` подхватывает tenants/<slug>/config.ts
 * БЕЗ изменения кода приложения: добавил папку — получил студию.
 */
import type { TenantConfig } from 'shared';

const modules = import.meta.glob<string, { default: TenantConfig }>(
  '../../../tenants/*/config.ts',
  { eager: true },
);

export const tenants: Record<string, TenantConfig> = {};
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.match(/tenants\/([^/]+)\/config\.ts$/)?.[1];
  if (slug && slug !== '_template') tenants[slug] = mod.default;
}

export function getTenant(slug: string | undefined): TenantConfig | undefined {
  return slug ? tenants[slug] : undefined;
}

export function tenantAssetUrl(cfg: TenantConfig, rel: string): string {
  // Supabase Storage URL или локальный public/tenants/<slug>/...
  if (/^https?:\/\//.test(rel)) return rel;
  return `/tenants/${cfg.slug}/${rel}`;
}

/** Локальное время студии сейчас: "YYYY-MM-DD" и минуты от полуночи */
export function studioNow(cfg: TenantConfig): { day: string; minOfDay: number; isoUtc: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const minOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  return { day, minOfDay, isoUtc: now.toISOString() };
}
