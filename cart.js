/* cart.js — сторінка «Кошик»: інтерактивний компонент з динамічним оновленням.
   Зміна кількості, видалення, промокод із перевіркою, прогрес до безкоштовної
   доставки й підсумок перераховуються одразу, без перезавантаження сторінки. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var store = SFV.store;
  var D = SFV.data;
  var Cart = store.Cart;
  var root = d.getElementById('cart-root');
  if (!root) return;

  function lineHtml(l) {
    var p = l.product;
    return (
      '<li class="line">' +
      '<a class="thumb" href="product-' + p.id + '.html" tabindex="-1"><img src="' + p.img + '" width="' + p.w + '" height="' + p.h + '" alt="Флакон ' + ui.esc(p.title) + '"></a>' +
      '<div><p class="brand">' + ui.esc(p.brand) + '</p>' +
      '<h3><a href="product-' + p.id + '.html">' + ui.esc(p.title) + '</a></h3>' +
      '<p class="hint">' + p.ml + ' ml · ' + ui.fmt(p.price) + '</p>' +
      '<div class="line-controls"><div class="stepper">' +
      '<button type="button" data-cart="dec" data-id="' + p.id + '" aria-label="Менше: ' + ui.esc(p.title) + '"' + (l.qty <= 1 ? ' disabled' : '') + '>−</button>' +
      '<input type="number" min="1" max="' + store.MAX_QTY + '" value="' + l.qty + '" data-cart="qty" data-id="' + p.id + '" inputmode="numeric" aria-label="Кількість: ' + ui.esc(p.title) + '">' +
      '<button type="button" data-cart="inc" data-id="' + p.id + '" aria-label="Більше: ' + ui.esc(p.title) + '"' + (l.qty >= store.MAX_QTY ? ' disabled' : '') + '>+</button></div>' +
      '<button type="button" class="link link-btn" data-cart="remove" data-id="' + p.id + '">Видалити</button></div></div>' +
      '<p class="line-sum">' + ui.fmt(l.sum) + '</p></li>'
    );
  }

  function summaryHtml() {
    var sub = Cart.subtotal();
    var discount = Cart.discount();
    var ship = Cart.shipping('np');
    var promo = Cart.promo();
    var left = Math.max(0, D.freeFrom - sub);
    return (
      '<aside class="panel" aria-labelledby="sum-title"><h2 id="sum-title">Ваше замовлення</h2>' +
      '<div class="sum-row"><span>Товари (' + Cart.count() + ')</span><span>' + ui.fmt(sub) + '</span></div>' +
      (discount ? '<div class="sum-row sum-row--discount"><span>Промокод ' + ui.esc(promo) + '</span><span>−' + ui.fmt(discount) + '</span></div>' : '') +
      '<div class="sum-row"><span>Доставка</span><span>' + (ship ? ui.fmt(ship) : 'безкоштовно') + '</span></div>' +
      '<progress class="progress" max="' + D.freeFrom + '" value="' + Math.min(sub, D.freeFrom) + '" aria-label="Прогрес до безкоштовної доставки"></progress>' +
      '<p class="hint">' + (left ? 'До безкоштовної доставки: ' + ui.fmt(left) : 'Безкоштовна доставка діє') + '</p>' +
      '<div class="sum-row sum-row--total"><span>Разом</span><span>' + ui.fmt(sub - discount + ship) + '</span></div>' +
      '<form class="promo-form" id="promo-form" novalidate><div class="field"><label for="promo">Промокод</label>' +
      '<div class="promo"><input class="input" id="promo" name="promo" placeholder="Напр. SCENT10" autocomplete="off" data-rules="required" value="' + ui.esc(promo || '') + '">' +
      '<button class="btn btn--ghost btn--small" type="submit">' + (promo ? 'Змінити' : 'Застосувати') + '</button></div></div></form>' +
      (promo ? '<p class="hint">Застосовано: <b>' + ui.esc(promo) + '</b> (−' + D.promos[promo] + '%) <button type="button" class="link link-btn" data-cart="remove-promo">Прибрати</button></p>' : '') +
      '<a class="btn btn--block btn--spaced" href="checkout.html">Оформити замовлення</a></aside>'
    );
  }

  function render() {
    // запам’ятовуємо елемент у фокусі, щоб повернути його після перемальовування
    var active = d.activeElement;
    var focusKey = active && active.dataset && active.dataset.cart ? [active.dataset.cart, active.dataset.id] : null;

    var lines = Cart.lines();
    if (!lines.length) {
      root.innerHTML = ui.emptyState('Кошик порожній', 'Додайте аромат із каталогу, і він з’явиться тут.', 'catalog.html', 'Обрати аромат');
      return;
    }
    root.innerHTML =
      '<div class="split"><section aria-labelledby="lines-title"><h2 class="sr-only" id="lines-title">Товари в кошику</h2>' +
      '<ul class="lines">' + lines.map(lineHtml).join('') + '</ul>' +
      '<p class="back-link"><a class="link" href="catalog.html">← Продовжити покупки</a> · <button type="button" class="link link-btn" data-cart="clear">Очистити кошик</button></p></section>' +
      summaryHtml() + '</div>';
    SFV.validate.bind(d.getElementById('promo-form'));

    if (focusKey) {
      var again = root.querySelector('[data-cart="' + focusKey[0] + '"][data-id="' + focusKey[1] + '"]:not([disabled])');
      if (again) again.focus();
    }
  }

  /* Делегування: один обробник кліків на контейнер кошика */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cart]');
    if (!t) return;
    var id = Number(t.dataset.id);
    var current = Cart.get()[id] || 1;
    switch (t.dataset.cart) {
      case 'inc': Cart.set(id, current + 1); break;
      case 'dec': Cart.set(id, current - 1); break;
      case 'remove':
        Cart.remove(id);
        ui.toast('Товар видалено з кошика');
        break;
      case 'clear':
        Cart.clear();
        ui.toast('Кошик очищено');
        break;
      case 'remove-promo':
        Cart.removePromo();
        ui.toast('Промокод прибрано');
        break;
      default: break;
    }
  });

  /* Ручне введення кількості */
  root.addEventListener('change', function (e) {
    if (!e.target.matches('[data-cart="qty"]')) return;
    var id = Number(e.target.dataset.id);
    var n = Number(e.target.value);
    if (!Number.isInteger(n) || n < 1 || n > store.MAX_QTY) {
      ui.toast('Кількість має бути цілим числом від 1 до ' + store.MAX_QTY, 'error');
      e.target.value = Cart.get()[id];
      return;
    }
    Cart.set(id, n);
  });

  /* Промокод: перевірка поля і повідомлення про помилку */
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'promo-form') return;
    e.preventDefault();
    var input = d.getElementById('promo');
    if (SFV.validate.form(e.target)) {
      SFV.validate.showError(input, 'Введіть промокод');
      return;
    }
    var result = Cart.applyPromo(input.value);
    if (result.ok) ui.toast(result.message);
    else SFV.validate.showError(input, result.message);
  });

  w.addEventListener('sfv:change', render);
  render();
})(window, document);
