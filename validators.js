'use strict';
/* validators.js — перевірка вхідних даних на сервері (дублює правила клієнта, але не довіряє йому). */

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NAME = /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’.\-\s]{2,80}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

function check(rules) {
  const errors = {};
  for (const [field, message] of Object.entries(rules)) if (message) errors[field] = message;
  if (Object.keys(errors).length) throw new HttpError(400, 'Некоректні дані', errors);
}

const rule = {
  name: (v) => (NAME.test(v) ? '' : 'Вкажіть ім’я та прізвище літерами (щонайменше 2 символи)'),
  email: (v) => (v.length <= 120 && EMAIL.test(v) ? '' : 'Введіть коректний email'),
  phone: (v) => (/^\+?380\d{9}$/.test(v.replace(/[\s\-()]/g, '')) ? '' : 'Введіть номер у форматі +380501234567'),
  phoneOpt: (v) => (v === '' ? '' : rule.phone(v)),
  password: (v) => {
    if (typeof v !== 'string' || v.length < 6 || v.length > 100) return 'Пароль має містити від 6 до 100 символів';
    return /[A-Za-zА-Яа-я]/.test(v) && /\d/.test(v) ? '' : 'Пароль має містити хоча б одну літеру й одну цифру';
  },
  text: (v, min, max, msg) => (v.length >= min && v.length <= max ? '' : msg),
};

const normPhone = (v) => {
  const digits = v.replace(/[\s\-()]/g, '');
  return '+' + digits.replace(/^\+/, '');
};

module.exports = { HttpError, str, check, rule, normPhone };
