/* favorites.js — сторінка «Обране»: список будується зі сховища.
   Коли користувач прибирає товар серцем, подія sfv:change перемальовує сторінку. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var store = SFV.store;
  var root = d.getElementById('fav-root');
  if (!root) return;

  function render() {
    var items = store.Favs.list().map(store.byId).filter(Boolean);
    if (!items.length) {
      root.innerHTML = ui.emptyState('Тут поки порожньо', 'Натисніть на серце біля аромату, і він з’явиться тут.', 'catalog.html', 'Перейти до каталогу');
      return;
    }
    root.innerHTML =
      '<div class="toolbar"><p class="hint" aria-live="polite">У списку: ' + items.length + ' ' + ui.plural(items.length, ['аромат', 'аромати', 'ароматів']) + '</p>' +
      '<div class="toolbar-actions"><button type="button" class="btn btn--small" data-action="fav-add-all">Додати все в кошик</button>' +
      '<button type="button" class="btn btn--small btn--ghost" data-action="fav-clear">Очистити список</button></div></div>' +
      '<ul class="grid">' + items.map(ui.card).join('') + '</ul>';
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.dataset.action === 'fav-add-all') {
      var ids = store.Favs.list();
      ids.forEach(function (id) { store.Cart.add(id, 1); });
      ui.renderBadges('cart');
      ui.toast('У кошик додано ' + ids.length + ' ' + ui.plural(ids.length, ['товар', 'товари', 'товарів']));
    } else if (t.dataset.action === 'fav-clear') {
      store.Favs.clear();
      ui.toast('Список обраного очищено');
    }
  });

  w.addEventListener('sfv:change', render);
  render();
})(window, document);
