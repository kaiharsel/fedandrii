# Фонове відео для hero-секції

Покладіть сюди файл і впишіть його шлях у `data-video` в `index.html` та `en.html`:

```html
<div class="hero__bg" data-video="video/hero.mp4" aria-hidden="true">
```

Поки поле порожнє (`data-video=""`), відео не завантажується взагалі — показується
графіка, намальована кодом. Нічого не ламається, зайвих запитів немає.

## Технічні вимоги

| Параметр | Значення |
|---|---|
| Формат | MP4, кодек H.264 (universal) |
| Роздільність | 1920×1080 достатньо; 1280×720 теж норм — фон сильно затемнений |
| Тривалість | 8–15 секунд, **безшовна петля** (останній кадр = перший) |
| Частота | 24–30 fps |
| Звук | видалити доріжку повністю |
| Вага | до 4–6 МБ. Більше — сайт буде довго вантажитись |

Стиснути можна через ffmpeg:

```
ffmpeg -i input.mp4 -an -c:v libx264 -crf 30 -preset slow -vf "scale=1920:-2,fps=30" -movflags +faststart video/hero.mp4
```

## Що промптити в AI-генераторі

Головне правило: фон **не має конкурувати із заголовком**. Ніяких облич,
предметів, тексту, різких контрастів і швидкого руху — інакше «ДИЗАЙН &
РОЗРОБКА» стане нечитабельним. Потрібна повільна абстракція в чорно-білому.

Промпт (англійською — так ці інструменти працюють краще):

```
Abstract dark monochrome background, very slow drifting fine white contour
lines over deep black, subtle topographic wireframe motion, fine film grain,
minimal Swiss design aesthetic, extremely slow camera drift, no text, no
people, no objects, high contrast blacks, seamless loop, cinematic
```

Варіанти, якщо хочеться іншого настрою:

- **Дим / чорнило:** `slow black ink diffusing in water, monochrome, macro, dark background, seamless loop, no objects`
- **Частинки:** `dark abstract particle field drifting slowly, monochrome white dust on black, shallow depth of field, seamless loop`
- **Сітка:** `slowly rotating white wireframe grid on black, minimal, technical, no text, seamless loop`

Генератори, які приймають такий текстовий промпт: Sora, Runway, Kling,
Luma Dream Machine, Pika, Google Veo.

## Після того, як вставите

Затемнення вже налаштоване в CSS (`.hero__scrim`). Якщо відео вийде
заяскравим — підніміть непрозорість там; якщо навпаки задарк — опустіть.
