const { pool } = require('../db/pool')

// 資料存取層：只放 skill 資料表的 SQL，回傳 pg 原始結果（rows / rowCount）
// 第二個參數 db 預設為 pool，交易中可傳入 client

function findAll(db = pool) {
  return db.query('SELECT id, name FROM skill ORDER BY created_at ASC')
}

function findIdByName(name, db = pool) {
  return db.query('SELECT id FROM skill WHERE name = $1', [name])
}

function insert(name, db = pool) {
  return db.query('INSERT INTO skill (name) VALUES ($1) RETURNING id, name, created_at', [name])
}

function deleteById(skillId, db = pool) {
  return db.query('DELETE FROM skill WHERE id = $1', [skillId])
}

module.exports = { findAll, findIdByName, insert, deleteById }
