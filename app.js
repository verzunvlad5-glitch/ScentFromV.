'use strict';
/* app.js — HTTP-сервер: маршрути REST API + роздача статичних файлів клієнта.
   Без зовнішніх залежностей: лише вбудовані модулі Node.js (http, sqlite, crypto, zlib). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { open } = require('./db');
const sec = require('./security');
const { HttpError, str, check, rule, normPhone } = require('./validators');
const CONFIG = require('./seed.json');

const MAX_QTY = 10;
const PAY = { card: 'Карткою онлайн', cod: 'При отриманні' };
const TOPICS = ['Допомога з вибором аромату', 'Статус замовлення', 'Повернення й обмін', 'Інше'];
const GENDER = Object.fromEntries(CONFIG.genders.map((g) => [g.id, g.name]));
const FAMILY = Object.fromEntries(CONFIG.families.map((f) => [f.id, f.name]));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function createApp({ dbFile, publicDir, adminToken = '' }) {
  const db = open(dbFile);
  const loginLimiter = sec.createLimiter(10, 15 * 60 * 1000);
  const writeLimiter = sec.createLimiter(30, 60 * 1000);

  /* ---------- Допоміжні функції ---------- */
  const productOut = (r) => ({
    id: r.id, brand: r.brand, title: r.title, ml: r.ml, price: r.price,
    gender: r.gender, genderName: GENDER[r.gender] || '', fam: r.fam, famName: FAMILY[r.fam] || '',
    img: r.img, w: r.w, h: r.h, cover: !!r.cover, top: r.top, heart: r.heart, base: r.base, desc: r.desc,
  });
  const userOut = (u) => ({ name: u.name, email: u.email, phone: u.phone, city: u.city });
  const orderCode = (id) => 'SV-' + String(id + 100).padStart(6, '0');
  const orderId = (code) => {
    const m = /^SV-(\d{6})$/.exec(code);
    return m ? Number(m[1]) - 100 : 0;
  };

  function orderOut(o, withAccess) {
    const items = db.prepare('SELECT product_id AS id, title, price, qty FROM order_items WHERE order_id = ?').all(o.id);
    const out = {
      id: orderCode(o.id), date: o.created, status: o.status, delivery: o.delivery, ship: o.ship,
      discount: o.discount, promo: o.promo, total: o.total, pay: o.pay, note: o.note, items,
      contact: { name: o.c_name, phone: o.c_phone, email: o.c_email, city: o.c_city, addr: o.c_addr },
    };
    if (withAccess) out.access = o.access;
    return out;
  }

  function authUser(req) {
    const m = /^Bearer ([\w-]{20,100})$/.exec(req.headers.authorization || '');
    if (!m) return null;
    const row = db
      .prepare('SELECT u.*, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
      .get(sec.sha256(m[1]));
    if (!row || row.expires < Date.now()) return null;
    return row;
  }
  const requireUser = (req) => {
    const u = authUser(req);
    if (!u) throw new HttpError(401, 'Потрібен вхід у профіль');
    return u;
  };
  const requireAdmin = (req) => {
    if (!adminToken) throw new HttpError(403, 'Адміністрування вимкнено (не задано ADMIN_TOKEN)');
    if (!sec.safeEqual(req.headers['x-admin-token'] || '', adminToken)) throw new HttpError(403, 'Недостатньо прав');
  };

  function startSession(userId) {
    const token = sec.newToken();
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?,?,?)')
      .run(sec.sha256(token), userId, Date.now() + sec.SESSION_TTL_MS);
    return token;
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
        return reject(new HttpError(415, 'Очікується Content-Type: application/json'));
      }
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 20 * 1024) { reject(new HttpError(413, 'Тіло запиту завелике')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not object');
          resolve(body);
        } catch (e) {
          reject(new HttpError(400, 'Некоректний JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  /* ---------- Каталог ---------- */
  function listProducts(query) {
    const where = [];
    const args = [];
    const q = (query.get('q') || '').trim().toLowerCase();
    if (q) {
      where.push('(LOWER(title) LIKE ? ESCAPE \'\\\' OR LOWER(brand) LIKE ? ESCAPE \'\\\')');
      const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
      args.push(like, like);
    }
    for (const [key, col] of [['gender', 'gender'], ['fam', 'fam'], ['brand', 'brand']]) {
      const vals = (query.get(key) || '').split(',').filter(Boolean).slice(0, 20);
      if (vals.length) {
        where.push(`${col} IN (${vals.map(() => '?').join(',')})`);
        args.push(...vals);
      }
    }
    const max = Number(query.get('max'));
    if (Number.isFinite(max) && max > 0) { where.push('price <= ?'); args.push(max); }
    const order = { asc: 'price ASC', desc: 'price DESC', az: 'title COLLATE NOCASE ASC' }[query.get('sort')] || 'id ASC';
    const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
    return db.prepare(sql).all(...args).map(productOut);
  }

  function productInput(b, partial) {
    const v = {
      brand: str(b.brand), title: str(b.title), ml: Number(b.ml), price: Number(b.price),
      gender: str(b.gender), fam: str(b.fam), img: str(b.img),
      w: Number(b.w) || 0, h: Number(b.h) || 0, cover: b.cover ? 1 : 0,
      top: str(b.top), heart: str(b.heart), base: str(b.base), desc: str(b.desc),
    };
    check({
      brand: v.brand.length >= 2 && v.brand.length <= 60 ? '' : 'Бренд: 2–60 символів',
      title: v.title.length >= 2 && v.title.length <= 80 ? '' : 'Назва: 2–80 символів',
      ml: Number.isInteger(v.ml) && v.ml >= 1 && v.ml <= 1000 ? '' : 'Об’єм: ціле число 1–1000',
      price: Number.isInteger(v.price) && v.price >= 1 && v.price <= 1000000 ? '' : 'Ціна: ціле число 1–1 000 000',
      gender: GENDER[v.gender] ? '' : 'Стать: w, m або u',
      fam: FAMILY[v.fam] ? '' : 'Невідома група аромату',
      img: /^images\/[\w.\-]+\.(jpe?g|png|webp)$/i.test(v.img) ? '' : 'Зображення: шлях виду images/name.jpg',
      desc: v.desc.length <= 600 ? '' : 'Опис: до 600 символів',
    });
    return v;
  }

  /* ---------- Замовлення ---------- */
  function createOrder(b, user) {
    const contact = b.contact && typeof b.contact === 'object' ? b.contact : {};
    const c = { name: str(contact.name), phone: str(contact.phone), email: str(contact.email).toLowerCase(), city: str(contact.city), addr: str(contact.addr) };
    const delivery = CONFIG.delivery[b.deliveryKey];
    const items = Array.isArray(b.items) ? b.items : [];
    const promo = str(b.promo).toUpperCase();
    check({
      'contact.name': rule.name(c.name),
      'contact.phone': rule.phone(c.phone),
      'contact.email': rule.email(c.email),
      'contact.city': rule.text(c.city, 2, 60, 'Вкажіть місто'),
      'contact.addr': b.deliveryKey === 'pickup' || rule.text(c.addr, 5, 150, 'Вкажіть адресу доставки (5–150 символів)') === '' ? '' : 'Вкажіть адресу доставки (5–150 символів)',
      deliveryKey: delivery ? '' : 'Невідомий спосіб доставки',
      pay: PAY[b.pay] ? '' : 'Невідомий спосіб оплати',
      items: items.length >= 1 && items.length <= 50 ? '' : 'Кошик порожній',
      note: str(b.note).length <= 300 ? '' : 'Коментар: до 300 символів',
      promo: !promo || CONFIG.promos[promo] ? '' : 'Невідомий промокод',
    });
    const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
    const lines = [];
    const seen = new Set();
    for (const it of items) {
      const id = Number(it && it.id);
      const qty = Number(it && it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, 'Некоректна кількість', { items: 'Кількість має бути від 1 до ' + MAX_QTY });
      const p = getProduct.get(id);
      if (!p) throw new HttpError(400, 'Товар не знайдено', { items: 'Товар №' + id + ' не існує' });
      if (seen.has(id)) throw new HttpError(400, 'Дублікат товару', { items: 'Товар №' + id + ' повторюється' });
      seen.add(id);
      lines.push({ p, qty });
    }
    // Ціни беруться з БД, а не з клієнта: підміна ціни в запиті неможлива
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const discount = promo ? Math.round((subtotal * CONFIG.promos[promo]) / 100) : 0;
    const ship = delivery.price && subtotal >= CONFIG.freeFrom ? 0 : delivery.price;
    const total = subtotal - discount + ship;
    const access = sec.newToken().slice(0, 24);
    let id;
    db.exec('BEGIN');
    try {
      const r = db.prepare(
        `INSERT INTO orders (access,user_id,created,delivery_key,delivery,ship,discount,promo,total,pay,note,c_name,c_phone,c_email,c_city,c_addr)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(access, user ? user.id : null, new Date().toISOString(), b.deliveryKey, delivery.name, ship, discount, promo, total,
        PAY[b.pay], str(b.note), c.name, normPhone(c.phone), c.email, c.city, b.deliveryKey === 'pickup' ? '' : c.addr);
      id = Number(r.lastInsertRowid);
      const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,title,price,qty) VALUES (?,?,?,?,?)');
      for (const l of lines) insItem.run(id, l.p.id, l.p.title, l.p.price, l.qty);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return orderOut(db.prepare('SELECT * FROM orders WHERE id = ?').get(id), true);
  }

  /* ---------- Маршрути ---------- */
  const routes = [];
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern + '$'), handler });

  route('GET', '/api/health', () => [200, { status: 'ok', time: new Date().toISOString() }]);

  route('GET', '/api/bootstrap', () => [200, {
    products: listProducts(new URLSearchParams()),
    families: CONFIG.families, genders: CONFIG.genders, recommended: CONFIG.recommended,
    freeFrom: CONFIG.freeFrom, promos: CONFIG.promos, delivery: CONFIG.delivery,
  }]);

  route('GET', '/api/products', (ctx) => [200, listProducts(ctx.query)]);
  route('GET', '/api/products/(\\d+)', (ctx, id) => {
    const r = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
    if (!r) throw new HttpError(404, 'Товар не знайдено');
    return [200, productOut(r)];
  });
  route('POST', '/api/products', async (ctx) => {
    requireAdmin(ctx.req);
    const v = productInput(await readBody(ctx.req));
    const r = db.prepare('INSERT INTO products (brand,title,ml,price,gender,fam,img,w,h,cover,top,heart,base,"desc") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(v.brand, v.title, v.ml, v.price, v.gender, v.fam, v.img, v.w, v.h, v.cover, v.top, v.heart, v.base, v.desc);
    return [201, productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(r.lastInsertRowid)))];
  });
  route('PUT', '/api/products/(\\d+)', async (ctx, id) => {
    requireAdmin(ctx.req);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(Number(id))) throw new HttpError(404, 'Товар не знайдено');
    const v = productInput(await readBody(ctx.req));
    db.prepare('UPDATE products SET brand=?,title=?,ml=?,price=?,gender=?,fam=?,img=?,w=?,h=?,cover=?,top=?,heart=?,base=?,"desc"=? WHERE id=?')
      .run(v.brand, v.title, v.ml, v.price, v.gender, v.fam, v.img, v.w, v.h, v.cover, v.top, v.heart, v.base, v.desc, Number(id));
    return [200, productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id)))];
  });
  route('DELETE', '/api/products/(\\d+)', (ctx, id) => {
    requireAdmin(ctx.req);
    const r = db.prepare('DELETE FROM products WHERE id = ?').run(Number(id));
    if (!r.changes) throw new HttpError(404, 'Товар не знайдено');
    return [204, null];
  });

  route('POST', '/api/auth/register', async (ctx) => {
    if (!writeLimiter(ctx.ip)) throw new HttpError(429, 'Забагато запитів, спробуйте пізніше');
    const b = await readBody(ctx.req);
    const name = str(b.name), email = str(b.email).toLowerCase();
    check({ name: rule.name(name), email: rule.email(email), password: rule.password(b.password) });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, 'Профіль із таким email уже існує. Увійдіть.', { email: 'Профіль із таким email уже існує. Увійдіть.' });
    }
    const { hash, salt } = sec.hashPassword(b.password);
    const r = db.prepare('INSERT INTO users (name,email,hash,salt,created) VALUES (?,?,?,?,?)').run(name, email, hash, salt, new Date().toISOString());
    const id = Number(r.lastInsertRowid);
    return [201, { token: startSession(id), user: userOut(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) }];
  });
  route('POST', '/api/auth/login', async (ctx) => {
    const b = await readBody(ctx.req);
    const email = str(b.email).toLowerCase();
    if (!loginLimiter(ctx.ip + '|' + email)) throw new HttpError(429, 'Забагато спроб входу. Зачекайте 15 хвилин.');
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // однакова відповідь і однаковий обсяг роботи для неіснуючого email і хибного пароля
    const ok = u ? sec.verifyPassword(String(b.password || ''), u.hash, u.salt) : (sec.hashPassword('x'), false);
    if (!ok) throw new HttpError(401, 'Невірний email або пароль', { password: 'Невірний email або пароль' });
    return [200, { token: startSession(u.id), user: userOut(u) }];
  });
  route('POST', '/api/auth/logout', (ctx) => {
    const m = /^Bearer ([\w-]{20,100})$/.exec(ctx.req.headers.authorization || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sec.sha256(m[1]));
    return [204, null];
  });
  route('GET', '/api/me', (ctx) => [200, userOut(requireUser(ctx.req))]);
  route('PUT', '/api/me', async (ctx) => {
    const u = requireUser(ctx.req);
    const b = await readBody(ctx.req);
    const name = str(b.name), phone = str(b.phone), city = str(b.city);
    check({ name: rule.name(name), phone: rule.phoneOpt(phone), city: city === '' || (city.length >= 2 && city.length <= 60) ? '' : 'Місто: 2–60 символів' });
    db.prepare('UPDATE users SET name=?, phone=?, city=? WHERE id=?').run(name, phone ? normPhone(phone) : '', city, u.id);
    return [200, userOut(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id))];
  });

  route('POST', '/api/orders', async (ctx) => {
    if (!writeLimiter(ctx.ip)) throw new HttpError(429, 'Забагато запитів, спробуйте пізніше');
    return [201, createOrder(await readBody(ctx.req), authUser(ctx.req))];
  });
  route('GET', '/api/orders', (ctx) => {
    const u = requireUser(ctx.req);
    return [200, db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id).map((o) => orderOut(o))];
  });
  route('GET', '/api/orders/(SV-\\d{6})', (ctx, code) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId(code));
    const u = authUser(ctx.req);
    const token = ctx.query.get('t') || '';
    // замовлення бачить власник або той, хто знає одноразовий токен доступу з посилання
    const allowed = o && ((u && o.user_id === u.id) || (token && sec.safeEqual(token, o.access)));
    if (!allowed) throw new HttpError(404, 'Замовлення не знайдено');
    return [200, orderOut(o)];
  });

  route('POST', '/api/messages', async (ctx) => {
    if (!writeLimiter(ctx.ip)) throw new HttpError(429, 'Забагато запитів, спробуйте пізніше');
    const b = await readBody(ctx.req);
    const name = str(b.name), email = str(b.email), topic = str(b.topic), text = str(b.message);
    check({
      name: rule.name(name), email: rule.email(email),
      topic: TOPICS.includes(topic) ? '' : 'Оберіть тему',
      message: rule.text(text, 10, 500, 'Повідомлення: від 10 до 500 символів'),
    });
    const r = db.prepare('INSERT INTO messages (name,email,topic,text,created) VALUES (?,?,?,?,?)').run(name, email, topic, text, new Date().toISOString());
    return [201, { id: Number(r.lastInsertRowid) }];
  });
  route('GET', '/api/messages', (ctx) => {
    requireAdmin(ctx.req);
    return [200, db.prepare('SELECT id,name,email,topic,text,created FROM messages ORDER BY id DESC LIMIT 200').all()];
  });

  /* ---------- Відповіді ---------- */
  const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  }
  function sendJson(res, status, data) {
    if (data === null) return send(res, status, undefined, { 'Cache-Control': 'no-store' });
    send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  function serveStatic(req, res, pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    if (rel.includes('\0')) return send(res, 400, 'Bad request');
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(publicDir, rel));
    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return send(res, 403, 'Forbidden');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        return send(res, 404, '<!doctype html><meta charset="utf-8"><title>404</title><h1>Сторінку не знайдено</h1><a href="/">На головну</a>', { 'Content-Type': 'text/html; charset=utf-8' });
      }
      const ext = path.extname(file).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
      const headers = { 'Content-Type': type, ETag: etag, 'Cache-Control': /\.(jpe?g|png|webp)$/.test(ext) ? 'public, max-age=86400' : 'no-cache' };
      if (req.headers['if-none-match'] === etag) return send(res, 304, undefined, headers);
      const compressible = /^(text|application\/json|image\/svg)/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (req.method === 'HEAD') return send(res, 200, undefined, headers);
      if (compressible) {
        headers['Content-Encoding'] = 'gzip';
        headers.Vary = 'Accept-Encoding';
        res.writeHead(200, { ...SECURITY_HEADERS, ...headers });
        return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
      }
      res.writeHead(200, { ...SECURITY_HEADERS, ...headers, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    });
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const ctx = { req, query: url.searchParams, ip: req.socket.remoteAddress || '' };
    if (url.pathname.startsWith('/api/')) {
      try {
        const matches = routes.filter((r) => r.re.test(url.pathname));
        if (!matches.length) throw new HttpError(404, 'Маршрут не знайдено');
        const r = matches.find((m) => m.method === req.method);
        if (!r) throw new HttpError(405, 'Метод не дозволено');
        const [status, data] = await r.handler(ctx, ...r.re.exec(url.pathname).slice(1));
        return sendJson(res, status, data);
      } catch (e) {
        if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, fields: e.fields });
        console.error('[помилка]', e); // подробиці лише в лог, клієнту — загальне повідомлення
        return sendJson(res, 500, { error: 'Внутрішня помилка сервера' });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    serveStatic(req, res, url.pathname);
  }

  const server = http.createServer((req, res) => { handler(req, res).catch((e) => { console.error(e); res.destroy(); }); });
  server.requestTimeout = 15000;
  server.on('close', () => db.close());
  return server;
}

module.exports = { createApp };
