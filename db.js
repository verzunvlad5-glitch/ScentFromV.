'use strict';
/* db.js — підключення до SQLite (вбудований модуль node:sqlite), схема й початкові дані. */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  title TEXT NOT NULL,
  ml INTEGER NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  gender TEXT NOT NULL,
  fam TEXT NOT NULL,
  img TEXT NOT NULL,
  w INTEGER NOT NULL DEFAULT 0,
  h INTEGER NOT NULL DEFAULT 0,
  cover INTEGER NOT NULL DEFAULT 0,
  top TEXT NOT NULL DEFAULT '',
  heart TEXT NOT NULL DEFAULT '',
  base TEXT NOT NULL DEFAULT '',
  "desc" TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Прийнято',
  created TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  delivery TEXT NOT NULL,
  ship INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  promo TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL,
  pay TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  c_name TEXT NOT NULL, c_phone TEXT NOT NULL, c_email TEXT NOT NULL,
  c_city TEXT NOT NULL, c_addr TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL, topic TEXT NOT NULL,
  text TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_fam ON products(fam);
`;

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count === 0) seed(db);
  return db;
}

function seed(db) {
  const seed = require('./seed.json');
  const ins = db.prepare(
    'INSERT INTO products (id,brand,title,ml,price,gender,fam,img,w,h,cover,top,heart,base,"desc") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  db.exec('BEGIN');
  try {
    for (const p of seed.products) {
      ins.run(p.id, p.brand, p.title, p.ml, p.price, p.gender, p.fam, p.img, p.w, p.h, p.cover ? 1 : 0, p.top, p.heart, p.base, p.desc);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open };
