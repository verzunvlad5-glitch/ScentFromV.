'use strict';
/* security.js — хешування паролів, токени сесій, обмеження частоти запитів. */
const crypto = require('node:crypto');

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Простий лічильник «N спроб за вікно часу» у пам’яті процесу. */
function createLimiter(max, windowMs) {
  const hits = new Map();
  return function hit(key) {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return list.length <= max;
  };
}

module.exports = { SESSION_TTL_MS, hashPassword, verifyPassword, sha256, newToken, safeEqual, createLimiter };
