# ScentFromV — інтернет-магазин парфумерії (лабораторна робота № 5)

Повноцінний вебзастосунок: клієнт (HTML/CSS/JS із ЛР 1–4), сервер на Node.js, база даних SQLite, REST API.
Зовнішніх залежностей немає — лише вбудовані модулі Node.js (`http`, `node:sqlite`, `crypto`, `zlib`).

## Запуск
Потрібен Node.js ≥ 22.5. **Сайт працює лише через сервер** — відкриття `index.html` подвійним кліком не підходить (API недоступне).
Найпростіше: Windows — двічі клікнути `start.bat`; macOS/Linux — `./start.sh`; або вручну:
```bash
npm start            # http://localhost:3000
npm test             # 14 автотестів REST API (node:test)
```
Змінні середовища — див. `.env.example` (`PORT`, `DB_FILE`, `ADMIN_TOKEN`).
Адмін-панель: `/admin.html` (токен із `ADMIN_TOKEN`; без нього адміністрування вимкнено).
Тестовий промокод: `SCENT10` (−10 %).

## Архітектура
```
Браузер (public/)  ──fetch/JSON──▶  server/app.js (маршрути REST, валідація, безпека)  ──SQL──▶  SQLite (data/*.db)
```
| Шар | Файли |
|---|---|
| Клієнт | `public/*.html`, `public/css`, `public/js` (`api.js` — Fetch API, `boot.js` — завантаження даних, `store.js`, сторінкові модулі) |
| Сервер | `server/app.js` (маршрути, статика), `server/db.js` (схема, seed), `server/security.js`, `server/validators.js`, `server/index.js` |
| Тести | `test/api.test.js` |

## Модель даних
`users(id, name, email UNIQUE, hash, salt, phone, city, created)` · `sessions(token_hash PK, user_id → users, expires)` ·
`products(id, brand, title, ml, price, gender, fam, img, w, h, cover, top, heart, base, desc)` ·
`orders(id, access, user_id → users NULL, status, created, delivery_key, delivery, ship, discount, promo, total, pay, note, c_*)` ·
`order_items(order_id → orders, product_id, title, price, qty)` · `messages(id, name, email, topic, text, created)`.

## REST API
| Метод і маршрут | Призначення | Доступ |
|---|---|---|
| `GET /api/health` | стан сервера | всі |
| `GET /api/bootstrap` | каталог і довідкові дані | всі |
| `GET /api/products?q=&gender=&fam=&brand=&max=&sort=` | список із фільтрами | всі |
| `GET /api/products/:id` | один товар | всі |
| `POST /api/products` · `PUT /api/products/:id` · `DELETE /api/products/:id` | CRUD каталогу | `X-Admin-Token` |
| `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` | сесії (Bearer-токен) | всі / користувач |
| `GET /api/me` · `PUT /api/me` | профіль | користувач |
| `POST /api/orders` | створити замовлення (суму рахує сервер) | всі |
| `GET /api/orders` | мої замовлення | користувач |
| `GET /api/orders/:SV-000101[?t=токен]` | одне замовлення | власник або за токеном із посилання |
| `POST /api/messages` · `GET /api/messages` | звернення з «Контактів» | всі / `X-Admin-Token` |

Помилки: JSON `{ "error": "...", "fields": { "поле": "повідомлення" } }` зі статусами 400/401/403/404/405/409/413/415/429/500.

## Безпека
Параметризовані SQL-запити; паролі — scrypt із сіллю; токени сесій у БД лише як SHA-256; суми й ціни рахує сервер;
валідація всіх вхідних даних; обмеження тіла запиту (20 КБ), частоти входу й записів; захист від path traversal;
заголовки CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy; секрети — лише зі змінних середовища;
на клієнті всі дані екрануються перед вставкою в DOM. Обмеження: у навчальній версії немає HTTPS (його дає платформа),
CSRF не потрібен (токен у заголовку, не в cookie), лічильники частоти зберігаються в пам’яті процесу.

## Розгортання
- **Render:** репозиторій → *New → Blueprint* (`render.yaml`) або *Web Service*: Build — порожньо, Start — `npm start`, `NODE_VERSION=22`, задати `ADMIN_TOKEN`. На безкоштовному тарифі файлова система тимчасова: для збереження даних підключіть Persistent Disk і вкажіть `DB_FILE` на нього.
- **Docker:** `docker build -t scentfromv . && docker run -p 3000:3000 -e ADMIN_TOKEN=... -v sfv-data:/app/data scentfromv`.
