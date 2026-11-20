/* catalog.js — каталог: динамічна фільтрація без перезавантаження сторінки.
   Інтерактивний компонент «Фільтр каталогу»: пошук за назвою/брендом, фільтри за статтю,
   групою аромату й брендом, обмеження ціни, сортування, «чіпси» активних фільтрів,
   порожній стан. Стан фільтрів зберігається в адресі (?q=...&fam=...). */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var D = SFV.data;
  var grid = d.getElementById('grid');
  if (!grid) return;

  var MAX = Math.ceil(Math.max.apply(null, D.products.map(function (p) { return p.price; })) / 500) * 500;
  var NAMES = {};
  D.genders.concat(D.families).forEach(function (x) { NAMES[x.id] = x.name; });

  var state = { q: '', gender: [], fam: [], brand: [], max: MAX, sort: 'rec' };
  var el = {
    form: d.getElementById('filters-form'),
    q: d.getElementById('f-q'),
    max: d.getElementById('f-max'),
    maxOut: d.getElementById('f-max-out'),
    sort: d.getElementById('f-sort'),
    count: d.getElementById('count'),
    chips: d.getElementById('chips'),
    panel: d.getElementById('filters'),
    toggle: d.getElementById('filters-toggle')
  };

  /* ---------- Стан <-> адреса ---------- */
  function list(value) {
    return value ? value.split(',').filter(Boolean) : [];
  }

  function readUrl() {
    var params = new URLSearchParams(w.location.search);
    state.q = params.get('q') || '';
    state.gender = list(params.get('gender'));
    state.fam = list(params.get('fam'));
    state.brand = list(params.get('brand'));
    var max = Number(params.get('max'));
    state.max = max >= 1000 && max <= MAX ? max : MAX;
    state.sort = params.get('sort') || 'rec';
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    ['gender', 'fam', 'brand'].forEach(function (k) {
      if (state[k].length) p.set(k, state[k].join(','));
    });
    if (state.max < MAX) p.set('max', state.max);
    if (state.sort !== 'rec') p.set('sort', state.sort);
    var query = p.toString();
    try {
      w.history.replaceState(null, '', w.location.pathname + (query ? '?' + query : ''));
    } catch (e) {
      /* на деяких файлових адресах history недоступна: це не критично */
    }
  }

  /* ---------- Стан <-> елементи форми ---------- */
  function checked(name) {
    return ui.$$('input[name="' + name + '"]:checked', el.form).map(function (i) { return i.value; });
  }

  function readControls() {
    state.q = el.q.value;
    state.gender = checked('gender');
    state.fam = checked('fam');
    state.brand = checked('brand');
    state.max = Number(el.max.value);
    state.sort = el.sort.value;
  }

  function writeControls() {
    el.q.value = state.q;
    ['gender', 'fam', 'brand'].forEach(function (name) {
      ui.$$('input[name="' + name + '"]', el.form).forEach(function (i) {
        i.checked = state[name].indexOf(i.value) > -1;
      });
    });
    el.max.value = state.max;
    el.sort.value = state.sort;
  }

  /* ---------- Фільтрація й сортування ---------- */
  function visibleProducts() {
    var q = state.q.trim().toLowerCase();
    var result = D.products.filter(function (p) {
      if (q && (p.title + ' ' + p.brand + ' ' + p.famName).toLowerCase().indexOf(q) === -1) return false;
      if (state.gender.length && state.gender.indexOf(p.gender) === -1) return false;
      if (state.fam.length && state.fam.indexOf(p.fam) === -1) return false;
      if (state.brand.length && state.brand.indexOf(p.brand) === -1) return false;
      return p.price <= state.max;
    });
    var sorters = {
      asc: function (a, b) { return a.price - b.price; },
      desc: function (a, b) { return b.price - a.price; },
      az: function (a, b) { return a.title.localeCompare(b.title, 'uk'); }
    };
    if (sorters[state.sort]) result.sort(sorters[state.sort]);
    return result;
  }

  function chipHtml(type, value, label) {
    return '<button type="button" class="chip" data-chip="' + type + '" data-value="' + ui.esc(value) + '" aria-label="Прибрати фільтр: ' + ui.esc(label) + '">' + ui.esc(label) + ' <span aria-hidden="true">×</span></button>';
  }

  function renderChips() {
    var html = '';
    if (state.q.trim()) html += chipHtml('q', '', 'Пошук: ' + state.q.trim());
    ['gender', 'fam'].forEach(function (k) {
      state[k].forEach(function (v) { html += chipHtml(k, v, NAMES[v] || v); });
    });
    state.brand.forEach(function (v) { html += chipHtml('brand', v, v); });
    if (state.max < MAX) html += chipHtml('max', '', 'До ' + ui.fmt(state.max));
    el.chips.innerHTML = html;
    el.chips.hidden = !html;
  }

  function render() {
    var items = visibleProducts();
    grid.innerHTML = items.length
      ? '<ul class="grid">' + items.map(ui.card).join('') + '</ul>'
      : '<div class="empty"><h2>Нічого не знайдено</h2><p>Спробуйте змінити пошуковий запит або послабити фільтри.</p><button type="button" class="btn" data-action="reset-filters">Скинути фільтри</button></div>';
    el.count.textContent = 'Знайдено: ' + items.length + ' ' + ui.plural(items.length, ['аромат', 'аромати', 'ароматів']);
    el.maxOut.textContent = ui.fmt(state.max);
    renderChips();
    writeUrl();
  }

  function reset() {
    state = { q: '', gender: [], fam: [], brand: [], max: MAX, sort: 'rec' };
    writeControls();
    render();
  }

  /* ---------- Обробники подій ---------- */
  var timer;
  el.q.addEventListener('input', function () {
    clearTimeout(timer); // debounce: перемальовуємо через 150 мс після останнього символу
    timer = setTimeout(function () { readControls(); render(); }, 150);
  });
  el.form.addEventListener('change', function (e) {
    // текстове поле вже оброблено подією input; повторне перемальовування при втраті
    // фокуса знищило б кнопку, на яку користувач щойно натиснув
    if (e.target === el.q) return;
    readControls();
    render();
  });
  // <select> сортування лежить поза <form> (зв’язаний атрибутом form), тому слухаємо його окремо
  el.sort.addEventListener('change', function () { readControls(); render(); });
  el.max.addEventListener('input', function () { readControls(); render(); });
  el.form.addEventListener('submit', function (e) { e.preventDefault(); });

  // делегування: кнопки «Скинути» та «чіпси» створюються динамічно
  d.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="reset-filters"]')) {
      reset();
      return;
    }
    var chip = e.target.closest('[data-chip]');
    if (!chip) return;
    var type = chip.dataset.chip;
    if (type === 'q') state.q = '';
    else if (type === 'max') state.max = MAX;
    else state[type] = state[type].filter(function (v) { return v !== chip.dataset.value; });
    writeControls();
    render();
  });

  // на малих екранах панель фільтрів згортається
  if (el.toggle) {
    el.toggle.addEventListener('click', function () {
      var open = el.panel.classList.toggle('is-open');
      el.toggle.setAttribute('aria-expanded', String(open));
    });
  }

  readUrl();
  writeControls();
  render();
})(window, document);
