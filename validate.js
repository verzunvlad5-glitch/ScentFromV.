/* validate.js — клієнтська перевірка форм.
   Правила задаються в HTML атрибутом data-rules, наприклад:
     <input id="email" data-rules="required email">
     <input id="city"  data-rules="required min:2">
   Помилка показується під полем (клас .field-error), поле отримує
   aria-invalid="true", а у разі помилки фокус переходить на перше хибне поле. */
(function (w, d) {
  'use strict';

  var SFV = (w.SFV = w.SFV || {});

  /* Кожне правило повертає текст помилки або порожній рядок */
  var RULES = {
    required: function (v) {
      return v.trim() ? '' : 'Заповніть це поле';
    },
    name: function (v) {
      var s = v.trim();
      var lettersOnly = /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’.\-\s]+$/.test(s);
      return s.length >= 2 && lettersOnly ? '' : 'Вкажіть ім’я та прізвище літерами (щонайменше 2 символи)';
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Введіть коректний email, наприклад name@example.com';
    },
    phone: function (v) {
      return /^\+?380\d{9}$/.test(v.replace(/[\s\-()]/g, '')) ? '' : 'Введіть номер у форматі +380501234567';
    },
    pass: function (v) {
      if (v.length < 6) return 'Пароль має містити щонайменше 6 символів';
      if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(v) || !/\d/.test(v)) return 'Пароль має містити хоча б одну літеру й одну цифру';
      return '';
    },
    min: function (v, n) {
      var len = v.trim().length;
      return len >= Number(n) ? '' : 'Напишіть щонайменше ' + n + ' символів (зараз ' + len + ')';
    },
    match: function (v, selector, form) {
      var other = form.querySelector(selector);
      return other && v === other.value ? '' : 'Паролі не збігаються';
    }
  };

  /* Поле вважається прихованим, якщо воно вимкнене або лежить усередині [hidden] */
  function isActive(input) {
    return !input.disabled && !input.closest('[hidden]');
  }

  function validateField(input) {
    if (!isActive(input)) return '';
    var rules = (input.dataset.rules || '').split(/\s+/).filter(Boolean);
    var value = input.value;
    // необов’язкове порожнє поле не перевіряємо
    if (!value.trim() && rules.indexOf('required') === -1) return '';
    for (var i = 0; i < rules.length; i++) {
      var parts = rules[i].split(':');
      var rule = RULES[parts[0]];
      if (!rule) continue;
      var message = rule(value, parts[1], input.form);
      if (message) return message;
    }
    return '';
  }

  /* Показ або приховування повідомлення про помилку під полем */
  function showError(input, message) {
    var field = input.closest('.field') || input.parentNode;
    var box = field.querySelector('.field-error');
    if (!box) {
      box = d.createElement('p');
      box.className = 'field-error';
      box.id = 'err-' + (input.id || input.name);
      box.hidden = true;
      field.appendChild(box);
    }
    box.textContent = message || '';
    box.hidden = !message;
    field.classList.toggle('is-invalid', !!message);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', box.id);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function fields(form) {
    return Array.prototype.slice.call(form.querySelectorAll('[data-rules]'));
  }

  /* Перевірка всієї форми. Повертає кількість помилок */
  function validateForm(form) {
    var firstBad = null;
    var count = 0;
    fields(form).forEach(function (input) {
      var message = validateField(input);
      showError(input, message);
      if (message) {
        count++;
        if (!firstBad) firstBad = input;
      }
    });
    if (firstBad) firstBad.focus();
    return count;
  }

  /* Перевірка «наживо»: при виході з поля та під час виправлення помилки */
  function bind(form) {
    form.setAttribute('novalidate', '');
    form.addEventListener('focusout', function (e) {
      if (e.target.matches('[data-rules]')) showError(e.target, validateField(e.target));
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-rules]') && t.getAttribute('aria-invalid') === 'true') {
        showError(t, validateField(t));
      }
    });
  }

  /* Загальне повідомлення для форми (успіх або кількість помилок) */
  function setStatus(form, message, type) {
    var box = form.querySelector('.form-status');
    if (!box) {
      box = d.createElement('p');
      box.className = 'form-status';
      box.setAttribute('role', 'alert');
      form.insertBefore(box, form.firstChild);
    }
    box.textContent = message || '';
    box.hidden = !message;
    box.className = 'form-status form-status--' + (type || 'error');
  }

  function plural(n) {
    var a = n % 10;
    var b = n % 100;
    return a === 1 && b !== 11 ? 'поле' : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'поля' : 'полів';
  }

  SFV.validate = {
    field: validateField,
    form: validateForm,
    bind: bind,
    showError: showError,
    setStatus: setStatus,
    summary: function (count) {
      return 'Виправте ' + count + ' ' + plural(count) + ' у формі';
    }
  };
})(window, document);
