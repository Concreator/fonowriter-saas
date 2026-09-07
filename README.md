# SaaS-лендинг FonoWriter — projects/fonowriter-saas

**Опубликовано: https://concreator.github.io/fonowriter-saas/**
Репозиторий: https://github.com/Concreator/fonowriter-saas (аккаунт Concreator).
Деплой: GitHub Pages (main → /), пересборка автоматическая при каждом push в main (~1 мин).

Источник: код AI-стратега владельца (структура «Слоёный пирог»: hero → как работает → 3 сегмента → доказательство → тарифы → услуга → waitlist → контакты).
Применён как есть + правки координатора (см. ниже). Лендинг услуги с мини-замером живёт отдельно: `projects/fonowriter-landing/`.

## Правки координатора от 2026-09-06
1. **Демо-цифры заменены реальными замерами движка.** Стратег выдумал («Грубый +13.0» и т.п. — движок такого не даёт). Поставлены проверенные значения, proof: `proof/measure.py` (зелёный) + `proof/scales.json`. Скриншоты владельца независимо подтвердили цифры движка.
2. **«48 шкал» → «45 шкал (24 Журавлёва + 21 Левицкого)»** (24+21=45; было в 2 местах).
3. **Убран китайский текст** «白标 отчёт» → «Отчёты под вашим брендом».
4. **Футер:** добавлены реквизиты ИП, телефон, ссылки на /152 и /reglament с `target="_top"` (для iFrame в Tilda).
5. **Формы заменены кнопками ботов** (решение владельца: заявки только в TG/MAX, почту не использовать). Waitlist → «Ранний доступ в TG/MAX» (написать ДОСТУП); услуга → «Написать в TG/MAX» + телефон. Мёртвый JS форм удалён.
6. **Скриншот:** `assets/screenshot-after.png` (локальный) с fallback на внешний URL. **Владелец: положи 2 скриншота из чата в `assets/` как `screenshot-after.png` (рерайт, зелёный) и `screenshot-before.png` (текст до, красный) — после этого fallback можно удалить.**

## Встройка в Tilda (готово к вставке)
На отдельной странице сайта — блок **T123 (HTML-код)**:

```html
<div id="fw-wrap">
  <iframe id="fw-frame" src="https://concreator.github.io/fonowriter-saas/"
    style="width:100%;border:0;" scrolling="no" title="FonoWriter — ЮгСпецСети"></iframe>
</div>
<script>
window.addEventListener('message', function(e){
  if (e.data && e.data.fonowriterHeight) {
    document.getElementById('fw-frame').style.height = (e.data.fonowriterHeight + 20) + 'px';
  }
});
</script>
```

Страница сама сообщает высоту родителю (postMessage) — скролла внутри фрейма не будет.
Проверить на десктопе и мобильном после публикации страницы Tilda.

## Публикация (как было сделано, для повторения)
1. `git init -b main` в папке проекта → commit.
2. `gh repo create fonowriter-saas --public` (аккаунт Concreator) → push.
   Нюанс: системный git подхватывает credentials andreipromarketing-dev из Windows Credential Manager → 403.
   Лечение только для этого репо: `git remote set-url origin https://Concreator:<gh-auth-token>@github.com/Concreator/fonowriter-saas.git`.
   Глобальные настройки не трогать (сломается ohotnik-za-klientami).
3. `gh api repos/Concreator/fonowriter-saas/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'`.
4. Проверка: открыть https://concreator.github.io/fonowriter-saas/ (первый билд ~2 мин).
5. Внимание: Tailwind и шрифты грузятся с CDN — без интернета страница не стилизуется.

## Статус решений (2026-09-06)
- Тарифы Free/990/2490 и услуги 4500/75000+/35000+ — **утверждены владельцем**.
- Заявки — только боты. Перспектива (roadmap): бот сам выставляет счёт и выдаёт одноразовый токен тарифа.
- Открыто: положить скриншоты в `assets/` (см. п.6 выше).
