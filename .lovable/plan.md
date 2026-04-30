# План: мгновенная и актуальная занятость в календаре

## Цель
Гостевой календарь должен показывать занятые/свободные даты максимально быстро, без ложного "пустого" состояния и без риска показать устаревшие данные незаметно для пользователя.

## Подход: SWR + lite-view + prefetch

Три независимые техники, каждая ускоряет свой участок:

1. **SQL-view с минимумом полей** — payload занятости меньше в ~10×
2. **Prefetch до монтирования React** — выигрыш 100-200мс
3. **SWR-кэш с явным индикатором** — мгновенный показ + видимая проверка свежести

## Поведение по решениям пользователя

- **Первый заход (нет кэша):** пустой календарь + тонкая полоска загрузки сверху (как сейчас)
- **Повторный заход, кэш ≤5 мин:** сразу показываем занятость из кэша, ячейки слегка приглушены (opacity 0.85), у заголовка месяца — маленький спиннер. После прихода свежих данных: opacity → 1, спиннер исчезает, изменившиеся ячейки бесшовно обновляются
- **Кэш >5 мин:** считаем устаревшим, ведём себя как при первом заходе
- **Pricing** убираем из стартовой загрузки — грузим только при клике на дату внутри `GuestPriceDetail`

## Технические шаги

### 1. SQL миграция: lite-view для занятости
Создать `public.calendar_occupancy_view` с полями: `id`, `house_id`, `check_in`, `check_out`, `cancelled`, `synced_from`. SECURITY INVOKER, GRANT SELECT для `anon` и `authenticated`. Исключает отменённые с `manual_override=true` уже не нужно — фронт сам фильтрует, view возвращает всё с `cancelled` для корректного отображения красной полоски в админке (но в гостевом фронт игнорирует `cancelled=true`).

### 2. `src/lib/occupancyCache.ts` (новый)
- `readOccupancy()` → `{ data, isFresh } | null` (TTL 5 минут)
- `writeOccupancy(data)` → сохраняет с timestamp
- Хранит только массив объектов lite-view, ключ `elkihome_occupancy_v1`

### 3. `src/lib/prefetch.ts` (новый)
- Сразу при импорте запускает `supabase.from("calendar_occupancy_view").select("*")`
- Экспортирует `occupancyPromise: Promise<Booking[]>`
- При успехе вызывает `writeOccupancy`

### 4. `src/main.tsx`
Добавить `import "./lib/prefetch"` **до** рендера React — fetch стартует в момент парсинга JS.

### 5. `src/components/GuestView.tsx`
- Инициализация `bookings` из `readOccupancy()` (если есть и свежий)
- State `isRefreshing: boolean` (true пока prefetch не разрешился)
- `useEffect`: ждёт `occupancyPromise` → обновляет `bookings`, ставит `isRefreshing=false`, пишет в кэш
- Убрать загрузку `pricing` из стартового `useEffect`
- Передать в `CalendarGrid` пропсы: `bookingsLoading` (true когда нет ни кэша ни данных), `isRefreshing` (true когда показываем кэш и ждём свежее)

### 6. `src/components/GuestPriceDetail.tsx`
Добавить lazy-загрузку `pricing` через `useEffect` при `open=true`, если ещё не загружено. Передать через React Query или локальный state в `GuestView`.

### 7. `src/components/CalendarGrid.tsx`
Новый пропс `isRefreshing?: boolean`:
- При `true` → ячейкам с `cellBg` добавить класс `calendar-cell-refreshing` (opacity 0.85)
- У заголовка месяца (рендерится в `GuestView`) — показать `Loader2` спиннер 14px справа от названия

### 8. `src/index.css`
```css
.calendar-cell-refreshing { opacity: 0.85; transition: opacity 200ms ease; }
```
Полоска `.calendar-loading-bar` уже есть — оставляем для первого захода.

### 9. Обновить `src/hooks/useBookings.ts` (админка)
Подписка на realtime уже есть. Добавить: при любом изменении в `bookings` — инвалидировать кэш `occupancyCache` (вызвать `writeOccupancy(null)` или перезаписать), чтобы при следующем заходе гостя кэш был свежим. Можно через тот же realtime-канал инициировать lite-fetch и обновить кэш.

## Ожидаемый результат

| Сценарий | Время до показа занятости |
|---|---|
| Первый заход | ~150-300мс (видна полоска загрузки) |
| Повторный заход (кэш свежий) | **0мс** (мгновенно, со спиннером проверки) |
| Кэш устарел >5 мин | ~150-300мс (как первый заход) |

Пользователь **никогда не видит ложно-свободные даты без индикации** — либо данные актуальны, либо видна явная проверка/загрузка.

## Файлы

**Новые:**
- `supabase/migrations/<timestamp>_calendar_occupancy_view.sql`
- `src/lib/occupancyCache.ts`
- `src/lib/prefetch.ts`

**Изменяются:**
- `src/main.tsx`
- `src/components/GuestView.tsx`
- `src/components/CalendarGrid.tsx`
- `src/components/GuestPriceDetail.tsx`
- `src/hooks/useBookings.ts`
- `src/index.css`
