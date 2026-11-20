/* auth.js — сторінка «Профіль»: вкладки «Вхід» і «Реєстрація» (компонент із ARIA-ролями
   та керуванням стрілками), кнопки «показати пароль», індикатор надійності пароля,
   валідація форм і автентифікація через сховище. */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var ui = SFV.ui;
  var Auth = SFV.store.Auth;
  var tablist = d.querySelector('[role="tablist"]');
  if (!tablist) return;

  // користувач уже увійшов: відразу в кабінет
  if (Auth.current()) {
    w.location.replace('account.html');
    return;
  }

  /* ---------- Вкладки ---------- */
  var tabs = ui.$$('[role="tab"]', tablist);

  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      d.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }

  tablist.addEventListener('click', function (e) {
    var tab = e.target.closest('[role="tab"]');
    if (tab) select(tab, false);
  });

  // навігація клавіатурою: ← → Home End
  tablist.addEventListener('keydown', function (e) {
    var i = tabs.indexOf(d.activeElement);
    if (i === -1) return;
    var next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[next], true);
  });

  /* ---------- Показати/сховати пароль ---------- */
  ui.$$('input[type="password"]').forEach(function (input) {
    var wrap = d.createElement('div');
    wrap.className = 'input-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.textContent = 'Показати';
    btn.setAttribute('aria-label', 'Показати пароль');
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Сховати' : 'Показати';
      btn.setAttribute('aria-label', show ? 'Сховати пароль' : 'Показати пароль');
    });
    wrap.appendChild(btn);
  });

  /* ---------- Індикатор надійності пароля ---------- */
  var regForm = d.getElementById('register-form');
  var loginForm = d.getElementById('login-form');
  var meter = d.getElementById('pw-meter');
  var meterText = d.getElementById('pw-hint');

  function strength(p) {
    var score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Za-zА-Яа-я]/.test(p) && /\d/.test(p)) score++;
    if (/[A-ZА-Я]/.test(p) && /[^A-Za-zА-Яа-я0-9]/.test(p)) score++;
    return score;
  }

  regForm.elements.password.addEventListener('input', function () {
    var s = this.value ? strength(this.value) : 0;
    var labels = ['', 'Слабкий пароль', 'Середній пароль', 'Добрий пароль', 'Надійний пароль'];
    meter.dataset.level = s;
    meterText.textContent = labels[s] || 'Введіть пароль';
  });

  /* ---------- Форми ---------- */
  SFV.validate.bind(loginForm);
  SFV.validate.bind(regForm);

  function finish() {
    ui.toast('Готово! Переходимо до кабінету');
    w.location.href = 'account.html';
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = SFV.validate.form(loginForm);
    if (errors) {
      SFV.validate.setStatus(loginForm, SFV.validate.summary(errors));
      return;
    }
    SFV.validate.setStatus(loginForm, '');
    Auth.login(loginForm.elements.email.value, loginForm.elements.password.value).then(function (r) {
      if (r.ok) finish();
      else {
        SFV.validate.showError(loginForm.elements[r.field], r.message);
        loginForm.elements[r.field].focus();
      }
    });
  });

  regForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = SFV.validate.form(regForm);
    if (errors) {
      SFV.validate.setStatus(regForm, SFV.validate.summary(errors));
      return;
    }
    SFV.validate.setStatus(regForm, '');
    Auth.register({
      name: regForm.elements.name.value,
      email: regForm.elements.email.value,
      password: regForm.elements.password.value
    }).then(function (r) {
      if (r.ok) finish();
      else {
        SFV.validate.showError(regForm.elements[r.field], r.message);
        regForm.elements[r.field].focus();
      }
    });
  });
})(window, document);
