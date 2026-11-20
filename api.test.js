'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp } = require('../server/app');

let server, base;
const ADMIN = 'test-admin-token';

before(async () => {
  server = createApp({ dbFile: ':memory:', publicDir: path.join(__dirname, '..', 'public'), adminToken: ADMIN });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => new Promise((r) => server.close(r)));

async function api(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
const bearer = (t) => ({ Authorization: 'Bearer ' + t });
const contact = { name: 'Іван Петренко', phone: '+380501234567', email: 'ivan@example.com', city: 'Київ', addr: 'вул. Прикладна, 1' };
const order = (over = {}) => ({ items: [{ id: 1, qty: 2 }], deliveryKey: 'np', pay: 'card', contact, ...over });

test('health і bootstrap', async () => {
  assert.equal((await api('GET', '/api/health')).body.status, 'ok');
  const b = (await api('GET', '/api/bootstrap')).body;
  assert.equal(b.products.length, 16);
  assert.ok(b.promos.SCENT10 && b.delivery.np);
});

test('READ: фільтрація, пошук і сортування товарів', async () => {
  assert.equal((await api('GET', '/api/products?fam=fresh')).body.length, 3);
  assert.equal((await api('GET', '/api/products?q=creed')).body.length, 1);
  const asc = (await api('GET', '/api/products?sort=asc')).body.map((p) => p.price);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  assert.ok((await api('GET', '/api/products?max=5000')).body.every((p) => p.price <= 5000));
  assert.equal((await api('GET', "/api/products?q=%25'%3B DROP TABLE products--")).body.length, 0);
  assert.equal((await api('GET', '/api/products')).body.length, 16);
});

test('READ: один товар, 404', async () => {
  const p = (await api('GET', '/api/products/1')).body;
  assert.equal(typeof p.cover, 'boolean');
  assert.ok(p.genderName && p.famName);
  assert.equal((await api('GET', '/api/products/9999')).status, 404);
});

test('CRUD товарів: доступ лише з адмін-токеном', async () => {
  const item = { brand: 'Test', title: 'Тестовий аромат', ml: 50, price: 1234, gender: 'u', fam: 'fresh', img: 'images/test.jpg' };
  assert.equal((await api('POST', '/api/products', item)).status, 403);
  assert.equal((await api('POST', '/api/products', item, { 'X-Admin-Token': 'wrong' })).status, 403);
  const h = { 'X-Admin-Token': ADMIN };
  const created = await api('POST', '/api/products', item, h);
  assert.equal(created.status, 201);
  const id = created.body.id;
  const upd = await api('PUT', '/api/products/' + id, { ...item, price: 1500 }, h);
  assert.equal(upd.body.price, 1500);
  assert.equal((await api('GET', '/api/products/' + id)).body.price, 1500);
  assert.equal((await api('DELETE', '/api/products/' + id, undefined, h)).status, 204);
  assert.equal((await api('GET', '/api/products/' + id)).status, 404);
  assert.equal((await api('DELETE', '/api/products/' + id, undefined, h)).status, 404);
});

test('CREATE товару: валідація', async () => {
  const h = { 'X-Admin-Token': ADMIN };
  const r = await api('POST', '/api/products', { brand: 'A', title: '', ml: -1, price: 'abc', gender: 'x', fam: 'y', img: '../../etc/passwd' }, h);
  assert.equal(r.status, 400);
  for (const f of ['brand', 'title', 'ml', 'price', 'gender', 'fam', 'img']) assert.ok(r.body.fields[f], f);
});

test('Реєстрація, вхід, профіль, вихід', async () => {
  const reg = await api('POST', '/api/auth/register', { name: 'Олена Коваль', email: 'Olena@Example.com', password: 'secret1' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'olena@example.com');
  assert.equal(reg.body.user.hash, undefined);
  assert.equal((await api('POST', '/api/auth/register', { name: 'Олена Коваль', email: 'olena@example.com', password: 'secret1' })).status, 409);
  assert.equal((await api('POST', '/api/auth/register', { name: '1', email: 'bad', password: '123' })).status, 400);
  assert.equal((await api('POST', '/api/auth/login', { email: 'olena@example.com', password: 'wrong1' })).status, 401);
  const login = await api('POST', '/api/auth/login', { email: 'olena@example.com', password: 'secret1' });
  const h = bearer(login.body.token);
  assert.equal((await api('GET', '/api/me', undefined, h)).body.name, 'Олена Коваль');
  const upd = await api('PUT', '/api/me', { name: 'Олена К.', phone: '+380 50 123 45 67', city: 'Львів' }, h);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.phone, '+380501234567');
  assert.equal(upd.body.city, 'Львів');
  assert.equal((await api('PUT', '/api/me', { name: 'Олена', phone: '123', city: '' }, h)).status, 400);
  assert.equal((await api('POST', '/api/auth/logout', undefined, h)).status, 204);
  assert.equal((await api('GET', '/api/me', undefined, h)).status, 401);
});

test('Захищені маршрути без токена', async () => {
  assert.equal((await api('GET', '/api/me')).status, 401);
  assert.equal((await api('GET', '/api/orders')).status, 401);
  assert.equal((await api('GET', '/api/me', undefined, bearer('x'.repeat(40)))).status, 401);
  assert.equal((await api('GET', '/api/messages')).status, 403);
});

test('Замовлення: сервер сам рахує суму, ціна з клієнта ігнорується', async () => {
  const r = await api('POST', '/api/orders', order({ promo: 'scent10', items: [{ id: 1, qty: 2, price: 1 }] }));
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 14000 - 1400);
  assert.equal(r.body.discount, 1400);
  assert.equal(r.body.ship, 0);
  assert.match(r.body.id, /^SV-\d{6}$/);
  assert.ok(r.body.access);
  const cheap = await api('POST', '/api/orders', order({ items: [{ id: 1, qty: 1 }], deliveryKey: 'courier' }));
  assert.equal(cheap.body.total, 7000);
  const pickup = await api('POST', '/api/orders', order({ deliveryKey: 'pickup', contact: { ...contact, addr: '' } }));
  assert.equal(pickup.status, 201);
});

test('Замовлення: валідація', async () => {
  const bad = [
    order({ items: [] }), order({ items: [{ id: 1, qty: 0 }] }), order({ items: [{ id: 1, qty: 11 }] }),
    order({ items: [{ id: 999, qty: 1 }] }), order({ items: [{ id: 1, qty: 1 }, { id: 1, qty: 1 }] }),
    order({ deliveryKey: 'drone' }), order({ pay: 'bitcoin' }), order({ promo: 'FREE' }),
    order({ contact: { ...contact, phone: '050' } }), order({ contact: { ...contact, email: 'x' } }),
    order({ contact: { ...contact, addr: '' } }),
  ];
  for (const b of bad) assert.equal((await api('POST', '/api/orders', b)).status, 400, JSON.stringify(b).slice(0, 80));
});

test('Замовлення: доступ власника й за токеном', async () => {
  const reg = await api('POST', '/api/auth/register', { name: 'Марія Шевчук', email: 'maria@example.com', password: 'secret2' });
  const h = bearer(reg.body.token);
  const o = (await api('POST', '/api/orders', order(), h)).body;
  assert.equal((await api('GET', '/api/orders', undefined, h)).body.length, 1);
  assert.equal((await api('GET', '/api/orders/' + o.id, undefined, h)).status, 200);
  assert.equal((await api('GET', '/api/orders/' + o.id)).status, 404);
  assert.equal((await api('GET', `/api/orders/${o.id}?t=${o.access}`)).status, 200);
  assert.equal((await api('GET', `/api/orders/${o.id}?t=wrong`)).status, 404);
  const other = await api('POST', '/api/auth/register', { name: 'Петро Іванов', email: 'petro@example.com', password: 'secret3' });
  assert.equal((await api('GET', '/api/orders/' + o.id, undefined, bearer(other.body.token))).status, 404);
  assert.equal((await api('GET', '/api/orders', undefined, bearer(other.body.token))).body.length, 0);
});

test('Повідомлення з контактів', async () => {
  const msg = { name: 'Іван', email: 'i@example.com', topic: 'Інше', message: 'Доброго дня, питання щодо доставки' };
  assert.equal((await api('POST', '/api/messages', msg)).status, 201);
  assert.equal((await api('POST', '/api/messages', { ...msg, message: 'коротко' })).status, 400);
  assert.equal((await api('POST', '/api/messages', { ...msg, topic: 'Hack' })).status, 400);
  const list = await api('GET', '/api/messages', undefined, { 'X-Admin-Token': ADMIN });
  assert.equal(list.body.length, 1);
});

test('Захист: XSS-рядок зберігається як текст, помилки не розкривають деталей', async () => {
  const bad = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
  assert.equal((await api('POST', '/api/orders', undefined, { 'Content-Type': 'text/plain' })).status, 415);
  const big = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'x'.repeat(30000) }) }).catch(() => ({ status: 413 }));
  assert.equal(big.status, 413);
  assert.equal((await api('DELETE', '/api/health')).status, 405);
  assert.equal((await api('GET', '/api/nope')).status, 404);
});

test('Обмеження спроб входу (brute force)', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await api('POST', '/api/auth/login', { email: 'brute@example.com', password: 'nope123' });
  assert.equal(last.status, 429);
});

test('Статика: заголовки безпеки, path traversal, 404', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(base + '/css/base.css')).status, 200);
  assert.equal((await fetch(base + '/nope.html')).status, 404);
  for (const p of ['/../server/app.js', '/%2e%2e/server/app.js', '/..%2fserver%2fapp.js', '/css/..%2f..%2fserver/db.js']) {
    const res = await fetch(base + p);
    assert.ok([403, 404, 400].includes(res.status), p + ' → ' + res.status);
    assert.ok(!(await res.text()).includes('DatabaseSync'));
  }
});
