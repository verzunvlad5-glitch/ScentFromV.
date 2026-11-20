/* checkout.js — оформлення замовлення: валідація форми, перерахунок підсумку
   залежно від способу доставки, приховування поля адреси при самовивозі,
   створення замовлення й перехід на сторінку підтвердження. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var store = SFV.store;
  var D = SFV.data;
  var Cart = store.Cart;
  var form = d.getElementById('checkout-form');
  if (!form) return;

  var content = d.getElementById('co-content');
  var emptyBox = d.getElementById('co-empty');
  var summary = d.getElementById('co-summary');
  var addrField = d.getElementById('addr-field');
  var addr = d.getElementById('addr');

  // порожній кошик: форма не потрібна
  if (!Cart.lines().length) {
    content.hidden = true;
    emptyBox.hidden = false;
    return;
  }

  SFV.validate.bind(form);

  function method() {
    return form.querySelector('input[name="delivery"]:checked').value;
  }

  function renderSummary() {
    var m = method();
    var lines = Cart.lines();
    var discount = Cart.discount();
    var ship = Cart.shipping(m);
    summary.innerHTML =
      '<h2 id="co-sum">Ваше замовлення</h2>' +
      lines.map(function (l) {
        return '<div class="sum-row"><span>' + ui.esc(l.product.title) + ' × ' + l.qty + '</span><span>' + ui.fmt(l.sum) + '</span></div>';
      }).join('') +
      (discount ? '<div class="sum-row sum-row--discount"><span>Промокод ' + ui.esc(Cart.promo()) + '</span><span>−' + ui.fmt(discount) + '</span></div>' : '') +
      '<div class="sum-row"><span>Доставка</span><span>' + (ship ? ui.fmt(ship) : 'безкоштовно') + '</span></div>' +
      '<div class="sum-row sum-row--total"><span>Разом</span><span>' + ui.fmt(Cart.total(m)) + '</span></div>' +
      '<button class="btn btn--block btn--spaced" type="submit" id="co-submit">Підтвердити замовлення</button>';
  }

  /* При самовивозі адреса не потрібна: ховаємо поле й вимикаємо його перевірку */
  function toggleAddress() {
    var pickup = method() === 'pickup';
    addrField.hidden = pickup;
    addr.disabled = pickup;
    if (pickup) SFV.validate.showError(addr, '');
  }

  // підставляємо дані авторизованого користувача
  var user = store.Auth.current();
  if (user) {
    form.elements.name.value = user.name;
    form.elements.email.value = user.email;
    form.elements.phone.value = user.phone;
    form.elements.city.value = user.city;
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'delivery') {
      toggleAddress();
      renderSummary();
    }
  });

  // приводимо телефон до єдиного вигляду після виходу з поля
  form.elements.phone.addEventListener('blur', function () {
    var digits = this.value.replace(/[\s\-()]/g, '');
    if (/^\+?380\d{9}$/.test(digits)) this.value = '+' + digits.replace(/^\+/, '');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = SFV.validate.form(form);
    if (errors) {
      SFV.validate.setStatus(form, SFV.validate.summary(errors), 'error');
      return;
    }
    SFV.validate.setStatus(form, '');
    var btn = d.getElementById('co-submit');
    btn.disabled = true; // захист від подвійного натискання
    btn.textContent = 'Оформлюємо…';

    var m = method();
    var pay = form.querySelector('input[name="pay"]:checked');
    // на сервер надсилаємо лише id і кількість: ціни та суму сервер рахує сам
    store.Orders.create({
      items: Cart.lines().map(function (l) {
        return { id: l.product.id, qty: l.qty };
      }),
      deliveryKey: m,
      promo: Cart.promo() || '',
      pay: pay.value,
      note: form.elements.note.value.trim(),
      contact: {
        name: form.elements.name.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: form.elements.email.value.trim(),
        city: form.elements.city.value.trim(),
        addr: m === 'pickup' ? '' : addr.value.trim()
      }
    }).then(
      function (order) {
        Cart.clear();
        w.location.href = 'order-success.html?id=' + encodeURIComponent(order.id) + '&t=' + encodeURIComponent(order.access);
      },
      function (err) {
        btn.disabled = false;
        btn.textContent = 'Підтвердити замовлення';
        var shown = false;
        Object.keys(err.fields || {}).forEach(function (key) {
          var input = form.elements[key.replace('contact.', '')];
          if (input && key.indexOf('contact.') === 0) {
            SFV.validate.showError(input, err.fields[key]);
            shown = true;
          }
        });
        var general = err.fields && (err.fields.items || err.fields.promo || err.fields.pay);
        SFV.validate.setStatus(form, general || (shown ? 'Перевірте виділені поля' : err.message), 'error');
      }
    );
  });

  toggleAddress();
  renderSummary();
})(window, document);
