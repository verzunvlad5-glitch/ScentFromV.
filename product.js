/* product.js — сторінка товару: перевірка кількості, швидке додавання з клавіатури,
   динамічний блок «Ви переглядали». Кнопки «Додати в кошик» і «В обране»
   обробляє делегований обробник у ui.js. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var store = SFV.store;
  var article = d.querySelector('.pdp');
  if (!article) return;

  var id = Number(article.dataset.id);
  var qty = d.getElementById('qty');

  /* Кількість: коректуємо значення, яке ввів користувач */
  qty.addEventListener('change', function () {
    var n = Number(qty.value);
    if (!Number.isInteger(n) || n < 1 || n > store.MAX_QTY) {
      qty.value = 1;
      ui.toast('Кількість має бути цілим числом від 1 до ' + store.MAX_QTY, 'error');
    }
  });

  /* Enter у полі кількості додає товар у кошик */
  qty.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      d.querySelector('[data-action="add"]').click();
    }
  });

  /* «Ви переглядали»: список зберігається між візитами */
  store.Recent.push(id);
  var box = d.getElementById('recent');
  var items = store.Recent.list()
    .filter(function (x) { return x !== id; })
    .slice(0, 4)
    .map(store.byId)
    .filter(Boolean);
  if (box && items.length) {
    box.querySelector('ul').innerHTML = items.map(ui.card).join('');
    box.hidden = false;
    ui.syncFavButtons();
  }
})(window, document);
