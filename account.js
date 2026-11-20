/* account.js — особистий кабінет: захист сторінки (без входу перенаправляє на «Профіль»),
   редагування даних із валідацією, історія замовлень зі сховища, вихід. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var store = SFV.store;
  var root = d.getElementById('account-root');
  if (!root) return;

  var user = null;
  var orders = null; // null — ще завантажуються; [] — порожньо; false — помилка

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function ordersHtml() {
    if (orders === null) return '<p class="hint" role="status">Завантажуємо замовлення…</p>';
    if (orders === false) return '<p class="form-status form-status--error" role="alert">Не вдалося завантажити замовлення. Оновіть сторінку.</p>';
    if (!orders.length) {
      return ui.emptyState('Замовлень ще немає', 'Після оформлення вони з’являться тут.', 'catalog.html', 'До каталогу');
    }
    return orders.map(function (o) {
      return (
        '<article class="order"><header><span>' + ui.esc(o.id) + '</span><span class="status">' + ui.esc(o.status) + '</span></header>' +
        '<p class="hint"><time datetime="' + ui.esc(o.date) + '">' + formatDate(o.date) + '</time> · ' + ui.esc(o.delivery) + '</p>' +
        '<p>' + o.items.map(function (i) { return ui.esc(i.title) + ' × ' + i.qty; }).join(', ') + '</p>' +
        '<b>' + ui.fmt(o.total) + '</b></article>'
      );
    }).join('');
  }

  function render() {
    user = store.Auth.current() || user;
    root.innerHTML =
      '<p class="page-title">Вітаємо, ' + ui.esc(user.name.split(' ')[0]) + '</p>' +
      '<p class="lede lede--spaced">' + ui.esc(user.email) + '</p>' +
      '<div class="two-col"><section class="panel" aria-labelledby="mydata"><h2 id="mydata">Мої дані</h2>' +
      '<form id="account-form" novalidate>' +
      '<div class="field"><label for="a-name">Ім’я та прізвище</label><input id="a-name" name="name" type="text" value="' + ui.esc(user.name) + '" data-rules="required name"></div>' +
      '<div class="field"><label for="a-phone">Телефон</label><input id="a-phone" name="phone" type="tel" value="' + ui.esc(user.phone) + '" placeholder="+380501234567" data-rules="phone"></div>' +
      '<div class="field"><label for="a-city">Місто</label><input id="a-city" name="city" type="text" value="' + ui.esc(user.city) + '" data-rules="min:2"></div>' +
      '<button class="btn" type="submit">Зберегти</button> <button class="btn btn--ghost" type="button" data-action="logout">Вийти</button></form></section>' +
      '<section aria-labelledby="myorders"><h2 class="subheading subheading--flush" id="myorders">Мої замовлення</h2>' + ordersHtml() + '</section></div>';
    SFV.validate.bind(d.getElementById('account-form'));
  }

  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'account-form') return;
    e.preventDefault();
    var form = e.target;
    var errors = SFV.validate.form(form);
    if (errors) {
      SFV.validate.setStatus(form, SFV.validate.summary(errors));
      return;
    }
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    store.Auth.update({
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      city: form.elements.city.value.trim()
    }).then(function (r) {
      if (r.ok) {
        ui.toast('Дані збережено');
        render();
        return;
      }
      btn.disabled = false;
      var input = form.elements[r.field];
      if (input) SFV.validate.showError(input, r.message);
      else SFV.validate.setStatus(form, r.message, 'error');
    });
  });

  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="logout"]')) {
      store.Auth.logout().then(function () {
        w.location.href = 'profile.html';
      });
    }
  });

  // сторінку бачить лише користувач із дійсною сесією; профіль і замовлення беремо із сервера
  store.Auth.refresh().then(function (u) {
    if (!u) {
      w.location.replace('profile.html');
      return;
    }
    user = u;
    render();
    store.Orders.mine().then(
      function (list) {
        orders = list;
        render();
      },
      function () {
        orders = false;
        render();
      }
    );
  });
})(window, document);
