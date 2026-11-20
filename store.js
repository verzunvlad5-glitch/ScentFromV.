/* store.js — збереження стану магазину в браузері (localStorage).
   Об’єкти-«сховища»: Cart (кошик), Favs (обране), Recent (переглянуті),
   Auth (користувачі), Orders (замовлення).
   Будь-яка зміна даних надсилає подію "sfv:change", тому інтерфейс
   (лічильники в шапці, сторінки кошика й обраного) оновлюється сам. */
(function (w) {
  'use strict';

  var SFV = (w.SFV = w.SFV || {});
  var D = SFV.data;
  var PREFIX = 'sfv5_';
  var MAX_QTY = 10;
  var memory = {}; // запасний варіант, якщо localStorage недоступний

  function read(key, fallback) {
    try {
      var raw = w.localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      /* сховище недоступне або пошкоджене */
    }
    return key in memory ? JSON.parse(memory[key]) : fallback;
  }

  function write(key, value) {
    memory[key] = JSON.stringify(value);
    try {
      w.localStorage.setItem(PREFIX + key, memory[key]);
    } catch (e) {
      /* працюємо лише з пам’яттю сторінки */
    }
  }

  function notify() {
    w.dispatchEvent(new CustomEvent('sfv:change'));
  }

  function byId(id) {
    id = Number(id);
    for (var i = 0; i < D.products.length; i++) {
      if (D.products[i].id === id) return D.products[i];
    }
    return null;
  }

  /* ---------- Кошик ---------- */
  var Cart = {
    get: function () {
      return read('cart', {});
    },
    add: function (id, qty) {
      var cart = this.get();
      var key = String(id);
      cart[key] = Math.min(MAX_QTY, (cart[key] || 0) + (qty || 1));
      write('cart', cart);
      notify();
      return cart[key];
    },
    set: function (id, qty) {
      var cart = this.get();
      qty = Math.min(MAX_QTY, Math.floor(qty));
      if (qty < 1) delete cart[String(id)];
      else cart[String(id)] = qty;
      write('cart', cart);
      notify();
    },
    remove: function (id) {
      var cart = this.get();
      delete cart[String(id)];
      write('cart', cart);
      notify();
    },
    clear: function () {
      write('cart', {});
      write('promo', null);
      notify();
    },
    count: function () {
      var cart = this.get();
      return Object.keys(cart).reduce(function (sum, k) {
        return sum + cart[k];
      }, 0);
    },
    lines: function () {
      var cart = this.get();
      return Object.keys(cart)
        .map(function (id) {
          var product = byId(id);
          return product ? { product: product, qty: cart[id], sum: product.price * cart[id] } : null;
        })
        .filter(Boolean);
    },
    subtotal: function () {
      return this.lines().reduce(function (sum, l) {
        return sum + l.sum;
      }, 0);
    },
    promo: function () {
      return read('promo', null);
    },
    applyPromo: function (code) {
      code = String(code || '').trim().toUpperCase();
      if (!code) return { ok: false, message: 'Введіть промокод' };
      if (!D.promos[code]) {
        return { ok: false, message: 'Промокод «' + code + '» не знайдено. Перевірте написання.' };
      }
      write('promo', code);
      notify();
      return { ok: true, message: 'Промокод застосовано: знижка ' + D.promos[code] + '%' };
    },
    removePromo: function () {
      write('promo', null);
      notify();
    },
    discount: function () {
      var code = this.promo();
      return code && D.promos[code] ? Math.round((this.subtotal() * D.promos[code]) / 100) : 0;
    },
    shipping: function (method) {
      var option = D.delivery[method] || D.delivery.np;
      return option.price && this.subtotal() >= D.freeFrom ? 0 : option.price;
    },
    total: function (method) {
      return this.subtotal() - this.discount() + this.shipping(method);
    }
  };

  /* ---------- Обране ---------- */
  var Favs = {
    list: function () {
      return read('favs', []);
    },
    has: function (id) {
      return this.list().indexOf(Number(id)) > -1;
    },
    toggle: function (id) {
      id = Number(id);
      var list = this.list();
      var i = list.indexOf(id);
      if (i > -1) list.splice(i, 1);
      else list.push(id);
      write('favs', list);
      notify();
      return i === -1; // true, якщо товар додано
    },
    clear: function () {
      write('favs', []);
      notify();
    }
  };

  /* ---------- Нещодавно переглянуті ---------- */
  var Recent = {
    list: function () {
      return read('recent', []);
    },
    push: function (id) {
      id = Number(id);
      var list = this.list().filter(function (x) {
        return x !== id;
      });
      list.unshift(id);
      write('recent', list.slice(0, 6));
    }
  };

  /* ---------- Користувачі (дані зберігає сервер, у браузері — лише токен і копія профілю) ---------- */
  var api = SFV.api;

  // перетворює помилку сервера на {ok:false, field, message} для форм
  function failure(err, fallbackField) {
    var fields = err.fields || {};
    var field = Object.keys(fields)[0] || fallbackField;
    return { ok: false, field: field, message: fields[field] || err.message };
  }

  var Auth = {
    current: function () {
      return api.getToken() ? read('user', null) : null;
    },
    register: function (data) {
      return api
        .request('POST', '/api/auth/register', { name: data.name, email: data.email, password: data.password })
        .then(function (r) {
          api.setToken(r.token);
          write('user', r.user);
          notify();
          return { ok: true };
        })
        .catch(function (err) {
          return failure(err, 'email');
        });
    },
    login: function (email, password) {
      return api
        .request('POST', '/api/auth/login', { email: email, password: password })
        .then(function (r) {
          api.setToken(r.token);
          write('user', r.user);
          notify();
          return { ok: true };
        })
        .catch(function (err) {
          return failure(err, 'password');
        });
    },
    logout: function () {
      var done = function () {
        api.setToken(null);
        write('user', null);
        notify();
      };
      return api.request('POST', '/api/auth/logout').then(done, done);
    },
    update: function (fields) {
      return api.request('PUT', '/api/me', fields).then(function (user) {
        write('user', user);
        notify();
        return { ok: true };
      }).catch(function (err) {
        return failure(err, 'name');
      });
    },
    // перевіряє, чи токен ще дійсний (викликається під час завантаження сторінки)
    refresh: function () {
      if (!api.getToken()) return Promise.resolve(null);
      return api.request('GET', '/api/me').then(
        function (user) {
          write('user', user);
          return user;
        },
        function (err) {
          if (err.status === 401) {
            api.setToken(null);
            write('user', null);
          }
          return null;
        }
      );
    }
  };

  /* ---------- Замовлення (на сервері) ---------- */
  var Orders = {
    create: function (data) {
      return api.request('POST', '/api/orders', data);
    },
    get: function (id, token) {
      return api.request('GET', '/api/orders/' + encodeURIComponent(id) + (token ? '?t=' + encodeURIComponent(token) : ''));
    },
    mine: function () {
      return api.request('GET', '/api/orders');
    }
  };

  /* Інші вкладки браузера теж повідомляють про зміни через подію storage */
  w.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf(PREFIX) === 0) notify();
  });

  SFV.store = { Cart: Cart, Favs: Favs, Recent: Recent, Auth: Auth, Orders: Orders, byId: byId, MAX_QTY: MAX_QTY };
})(window);
