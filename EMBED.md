# Публичный календарь для elkihome24.ru (Тильда)

Виджет переиспользует `GuestView` из основного приложения — никакой
параллельной кодовой базы. Любые правки в админ-проекте (цвета,
прайсинг, синхронизация с Авито) автоматически попадают в виджет
после пересборки.

## Репозиторий

- GitHub: https://github.com/dk20663/elkihome
- Бандл лежит в папке `dist-embed/` в корне репозитория
- CDN (jsDelivr): https://cdn.jsdelivr.net/gh/dk20663/elkihome@v1/dist-embed/embed.html

## Готовый код для блока T123 в Тильде

```html
<div id="elkihome-calendar-root" style="width:100%;max-width:560px;margin:0 auto"></div>
<script>
(function () {
  var REPO = 'dk20663/elkihome';
  var VERSION = 'v1';
  var c = document.getElementById('elkihome-calendar-root');
  var f = document.createElement('iframe');
  f.src = 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + VERSION + '/dist-embed/embed.html';
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

## Первая публикация (один раз)

1. Убедиться, что репозиторий https://github.com/dk20663/elkihome **публичный**
   (Settings → General → Danger Zone → Change visibility → Public).
   jsDelivr работает только с публичными репозиториями.
2. Открыть https://github.com/dk20663/elkihome/releases/new
3. В поле **Choose a tag** ввести `v1` → **Create new tag: v1 on publish**.
4. Release title: `v1` (или «Публичный календарь — первая версия»).
5. Нажать **Publish release**.
6. Через 1–2 минуты проверить:
   https://cdn.jsdelivr.net/gh/dk20663/elkihome@v1/dist-embed/embed.html
   должен открыться календарь.
7. Вставить HTML-снипет выше в блок **T123** на странице Тильды → Сохранить → Опубликовать.

## Обновление виджета (любые будущие правки)

1. Внести изменения в Lovable (например, поправить `GuestView`, цены, контакты).
2. Бандл `dist-embed/` пересобирается и коммитится автоматически
   (либо вручную: `npm run build:embed`).
3. Открыть https://github.com/dk20663/elkihome/releases/new
4. Новый тег: `v2` (далее `v3`, `v4`…). Publish release.
5. В Тильде в блоке T123 поменять `var VERSION = 'v1';` → `'v2';` → Сохранить → Опубликовать.

Версионирование (`@v1`, `@v2`) даёт две полезные вещи:
- **Кэш jsDelivr навсегда** — страница в Тильде грузится мгновенно.
- **Мгновенный откат** — если что-то сломалось в `v2`, достаточно вернуть `'v1'` в Тильде.

## Альтернатива: всегда последняя версия (без тегов)

Если не хочется создавать релизы — можно использовать ветку `main`:

```js
f.src = 'https://cdn.jsdelivr.net/gh/dk20663/elkihome@main/dist-embed/embed.html';
```

Минусы: jsDelivr кэширует ~12 часов (обновления видны не сразу),
нет возможности откатиться на предыдущую версию одной строкой.
