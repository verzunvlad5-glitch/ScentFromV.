/* admin.js — сторінка адміністратора: повний CRUD каталогу (створення, читання, оновлення,
   видалення товарів) і перегляд звернень. Токен адміністратора зберігається лише в sessionStorage. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var login = d.getElementById('admin-login');
  if (!login) return;

  var app = d.getElementById('admin-app');
  var status = d.getElementById('ad-status');
  var form = d.getElementById('product-form');
  var cancel = d.getElementById('p-cancel');
  var token = '';
  var products = [];

  try {
    token = w.sessionStorage.getItem('sfv_admin') || '';
  } catch (e) {
    token = '';
  }

  function call(method, url, body) {
    return SFV.api.request(method, url, body, { 'X-Admin-Token': token });
  }

  function loadProducts() {
    return SFV.api.request('GET', '/api/products').then(function (list) {
      products = list;
      var rows = list.map(function (p) {
        return '<tr><td>' + p.id + '</td><td>' + ui.esc(p.brand) + '</td><td>' + ui.esc(p.title) + ' ' + p.ml + ' мл</td><td>' + ui.fmt(p.price) + '</td>' +
          '<td><button type="button" class="btn btn--ghost" data-edit="' + p.id + '">Змінити</button><button type="button" class="btn btn--ghost" data-del="' + p.id + '">Видалити</button></td></tr>';
      }).join('');
      d.getElementById('admin-products').innerHTML = '<div class="admin-scroll"><table class="admin-table"><thead><tr><th>ID</th><th>Бренд</th><th>Назва</th><th>Ціна</th><th>Дії</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  }

  function loadMessages() {
    return call('GET', '/api/messages').then(function (list) {
      d.getElementById('admin-messages').innerHTML = list.length
        ? list.map(function (m) {
            return '<article class="order"><header><span>' + ui.esc(m.name) + ' · ' + ui.esc(m.email) + '</span><span class="status">' + ui.esc(m.topic) + '</span></header><p>' + ui.esc(m.text) + '</p></article>';
          }).join('')
        : '<p class="hint">Звернень ще немає.</p>';
    });
  }

  function enter() {
    return loadMessages().then(loadProducts).then(function () {
      login.hidden = true;
      app.hidden = false;
      try { w.sessionStorage.setItem('sfv_admin', token); } catch (e) { /* не критично */ }
    });
  }

  function reset() {
    form.reset();
    form.elements.id.value = '';
    d.getElementById('ad-form-title').textContent = 'Новий товар';
    cancel.hidden = true;
  }

  login.addEventListener('submit', function (e) {
    e.preventDefault();
    token = d.getElementById('ad-token').value;
    enter().catch(function (err) {
      status.textContent = err.status === 403 ? 'Невірний токен або адміністрування вимкнено' : err.message;
      status.hidden = false;
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var id = f.id.value;
    var body = {
      brand: f.brand.value, title: f.title.value, ml: Number(f.ml.value), price: Number(f.price.value),
      gender: f.gender.value, fam: f.fam.value, img: f.img.value, desc: f.desc.value
    };
    var old = products.filter(function (p) { return String(p.id) === id; })[0];
    if (old) ['w', 'h', 'cover', 'top', 'heart', 'base'].forEach(function (k) { body[k] = old[k]; });
    call(id ? 'PUT' : 'POST', '/api/products' + (id ? '/' + id : ''), body).then(
      function () {
        SFV.validate.setStatus(form, '');
        ui.toast(id ? 'Товар оновлено' : 'Товар створено');
        reset();
        loadProducts();
      },
      function (err) {
        var fields = err.fields ? Object.keys(err.fields).map(function (k) { return err.fields[k]; }).join('; ') : '';
        SFV.validate.setStatus(form, fields || err.message, 'error');
      }
    );
  });

  cancel.addEventListener('click', reset);

  d.getElementById('admin-products').addEventListener('click', function (e) {
    var edit = e.target.closest('[data-edit]');
    var del = e.target.closest('[data-del]');
    if (edit) {
      var p = products.filter(function (x) { return String(x.id) === edit.dataset.edit; })[0];
      var f = form.elements;
      ['id', 'brand', 'title', 'ml', 'price', 'gender', 'fam', 'img', 'desc'].forEach(function (k) { f[k].value = p[k]; });
      d.getElementById('ad-form-title').textContent = 'Редагування: ' + p.title;
      cancel.hidden = false;
      f.brand.focus();
    } else if (del && w.confirm('Видалити товар №' + del.dataset.del + '?')) {
      call('DELETE', '/api/products/' + del.dataset.del).then(function () {
        ui.toast('Товар видалено');
        loadProducts();
      }, function (err) { ui.toast(err.message, 'error'); });
    }
  });

  if (token) enter().catch(function () { /* токен застарів: лишається форма входу */ });
})(window, document);
