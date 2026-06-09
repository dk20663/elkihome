# Публичный календарь для elkihome24.ru (Тильда)

Виджет переиспользует `GuestView` из основного приложения — никакой
параллельной кодовой базы. Любые правки в админ-проекте (цвета,
прайсинг, синхронизация с Авито) автоматически попадают в виджет
после пересборки.

## Сборка

```bash
npm run build:embed
```

Результат — папка `dist-embed/` со статическим сайтом
(`embed.html` + `assets/*`).

## Хостинг через GitHub + jsDelivr

1. Создать публичный репозиторий, например `elkihome24/calendar-embed`.
2. Скопировать содержимое `dist-embed/` в корень репозитория.
3. Создать релиз / тег: `v1`.
4. Файл будет доступен по адресу:
   `https://cdn.jsdelivr.net/gh/elkihome24/calendar-embed@v1/embed.html`

Чтобы выкатить новую версию — закоммитить новый `dist-embed/`,
повысить тег (`v2`) и поменять `@v1` → `@v2` в Тильде.

## Вставка на Тильду

В блок T123 (HTML) на странице сайта:

```html
<div id="elkihome-calendar-root" style="width:100%"></div>
<script>
(function () {
  var c = document.getElementById('elkihome-calendar-root');
  var f = document.createElement('iframe');
  f.src = 'https://cdn.jsdelivr.net/gh/elkihome24/calendar-embed@v1/embed.html';
  f.style.cssText = 'width:100%;border:0;display:block;min-height:780px;background:transparent';
  f.loading = 'lazy';
  f.setAttribute('title', 'Календарь загрузки Elki Home 24');
  c.appendChild(f);
  window.addEventListener('message', function (e) {
    if (!e || !e.data || e.data.type !== 'elkihome-height') return;
    if (e.source !== f.contentWindow) return;
    f.style.height = Math.max(400, e.data.height) + 'px';
  });
})();
</script>
```

Высота iframe подстраивается автоматически (через `postMessage` из
виджета).

## Что внутри

- Точка входа: `src/embed/main.tsx`
- Обёртка: `src/embed/EmbedApp.tsx` (QueryClient + GuestView с `hideBack`)
- Конфиг сборки: `vite.embed.config.ts`
- Шаблон: `embed.html`

Данные читаются из той же базы (Supabase, view `public_bookings_view`),
синхронизация с Авито работает как обычно — виджет только читает.
