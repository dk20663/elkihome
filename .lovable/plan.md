# Двухфазная загрузка календаря (без визуальных скачков)

## Принцип

Phase 1 и Phase 2 возвращают **один и тот же тип** `Booking[]` с **одинаковыми полями, важными для раскраски**. Phase 2 — это надмножество Phase 1 (добавляет PII / цены / услуги, но id и occupancy-поля идентичны). Грид работает только с occupancy-полями → подмена данных невидима.

```text
Phase 1 (~100–200 мс, без auth)
  public_bookings_view → Booking[] (occupancy-only, остальные поля = пустые плейсхолдеры)
       ↓
  setBookings(phase1)                  ← цвета появляются
       ↓
Phase 2 (после auth, ~500 мс)
  bookings (full)      → Booking[] (полные данные)
       ↓
  setBookings(phase2)                  ← бесшовно, цвета не меняются
```

## Гарантия консистентности

### Единая нормализация
Создать **одну функцию** `normalizeBooking(raw, source)` в `src/lib/bookingNormalize.ts`:

```ts
export function normalizeBooking(raw: any): Booking {
  return {
    id: raw.id,
    house_id: raw.house_id,
    check_in: raw.check_in,
    check_out: raw.check_out,
    cancelled: raw.cancelled ?? false,
    synced_from: raw.synced_from ?? null,
    // плейсхолдеры — заполняются Phase 2
    guest_name: raw.guest_name ?? "",
    guest_phone: raw.guest_phone ?? "",
    comment: raw.comment ?? "",
    source: raw.source ?? "",
    guest_count: raw.guest_count ?? 0,
    sauna: raw.sauna ?? false,
    plunge_pool: raw.plunge_pool ?? false,
    bath_brooms: raw.bath_brooms ?? false,
    fir_infusion: raw.fir_infusion ?? false,
    citrus_infusion: raw.citrus_infusion ?? false,
    total_price: raw.total_price ?? 0,
    manual_override: raw.manual_override ?? false,
    external_uid: raw.external_uid ?? null,
    created_by: raw.created_by ?? null,
    created_at: raw.created_at ?? "",
    updated_at: raw.updated_at ?? "",
    houses: raw.houses ?? null,
  };
}
```

Используется и в Phase 1 (`public_bookings_view`), и в Phase 2 (`bookings`), и в `prefetch.ts` гостя. Дублирование исчезает.

### Одинаковая фильтрация в `CalendarGrid`
Грид уже считает занятость по `id`, `house_id`, `check_in`, `check_out`, `cancelled`, `synced_from`. Эти поля **обязательно** есть в обеих фазах и приходят из одного и того же источника правды (БД). → Логика занятости автоматически совпадает.

### Отсутствие "перекрашивания"
Условие отсутствия скачка: для брони с тем же `id` все occupancy-поля в Phase 2 = тем же значениям, что в Phase 1. Так как обе фазы читают **ту же таблицу `bookings`** (view — это просто `SELECT` подмножества колонок), значения идентичны. Дополнительно: при подмене сохраняем те же `id` → React-keys стабильны → никаких re-mount эффектов.

## Изменения в коде

### 1. `src/lib/bookingNormalize.ts` (новый)
Единая функция `normalizeBooking` (см. выше).

### 2. `src/hooks/useBookings.ts`
Один хук, два запроса под одним ключом данных:

```ts
export function useBookings() {
  // Phase 1 — стартует немедленно, без auth
  const phase1 = useQuery({
    queryKey: ["bookings", "occupancy"],
    queryFn: async () => {
      const { data } = await supabase.from("public_bookings_view").select("*");
      return (data ?? []).map(normalizeBooking);
    },
    staleTime: 0, gcTime: 0,
  });

  // Phase 2 — после auth
  const phase2 = useQuery({
    queryKey: ["bookings", "full", authReady],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("*, houses(*)").order("check_in");
      return (data ?? []).map(normalizeBooking);
    },
    enabled: authReady,
    staleTime: 0,
  });

  // Бесшовное слияние: Phase 2 побеждает, иначе Phase 1
  const data = phase2.data ?? phase1.data ?? [];
  const isLoading = !phase1.data && !phase2.data;
  const isRefreshing = !!phase1.data && !phase2.data;

  return { data, isLoading, isRefreshing, error: phase2.error ?? phase1.error };
}
```

Realtime-подписка инвалидирует **оба** ключа.

### 3. Гостевой `prefetch.ts`
Удалить локальную нормализацию-плейсхолдеры — заменить на `normalizeBooking`. Логика SWR гостя остаётся.

### 4. Админский UI (`Index.tsx` / места использования `useBookings`)
- Раскраска: использует `data` напрямую — без проверок фазы.
- Действия с деталями (открытие брони, форма): если `isRefreshing && !phase2.data`, при клике показать мини-спиннер до прихода Phase 2 (промис `phase2.refetch()` или ожидание).
- Заголовок месяца: показывать тот же `Loader2`-спиннер, что у гостя, при `isRefreshing`.

### 5. Без приглушения цветов
Класс `calendar-cell-refreshing` **не применять** в админ-режиме — данные актуальные, приглушение создавало бы ложный сигнал "устарело". Только спиннер у месяца.

## Что это даёт

| | Сейчас | После |
|---|---|---|
| Цвета занятости | ~800–1500 мс | ~100–200 мс |
| Визуальные скачки | — | Нет (id и occupancy-поля идентичны между фазами) |
| Дублирование маппинга | в `prefetch.ts` руками | Единая `normalizeBooking` |
| Кэш админа | нет | нет (оба запроса свежие) |

## Файлы

- `src/lib/bookingNormalize.ts` — новый
- `src/hooks/useBookings.ts` — рефакторинг (две query, слияние)
- `src/lib/prefetch.ts` — использовать `normalizeBooking`
- Места, читающие `useBookings()`: обновить деструктуризацию (`{ data, isLoading, isRefreshing }` вместо `data`/`isLoading` от useQuery)
- `src/components/CalendarGrid.tsx` — пробросить `isRefreshing` только как индикатор у заголовка (без `calendar-cell-refreshing` для админа)
