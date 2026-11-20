/* order-success.js — сторінка підтвердження: показує замовлення, ідентифікатор якого
   передано в адресі (?id=SV-000101). Якщо замовлення не знайдено, виводить повідомлення. */
(function (w, d) {
  'use strict';

  var ui = w.SFV.ui;
  var root = d.getElementById('success-root');
  if (!root) return;

  var params = new URLSearchParams(w.location.search);
  var id = params.get('id');

  function notFound(message) {
    root.innerHTML = ui.emptyState('Замовлення не знайдено', message || 'Перевірте номер замовлення або оформіть нове.', 'catalog.html', 'До каталогу');
  }

  if (!id) {
    notFound();
    return;
  }
  root.innerHTML = '<p class="hint" role="status">Завантажуємо замовлення…</p>';
  w.SFV.store.Orders.get(id, params.get('t')).then(show, function (err) {
    notFound(err.status === 0 ? err.message : undefined);
  });

  function show(order) {
  root.innerHTML =
    '<div class="success"><div class="tick" aria-hidden="true">✓</div>' +
    '<p class="page-title">Дякуємо за замовлення!</p>' +
    '<p class="lede">Номер замовлення <b>' + ui.esc(order.id) + '</b>. Підтвердження буде надіслано на ' + ui.esc(order.contact.email) + '. Сума: <b>' + ui.fmt(order.total) + '</b>.</p>' +
    '<section class="panel" aria-label="Склад замовлення">' +
    order.items.map(function (i) {
      return '<div class="sum-row"><span>' + ui.esc(i.title) + ' × ' + i.qty + '</span><span>' + ui.fmt(i.price * i.qty) + '</span></div>';
    }).join('') +
    (order.discount ? '<div class="sum-row sum-row--discount"><span>Промокод ' + ui.esc(order.promo) + '</span><span>−' + ui.fmt(order.discount) + '</span></div>' : '') +
    '<div class="sum-row"><span>' + ui.esc(order.delivery) + '</span><span>' + (order.ship ? ui.fmt(order.ship) : 'безкоштовно') + '</span></div>' +
    '<div class="sum-row"><span>Оплата</span><span>' + ui.esc(order.pay) + '</span></div></section>' +
    '<a class="btn" href="catalog.html">Продовжити покупки</a> <a class="btn btn--ghost" href="account.html">Мої замовлення</a></div>';
  }
})(window, document);
